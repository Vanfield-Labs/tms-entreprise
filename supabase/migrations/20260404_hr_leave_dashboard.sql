create or replace function public.is_hr_department_member(p_uid uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = 'public'
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = coalesce(p_uid, auth.uid())
      and p.unit_id = 'f14262ab-7490-4958-94a9-dea5b11bf0c5'
      and p.system_role in ('unit_head', 'staff', 'admin')
      and coalesce(p.status, 'active') = 'active'
  );
$$;

create or replace function public.leave_type_deducts_annual(p_leave_type text)
returns boolean
language sql
immutable
as $$
  select lower(coalesce(p_leave_type, '')) = 'annual';
$$;

create or replace function public.next_working_day(p_date date)
returns date
language plpgsql
immutable
as $$
declare
  v_date date := p_date;
begin
  loop
    v_date := v_date + 1;
    exit when extract(dow from v_date) not in (0, 6);
  end loop;

  return v_date;
end;
$$;

create or replace function public.count_working_days(p_start_date date, p_end_date date)
returns integer
language sql
immutable
as $$
  select coalesce(count(*), 0)::integer
  from generate_series(p_start_date, p_end_date, '1 day'::interval) d
  where extract(dow from d) not in (0, 6);
$$;

create or replace function public.ensure_driver_leave_balance_row(p_driver_id uuid)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_employment_date date;
begin
  select d.employment_date
    into v_employment_date
  from public.drivers d
  where d.id = p_driver_id;

  insert into public.driver_leave_balances (
    driver_id,
    annual_entitlement,
    days_taken,
    days_booked_in,
    accrual_start_date,
    updated_at
  )
  values (
    p_driver_id,
    20,
    0,
    0,
    coalesce(v_employment_date, current_date),
    now()
  )
  on conflict (driver_id) do update
    set annual_entitlement = coalesce(public.driver_leave_balances.annual_entitlement, 20),
        accrual_start_date = coalesce(public.driver_leave_balances.accrual_start_date, excluded.accrual_start_date),
        updated_at = now();
end;
$$;

create or replace function public.get_driver_leave_balance_snapshot(
  p_driver_id uuid,
  p_as_of date default current_date
)
returns table (
  annual_entitlement integer,
  accrual_start_date date,
  rollover_days numeric,
  accrued_this_year numeric,
  approved_annual_days integer,
  pending_annual_days integer,
  available_annual_days numeric,
  currently_on_leave boolean,
  current_leave_type text,
  current_leave_end_date date,
  current_resume_date date
)
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_annual_entitlement integer := 20;
  v_employment_date date;
  v_accrual_start_date date;
  v_current_year integer := extract(year from p_as_of)::integer;
  v_year integer;
  v_year_start date;
  v_year_end date;
  v_days_in_year integer;
  v_prior_entitlement numeric := 0;
  v_current_year_entitlement numeric := 0;
  v_approved_before_current integer := 0;
  v_approved_current integer := 0;
  v_pending_current integer := 0;
  v_rollover numeric := 0;
  v_available numeric := 0;
  v_current_leave_type text;
  v_current_leave_end_date date;
  v_current_resume_date date;
