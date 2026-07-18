-- Phase 1: shared workspace membership and access helper
-- 기존 공용 테이블이 있다면 README의 preflight query로 호환성을 먼저 확인합니다.

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null
    references public.workspaces(id) on delete cascade,
  user_id uuid not null
    references auth.users(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create unique index if not exists workspace_members_workspace_user_unique
  on public.workspace_members (workspace_id, user_id);

insert into public.workspaces (id, name)
values ('00000000-0000-0000-0000-000000000003', 'ngmembers')
on conflict (id) do update set name = excluded.name;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

-- 일반 브라우저 세션은 워크스페이스와 멤버십을 변경할 수 없습니다.
revoke insert, update, delete on public.workspaces from public, anon, authenticated;
revoke insert, update, delete on public.workspace_members from public, anon, authenticated;
grant select on public.workspaces to authenticated;
grant select on public.workspace_members to authenticated;

drop policy if exists workspaces_select_member on public.workspaces;
create policy workspaces_select_member
on public.workspaces
for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_members as wm
    where wm.workspace_id = workspaces.id
      and wm.user_id = (select auth.uid())
  )
);

drop policy if exists workspace_members_select_self on public.workspace_members;
create policy workspace_members_select_self
on public.workspace_members
for select
to authenticated
using (user_id = (select auth.uid()));

create or replace function public.has_ngmembers_admin_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members as wm
    where wm.workspace_id = '00000000-0000-0000-0000-000000000003'::uuid
      and wm.user_id = (select auth.uid())
      and wm.role::text = 'admin'
  );
$$;

create or replace function public.get_ngmembers_access()
returns table (is_authorized boolean, role text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.has_ngmembers_admin_access() as is_authorized,
    case
      when public.has_ngmembers_admin_access() then 'admin'::text
      else null::text
    end as role;
$$;

revoke all on function public.has_ngmembers_admin_access() from public, anon;
revoke all on function public.get_ngmembers_access() from public, anon;
grant execute on function public.has_ngmembers_admin_access() to authenticated;
grant execute on function public.get_ngmembers_access() to authenticated;

comment on function public.get_ngmembers_access() is
  '현재 auth.uid()에 ngmembers Admin 멤버십 행이 있는지 이메일 노출 없이 확인한다.';
