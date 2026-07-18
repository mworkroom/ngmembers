# 회원 계보 찾기

React 19, TypeScript, Vite, Supabase Auth/Postgres 기반의 내부 회원 관리 앱이다. Phase 1에서는 실제 회원정보를 넣지 않고 Google 로그인, ngmembers 워크스페이스 허용 목록, RLS 기반만 구축한다.

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

## Phase 1 데이터

- 실제 `seedMembers.json`과 CSV, 과거 완성 번들은 제거했다.
- 로그인 후 기존 UI 확인에는 `src/data/demoMembers.ts`의 개인정보 없는 가상 회원 3명만 사용한다.
- 과거 `localStorage` key는 앱 시작 시 제거하며 Phase 1 전용 demo key와 분리했다.
- 최종 1,378명 CSV import와 Supabase CRUD 연결은 이후 Phase에서 진행한다.

## Supabase 적용

자세한 순서와 두 Admin UUID 등록, Google OAuth, RLS 6개 시나리오 확인법은 `supabase/README.md`를 따른다.

```text
supabase/001_members_schema.sql
supabase/002_workspace_access.sql
supabase/003_rls_policies.sql
```

`members`의 일반 로그인 세션에는 SELECT·INSERT·UPDATE만 열고 DELETE grant/policy는 만들지 않는다.

## 빌드와 안전 검사

```bash
npm run build
npm run verify:phase1
```

안전 검사는 제거 대상 파일, secret/service role key 형태, 과거 Git seed에 있던 식별 문자열의 현재 source/dist 잔존 여부, DELETE 정책 부재를 확인한다. 기존 Git history 자체의 정리는 별도 승인과 새 안전 이력 생성 절차가 필요하다.
