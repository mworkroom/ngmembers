# Phase 5 최종 보안·배포·운영 마감 계획

- 작성일: 2026-07-19
- 선행 단계: Phase 1–3 production 적용 완료, Phase 4 UI·문구 구현 완료 및 잔여 항목 승인
- 대상: 저장소·빌드 산출물·Supabase 권한·Google OAuth·GitHub Pages·`member.nangok.app`·최종 운영 문서
- 원칙: 실제 회원 데이터와 권한을 임의로 변경하지 않고, 검사 결과가 통과한 뒤에만 배포한다.

## 1. 목적

Phase 5의 목적은 이미 구현된 회원 앱을 최종 운영 주소에서 안전하게 사용할 수 있는 상태로 확인하고 인수인계하는 것이다.

이번 단계에서는 다음을 완료한다.

- source와 `dist`에 실제 회원 개인정보와 secret이 없는지 재검사한다.
- Supabase `members` 권한, RLS, DELETE·TRUNCATE 차단, 관계 cycle trigger를 production 기준으로 재확인한다.
- GitHub Actions가 검증된 `dist`만 배포하도록 최종 검사 명령을 연결한다.
- GitHub Pages custom domain `member.nangok.app`과 HTTPS를 확인한다.
- Supabase Auth와 Google OAuth의 production redirect를 검증한다.
- J님과 엄마 계정의 PC·iPhone·iPad 실사용을 확인한다.
- 운영 중단·계정 제거·key 교체 절차를 문서화한다.

Phase 5에서는 회원 기능, 검색 규칙, 카드 UI, DB schema, RLS 정책의 의미를 새로 설계하지 않는다. 검증 중 결함이 발견되면 해당 결함을 먼저 수정하고 Phase 5 검사를 다시 시작한다.

## 2. 현재 기준선과 진입 조건

### 2.1 고정된 기준선

- production 회원 1,378행
- `affiliation_id` 관계 1,271건
- 관계 cycle 0건
- 두 Admin 계정의 동일한 조회·추가·수정·숨김 권한
- `members` 일반 세션 권한은 SELECT·INSERT·UPDATE
- 앱에는 영구 삭제와 숨김 복원 기능이 없음
- 브라우저에는 Supabase URL과 publishable key만 존재
- 회원 데이터는 브라우저 영구 저장소가 아닌 메모리에만 유지
- GitHub Actions는 Node 22와 `npm ci`를 사용해 Pages artifact를 생성

### 2.2 Phase 5 진입 조건

다음 항목을 모두 확인하기 전에는 production domain 전환을 진행하지 않는다.

- Phase 4의 메모 검색·국가 선택·닉네임·문구 변경이 승인됨
- Phase 4의 외부 Pretendard stylesheet·font 요청과 fallback 검증이 완료되었거나 미완료 사유가 기록됨
- `npm run verify:phase1`부터 최종 Phase 4 검사까지 통과함
- Phase 3 production migration과 실제 권한 상태가 보고서와 일치함
- GitHub 저장소의 현재 branch와 배포 대상 branch가 확인됨
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` GitHub Variables가 준비됨
- custom domain DNS를 변경할 담당자와 변경 시간이 정해짐
- Google OAuth와 Supabase Dashboard를 확인할 권한이 준비됨

## 3. 범위와 비범위

### 3.1 포함

- Phase 1–4 안전·빌드·단위 검사 통합
- Git tracked private file, `.env`, secret, service role key 검사
- source·`dist`·Git history의 PII marker 검사
- Supabase table grant·policy·function execute 권한 점검
- DELETE·TRUNCATE·REFERENCES·TRIGGER 과다 권한 점검
- 관계 cycle 차단과 동시성 보정 확인
- GitHub Actions build gate와 Pages artifact 확인
- custom domain·DNS·HTTPS·cache 확인
- Supabase Site URL·Redirect URL과 Google OAuth callback 확인
- 두 Admin의 로그인·조회·추가·수정·숨김 smoke test
- 모바일·PC·오류 복구·로그아웃 확인
- 운영 문서와 비밀값 정리

### 3.2 제외

- 회원 데이터 일괄 수정·재import
- DB schema 또는 RLS 정책의 임의 완화
- DELETE policy·영구 삭제 API·복원 UI 추가
- Realtime·pagination·server-side search 도입
- 별도 Admin/Editor 역할 분리
- Google Client Secret, DB password, service role key를 저장소나 문서에 기록
- J님 승인 없는 production test row 생성·수정·삭제
- custom domain을 우회하기 위한 다른 호스팅으로의 임시 이전

## 4. 최종 승인 표

| 항목 | Phase 5 기준 | 확인 방법 | 중단 조건 |
| --- | --- | --- | --- |
| 배포 branch | `main` push 또는 승인된 workflow dispatch만 배포 | GitHub Actions run | 다른 branch가 production으로 연결됨 |
| build gate | `npm ci` 후 최종 verify 명령 통과 | Actions log와 local 재현 | build 또는 안전 검사 실패 |
| frontend key | Supabase URL·publishable key만 사용 | source·bundle scan | secret/service role 형태 발견 |
| 회원 PII | source·`dist`·tracked private file에 없음 | 기존 marker 검사와 파일 목록 | 실제 이름·전화번호·CPF 발견 |
| members 권한 | authenticated SELECT·INSERT·UPDATE만 허용 | SQL privilege 조회·RLS 테스트 | DELETE·TRUNCATE 또는 과다 grant 존재 |
| domain | `https://member.nangok.app/`에서 정상 응답 | DNS·HTTPS·브라우저 | certificate 오류·잘못된 artifact |
| OAuth | production origin으로 로그인 callback 성공 | 두 Admin 계정 browser test | callback mismatch 또는 unauthorized 접근 |
| 운영 key | service role·client secret을 로컬/관리 화면에서만 보관 | env·GitHub secret/variable 점검 | 채팅·GitHub source·frontend 노출 |

