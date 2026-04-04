create or replace function public.submit_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_booking public.bookings%rowtype;
  v_requires_finance boolean := false;
begin
  select *
  into v_booking
  from public.bookings
  where id = p_booking_id;

  if not found then
    raise exception 'Booking not found';
  end if;

  if v_booking.created_by <> auth.uid() and not public.is_admin() then
    raise exception 'Not allowed';
  end if;

  if v_booking.status not in ('draft', 'rejected') then
    raise exception 'Only draft/rejected bookings can be submitted';
  end if;

  v_requires_finance :=
    coalesce(v_booking.needs_finance_approval, false)
    or (
      v_booking.trip_end_date is not null
      and v_booking.trip_end_date > v_booking.trip_date
    )
    or (
      v_booking.return_date is not null
      and v_booking.return_date > v_booking.trip_date
    );

  update public.bookings
  set
    requires_finance = v_requires_finance,
    status = case
      when v_requires_finance then 'finance_pending'::booking_status
      else 'submitted'::booking_status
    end,
    expires_at = (
      case
        when v_requires_finance then now() + interval '24 hours'
        else (v_booking.trip_date::timestamp + v_booking.trip_time) - interval '1 hour'
      end
    ),
    expired_at = null
  where id = p_booking_id;

  if v_requires_finance then
    insert into public.notifications(recipient_id, title, body, priority, entity_type, entity_id, created_by)
    select
      p.user_id,
      'Booking Needs Finance Approval',
      'A booking requires finance review before corporate approval.',
      'high',
      'booking',
      p_booking_id,
      auth.uid()
    from public.profiles p
    where p.system_role in ('finance_manager', 'admin')
      and p.status = 'active';
  else
    insert into public.notifications(recipient_id, title, body, priority, entity_type, entity_id, created_by)
    select
      p.user_id,
      'Booking Pending Approval',
      'A booking has been submitted and is awaiting corporate approval.',
      'normal',
      'booking',
      p_booking_id,
      auth.uid()
    from public.profiles p
    where p.system_role in ('corporate_approver', 'admin')
      and p.status = 'active';
  end if;

  perform public.log_audit(
    'booking_submitted',
    'booking',
    p_booking_id,
    jsonb_build_object('requires_finance', v_requires_finance)
  );
end;
$function$;

create or replace function public.finance_review_booking(
  p_booking_id uuid,
  p_action approval_action,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_requester uuid;
  v_purpose text;
  v_trip_date date;
  v_trip_time time;
  v_requester_name text;
  v_approver_name text;
  v_uid uuid;
begin
  if not (public.is_admin() or public.is_finance_manager()) then
    raise exception 'Not allowed';
  end if;

  if not exists (
    select 1
    from public.bookings
    where id = p_booking_id
      and status = 'finance_pending'
  ) then
    raise exception 'Booking not in finance_pending state';
  end if;

  select b.created_by, b.purpose, b.trip_date, b.trip_time, p.full_name
    into v_requester, v_purpose, v_trip_date, v_trip_time, v_requester_name
  from public.bookings b
  left join public.profiles p on p.user_id = b.created_by
  where b.id = p_booking_id;

  select full_name into v_approver_name
  from public.profiles
  where user_id = auth.uid();

  update public.bookings
  set
    status = case when p_action = 'approved' then 'submitted'::booking_status else 'rejected'::booking_status end,
    finance_approved_by = auth.uid(),
    finance_approved_at = now(),
    finance_notes = p_comment,
    requires_finance = true
  where id = p_booking_id;

  if p_action = 'approved' then
    for v_uid in
      select user_id from public._get_role_user_ids('corporate_approver')
      union
      select user_id from public._get_role_user_ids('admin')
    loop
      perform public._notify(
        v_uid,
        'Booking Pending Approval',
        '"' || coalesce(v_purpose, 'A booking') || '" is ready for corporate approval.',
        'booking',
        p_booking_id,
        'normal'
      );
    end loop;
  else
    perform public._notify(
      v_requester,
      'Booking Rejected',
      '"' || coalesce(v_purpose, 'Your booking') || '" rejected by '
        || coalesce(v_approver_name, 'finance')
        || case when p_comment is not null then '. Reason: ' || p_comment else '' end,
      'booking',
      p_booking_id,
      'normal'
    );

    for v_uid in select user_id from public._get_role_user_ids('admin') loop
      perform public._notify(
        v_uid,
        'Booking Rejected',
        '"' || coalesce(v_purpose, 'A booking') || '" from ' || coalesce(v_requester_name, 'staff')
          || ' rejected by ' || coalesce(v_approver_name, 'finance')
          || case when p_comment is not null then '. Reason: ' || p_comment else '' end,
        'booking',
        p_booking_id,
        'normal'
      );
    end loop;
  end if;

  perform public.log_audit(
    case when p_action = 'approved' then 'finance_booking_approved' else 'finance_booking_rejected' end,
    'booking',
    p_booking_id,
    jsonb_build_object('decision', p_action::text, 'comment', p_comment)
  );
end;
$function$;

drop policy if exists bookings_select_visibility_based on public.bookings;
create policy bookings_select_visibility_based
on public.bookings
for select
to public
using (
  public.is_admin()
  or public.is_corporate_approver()
  or public.is_finance_manager()
  or public.is_transport_supervisor()
  or (created_by = auth.uid())
  or public.is_booking_driver(id)
  or public.is_booking_visible_to_user(id)
);

drop policy if exists bookings_update_draft_owner_fields on public.bookings;
create policy bookings_update_draft_owner_fields
on public.bookings
for update
to public
using (
  (created_by = auth.uid())
  or public.is_admin()
  or public.is_finance_manager()
  or public.is_transport_supervisor()
  or public.is_corporate_approver()
)
with check (
  (created_by = auth.uid())
  or public.is_admin()
  or public.is_finance_manager()
  or public.is_transport_supervisor()
  or public.is_corporate_approver()
);

drop policy if exists profiles_privileged_read on public.profiles;
create policy profiles_privileged_read
on public.profiles
for select
to authenticated
using (
  (user_id = auth.uid())
  or public.is_admin()
  or public.is_finance_manager()
  or public.is_transport_supervisor()
  or public.is_corporate_approver()
  or public.is_unit_head()
);
