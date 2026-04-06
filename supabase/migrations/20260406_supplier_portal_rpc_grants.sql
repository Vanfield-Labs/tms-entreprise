revoke execute on function public.supplier_verify_pin(text) from public;
revoke execute on function public.supplier_verify_pin(text) from anon;
revoke execute on function public.supplier_verify_pin(text) from authenticated;
grant execute on function public.supplier_verify_pin(text) to service_role;

revoke execute on function public.supplier_get_licence_status(text) from public;
revoke execute on function public.supplier_get_licence_status(text) from anon;
revoke execute on function public.supplier_get_licence_status(text) from authenticated;
grant execute on function public.supplier_get_licence_status(text) to service_role;

revoke execute on function public.supplier_renew_licence(text, date, integer, text, text[]) from public;
revoke execute on function public.supplier_renew_licence(text, date, integer, text, text[]) from anon;
revoke execute on function public.supplier_renew_licence(text, date, integer, text, text[]) from authenticated;
grant execute on function public.supplier_renew_licence(text, date, integer, text, text[]) to service_role;

revoke execute on function public.supplier_deactivate_licence(text) from public;
revoke execute on function public.supplier_deactivate_licence(text) from anon;
revoke execute on function public.supplier_deactivate_licence(text) from authenticated;
grant execute on function public.supplier_deactivate_licence(text) to service_role;
