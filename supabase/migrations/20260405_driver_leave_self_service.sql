create or replace function public.submit_driver_leave(
  p_driver_id uuid,
  p_leave_type text,
  p_start_date date,
  p_end_date date,
  p_reason text default null::text
)
returns uuid
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_days integer;
  v_id uuid;
  v_available numeric := 0;
  v_driver_name text;
  v_driver_user_id uuid;
  v_role text := public.get_current_user_role();
begin
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'Enter a valid leave period';
  end if;

  select d.user_id, coalesce(d.full_name, p.full_name, d.license_number)
    into v_driver_user_id, v_driver_name
  from public.drivers d
  left join public.profiles p on p.user_id = d.user_id
  where d.id = p_driver_id;

  if v_driver_user_id is null and v_role not in ('admin', 'transport_supervisor') then
    raise exception 'Driver is not linked to a login account';
  end if;

  if v_role not in ('admin', 'transport_supervisor') and v_driver_user_id <> auth.uid() then
    raise exception 'Not authorized to submit leave for this driver';
  end if;

  v_days := public.count_working_days(p_start_date, p_end_date);

  if v_days <= 0 then
    raise exception 'Leave request must include at least one working day';
  end if;

  perform public.ensure_driver_leave_balance_row(p_driver_id);

  if public.leave_type_deducts_annual(p_leave_type) then
    select s.available_annual_days
      into v_available
    from public.get_driver_leave_balance_snapshot(p_driver_id) s;

    if v_days > floor(coalesce(v_available, 0)) then
      raise exception 'Annual leave exceeds available balance. Available days: %', floor(coalesce(v_available, 0));
    end if;
  end if;

  insert into public.driver_leave_requests (
    driver_id,
    leave_type,
    start_date,
    end_date,
    working_days,
    reason
  )
  values (
    p_driver_id,
    lower(trim(coalesce(p_leave_type, 'annual'))),
    p_start_date,
    p_end_date,
    v_days,
    nullif(trim(coalesce(p_reason, '')), '')
  )
  returning id into v_id;

  if public.leave_type_deducts_annual(p_leave_type) then
    update public.driver_leave_balances
      set days_booked_in = coalesce(days_booked_in, 0) + v_days,
          updated_at = now()
    where driver_id = p_driver_id;
  end if;

  insert into public.notifications (recipient_id, title, body, priority, entity_type, entity_id, is_read)
  select
    p.user_id,
    'Driver leave request',
    coalesce(v_driver_name, 'A driver') || ' submitted ' || initcap(lower(trim(coalesce(p_leave_type, 'leave')))) || ' leave for ' || v_days || ' working day(s).',
    'normal',
    'driver_leave_request',
    v_id::text,
    false
  from public.profiles p
  where p.system_role in ('admin', 'transport_supervisor')
    and coalesce(p.status, 'active') = 'active';

  if v_driver_user_id is not null then
    insert into public.notifications (
      recipient_id,
      title,
      body,
      priority,
      entity_type,
      entity_id,
      is_read
    )
    values (
      v_driver_user_id,
      'Leave request submitted',
      'Your leave request has been sent to transport for review.',
      'normal',
      'driver_leave_request',
      v_id::text,
      false
    );
  end if;

  return v_id;
end;
$function$;

create or replace function public.get_my_driver_leave_dashboard_data()
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_driver public.drivers%rowtype;
  v_profile_name text;
  v_balance public.driver_leave_balances%rowtype;
  v_requests jsonb;
begin
  select d.*
    into v_driver
  from public.drivers d
  where d.user_id = auth.uid()
  limit 1;

  if not found then
    return jsonb_build_object(
      'driver', null,
      'balance', null,
      'requests', '[]'::jsonb
    );
  end if;

  select p.full_name
    into v_profile_name
  from public.profiles p
  where p.user_id = v_driver.user_id;

  perform public.ensure_driver_leave_balance_row(v_driver.id);

  select *
    into v_balance
  from public.driver_leave_balances
  where driver_id = v_driver.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'driver_id', r.driver_id,
        'driver_name', coalesce(v_driver.full_name, v_profile_name, v_driver.license_number),
        'driver_user_id', v_driver.user_id,
        'leave_type', r.leave_type,
        'start_date', r.start_date,
        'end_date', r.end_date,
        'working_days', r.working_days,
        'reason', r.reason,
        'status', r.status,
        'created_at', r.created_at,
        'updated_at', r.updated_at
      )
      order by r.created_at desc
    ),
    '[]'::jsonb
  )
  into v_requests
  from public.driver_leave_requests r
  where r.driver_id = v_driver.id;

  return jsonb_build_object(
    'driver',
    jsonb_build_object(
      'id', v_driver.id,
      'user_id', v_driver.user_id,
      'full_name', coalesce(v_driver.full_name, v_profile_name),
      'license_number', v_driver.license_number,
      'employment_status', v_driver.employment_status,
      'employment_date', v_driver.employment_date,
      'phone', v_driver.phone
    ),
    'balance',
    case
      when v_balance.id is null then null
      else jsonb_build_object(
        'driver_id', v_balance.driver_id,
        'annual_entitlement', v_balance.annual_entitlement,
        'days_taken', v_balance.days_taken,
        'days_booked_in', v_balance.days_booked_in,
        'accrual_start_date', v_balance.accrual_start_date,
        'updated_at', v_balance.updated_at
      )
    end,
    'requests', v_requests
  );
end;
$$;
