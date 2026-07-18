# 회원앱 Phase 1 실행 계획서

- 작성일: 2026-07-18
- 대상: React/Vite 회원앱의 Supabase 기반과 인증·권한 구조 만들기
- 이번 문서의 역할: 구현 전에 작업 순서, 완료 기준, J님 확인 지점을 정리
- 중요: 이 문서를 만드는 단계에서는 코드·DB·GitHub 설정을 변경하지 않는다.

## 1. Phase 1의 목표

Phase 1에서는 실제 회원 CSV를 넣지 않는다. 먼저 다음 기반만 안전하게 만든다.

```text
정상 Vite 빌드
→ Supabase project 연결
→ members schema와 기존 workspace 멤버십 연결
→ Google 로그인
→ 허용 사용자 확인
→ RLS로 데이터 접근 차단
→ DELETE 차단
```

Phase 1이 끝나면 빈 데이터베이스 또는 개인정보 없는 가짜 데이터만 사용해 다음을 확인할 수 있어야 한다.

- 로그인하지 않은 사용자는 회원 데이터를 읽지 못함
- 허용된 J/Admin과 엄마/Admin 계정만 앱에 진입
- 허용된 사용자는 SELECT·INSERT·UPDATE 가능
- 일반 로그인 세션은 DELETE 불가
- 브라우저 번들과 GitHub에 실제 회원정보와 비밀키가 없음

## 2. 지금 entry를 바로 배포하지 않는 이유

현재 `index.html`은 과거 `assets/index-*.js/css`를 직접 참조한다. 정상 Vite entry로 복구해야 최신 `src`와 웹폰트 수정이 빌드된다.

하지만 현재 `src`는 `seedMembers.json`을 import하므로 entry만 고쳐 빌드하면 실제 회원 데이터가 새 번들에 다시 포함된다.

따라서 Phase 1에서는 다음 순서를 지킨다.

1. public 원격에는 현재 로컬 기록을 push하지 않음
2. 실제 seed·CSV·과거 완성 번들의 추적 및 import 제거
3. 필요하면 개인정보 없는 가짜 회원 10명 이하 fixture 사용
4. `index.html`을 `/src/main.tsx` entry로 복구
5. 새 `dist`에서 실제 회원정보가 없는지 검사
6. 안전 검사를 통과한 commit부터 새 저장소의 첫 이력으로 사용

즉, entry 복구는 미루는 작업이 아니라 PII 제거와 한 묶음으로 수행하는 Phase 1 초반 작업이다.

## 3. Phase 1 시작 전에 J님이 정할 것

### 필수 결정

- 기존 엄마용 앱 Supabase project를 함께 사용
- ngmembers workspace ID: `00000000-0000-0000-0000-000000000003`
- 기존 Supabase Auth에서 J님의 사용자 UUID
- 기존 Supabase Auth에서 엄마의 사용자 UUID
- 역할
  - J: `admin`
  - 엄마: `admin`
- 같은 Supabase project에 연결된 Google OAuth Client 재사용
- 새 public GitHub 저장소의 첫 push 시점
  - 권장: PII bundle 검사 통과 후

### 채팅·GitHub에 적지 않을 값

- Supabase DB password
- service role key
- Google OAuth Client Secret

이 값들은 Supabase Dashboard, Google Cloud Console, `.env.local`, GitHub Secrets에만 둔다.

## 4. 구현 순서

## Step 1 — 안전한 로컬 기준선 만들기

작업:

- 새 원격 저장소가 비어 있거나 안전한 상태인지 확인
- `.gitignore`에 실제 CSV·seed·report·환경변수 패턴 추가
- `src/data/seedMembers.json`, `data/members_sample.csv`, 과거 root `assets` 제거 계획 확정
- 필요한 경우 가짜 fixture 생성
- `index.html`을 정상 Vite entry로 복구
- `npm ci`, `npm run build`
- `dist` PII 문자열 검사

완료 기준:

