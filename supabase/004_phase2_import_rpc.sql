-- Phase 2: service_role 전용 일회성 원자적 members import RPC

create or replace function public.phase2_import_members(
  p_payload jsonb,
  p_expected_count integer,
  p_source_sha256 text,
  p_prepared_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_count integer;
  v_payload_count integer;
  v_invalid_count integer;
  v_relation_count integer;
  v_direct_parent_count integer;
  v_timestamps_missing integer;
  v_status jsonb;
  v_country jsonb;
  v_side jsonb;
  v_anchor jsonb;
  v_favorite jsonb;
  v_hidden jsonb;
begin
  if not exists (
    select 1
    from pg_catalog.pg_class
    where oid = 'public.members'::regclass
      and relrowsecurity
  ) then
    raise exception using errcode = '55000', message = 'members RLS is not enabled';
  end if;

  if jsonb_typeof(p_payload) <> 'object'
    or jsonb_typeof(p_payload -> 'members') <> 'array'
    or p_expected_count <= 0
    or p_payload ->> 'sourceSha256' <> p_source_sha256
    or p_payload ->> 'preparedSha256' <> p_prepared_sha256
    or (p_payload ->> 'rowCount')::integer <> p_expected_count
    or p_source_sha256 !~ '^[0-9a-f]{64}$'
    or p_prepared_sha256 !~ '^[0-9a-f]{64}$'
  then
    raise exception using errcode = '22023', message = 'invalid phase2 import contract';
  end if;

  select jsonb_array_length(p_payload -> 'members') into v_payload_count;
  if v_payload_count <> p_expected_count then
    raise exception using errcode = '22023', message = 'phase2 payload count mismatch';
  end if;

  select count(*)
  into v_invalid_count
  from jsonb_to_recordset(p_payload -> 'members') as m(
    id uuid,
    member_number text,
    name text,
    nickname text,
    is_anchor_member boolean,
    is_favorite boolean,
    sponsor_name_raw text,
    affiliation_id uuid,
    side text,
    direct_parent_id uuid,
    direct_parent_side text,
    birth_date date,
    phone text,
    country_code text,
    cpf text,
    notes text,
    member_status text,
    is_hidden boolean
  )
  where m.id is null
    or (m.member_number is not null and (
      m.member_number <> btrim(m.member_number)
      or m.member_number = ''
      or m.member_number !~ '^[0-9]+$'
    ))
    or m.is_anchor_member is null
    or m.is_favorite is null
    or m.is_hidden is null
    or (m.side is not null and m.side not in ('left', 'right'))
    or (m.country_code is not null and m.country_code !~ '^[A-Z]{2}$')
    or m.member_status not in ('active', 'withdrawn', 'review')
    or m.affiliation_id = m.id
    or m.direct_parent_id is not null
    or m.direct_parent_side is not null;

  if v_invalid_count <> 0 then
    raise exception using errcode = '23514', message = 'phase2 payload violates members constraints';
  end if;

  select count(*) - count(distinct m.id)
  into v_invalid_count
  from jsonb_to_recordset(p_payload -> 'members') as m(id uuid);
  if v_invalid_count <> 0 then
    raise exception using errcode = '23505', message = 'duplicate phase2 member id';
  end if;

  select count(*)
  into v_invalid_count
  from (
    select m.member_number
    from jsonb_to_recordset(p_payload -> 'members') as m(member_number text)
    where m.member_number is not null
    group by m.member_number
    having count(*) > 1
  ) duplicates;
  if v_invalid_count <> 0 then
    raise exception using errcode = '23505', message = 'duplicate phase2 member number';
  end if;

  select count(*)
  into v_invalid_count
  from jsonb_to_recordset(p_payload -> 'members') as m(affiliation_id uuid)
  where m.affiliation_id is not null
    and not exists (
      select 1
      from jsonb_to_recordset(p_payload -> 'members') as target(id uuid)
      where target.id = m.affiliation_id
    );
  if v_invalid_count <> 0 then
    raise exception using errcode = '23503', message = 'phase2 affiliation target missing';
  end if;

  lock table public.members in access exclusive mode;
  select count(*) into v_current_count from public.members;
  if v_current_count <> 0 then
    raise exception using errcode = '55000', message = 'members table is not empty';
  end if;

  insert into public.members (
    id,
    member_number,
    name,
    nickname,
    is_anchor_member,
    is_favorite,
    sponsor_name_raw,
    affiliation_id,
    side,
    direct_parent_id,
    direct_parent_side,
    birth_date,
    phone,
    country_code,
    cpf,
    notes,
    member_status,
    is_hidden
  )
  select
    m.id,
    m.member_number,
    m.name,
    m.nickname,
    m.is_anchor_member,
    m.is_favorite,
    m.sponsor_name_raw,
    null,
    null,
    null,
    null,
    m.birth_date,
    m.phone,
    m.country_code,
    m.cpf,
    m.notes,
    m.member_status,
    m.is_hidden
  from jsonb_to_recordset(p_payload -> 'members') as m(
    id uuid,
    member_number text,
    name text,
    nickname text,
    is_anchor_member boolean,
    is_favorite boolean,
    sponsor_name_raw text,
    affiliation_id uuid,
    side text,
    direct_parent_id uuid,
    direct_parent_side text,
    birth_date date,
    phone text,
    country_code text,
    cpf text,
    notes text,
    member_status text,
    is_hidden boolean
  );

  update public.members as target
  set
    affiliation_id = source.affiliation_id,
    side = source.side
  from jsonb_to_recordset(p_payload -> 'members') as source(
    id uuid,
    affiliation_id uuid,
    side text
  )
  where target.id = source.id;

  select
    count(*),
    count(*) filter (where affiliation_id is not null),
    count(*) filter (where direct_parent_id is not null),
    count(*) filter (where created_at is null or updated_at is null)
  into
    v_current_count,
    v_relation_count,
    v_direct_parent_count,
    v_timestamps_missing
  from public.members;

  if v_current_count <> p_expected_count
    or v_relation_count <> (
      select count(*)
      from jsonb_to_recordset(p_payload -> 'members') as m(affiliation_id uuid)
      where m.affiliation_id is not null
    )
    or v_direct_parent_count <> 0
    or v_timestamps_missing <> 0
  then
    raise exception using errcode = '55000', message = 'phase2 post-import verification failed';
  end if;

  select coalesce(jsonb_object_agg(key, total), '{}'::jsonb)
  into v_status
  from (
    select member_status as key, count(*)::integer as total
    from public.members group by member_status
  ) grouped;

  select coalesce(jsonb_object_agg(key, total), '{}'::jsonb)
  into v_country
  from (
    select coalesce(country_code, 'null') as key, count(*)::integer as total
    from public.members group by country_code
  ) grouped;

  select coalesce(jsonb_object_agg(key, total), '{}'::jsonb)
  into v_side
  from (
    select coalesce(side, 'null') as key, count(*)::integer as total
    from public.members group by side
  ) grouped;

  select coalesce(jsonb_object_agg(key, total), '{}'::jsonb)
  into v_anchor
  from (
    select is_anchor_member::text as key, count(*)::integer as total
    from public.members group by is_anchor_member
  ) grouped;

  select coalesce(jsonb_object_agg(key, total), '{}'::jsonb)
  into v_favorite
  from (
    select is_favorite::text as key, count(*)::integer as total
    from public.members group by is_favorite
  ) grouped;

  select coalesce(jsonb_object_agg(key, total), '{}'::jsonb)
  into v_hidden
  from (
    select is_hidden::text as key, count(*)::integer as total
    from public.members group by is_hidden
  ) grouped;

  return jsonb_build_object(
    'sourceSha256', p_source_sha256,
    'preparedSha256', p_prepared_sha256,
    'rowCount', v_current_count,
    'relationCount', v_relation_count,
    'directParentCount', v_direct_parent_count,
    'timestampsMissing', v_timestamps_missing,
    'distributions', jsonb_build_object(
      'memberStatus', v_status,
      'countryCode', v_country,
      'side', v_side,
      'isAnchorMember', v_anchor,
      'isFavorite', v_favorite,
      'isHidden', v_hidden
    )
  );
end;
$$;

revoke all on function public.phase2_import_members(jsonb, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.phase2_import_members(jsonb, integer, text, text)
  to service_role;

comment on function public.phase2_import_members(jsonb, integer, text, text) is
  'Phase 2 최초 1회 members import. 사후 검증 후 005 migration으로 제거한다.';
