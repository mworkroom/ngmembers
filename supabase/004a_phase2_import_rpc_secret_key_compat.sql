-- Phase 2: 이미 적용된 004 RPC의 sb_secret_* 호환 보정
--
-- 새 secret API key는 service_role DB 권한으로 실행되지만 JWT가 아니므로
-- request.jwt.claim.role이 없다. 이미 배포된 004의 레거시 claim 검사만
-- 함수 정의에서 제거하고 실행 권한은 계속 service_role에만 둔다.

do $migration$
declare
  v_definition text;
  v_legacy_block_lf text := E'  if coalesce(current_setting(''request.jwt.claim.role'', true), '''') <> ''service_role'' then\n    raise exception using errcode = ''42501'', message = ''phase2 import requires service_role'';\n  end if;\n\n';
begin
  select pg_get_functiondef(
    'public.phase2_import_members(jsonb,integer,text,text)'::regprocedure
  )
  into v_definition;

  if strpos(v_definition, 'request.jwt.claim.role') = 0 then
    return;
  end if;

  v_definition := replace(v_definition, replace(v_legacy_block_lf, E'\n', E'\r\n'), '');
  v_definition := replace(v_definition, v_legacy_block_lf, '');

  if strpos(v_definition, 'request.jwt.claim.role') <> 0 then
    raise exception using
      errcode = '55000',
      message = 'phase2 legacy claim block did not match';
  end if;

  execute v_definition;
end;
$migration$;

revoke all on function public.phase2_import_members(jsonb, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.phase2_import_members(jsonb, integer, text, text)
  to service_role;

comment on function public.phase2_import_members(jsonb, integer, text, text) is
  'Phase 2 최초 1회 members import. sb_secret 호환 보정 적용. 사후 검증 후 005 migration으로 제거한다.';