## 5. 실행 계획

### 5.1 Step 0 — Phase 4 완료 gate

1. Phase 4 계획서의 완료 기준을 다시 확인한다.
2. 실제 UI 요구사항이 추가되면 Phase 5 범위에 끼워 넣지 않고 Phase 4로 되돌린다.
3. 외부 웹폰트 요청·적용, 관리 화면 문구, 모바일 overflow 등 잔여 항목을 완료 또는 보류 사유로 기록한다.
4. 현재 commit, branch, working tree 상태를 기록한다.

### 5.2 Step 1 — 전체 자동 검사와 build 재현

로컬에서 다음 순서로 실행한다.

```text
npm ci
npm run verify:phase1
npm run verify:phase2
npm run verify:phase3
npm run verify:phase4
npm run build
```

최종적으로는 `verify:phase5`를 추가해 다음 검사를 하나의 gate로 묶는 것을 권장한다.

- Phase 1 안전 검사
- Phase 2 private file 격리 검사
- Phase 3 repository·migration 안전 검사
- Phase 4 build·unit test
- `dist` secret·PII·외부 asset 검사
- `dist/index.html`이 현재 asset hash를 가리키는지 검사

검사 결과에는 개인정보 값을 출력하지 않고 파일 경로, field 종류, count만 기록한다.

### 5.3 Step 2 — 저장소·source·dist 보안 검사

- `git ls-files`로 `reports/`, `.env.*` private file, prepared payload, rollback UUID가 추적되지 않는지 확인한다.
- `.env.local`, `.env.import.local`, service role key, Google Client Secret이 Git history와 working tree에 없는지 확인한다.
- `sb_secret_` 형태 문자열과 service role JWT를 전체 text file에서 검사한다.
- 과거 seed에서 추출한 PII marker와 `scripts/pii-markers.local.txt`를 source·docs·`dist`에 대조한다.
- `dist` JavaScript와 CSS에 실제 회원 이름·전화번호·CPF·CSV header가 없는지 확인한다.
- `dist/index.html`의 asset 경로가 방금 생성한 bundle과 일치하는지 확인한다.
- source map을 배포하지 않는지 확인하고, 배포가 필요하면 source map의 개인정보 포함 여부를 별도 확인한다.

검사 실패 시 배포하지 않는다. 실제 개인정보가 발견되면 해당 파일을 삭제하는 것으로 끝내지 말고 Git history와 Pages artifact까지 노출 범위를 확인한다.

### 5.4 Step 3 — Supabase production 권한과 RLS 확인

Supabase SQL Editor에서 읽기 중심으로 다음을 확인한다.

- `public.members`의 `authenticated` 권한은 SELECT·INSERT·UPDATE만 존재한다.
- `public`, `anon`, `authenticated`의 DELETE·TRUNCATE·REFERENCES·TRIGGER 권한이 없다.
- members DELETE policy가 없다.
- 기존 세 RLS policy가 로그인·workspace Admin 조건을 모두 검사한다.
- `has_ngmembers_admin_access()`와 `get_ngmembers_access()`의 execute 권한이 의도한 role에만 있다.
- cycle trigger function이 `SECURITY INVOKER`, 빈 `search_path`, 필요한 volatility 설정을 유지한다.
- `affiliation_id`와 `direct_parent_id` 관계 cycle 차단 trigger와 advisory lock이 존재한다.
- production row count와 관계 count가 기준선과 일치한다.

