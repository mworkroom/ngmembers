-- Phase 5 production 읽기 전용 감사 쿼리입니다.
-- INSERT, UPDATE, DELETE, DDL을 실행하지 않으며 결과를 보고서에 값 없이 기록합니다.

select
  has_table_privilege('authenticated', 'public.members', 'select') as authenticated_select,
  has_table_privilege('authenticated', 'public.members', 'insert') as authenticated_insert,
  has_table_privilege('authenticated', 'public.members', 'update') as authenticated_update,
  has_table_privilege('authenticated', 'public.members', 'delete') as authenticated_delete,
  has_table_privilege('authenticated', 'public.members', 'truncate') as authenticated_truncate,
  has_table_privilege('authenticated', 'public.members', 'references') as authenticated_references,
  has_table_privilege('authenticated', 'public.members', 'trigger') as authenticated_trigger;

select
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'members'
  and grantee in ('public', 'anon', 'authenticated')
order by grantee, privilege_type;

select
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename = 'members'
order by policyname;

select
  routine_name,
  has_function_privilege(
    'authenticated',
    format('%I.%I()', routine_schema, routine_name),
    'execute'
  ) as authenticated_execute,
  has_function_privilege(
    'anon',
    format('%I.%I()', routine_schema, routine_name),
    'execute'
  ) as anon_execute
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('has_ngmembers_admin_access', 'get_ngmembers_access');

select
  p.proname,
  p.prosecdef as security_definer,
  p.provolatile,
  p.proconfig
from pg_proc as p
join pg_namespace as n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'prevent_members_relation_cycle';

select exists (
  select 1
  from pg_trigger as t
  join pg_class as c on c.oid = t.tgrelid
  join pg_namespace as n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'members'
    and t.tgname = 'members_prevent_relation_cycle'
    and not t.tgisinternal
) as relation_cycle_trigger_present;

select
  count(*) as member_count,
  count(*) filter (where affiliation_id is not null) as affiliation_count,
  count(*) filter (where direct_parent_id is not null) as direct_parent_count,
  count(*) filter (where is_hidden) as hidden_count
from public.members;

with recursive affiliation_paths as (
  select
    member.id as start_id,
    member.id as current_id,
    member.affiliation_id,
    array[member.id]::uuid[] as path
  from public.members as member
  where member.affiliation_id is not null

  union all

  select
    paths.start_id,
    parent.id,
    parent.affiliation_id,
    paths.path || parent.id
  from affiliation_paths as paths
  join public.members as parent on parent.id = paths.affiliation_id
  where not parent.id = any(paths.path)
)
select count(*) as affiliation_cycle_count
from affiliation_paths
where affiliation_id = any(path);

with recursive direct_parent_paths as (
  select
    member.id as start_id,
    member.id as current_id,
    member.direct_parent_id,
    array[member.id]::uuid[] as path
  from public.members as member
  where member.direct_parent_id is not null

  union all

  select
    paths.start_id,
    parent.id,
    parent.direct_parent_id,
    paths.path || parent.id
  from direct_parent_paths as paths
  join public.members as parent on parent.id = paths.direct_parent_id
  where not parent.id = any(paths.path)
)
select count(*) as direct_parent_cycle_count
from direct_parent_paths
where direct_parent_id = any(path);
