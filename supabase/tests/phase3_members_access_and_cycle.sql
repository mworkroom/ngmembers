-- 빈 개발/검증 DB 전용 수동 검사입니다. production에서는 실행하지 않습니다.
-- 001~003과 Phase 3 migration 적용 후 실행하며, 모든 가짜 행은 rollback됩니다.

begin;

do $$
begin
  if not has_table_privilege('authenticated', 'public.members', 'select')
    or not has_table_privilege('authenticated', 'public.members', 'insert')
    or not has_table_privilege('authenticated', 'public.members', 'update') then
    raise exception 'authenticated requires select, insert, update';
  end if;

  if has_table_privilege('authenticated', 'public.members', 'delete')
    or has_table_privilege('authenticated', 'public.members', 'truncate')
    or has_table_privilege('authenticated', 'public.members', 'references')
    or has_table_privilege('authenticated', 'public.members', 'trigger') then
    raise exception 'authenticated has an excessive members privilege';
  end if;

  if has_table_privilege('anon', 'public.members', 'select')
    or has_table_privilege('anon', 'public.members', 'insert')
    or has_table_privilege('anon', 'public.members', 'update')
    or has_table_privilege('anon', 'public.members', 'delete')
    or has_table_privilege('anon', 'public.members', 'truncate')
    or has_table_privilege('anon', 'public.members', 'references')
    or has_table_privilege('anon', 'public.members', 'trigger') then
    raise exception 'anon can access members';
  end if;
end;
$$;

insert into public.members (id, name)
values
  ('30000000-0000-5000-8000-000000000001', '가상 소속 회원 1'),
  ('30000000-0000-5000-8000-000000000002', '가상 소속 회원 2'),
  ('30000000-0000-5000-8000-000000000003', '가상 소속 회원 3'),
  ('30000000-0000-5000-8000-000000000004', '가상 직계 회원 1'),
  ('30000000-0000-5000-8000-000000000005', '가상 직계 회원 2'),
  ('30000000-0000-5000-8000-000000000006', '가상 직계 회원 3');

update public.members
set affiliation_id = '30000000-0000-5000-8000-000000000001'
where id = '30000000-0000-5000-8000-000000000002';

update public.members
set affiliation_id = '30000000-0000-5000-8000-000000000002'
where id = '30000000-0000-5000-8000-000000000003';

do $$
begin
  update public.members
  set affiliation_id = '30000000-0000-5000-8000-000000000003'
  where id = '30000000-0000-5000-8000-000000000001';

  raise exception 'affiliation cycle was accepted';
exception
  when check_violation then null;
end;
$$;

update public.members
set direct_parent_id = '30000000-0000-5000-8000-000000000004'
where id = '30000000-0000-5000-8000-000000000005';

update public.members
set direct_parent_id = '30000000-0000-5000-8000-000000000005'
where id = '30000000-0000-5000-8000-000000000006';

do $$
begin
  update public.members
  set direct_parent_id = '30000000-0000-5000-8000-000000000006'
  where id = '30000000-0000-5000-8000-000000000004';

  raise exception 'direct parent cycle was accepted';
exception
  when check_violation then null;
end;
$$;

rollback;
