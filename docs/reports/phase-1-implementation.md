# Phase 1 Supabase Foundation 구현 결과

- 구현일: 2026-07-18
- 범위: 개인정보 없는 Vite 기준선, Supabase schema/RLS, Google Auth 화면과 워크스페이스 권한 gate
- 상태: Phase 1 구현·Supabase 적용·인증 확인·DELETE 차단·안전한 Git 첫 이력 완료

## 구현 결과

### 개인정보 없는 빌드 기준선

- 실제 `src/data/seedMembers.json`, `data/members_sample.csv`를 제거했다.
- 개인정보를 포함하던 루트 과거 JS/CSS bundle을 제거했다.
- 기존 개발 로그와 장기 계획서의 실제 회원 예시를 가상 예시로 익명화했다.
- `index.html`을 `/src/main.tsx` Vite entry로 복구했다.
- 기존 회원 UI 확인에는 `src/data/demoMembers.ts`의 가상 회원 3명만 사용한다.
- 과거 실제 데이터가 남을 수 있는 `localStorage` key를 앱 시작 시 제거하고 Phase 1 demo key로 분리했다.
- `.gitignore`에 실제 CSV/JSON, private report, 환경변수, Supabase 임시 파일 패턴을 추가했다.

### Supabase와 인증

- `@supabase/supabase-js`를 추가했다.
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`만 사용하는 client를 만들었다.
- 환경변수 누락, 잘못된 URL, `sb_secret_` key, legacy `service_role` JWT를 감지하면 앱 shell 진입을 차단한다.
- Google OAuth 로그인, session 복원, 로그아웃, 인증 로딩, 권한 확인, 미허용 계정, 오류 상태를 구현했다.
- 이메일 allowlist 대신 `get_ngmembers_access()` RPC가 현재 `auth.uid()`의 Admin 멤버십 행을 확인한다.
- 로그인·권한 확인 전에는 기존 회원 shell과 목록을 렌더링하지 않는다.

### SQL

작성 파일:

1. `supabase/001_members_schema.sql`
2. `supabase/002_workspace_access.sql`
3. `supabase/003_rls_policies.sql`

주요 보안 규칙:

- ngmembers workspace ID는 `00000000-0000-0000-0000-000000000003`으로 고정했다.
- `members`의 관계 FK는 `on delete restrict`다.
- `authenticated`에는 SELECT·INSERT·UPDATE만 grant한다.
- DELETE grant를 `public`, `anon`, `authenticated`에서 회수하고 DELETE policy를 만들지 않았다.
- `workspace_members` 일반 브라우저 쓰기 권한을 회수했다.
- 공용 workspace schema의 다른 역할을 깨뜨리지 않도록 role 컬럼 전체를 Admin으로 제한하지 않고, ngmembers helper에서만 Admin을 요구한다.
- 실제 `workspace_members`에는 활성 상태 컬럼이 없음을 확인했다. 멤버십 행의 존재를 활성 접근으로 사용하고, 접근 회수는 해당 행 삭제로 처리하도록 `002_workspace_access.sql`을 수정했다.

J님이 실제 project에서 `002_workspace_access.sql`을 처음 실행했을 때 기존 테이블에 없는 `is_active`를 참조해 PostgreSQL 42703 오류가 발생했다. 컬럼 목록을 확인한 뒤 `is_active`와 존재하지 않는 `updated_at` 의존성을 제거했다. 수정본 `002`부터 다시 실행해야 하며, 두 Auth UUID 등록과 RLS 라이브 검증은 아직 남아 있다.

## 실행한 검사

### 의존성

```text
npm ci
added 78 packages, audited 79 packages
취약점 0건
```

처음 실행은 로컬 Vite 서버가 `esbuild.exe`를 사용 중이어서 Windows `EPERM`으로 중단됐다. 이번 작업에서 시작한 서버만 종료한 뒤 같은 명령을 다시 실행해 성공했다.

### 빌드

```text
npm run build
TypeScript 성공
Vite 6.4.3
90 modules transformed
dist/index.html, 새 hashed JS/CSS 생성
```

과거 root bundle을 입력으로 다시 사용하는 4-module build가 아니라 최신 React/Supabase source를 변환하는 정상 Vite build로 바뀌었다.

### 개인정보·secret·DELETE 검사

```text
npm run verify:phase1
46개 current source/dist text file 검사
과거 seed에서 추출한 5,410개 PII marker 검사
통과
```

검사기는 제거 대상 파일, secret/service role key 형태, 과거 seed 식별 문자열의 current source/dist 잔존 여부, members DELETE policy 부재와 DELETE revoke를 확인한다. 값은 검사 출력에 노출하지 않는다.

### 로컬 브라우저

환경변수를 넣지 않은 `http://127.0.0.1:5173/`에서 확인했다.

