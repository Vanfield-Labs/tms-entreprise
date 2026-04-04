drop policy if exists maintenance_requests_select on public.maintenance_requests;
create policy maintenance_requests_select
on public.maintenance_requests
for select
to public
using (
  (reported_by = auth.uid())
  or public.is_admin()
  or public.is_finance_manager()
  or public.is_transport_supervisor()
  or public.is_corporate_approver()
);

drop policy if exists maintenance_requests_update_all_privileged on public.maintenance_requests;
create policy maintenance_requests_update_all_privileged
on public.maintenance_requests
for update
to public
using (
  public.is_admin()
  or public.is_finance_manager()
  or public.is_transport_supervisor()
  or public.is_corporate_approver()
)
with check (
  public.is_admin()
  or public.is_finance_manager()
  or public.is_transport_supervisor()
  or public.is_corporate_approver()
);

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
      when p_action = 'approved' then 'approved'::maintenance_status
      else 'rejected'::maintenance_status
    end,
    finance_approved_by = auth.uid(),
    finance_approved_at = now(),
    finance_notes = p_comment,
    updated_at = now()
  where id = p_request_id;

  if p_action = 'approved' then
    for v_uid in
      select user_id from public._get_role_user_ids('transport_supervisor')
      union
      select user_id from public._get_role_user_ids('admin')
    loop
      perform public._notify(
        v_uid,
        'Maintenance Approved for Work',
        coalesce(v_vehicle, 'Vehicle')
          || case when v_issue is not null then ' · ' || replace(v_issue, '_', ' ') else '' end
          || ' approved by finance and ready for maintenance action.',
        'maintenance_request',
        p_request_id,
        'normal'
      );
    end loop;
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