- 최신 `src` 문구가 새 번들에 포함됨
- 과거 완성 bundle을 다시 bundle하지 않음
- 실제 이름·전화번호·회원번호·CPF가 `dist`에서 발견되지 않음
- UI 디자인은 변경하지 않음

J님 확인 지점:

- 삭제·제외할 개인정보 파일 목록
- 가짜 fixture 사용 여부
- 첫 안전 commit에 포함할 파일 목록

## Step 2 — Supabase project와 환경변수 연결

작업:

- Supabase project URL과 publishable key 준비
- `@supabase/supabase-js` 설치
- `src/lib/supabase.ts` 생성
- `.env.example` 생성
- 실제 값은 `.env.local`에만 저장
- 환경변수 누락 시 사용자에게 이해 가능한 오류 표시

환경변수:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

금지:

```text
VITE_SUPABASE_SERVICE_ROLE_KEY
DB password
Google Client Secret
```

완료 기준:

- publishable key만 브라우저에 포함
- service role key 문자열이 source·dist에 없음
- `.env.local`이 Git에서 제외됨

## Step 3 — `members` schema 작성

예정 파일:

```text
supabase/
├─ 001_members_schema.sql
├─ 002_workspace_access.sql
├─ 003_rls_policies.sql
└─ README.md
```

`members` 주요 필드:

- UUID `id`
- 회원번호·이름·닉네임
- 주 사업자·관심 회원 flag
- `sponsor_name_raw`, `affiliation_id`, `side`
- `direct_parent_id`, `direct_parent_side`
- 생년월일·전화번호·국가·CPF·메모
- 상태와 숨김 flag
- 생성·수정 시각

제약:

- 빈 회원번호는 `NULL` 허용
- 값이 있는 회원번호는 unique
- 상태는 `active`, `withdrawn`, `review`
- side는 `left`, `right`, `NULL`
- 국가 코드는 영문 대문자 두 글자 또는 `NULL`
- 관계 FK는 `on delete restrict`
- 실제 삭제 기능은 만들지 않음

완료 기준:

- 새 Supabase project에서 SQL을 순서대로 재실행 가능
- schema를 여러 번 실수로 적용했을 때 문제를 알 수 있는 안내 포함
- 아직 최종 CSV를 import하지 않음

## Step 4 — 기존 워크스페이스에 허용 사용자 연결

작업:

- `workspaces`에 ngmembers ID `00000000-0000-0000-0000-000000000003`을 등록하는 절차 작성
- 기존 Supabase Auth의 J 사용자 UUID를 `admin`으로 연결
- 기존 Supabase Auth의 엄마 사용자 UUID를 `admin`으로 연결
- 일반 브라우저에서 workspace 멤버십을 추가·수정하지 못하도록 제한
- `auth.uid()`와 workspace Admin membership 행을 확인하는 DB helper 또는 안전한 조회 방식 결정

완료 기준:

- 허용된 두 계정이 동일한 `admin` 역할로 접근 가능
- 멤버십 행이 없거나 Admin이 아닌 계정은 members 접근 불가
- workspace 멤버십을 일반 사용자가 임의 수정할 수 없음

## Step 5 — RLS 정책 작성

허용 정책:

- SELECT
- INSERT
- UPDATE

만들지 않는 정책:

- DELETE

검사할 상황:

1. 익명 요청 SELECT 실패
2. 미허용 로그인 사용자 SELECT 실패
3. Admin SELECT·INSERT·UPDATE 성공
4. 엄마 Admin 계정 SELECT·INSERT·UPDATE 성공
5. 두 Admin 계정 모두 DELETE 실패
6. publishable key만 사용한 익명 요청 실패

완료 기준:

- UI 버그와 관계없이 DB에서 DELETE 차단
- RLS를 끄지 않아도 앱 기능 수행 가능
- SQL README에 직접 확인 절차 기록

## Step 6 — Google 로그인 기본 화면 만들기

