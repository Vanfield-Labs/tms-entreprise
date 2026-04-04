create or replace function public.submit_maintenance_request(
  p_vehicle_id uuid,
  p_issue_type text default null,
  p_issue_description text default null,
  p_priority text default null,
  p_estimated_cost numeric default null,
  p_scheduled_date date default null,
  p_notes text default null,
  p_requested_by_supervisor boolean default false
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_request_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.maintenance_requests (
    vehicle_id,
    reported_by,
    issue_type,
    issue_description,
    priority,
    estimated_cost,
    scheduled_date,
    notes,
    requested_by_supervisor,
    status
  )
  values (
    p_vehicle_id,
    auth.uid(),
    p_issue_type,
    coalesce(nullif(trim(p_issue_description), ''), 'Maintenance request'),
    p_priority,
    p_estimated_cost,
    p_scheduled_date,
    nullif(trim(p_notes), ''),
    coalesce(p_requested_by_supervisor, false),
    'finance_pending'::maintenance_status
  )
  returning id into v_request_id;

  insert into public.notifications(recipient_id, title, body, priority, entity_type, entity_id, created_by)
  select
    p.user_id,
    'Maintenance Needs Finance Approval',
    'A maintenance request requires finance review before corporate approval.',
    'high',
    'maintenance_request',
    v_request_id,
    auth.uid()
  from public.profiles p
  where p.system_role in ('finance_manager', 'admin')
    and p.status = 'active';

  perform public.log_audit(
    'maintenance_submitted',
    'maintenance_request',
    v_request_id,
    jsonb_build_object(
      'requested_by_supervisor', coalesce(p_requested_by_supervisor, false),
      'issue_type', p_issue_type
    )
  );

  return v_request_id;
end;
$function$;

create or replace function public.finance_review_maintenance(
  p_request_id uuid,
  p_action approval_action,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_reporter uuid;
  v_vehicle text;
  v_issue text;
  v_actor_name text;
  v_uid uuid;
begin
  if not (public.is_admin() or public.is_finance_manager()) then
    raise exception 'Not allowed';
  end if;

  if not exists (
    select 1
    from public.maintenance_requests
    where id = p_request_id
      and status = 'finance_pending'
  ) then
    raise exception 'Maintenance request not in finance_pending state';
  end if;

  select mr.reported_by, v.plate_number, mr.issue_type
    into v_reporter, v_vehicle, v_issue
  from public.maintenance_requests mr
  left join public.vehicles v on v.id = mr.vehicle_id
  where mr.id = p_request_id;

  select full_name into v_actor_name
  from public.profiles
  where user_id = auth.uid();

  update public.maintenance_requests
  set
    status = case
      when p_action = 'approved' then 'reported'::maintenance_status
      else 'finance_rejected'::maintenance_status
    end,
    finance_approved_by = auth.uid(),
    finance_approved_at = now(),
    finance_notes = p_comment,
    updated_at = now()
  where id = p_request_id;

  if p_action = 'approved' then
    insert into public.notifications(recipient_id, title, body, priority, entity_type, entity_id, created_by)
    select
      p.user_id,
      'Maintenance Pending Corporate Approval',
      coalesce(v_vehicle, 'Vehicle')
        || case when v_issue is not null then ' · ' || replace(v_issue, '_', ' ') else '' end
        || ' is ready for corporate approval.',
      'normal',
      'maintenance_request',
      p_request_id,
      auth.uid()
    from public.profiles p
    where p.system_role in ('corporate_approver', 'admin')
      and p.status = 'active';
  else
    perform public._notify(
      v_reporter,
      'Maintenance Request Rejected',
      coalesce(v_vehicle, 'Vehicle')
        || case when v_issue is not null then ' · ' || replace(v_issue, '_', ' ') else '' end
        || ' rejected by finance'
        || case when p_comment is not null then '. Reason: ' || p_comment else '' end
        || '.',
      'maintenance_request',
      p_request_id,
      'normal'
    );
  end if;

  perform public.log_audit(
    case
      when p_action = 'approved' then 'finance_maintenance_approved'
      else 'finance_maintenance_rejected'
    end,
    'maintenance_request',
    p_request_id,
    jsonb_build_object(
      'decision', p_action::text,
      'comment', p_comment,
      'actor', v_actor_name
    )
  );
end;
$function$;

create or replace function public.corporate_review_maintenance(
  p_request_id uuid,
  p_action approval_action,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_reporter uuid;
  v_vehicle text;
  v_issue text;
  v_actor_name text;
  v_uid uuid;
  v_existing_notes text;
begin
  if not (public.is_admin() or public.is_corporate_approver()) then
    raise exception 'Not allowed';
  end if;

  if not exists (
    select 1
    from public.maintenance_requests
    where id = p_request_id
      and status = 'reported'
  ) then
    raise exception 'Maintenance request not in corporate review state';
  end if;

  select mr.reported_by, v.plate_number, mr.issue_type, mr.notes
    into v_reporter, v_vehicle, v_issue, v_existing_notes
  from public.maintenance_requests mr
  left join public.vehicles v on v.id = mr.vehicle_id
  where mr.id = p_request_id;

  select full_name into v_actor_name
  from public.profiles
  where user_id = auth.uid();

  update public.maintenance_requests
  set
    status = case
      when p_action = 'approved' then 'approved'::maintenance_status
      else 'rejected'::maintenance_status
    end,
    approved_by = auth.uid(),
    approved_at = now(),
    notes = case
      when p_comment is null or trim(p_comment) = '' then v_existing_notes
      when v_existing_notes is null or trim(v_existing_notes) = '' then '[Corporate ' || p_action::text || '] ' || trim(p_comment)
      else v_existing_notes || E'\n\n' || '[Corporate ' || p_action::text || '] ' || trim(p_comment)
    end,
    updated_at = now()
  where id = p_request_id;

  if p_action = 'approved' then
    insert into public.notifications(recipient_id, title, body, priority, entity_type, entity_id, created_by)
    select
      p.user_id,
      'Maintenance Approved for Work',
      coalesce(v_vehicle, 'Vehicle')
        || case when v_issue is not null then ' · ' || replace(v_issue, '_', ' ') else '' end
        || ' approved by corporate and ready for maintenance action.',
      'normal',
      'maintenance_request',
      p_request_id,
      auth.uid()
    from public.profiles p
    where p.system_role in ('transport_supervisor', 'admin')
      and p.status = 'active';
  else
    perform public._notify(
      v_reporter,
      'Maintenance Request Rejected',
      coalesce(v_vehicle, 'Vehicle')
        || case when v_issue is not null then ' · ' || replace(v_issue, '_', ' ') else '' end
        || ' rejected by corporate'
        || case when p_comment is not null then '. Reason: ' || p_comment else '' end
        || '.',
      'maintenance_request',
      p_request_id,
      'normal'
    );
  end if;

  perform public.log_audit(
    case
      when p_action = 'approved' then 'corporate_maintenance_approved'
      else 'corporate_maintenance_rejected'
    end,
    'maintenance_request',
    p_request_id,
    jsonb_build_object(
      'decision', p_action::text,
      'comment', p_comment,
      'actor', v_actor_name
    )
  );
end;
$function$;
