-- Phase 1: members row-level security

alter table public.members enable row level security;

revoke all on public.members from anon;
revoke delete on public.members from public, anon, authenticated;
grant select, insert, update on public.members to authenticated;

drop policy if exists members_select_admin on public.members;
create policy members_select_admin
on public.members
for select
to authenticated
using ((select public.has_ngmembers_admin_access()));

drop policy if exists members_insert_admin on public.members;
create policy members_insert_admin
on public.members
for insert
to authenticated
with check ((select public.has_ngmembers_admin_access()));

drop policy if exists members_update_admin on public.members;
create policy members_update_admin
on public.members
for update
to authenticated
using ((select public.has_ngmembers_admin_access()))
with check ((select public.has_ngmembers_admin_access()));

-- 의도적으로 DELETE policy와 authenticated DELETE grant를 만들지 않습니다.