begin
  perform public.ensure_driver_leave_balance_row(p_driver_id);

  select
    d.employment_date,
    coalesce(b.annual_entitlement, 20),
    coalesce(b.accrual_start_date, d.employment_date, current_date)
  into
    v_employment_date,
    v_annual_entitlement,
    v_accrual_start_date
  from public.drivers d
  left join public.driver_leave_balances b on b.driver_id = d.id
  where d.id = p_driver_id;

  if v_accrual_start_date is null then
    v_accrual_start_date := p_as_of;
  end if;

  if extract(year from v_accrual_start_date)::integer < v_current_year then
    for v_year in extract(year from v_accrual_start_date)::integer .. v_current_year - 1 loop
      v_year_start := greatest(make_date(v_year, 1, 1), v_accrual_start_date);
      v_year_end := make_date(v_year, 12, 31);
      v_days_in_year := case
        when (mod(v_year, 400) = 0) or (mod(v_year, 4) = 0 and mod(v_year, 100) <> 0) then 366
        else 365
      end;

      if v_year_end >= v_year_start then
        v_prior_entitlement := v_prior_entitlement + (
          v_annual_entitlement::numeric *
          ((v_year_end - v_year_start + 1)::numeric / v_days_in_year::numeric)
        );
      end if;
    end loop;
  end if;

  v_year_start := greatest(make_date(v_current_year, 1, 1), v_accrual_start_date);
  v_days_in_year := case
    when (mod(v_current_year, 400) = 0) or (mod(v_current_year, 4) = 0 and mod(v_current_year, 100) <> 0) then 366
    else 365
  end;

  if p_as_of >= v_year_start then
    v_current_year_entitlement := (
      v_annual_entitlement::numeric *
      ((p_as_of - v_year_start + 1)::numeric / v_days_in_year::numeric)
    );
  end if;

  select coalesce(sum(r.working_days), 0)::integer
    into v_approved_before_current
  from public.driver_leave_requests r
  where r.driver_id = p_driver_id
    and public.leave_type_deducts_annual(r.leave_type)
    and r.status = 'approved'
    and r.start_date < make_date(v_current_year, 1, 1);

  select coalesce(sum(r.working_days), 0)::integer
    into v_approved_current
  from public.driver_leave_requests r
  where r.driver_id = p_driver_id
    and public.leave_type_deducts_annual(r.leave_type)
    and r.status = 'approved'
    and r.start_date >= make_date(v_current_year, 1, 1);

  select coalesce(sum(r.working_days), 0)::integer
    into v_pending_current
  from public.driver_leave_requests r
  where r.driver_id = p_driver_id
    and public.leave_type_deducts_annual(r.leave_type)
    and r.status in ('pending_supervisor', 'pending_corporate', 'pending_hr')
    and r.start_date >= make_date(v_current_year, 1, 1);

  v_rollover := round(greatest(0, v_prior_entitlement - v_approved_before_current), 2);
  v_current_year_entitlement := round(v_current_year_entitlement, 2);
  v_available := round(
    greatest(0, v_rollover + v_current_year_entitlement - v_approved_current - v_pending_current),
    2
  );

  select
    r.leave_type,
    r.end_date,
    public.next_working_day(r.end_date)
  into
    v_current_leave_type,
    v_current_leave_end_date,
    v_current_resume_date
  from public.driver_leave_requests r
  where r.driver_id = p_driver_id
    and r.status = 'approved'
    and p_as_of between r.start_date and r.end_date
  order by r.end_date desc
  limit 1;

  return query
  select
    v_annual_entitlement,
    v_accrual_start_date,
    v_rollover,
    v_current_year_entitlement,
    v_approved_current,
    v_pending_current,
    v_available,
    v_current_leave_end_date is not null,
    v_current_leave_type,
    v_current_leave_end_date,
    v_current_resume_date;
end;
$$;

create or replace function public.get_driver_leave_dashboard_data()
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_role text := public.get_current_user_role();
  v_result jsonb;
begin
  if v_role not in ('admin', 'transport_supervisor', 'corporate_approver') and not public.is_hr_department_member() then
    raise exception 'Not authorized';
  end if;

  select jsonb_build_object(
    'drivers',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'user_id', d.user_id,
          'full_name', coalesce(d.full_name, p.full_name),
          'license_number', d.license_number,
          'employment_status', d.employment_status,
          'employment_date', d.employment_date,
          'phone', d.phone
        )
        order by coalesce(d.full_name, p.full_name), d.license_number
      )
      from public.drivers d
      left join public.profiles p on p.user_id = d.user_id
    ), '[]'::jsonb),
    'balances',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'driver_id', b.driver_id,
          'annual_entitlement', coalesce(b.annual_entitlement, 20),
          'days_taken', coalesce(b.days_taken, 0),
          'days_booked_in', coalesce(b.days_booked_in, 0),
          'accrual_start_date', b.accrual_start_date,
          'updated_at', b.updated_at
        )
        order by b.driver_id
      )
      from public.driver_leave_balances b
    ), '[]'::jsonb),
    'requests',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'driver_id', r.driver_id,
          'driver_name', coalesce(d.full_name, p.full_name, d.license_number),
          'driver_user_id', d.user_id,
          'leave_type', r.leave_type,
          'start_date', r.start_date,
          'end_date', r.end_date,
          'working_days', r.working_days,
          'reason', r.reason,
          'status', r.status,
          'supervisor_id', r.supervisor_id,
          'supervisor_note', r.supervisor_note,
          'supervisor_at', r.supervisor_at,
          'corporate_id', r.corporate_id,
          'corporate_note', r.corporate_note,
          'corporate_at', r.corporate_at,
          'hr_id', r.hr_id,
          'hr_note', r.hr_note,
          'hr_at', r.hr_at,
          'created_at', r.created_at,
          'updated_at', r.updated_at
        )
        order by r.created_at desc
      )
      from public.driver_leave_requests r
      join public.drivers d on d.id = r.driver_id
      left join public.profiles p on p.user_id = d.user_id
    ), '[]'::jsonb)
  )
  into v_result;

  return coalesce(v_result, jsonb_build_object('drivers', '[]'::jsonb, 'balances', '[]'::jsonb, 'requests', '[]'::jsonb));
end;
$$;

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
as $$
declare
  v_days integer;
  v_id uuid;
  v_available numeric := 0;
  v_driver_name text;
begin
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'Enter a valid leave period';
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

  select coalesce(d.full_name, p.full_name, d.license_number)
    into v_driver_name
  from public.drivers d
  left join public.profiles p on p.user_id = d.user_id
  where d.id = p_driver_id;

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

  return v_id;
end;
$$;

create or replace function public.action_driver_leave(
  p_request_id uuid,
  p_action text,
  p_stage text,
  p_note text default null::text
)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_role text := public.get_current_user_role();
  v_new_status text;
  v_request public.driver_leave_requests%rowtype;
  v_driver_name text;
  v_requester_user_id uuid;
