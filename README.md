# 회원 계보 찾기

React 19, TypeScript, Vite, Supabase Auth/Postgres 기반의 내부 회원 관리 앱이다. Phase 1의 Google 로그인·워크스페이스 허용 목록·RLS 기반과 Phase 2의 실제 회원 1,378행 최초 이전을 완료했고, Phase 3 프론트 데이터 계층의 로컬 구현도 완료했다.

## 로컬 실행

```bash
npm ci
Copy-Item .env.example .env.local
npm run dev
```

`.env.local`에는 Supabase project URL과 publishable/anon key만 입력한다. DB password, service role key, Google Client Secret은 프론트엔드 환경변수로 사용하지 않는다.

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

환경변수가 없거나 secret/service role key가 감지되면 앱은 회원 화면 대신 설정 오류를 표시한다.

## 현재 데이터 상태

- 실제 `seedMembers.json`과 CSV, 과거 완성 번들은 제거했다.
- 로그인·Admin 권한 확인 후 production `members`를 500행 UUID cursor로 끝까지 읽고 exact count와 중복 ID를 검증한다.
- 회원 row는 브라우저 메모리에만 유지하며 과거 `localStorage` key 두 개는 앱 시작 시 한 번 제거한다.
- 최종 1,378명과 sponsor 관계 1,271건을 production DB에 원자적으로 이전하고 검증했다.
- 일회성 import RPC는 제거했다.
- create/update/hide는 DB 반환 row로 화면을 갱신하고 update/hide는 `updated_at` 조건으로 충돌을 감지한다.
- demo fixture, 회원 localStorage 저장, CSV import/export, 샘플 초기화와 숨김 복원 UI는 제거했다.
- Phase 3 production 권한 migration과 두 Admin 실사용 검증은 아직 적용 전이다. 상세 상태는 `docs/reports/phase-3-implementation.md`를 따른다.

## Phase 2 로컬 검증

실제 CSV와 report는 `reports/phase2/`, import 환경변수는 `.env.import.local`에만 두며 모두 Git에서 제외된다.

```powershell
npm run members:validate -- reports/phase2/ngmembers-phase2.csv --report-dir reports/phase2
npm run members:prepare -- reports/phase2/ngmembers-phase2.csv --corrections reports/phase2/corrections.local.json --report-dir reports/phase2
npm run members:import -- --prepared reports/phase2/prepared-import.local.json --source reports/phase2/ngmembers-phase2.csv
npm run members:import -- --preflight --prepared reports/phase2/prepared-import.local.json --source reports/phase2/ngmembers-phase2.csv
```

`members:import`는 기본 offline dry-run이다. `--preflight`는 실제 쓰기 없이 설정된 project ref, credential, source/prepared hash와 `members` count를 확인한다. production `--apply`에는 source/prepared hash, 예상 건수, project ref, backup 확인을 모두 요구한다. 전체 승인·SQL 적용 순서는 `docs/reports/phase-2-implementation.md`를 따른다.

## Supabase 적용

자세한 순서와 두 Admin UUID 등록, Google OAuth, RLS 6개 시나리오 확인법은 `supabase/README.md`를 따른다.

```text
supabase/001_members_schema.sql
supabase/002_workspace_access.sql
supabase/003_rls_policies.sql
```

`members`의 일반 로그인 세션에는 SELECT·INSERT·UPDATE만 열고 DELETE grant/policy는 만들지 않는다.
기존 production 보정은 승인 후 `supabase/migrations/20260718024656_phase3_members_access_hardening.sql`을 별도로 적용한다.

## 빌드와 안전 검사

```bash
npm run build
npm run verify:phase1
npm run verify:phase2
npm run verify:phase3
```

안전 검사는 제거 대상 파일, secret/service role key 형태, DELETE 정책 부재를 확인한다. 안전한 root history 생성 전에는 과거 Git seed의 식별 문자열 5,410개도 source/dist와 대조했다. history 정리 후 추가 PII 대조가 필요하면 ignore된 `scripts/pii-markers.local.txt`에 한 줄당 marker 하나를 로컬에서만 작성한다.
