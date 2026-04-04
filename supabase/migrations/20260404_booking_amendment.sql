create or replace function public.request_booking_amendment(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_booking public.bookings%rowtype;
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

  if v_booking.status in ('dispatched', 'in_progress', 'completed', 'closed') then
    raise exception 'This booking can no longer be amended';
  end if;

  if v_booking.expired_at is not null or (v_booking.expires_at is not null and v_booking.expires_at <= now()) then
    raise exception 'This booking has expired and can no longer be amended';
  end if;

  if v_booking.status = 'draft' then
    return;
  end if;

  update public.bookings
  set
    status = 'draft'::booking_status,
    finance_approved_by = null,
    finance_approved_at = null,
    finance_notes = null,
    expires_at = null,
    expired_at = null
  where id = p_booking_id;

  delete from public.booking_approvals
  where booking_id = p_booking_id;

  perform public.log_audit(
    'booking_reopened_for_amendment',
    'booking',
    p_booking_id,
    jsonb_build_object('previous_status', v_booking.status)
  );
end;
$function$;
