revoke execute on function public.finance_review_booking(uuid, public.approval_action, text) from anon;
revoke execute on function public.finance_review_booking(uuid, public.approval_action, text) from authenticated;
grant execute on function public.finance_review_booking(uuid, public.approval_action, text) to authenticated;

revoke execute on function public.finance_review_maintenance(uuid, public.approval_action, text) from anon;
revoke execute on function public.finance_review_maintenance(uuid, public.approval_action, text) from authenticated;
grant execute on function public.finance_review_maintenance(uuid, public.approval_action, text) to authenticated;

revoke execute on function public.corporate_review_maintenance(uuid, public.approval_action, text) from anon;
revoke execute on function public.corporate_review_maintenance(uuid, public.approval_action, text) from authenticated;
grant execute on function public.corporate_review_maintenance(uuid, public.approval_action, text) to authenticated;

revoke execute on function public.submit_driver_leave(uuid, text, date, date, text) from anon;
revoke execute on function public.submit_driver_leave(uuid, text, date, date, text) from authenticated;
grant execute on function public.submit_driver_leave(uuid, text, date, date, text) to authenticated;

revoke execute on function public.action_driver_leave(uuid, text, text, text) from anon;
revoke execute on function public.action_driver_leave(uuid, text, text, text) from authenticated;
grant execute on function public.action_driver_leave(uuid, text, text, text) to authenticated;

revoke execute on function public.get_driver_leave_dashboard_data() from anon;
revoke execute on function public.get_driver_leave_dashboard_data() from authenticated;
grant execute on function public.get_driver_leave_dashboard_data() to authenticated;

revoke execute on function public.get_my_driver_leave_dashboard_data() from anon;
revoke execute on function public.get_my_driver_leave_dashboard_data() from authenticated;
grant execute on function public.get_my_driver_leave_dashboard_data() to authenticated;

revoke execute on function public.log_audit(text, text, uuid, jsonb) from anon;
revoke execute on function public.log_audit(text, text, uuid, jsonb) from authenticated;
grant execute on function public.log_audit(text, text, uuid, jsonb) to authenticated;
