-- 빈 개발/검증 DB 전용 수동 검사입니다. 실제 회원 데이터가 있는 DB에서는 실행하지 않습니다.
-- 001~004 적용 후 실행하면 가짜 2행을 넣은 뒤 바깥 transaction rollback으로 0행을 확인합니다.

begin;

do $$
begin
  if (select count(*) from public.members) <> 0 then
    raise exception 'rollback test requires an empty members table';
  end if;
end;
$$;

select set_config('request.jwt.claim.role', 'service_role', true);

select public.phase2_import_members(
  jsonb_build_object(
    'version', 1,
    'sourceSha256', repeat('a', 64),
    'preparedSha256', repeat('b', 64),
    'rowCount', 2,
    'summary', '{}'::jsonb,
    'members', jsonb_build_array(
      jsonb_build_object(
        'id', '10000000-0000-5000-8000-000000000001',
        'member_number', '900000001',
        'name', '가상 회원 1',
        'nickname', '가상일',
        'is_anchor_member', true,
        'is_favorite', false,
        'sponsor_name_raw', null,
        'affiliation_id', null,
        'side', null,
        'direct_parent_id', null,
        'direct_parent_side', null,
        'birth_date', '1990-01-01',
        'phone', null,
        'country_code', 'KR',
        'cpf', null,
        'notes', 'rollback fixture',
        'member_status', 'active',
        'is_hidden', false
      ),
      jsonb_build_object(
        'id', '10000000-0000-5000-8000-000000000002',
        'member_number', '900000002',
        'name', '가상 회원 2',
        'nickname', '가상이',
        'is_anchor_member', false,
        'is_favorite', false,
        'sponsor_name_raw', '900000001',
        'affiliation_id', '10000000-0000-5000-8000-000000000001',
        'side', 'left',
        'direct_parent_id', null,
        'direct_parent_side', null,
        'birth_date', null,
        'phone', null,
        'country_code', 'BR',
        'cpf', null,
        'notes', null,
        'member_status', 'review',
        'is_hidden', false
      )
    )
  ),
  2,
  repeat('a', 64),
  repeat('b', 64)
);

do $$
begin
  if (select count(*) from public.members) <> 2 then
    raise exception 'fixture import verification failed';
  end if;
end;
$$;

rollback;

do $$
begin
  if (select count(*) from public.members) <> 0 then
    raise exception 'rollback did not restore the empty members table';
  end if;
end;
$$;
