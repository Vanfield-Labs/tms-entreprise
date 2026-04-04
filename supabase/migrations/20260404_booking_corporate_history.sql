create or replace function public.approve_booking(
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
  if not (public.is_admin() or public.is_corporate_approver()) then
    raise exception 'Not allowed';
  end if;

  if not exists (select 1 from public.bookings where id = p_booking_id and status = 'submitted') then
    raise exception 'Booking not in submitted state';
  end if;

  select b.created_by, b.purpose, b.trip_date, b.trip_time, p.full_name
    into v_requester, v_purpose, v_trip_date, v_trip_time, v_requester_name
  from public.bookings b
  left join public.profiles p on p.user_id = b.created_by
  where b.id = p_booking_id;

  select full_name into v_approver_name from public.profiles where user_id = auth.uid();

  insert into public.booking_approvals (booking_id, action, comment, acted_by)
  values (p_booking_id, p_action, p_comment, auth.uid())
  on conflict (booking_id) do update
    set action = excluded.action,
        comment = excluded.comment,
        acted_by = excluded.acted_by,
        acted_at = now();

  update public.bookings
  set status = case when p_action = 'approved' then 'approved'::booking_status else 'rejected'::booking_status end
  where id = p_booking_id;

  if p_action = 'approved' then
    perform public._notify(
      v_requester,
      'Booking Approved ✓',
      '"' || coalesce(v_purpose, 'Your booking') || '"'
        || case when v_trip_date is not null then ' on ' || to_char(v_trip_date, 'DD Mon') else '' end
        || ' approved by ' || coalesce(v_approver_name, 'approver')
        || '. A vehicle will be assigned soon.',
      'booking',
      p_booking_id,
      'normal'
    );

    for v_uid in
      select user_id from public._get_role_user_ids('transport_supervisor')
      union
      select user_id from public._get_role_user_ids('admin')
    loop
      perform public._notify(
        v_uid,
        'Booking Ready to Dispatch 🚗',
        '"' || coalesce(v_purpose, '—') || '" from ' || coalesce(v_requester_name, 'staff')
          || case
            when v_trip_date is not null then
              ' · ' || to_char(v_trip_date, 'DD Mon')
              || case when v_trip_time is not null then ' ' || to_char(v_trip_time, 'HH24:MI') else '' end
            else ''
          end
          || '. Assign vehicle & driver.',
        'booking',
        p_booking_id,
        'normal'
      );
    end loop;
  else
    perform public._notify(
      v_requester,
      'Booking Rejected ✗',
      '"' || coalesce(v_purpose, 'Your booking') || '" rejected by '
        || coalesce(v_approver_name, 'approver')
        || case when p_comment is not null then '. Reason: ' || p_comment else '' end,
      'booking',
      p_booking_id,
      'normal'
    );

    for v_uid in select user_id from public._get_role_user_ids('admin') loop
      perform public._notify(
        v_uid,
        'Booking Rejected ✗',
        '"' || coalesce(v_purpose, '—') || '" from ' || coalesce(v_requester_name, 'staff')
          || ' rejected by ' || coalesce(v_approver_name, 'approver')
          || case when p_comment is not null then '. Reason: ' || p_comment else '' end,
        'booking',
        p_booking_id,
        'normal'
      );
    end loop;
  end if;

  perform public.log_audit(
    case when p_action = 'approved' then 'corporate_booking_approved' else 'corporate_booking_rejected' end,
    'booking',
    p_booking_id,
    jsonb_build_object('decision', p_action::text, 'comment', p_comment)
  );
end;
$function$;
