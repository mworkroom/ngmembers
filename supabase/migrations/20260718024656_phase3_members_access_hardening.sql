-- Phase 3: members Data API privileges and relation cycle protection

alter table public.members enable row level security;

revoke all on table public.members from public, anon, authenticated;
grant select, insert, update on table public.members to authenticated;

create or replace function public.prevent_members_relation_cycle()
returns trigger
language plpgsql
security invoker
volatile
set search_path = ''
as $$
begin
  if new.affiliation_id is not null or new.direct_parent_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('ngmembers.members.relation_cycle', 0)
    );
  end if;

  if new.affiliation_id = new.id then
    raise exception using
      errcode = '23514',
      constraint = 'members_affiliation_cycle',
      message = 'affiliation relation cannot contain a cycle';
  end if;

  if new.affiliation_id is not null and exists (
    with recursive ancestors as (
      select
        member.id,
        member.affiliation_id,
        array[member.id]::uuid[] as path
      from public.members as member
      where member.id = new.affiliation_id

      union all

      select
        parent.id,
        parent.affiliation_id,
        ancestors.path || parent.id
      from ancestors
      join public.members as parent
        on parent.id = ancestors.affiliation_id
      where not parent.id = any(ancestors.path)
    )
    select 1
    from ancestors
    where ancestors.id = new.id
  ) then
    raise exception using
      errcode = '23514',
      constraint = 'members_affiliation_cycle',
      message = 'affiliation relation cannot contain a cycle';
  end if;

  if new.direct_parent_id = new.id then
    raise exception using
      errcode = '23514',
      constraint = 'members_direct_parent_cycle',
      message = 'direct parent relation cannot contain a cycle';
  end if;

  if new.direct_parent_id is not null and exists (
    with recursive ancestors as (
      select
        member.id,
        member.direct_parent_id,
        array[member.id]::uuid[] as path
      from public.members as member
      where member.id = new.direct_parent_id

      union all

      select
        parent.id,
        parent.direct_parent_id,
        ancestors.path || parent.id
      from ancestors
      join public.members as parent
        on parent.id = ancestors.direct_parent_id
      where not parent.id = any(ancestors.path)
    )
    select 1
    from ancestors
    where ancestors.id = new.id
  ) then
    raise exception using
      errcode = '23514',
      constraint = 'members_direct_parent_cycle',
      message = 'direct parent relation cannot contain a cycle';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_members_relation_cycle()
from public, anon, authenticated;

drop trigger if exists members_prevent_relation_cycle on public.members;
create trigger members_prevent_relation_cycle
before insert or update of affiliation_id, direct_parent_id on public.members
for each row execute function public.prevent_members_relation_cycle();

comment on function public.prevent_members_relation_cycle() is
  'members affiliation_id와 direct_parent_id의 자기 참조 및 간접 cycle을 차단한다.';