begin
  select *
    into v_request
  from public.driver_leave_requests
  where id = p_request_id;

  if not found then
    raise exception 'Leave request not found';
  end if;

  select
    coalesce(d.full_name, p.full_name, d.license_number),
    d.user_id
  into
    v_driver_name,
    v_requester_user_id
  from public.drivers d
  left join public.profiles p on p.user_id = d.user_id
  where d.id = v_request.driver_id;

  if p_stage = 'supervisor' then
    if v_role not in ('admin', 'transport_supervisor') then
      raise exception 'Not authorized';
    end if;
    if v_request.status <> 'pending_supervisor' then
      raise exception 'Leave request is not awaiting supervisor approval';
    end if;

    if p_action = 'approved' then
      v_new_status := 'pending_corporate';
    else
      v_new_status := 'rejected';
    end if;

    update public.driver_leave_requests
      set status = v_new_status,
          supervisor_id = auth.uid(),
          supervisor_note = p_note,
          supervisor_at = now(),
          updated_at = now()
    where id = p_request_id;

    if v_new_status = 'pending_corporate' then
      insert into public.notifications (recipient_id, title, body, priority, entity_type, entity_id, is_read)
      select
        p.user_id,
        'Leave request awaiting corporate approval',
        coalesce(v_driver_name, 'A driver') || ' leave request is ready for corporate review.',
        'normal',
        'driver_leave_request',
        p_request_id::text,
        false
      from public.profiles p
      where p.system_role in ('admin', 'corporate_approver')
        and coalesce(p.status, 'active') = 'active';
    end if;

  elsif p_stage = 'corporate' then
    if v_role not in ('admin', 'corporate_approver') then
      raise exception 'Not authorized';
    end if;
    if v_request.status <> 'pending_corporate' then
      raise exception 'Leave request is not awaiting corporate approval';
    end if;

    if p_action = 'approved' then
      v_new_status := 'pending_hr';
    else
      v_new_status := 'rejected';
    end if;

    update public.driver_leave_requests
      set status = v_new_status,
          corporate_id = auth.uid(),
          corporate_note = p_note,
          corporate_at = now(),
          updated_at = now()
    where id = p_request_id;

    if v_new_status = 'pending_hr' then
      insert into public.notifications (recipient_id, title, body, priority, entity_type, entity_id, is_read)
      select
        p.user_id,
        'Leave request awaiting HR approval',
        coalesce(v_driver_name, 'A driver') || ' leave request is ready for final HR approval.',
        'normal',
        'driver_leave_request',
        p_request_id::text,
        false
      from public.profiles p
      where p.unit_id = 'f14262ab-7490-4958-94a9-dea5b11bf0c5'
        and p.system_role in ('unit_head', 'staff', 'admin')
        and coalesce(p.status, 'active') = 'active';
    end if;

  elsif p_stage = 'hr' then
    if v_role <> 'admin' and not public.is_hr_department_member() then
      raise exception 'Not authorized';
    end if;
    if v_request.status <> 'pending_hr' then
      raise exception 'Leave request is not awaiting HR approval';
    end if;

    if p_action = 'approved' then
      v_new_status := 'approved';
    else
      v_new_status := 'rejected';
    end if;

    update public.driver_leave_requests
      set status = v_new_status,
          hr_id = auth.uid(),
          hr_note = p_note,
          hr_at = now(),
          updated_at = now()
    where id = p_request_id;

    if public.leave_type_deducts_annual(v_request.leave_type) then
      perform public.ensure_driver_leave_balance_row(v_request.driver_id);

      update public.driver_leave_balances
        set days_booked_in = greatest(0, coalesce(days_booked_in, 0) - v_request.working_days),
            days_taken = case
              when v_new_status = 'approved' then coalesce(days_taken, 0) + v_request.working_days
              else coalesce(days_taken, 0)
            end,
            updated_at = now()
      where driver_id = v_request.driver_id;
    end if;
  else
    raise exception 'Unknown leave review stage';
  end if;

  if v_new_status = 'rejected' and public.leave_type_deducts_annual(v_request.leave_type) then
    update public.driver_leave_balances
      set days_booked_in = greatest(0, coalesce(days_booked_in, 0) - v_request.working_days),
          updated_at = now()
    where driver_id = v_request.driver_id;
  end if;

  if v_requester_user_id is not null then
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
      v_requester_user_id,
      'Leave request update',
      case
        when v_new_status = 'pending_corporate' then 'Your leave request has been approved by transport and moved to corporate.'
        when v_new_status = 'pending_hr' then 'Your leave request has been approved by corporate and moved to HR.'
        when v_new_status = 'approved' then 'Your leave request has been approved by HR.'
        else 'Your leave request has been rejected.'
      end,
      case when v_new_status = 'rejected' then 'high' else 'normal' end,
      'driver_leave_request',
      p_request_id::text,
      false
    );
  end if;
end;
$$;