production write smoke test는 J님이 명시적으로 승인한 경우에만 수행한다. 승인된 경우에도 실제 개인정보가 아닌 가짜 marker를 사용하고, 테스트 행 정리는 일반 앱 세션이 아니라 SQL Editor에서 수행한다. 삭제 차단 확인은 권한 오류를 확인한 뒤 승인된 관리 경로로만 정리한다.

### 5.5 Step 4 — GitHub Actions와 Pages artifact

현재 workflow의 `Build and verify`가 Phase 3 검사에 머물러 있으므로, Phase 4 완료 후 최종 gate로 승격한다.

- `npm ci`가 lockfile과 일치하는지 확인한다.
- Node 22와 Vite build 결과를 고정한다.
- `VITE_SUPABASE_URL`과 `VITE_SUPABASE_PUBLISHABLE_KEY`는 GitHub Variables에서만 주입한다.
- service role, DB password, Google Client Secret은 workflow env에 넣지 않는다.
- build job은 verify 실패 시 artifact를 업로드하지 않는다.
- deploy job은 build job 성공 뒤에만 실행한다.
- `contents: read`, deploy에 필요한 `pages: write`, `id-token: write` 최소 권한을 유지한다.
- `pages` concurrency와 `cancel-in-progress` 동작을 유지한다.
- workflow dispatch로 승인된 commit을 한 번 배포하고 Actions log와 artifact를 기록한다.

### 5.6 Step 5 — custom domain과 HTTPS

GitHub Pages와 DNS 관리 화면에서 다음 순서로 확인한다.

1. GitHub Pages의 custom domain을 `member.nangok.app`으로 설정한다.
2. DNS의 `member` CNAME이 GitHub Pages 대상(`mworkroom.github.io`)을 가리키는지 확인한다.
3. DNS 전파 전후에 기존 production 주소와 custom domain의 응답을 비교한다.
4. GitHub Pages HTTPS certificate 발급과 강제 HTTPS를 확인한다.
5. `https://member.nangok.app/`에서 `index.html`, JS, CSS, 외부 stylesheet·font 요청 상태를 확인한다.
6. 브라우저 cache가 과거 bundle을 보여주지 않는지 새 private window에서도 확인한다.

DNS와 Pages 설정 변경은 외부 상태를 바꾸므로 실행 시 J님에게 변경 범위와 대상 값을 먼저 확인받는다.

### 5.7 Step 6 — Supabase Auth와 Google OAuth

현재 앱은 `import.meta.env.BASE_URL`과 현재 origin을 조합해 OAuth `redirectTo`를 생성하므로 Pages 경로와 custom domain에서 실제 값을 확인한다.

- Supabase Auth Site URL을 `https://member.nangok.app/`으로 설정한다.
- Supabase Redirect URLs에 custom domain root를 등록한다.
- 전환 기간에는 기존 Pages 주소 `https://mworkroom.github.io/ngmembers/`를 유지할지 확인한다.
- 로컬 개발 주소는 production redirect와 구분해 필요한 경우에만 유지한다.
- Google Cloud OAuth client에는 Supabase Dashboard가 제공하는 callback URL을 등록한다.
- Google Client Secret은 Google Cloud/Supabase Dashboard에만 저장한다.
- J님과 엄마 계정 각각에서 로그인 → callback → workspace Admin 확인까지 실행한다.
- 허용되지 않은 계정은 로그인 후 회원 목록에 진입하지 못하는지 확인한다.
- 로그아웃 후 뒤로가기·새로고침으로 회원 목록이 노출되지 않는지 확인한다.

Redirect mismatch, callback error, unauthorized 계정의 데이터 노출이 발생하면 즉시 배포를 중단한다.

### 5.8 Step 7 — 최종 실사용 smoke test

PC, iPhone portrait 약 390px, iPad portrait 약 768px에서 두 Admin 계정으로 확인한다.

#### 로그인·권한

- Google 로그인과 재로그인
- 허용된 두 Admin의 동일 접근
- 권한 없는 계정의 차단 화면
- 로그아웃과 세션 만료 후 재접근 차단

#### 회원 목록·검색