예정 구조:

```text
src/
├─ hooks/useAuth.ts
├─ components/LoginScreen.tsx
├─ components/AuthGate.tsx
└─ lib/supabase.ts
```

상태:

- 인증 확인 중
- 로그아웃
- 허용된 사용자
- 허용되지 않은 사용자
- 인증 실패

기능:

- Google 로그인 버튼
- 새로고침 후 session 복원
- 로그아웃
- 허용되지 않은 계정 안내
- 현재 role 확인

Redirect URL 초기값:

```text
http://127.0.0.1:5173
http://localhost:5173
https://mworkroom.github.io/ngmembers/
```

정식 도메인은 안전한 배포가 확인된 뒤 추가한다.

완료 기준:

- 로그인 전 회원 UI와 데이터가 보이지 않음
- 허용 계정만 앱 shell 진입
- 새로고침 후 로그인 유지
- 로그아웃 시 데이터 화면 제거
- 아직 실제 1,378명 데이터는 없음

## Step 7 — Phase 1 통합 검사

실행:

```text
npm ci
npm run build
```

검사:

- TypeScript 오류 없음
- 최신 src가 실제 dist에 포함됨
- 실제 회원 이름·전화번호·회원번호·CPF 없음
- service role key 없음
- 로컬 로그인 흐름 동작
- RLS 6가지 시나리오 결과 기록
- UI 디자인이 임의로 변경되지 않음

보고 내용:

- 변경 파일
- 적용 SQL
- 수동 Dashboard 설정
- 실행한 명령과 결과
- J님이 직접 확인할 로그인·권한 항목
- Phase 2 전에 남은 문제

## 5. Phase 1에서 하지 않는 것

- 최종 `ngmembers.csv` import
- 1,378명 관계 연결
- localStorage 전체 데이터 계층 교체 완료
- 회원 추가·수정·숨김의 Supabase 연결 완료
- 최종 문구 변경
- 카드 UI 재설계
- 정식 도메인 연결
- production 데이터 입력

이 항목은 각각 Phase 2~5에서 진행한다.

## 6. 예상 결과물

```text
.env.example
supabase/001_members_schema.sql
supabase/002_workspace_access.sql
supabase/003_rls_policies.sql
supabase/README.md
src/lib/supabase.ts
src/hooks/useAuth.ts
src/components/AuthGate.tsx
src/components/LoginScreen.tsx
정상 Vite index.html
PII 없는 test fixture 또는 빈 상태
Phase 1 테스트 결과 문서
```

실제 구현 중 파일 이름은 기존 구조와 충돌이 있을 때 조정할 수 있으며, schema 의미 변경은 J님에게 먼저 설명한다.

## 7. Phase 1 완료 판정

다음 항목이 모두 충족되어야 Phase 2로 넘어간다.

```text
[ ] 최신 src가 실제로 build됨
[ ] 실제 회원정보가 source·dist·Git history에 없음
[ ] publishable key만 frontend에 존재
[ ] members schema와 workspace 접근 SQL 재실행 가능
[ ] RLS 활성화
[ ] 익명·미허용 사용자 접근 실패
[ ] J·엄마 Admin 계정 SELECT/INSERT/UPDATE 성공
[ ] DELETE 실패
[ ] Google 로그인·session 복원·로그아웃 성공
[ ] 허용되지 않은 계정 안내 확인
[ ] 최종 CSV는 아직 import하지 않음
[ ] 기존 승인 UI가 보존됨
```

## 8. Phase 1 시작 시 첫 작업

J님이 Phase 1 구현을 승인하면 가장 먼저 다음 세 가지를 함께 처리한다.

1. 실제 개인정보 파일과 과거 번들을 로컬 작업 대상에서 격리
2. 정상 Vite entry 복구
3. 개인정보 없는 build 기준선 확인

이 안전 기준선을 통과한 뒤 Supabase schema와 Google Auth 구현을 시작한다.
