drop policy if exists "Service can insert notifications" on public.notifications;
drop policy if exists notif_delete on public.notifications;
drop policy if exists notif_insert on public.notifications;
drop policy if exists notif_select on public.notifications;
drop policy if exists notif_update on public.notifications;
drop policy if exists notifications_delete_admin on public.notifications;
drop policy if exists notifications_insert_admin_transport_corp on public.notifications;
drop policy if exists notifications_select on public.notifications;
drop policy if exists notifications_update on public.notifications;

create policy notifications_select_own_or_admin
on public.notifications
for select
to authenticated
using (
  recipient_id = auth.uid()
  or public.is_admin()
);

create policy notifications_update_own_or_admin
on public.notifications
for update
to authenticated
using (
  recipient_id = auth.uid()
  or public.is_admin()
)
with check (
  recipient_id = auth.uid()
  or public.is_admin()
);

create policy notifications_delete_own_or_admin
on public.notifications
for delete
to authenticated
using (
  recipient_id = auth.uid()
  or public.is_admin()
);

create policy notifications_insert_privileged
on public.notifications
for insert
to authenticated
with check (
  public.is_admin()
  or public.is_transport_supervisor()
  or public.is_corporate_approver()
);

drop policy if exists drivers_select_authenticated on public.drivers;
drop policy if exists drivers_update_privileged on public.drivers;
drop policy if exists drivers_admin_transport_write on public.drivers;

create policy drivers_select_active_users
on public.drivers
for select
to authenticated
using (
  public.is_active_user()
);

create policy drivers_admin_transport_write
on public.drivers
for all
to authenticated
using (
  public.is_admin()
  or public.is_transport_supervisor()
)
with check (
  public.is_admin()
  or public.is_transport_supervisor()
);

revoke execute on function public.finance_review_booking(uuid, public.approval_action, text) from public;
grant execute on function public.finance_review_booking(uuid, public.approval_action, text) to authenticated;

revoke execute on function public.finance_review_maintenance(uuid, public.approval_action, text) from public;
grant execute on function public.finance_review_maintenance(uuid, public.approval_action, text) to authenticated;

revoke execute on function public.corporate_review_maintenance(uuid, public.approval_action, text) from public;
grant execute on function public.corporate_review_maintenance(uuid, public.approval_action, text) to authenticated;

revoke execute on function public.submit_driver_leave(uuid, text, date, date, text) from public;
grant execute on function public.submit_driver_leave(uuid, text, date, date, text) to authenticated;

revoke execute on function public.action_driver_leave(uuid, text, text, text) from public;
grant execute on function public.action_driver_leave(uuid, text, text, text) to authenticated;

revoke execute on function public.get_driver_leave_dashboard_data() from public;
grant execute on function public.get_driver_leave_dashboard_data() to authenticated;

revoke execute on function public.get_my_driver_leave_dashboard_data() from public;
grant execute on function public.get_my_driver_leave_dashboard_data() to authenticated;

revoke execute on function public.log_audit(text, text, uuid, jsonb) from public;
grant execute on function public.log_audit(text, text, uuid, jsonb) to authenticated;