- 1,378명 전체 load와 count
- 이름·닉네임·회원번호·전화번호·메모 검색
- 정확한 회원번호 검색만 자동 펼침
- 메모 검색은 접힌 카드로 표시
- 전체·주요 사업자·관심 회원 필터
- 새로고침과 다른 기기 반영

#### 회원 카드·편집

- 접힌 카드의 메모 10글자 미리보기
- 펼친 카드의 전체 메모
- 카드 국가 코드 `KR`, `BR`, `MX`, `XX`
- 국가 드롭다운 저장과 빈 값 처리
- `엘리자베스 100`, `헐실라 hercilla` 닉네임 저장
- 추가·수정·숨김과 충돌 오류
- 전화번호 link, 관계 회원 이동, 관리 화면

#### 화면·접근성

- 가로 overflow 0
- 긴 이름·닉네임·메모의 말줄임과 줄바꿈
- keyboard focus, Escape, dialog title, `aria-expanded`
- console error 0
- 새로고침 후 secret·PII가 화면이나 bundle에 나타나지 않음

### 5.9 Step 8 — 운영 인수인계와 종료

- 운영 URL, 로그인 계정 범주, 관리자 변경 절차를 README에 기록한다.
- Supabase Dashboard에서 workspace membership을 중지하는 절차를 기록한다.
- Google OAuth client, Supabase key, GitHub Variables/Secrets의 보관 위치를 값 없이 기록한다.
- key rotation이 필요한 경우 영향 범위와 순서를 기록한다.
- 장애 시 Pages 이전 배포로 되돌리는 방법과 OAuth/DNS rollback 조건을 기록한다.
- 최종 build hash, GitHub Actions run, production 확인 시간, 브라우저별 결과를 보고서에 기록한다.
- 실제 개인정보와 secret은 보고서·devlog·commit에 기록하지 않는다.

## 6. 중단 조건

다음 중 하나라도 발생하면 해당 작업을 중단하고 J님에게 확인한다.

- Phase 4 완료 조건이 충족되지 않음
- source, `dist`, Git history에서 실제 회원 PII 또는 secret 발견
- `authenticated`에 DELETE·TRUNCATE 또는 과다 권한 존재
- RLS policy 또는 Admin access function 정의가 기준선과 다름
- production count·관계·cycle이 기준선과 다름
- OAuth callback이 다른 origin으로 이동하거나 unauthorized 계정이 접근함
- custom domain certificate가 발급되지 않음
- Actions가 검증되지 않은 artifact를 배포함
- production write smoke test에 필요한 승인·backup·정리 경로가 없음
- 기존 Phase 1–4 테스트 또는 build가 실패함

## 7. 산출물

- `docs/plans/phase-5-security-deployment-plan.md`
- `scripts/verify-phase-5.mjs` 또는 동등한 최종 안전 검사
- `package.json`의 `verify:phase5` 명령
- Phase 5 구현 보고서
- 업데이트된 GitHub Actions workflow
- 업데이트된 README와 Supabase 운영 안내
- 최종 보안·배포·실사용 결과가 반영된 `docs/devlog/YYYY-MM-DD.md`

## 8. 완료 기준

- Phase 1–4 자동 검사와 Phase 5 최종 검사가 통과한다.
- source·`dist`·Git tracked file·배포 artifact에 실제 PII와 secret이 없다.
- production `members` 권한과 RLS가 SELECT·INSERT·UPDATE 중심으로 유지된다.
- DELETE·TRUNCATE가 일반 세션에서 차단된다.
- 관계 cycle trigger와 동시성 보호가 유지된다.
- GitHub Actions가 검증 실패 시 배포하지 않는다.
- `https://member.nangok.app/`에서 HTTPS와 최신 artifact가 정상 응답한다.
- Supabase Auth와 Google OAuth가 production origin에서 정상 callback한다.
- 두 Admin의 PC·iPhone·iPad 실사용 smoke test가 통과한다.
- unauthorized 계정과 로그아웃 상태에서 회원 데이터가 노출되지 않는다.
- 운영 중단·membership 제거·key rotation·rollback 절차가 값 없이 문서화된다.
- Phase 5 보고서와 devlog가 갱신된다.

## 9. Phase 5 이후

Phase 5 완료 후에는 기능 개발을 재개하기 전에 운영 중 발생한 오류와 요청을 별도 Issue로 분리한다. 기존 회원 데이터·권한·배포 구조를 바꾸는 요청은 영향 평가와 J님 승인 후 별도 Phase로 계획한다.