- Supabase 설정 필요 안내 카드 1개 표시
- 회원 app shell 0개
- 회원 목록 0개
- 콘솔 error 0개
- 가로 overflow 없음

실제 Google OAuth redirect와 session 복원은 project URL/publishable key, provider 설정이 없어 실행하지 않았다.

이후 J님이 실제 Supabase project에서 두 Admin 계정의 정상 동작을 확인했다. 익명 REST DELETE는 개인정보와 무관한 무작위 UUID를 대상으로 직접 요청했으며 HTTP 401로 거부됐다. 두 Admin 계정은 동일한 PostgreSQL `authenticated` role을 사용하고, 적용 SQL은 `public`, `anon`, `authenticated` 모두에서 DELETE grant를 회수하며 DELETE policy를 만들지 않으므로 Admin별 DELETE 권한 차이는 없다.

### 안전한 Git 이력

- GitHub Issue #1을 생성해 Phase 1 작업을 연결했다.
- 검증된 현재 tree만 사용해 부모가 없는 root commit `7b4d810`을 생성했다.
- public 원격 `main`의 Hello World commit을 force-with-lease로 안전한 root commit으로 교체했다.
- 로컬 `main`도 같은 root에 맞추고 reflog와 연결되지 않은 과거 PII object를 정리했다.
- 제거 전 기준 commit이 로컬 object database에서 더 이상 조회되지 않으며, 로컬·원격 `main` 모두 root commit 하나에서 시작함을 확인했다.

## J님 확인 및 수동 설정

1. 기존 Supabase project DB를 백업한다.
2. `supabase/README.md`의 workspace preflight query로 기존 공용 schema와 호환성을 확인한다.
3. SQL 3개를 순서대로 적용한다.
4. Supabase Auth의 J님/엄마 사용자 UUID를 SQL Editor에서 Admin으로 등록한다.
5. Google provider와 개발·Pages redirect URL을 Dashboard/Google Cloud Console에 등록한다.
6. `.env.local`에 project URL과 publishable/anon key만 넣는다.
7. `supabase/README.md`의 RLS 6개 시나리오를 두 실제 계정과 미허용 계정으로 실행한다.

DB password, service role key, Google Client Secret은 채팅·GitHub·`VITE_` 환경변수에 넣지 않는다.

## 완료 판정

- [x] 최신 `src`가 실제로 build됨
- [x] current source와 새 `dist`에서 과거 seed PII marker가 발견되지 않음
- [x] 프론트엔드가 publishable key 환경변수만 받음
- [x] members schema와 workspace/RLS SQL 작성
- [x] RLS 활성화와 DELETE 차단 SQL 작성
- [x] Google 로그인/session 복원/로그아웃 코드 작성
- [x] 로그인·권한 확인 전 회원 UI 차단
- [x] 기존 회원 UI를 가상 데이터로 보존
- [x] 최종 CSV를 import하지 않음
- [x] 기존 Supabase project에 SQL 적용
- [x] J님/엄마 Auth UUID 등록 및 정상 동작 확인
- [x] Google OAuth 실제 동작 확인
- [x] 익명 DELETE HTTP 401 및 authenticated DELETE grant/policy 차단 확인
- [x] 과거 PII가 있는 기존 Git history를 배제한 새 안전 이력 확정

Phase 1은 완료됐다. Phase 2에서는 최종 CSV 오류·경고를 보정하고 검증된 import 절차를 준비한다.
