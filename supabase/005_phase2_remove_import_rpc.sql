-- Phase 2: import 성공·사후 검증 완료 후 일회성 RPC 제거
-- 함수 삭제와 함께 부여된 EXECUTE 권한도 제거됩니다. 재실행해도 안전합니다.
drop function if exists public.phase2_import_members(jsonb, integer, text, text);
