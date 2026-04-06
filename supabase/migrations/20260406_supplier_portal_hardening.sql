create table if not exists public.supplier_portal_attempts (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  identifier_hash text not null,
  success boolean not null default false,
  detail jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists supplier_portal_attempts_action_identifier_created_idx
  on public.supplier_portal_attempts (action, identifier_hash, created_at desc);

alter table public.supplier_portal_attempts enable row level security;

drop policy if exists supplier_portal_attempts_service_role_only on public.supplier_portal_attempts;
create policy supplier_portal_attempts_service_role_only
on public.supplier_portal_attempts
for all
to service_role
using (true)
with check (true);

revoke all on public.supplier_portal_attempts from anon, authenticated;

revoke execute on function public.supplier_verify_pin(text) from anon;
revoke execute on function public.supplier_verify_pin(text) from authenticated;
grant execute on function public.supplier_verify_pin(text) to service_role;

revoke execute on function public.supplier_get_licence_status(text) from anon;
revoke execute on function public.supplier_get_licence_status(text) from authenticated;
grant execute on function public.supplier_get_licence_status(text) to service_role;

revoke execute on function public.supplier_renew_licence(text, date, integer, text, text[]) from anon;
revoke execute on function public.supplier_renew_licence(text, date, integer, text, text[]) from authenticated;
grant execute on function public.supplier_renew_licence(text, date, integer, text, text[]) to service_role;

revoke execute on function public.supplier_deactivate_licence(text) from anon;
revoke execute on function public.supplier_deactivate_licence(text) from authenticated;
grant execute on function public.supplier_deactivate_licence(text) to service_role;
