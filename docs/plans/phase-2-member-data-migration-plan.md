# 회원앱 Phase 2 실행 계획서

- 작성일: 2026-07-18
- 대상: 최종 회원 CSV 검증·보정과 Supabase `members` 최초 이전
- 선행 상태: Phase 1 완료, Auth/RLS/DELETE 차단과 안전한 Git 이력 확인
- 이번 문서의 역할: 실제 개인정보를 DB에 넣기 전에 입력 규칙, 승인 지점, 원자적 import와 rollback 기준을 확정
- 중요: 계획서 작성 단계에서는 최종 CSV·Supabase 데이터·환경변수를 변경하지 않는다.

## 1. Phase 2의 목표

Phase 2에서는 최종 CSV 1,378명을 검증하고, J님이 승인한 보정만 적용한 뒤 Supabase `members`에 최초 1회 이전한다.

```text
원본 CSV 고정 및 hash 확인
→ strict validation
→ 오류 보정안·경고 report
→ J님 승인
→ 개인정보 없는 dry-run 요약
→ 대상 DB와 빈 테이블 확인
→ 원자적 2단계 import
→ DB 결과 재검증
→ 일회성 import 권한 제거
```

Phase 2가 끝나면 다음이 성립해야 한다.

- 입력 CSV와 적용한 보정 내역을 로컬에서 재현할 수 있음
- 오류 0건인 입력만 production import 가능
- 1,378개 기본 행과 승인된 `affiliation_id` 관계가 한 transaction에서 반영됨
- 실패하면 `members`에 부분 데이터가 남지 않음
- 미해결·복수 sponsor는 임의 연결하지 않고 `NULL`과 private report로 남음
- 실제 CSV, service role key, 개인정보 report가 Git/GitHub/build에 없음
- Phase 3가 시작되기 전까지 앱은 기존 demo fixture를 계속 사용함

## 2. Phase 2 시작 기준

### 완료된 선행 조건

- Phase 1 SQL과 Google Auth 적용
- J님·엄마 Admin 정상 접근 확인
- RLS SELECT·INSERT·UPDATE 허용 및 DELETE 차단
- public Git history에서 과거 PII 제거
- `members` schema 생성

### 시작 직후 확인할 조건

- 최종 CSV의 경로, 크기, 수정 시각, SHA-256을 다시 기록
- Supabase 대상 project URL의 project ref 재확인
- `public.members` 현재 행 수가 0인지 확인
- 다른 작업자가 Phase 2 중 `members`에 데이터를 넣지 않는지 확인
- 기존 엄마용 project 전체 backup 또는 Supabase가 제공하는 복구 지점 확인

`members`가 0행이 아니면 자동 병합하거나 덮어쓰지 않고 즉시 중단한다.

## 3. 입력 파일과 개인정보 원칙

### 입력 파일

기준 원본은 저장소 밖의 최종 `ngmembers.csv`다. 원본을 직접 덮어쓰지 않고 다음처럼 분리한다.

```text
원본: ngmembers.csv
작업본: ngmembers-phase2.csv
보정 manifest: reports/phase2/corrections.local.json
```

모든 파일은 Git ignore 범위에 두며 실제 값, 일부 행, screenshot도 Issue·PR·채팅에 올리지 않는다.

### 공개 가능한 정보

- 전체 행 수와 오류·경고 건수
- CSV SHA-256
- 오류가 있는 CSV 행 번호와 필드 종류
- 관계 연결 성공·미해결·복수 후보 건수
- DB import 전후 집계

### 공개하면 안 되는 정보

- 이름·닉네임·회원번호·전화번호·CPF·생년월일·메모
- service role key, DB password, access token
- private validation report와 prepared import payload

## 4. 현재 기준선과 해결할 항목

Phase 0의 마지막 검사 기준:

```text
전체              1,378행
import 중단 오류      6건
경고                 84건 / 82행
```

### 반드시 해결할 오류 6건

| 종류 | 건수 | CSV 행 | Phase 2 처리 원칙 |
| --- | ---: | --- | --- |
| 잘못된 생년월일 | 5 | 333, 352, 428, 737, 1165 | 정확한 날짜로 수정하거나 J님 승인 후 `NULL` |
| 자기 자신 sponsor | 1 | 1020 | 올바른 sponsor로 수정하거나 J님 승인 후 미연결 `NULL` |

스크립트가 날짜나 sponsor를 추측해 고치지 않는다. 정확한 값이 없으면 `NULL`로 바꾸는 것도 명시적 승인 항목으로 기록한다.

### 승인 후 import 가능한 경고

| 종류 | 기준 건수 | 처리 원칙 |
| --- | ---: | --- |
| 회원번호 없음 | 2 | `NULL` 허용, row UUID로 구분 |
| 이름 없음 | 2 | DB `NULL` 허용, `review` 전환 여부 확인 |
| 국가 미확인 | 5 | `NULL` 허용 |
| sponsor 후보 없음 | 67 | `affiliation_id = NULL`, private unresolved report |
| sponsor 복수 후보 | 1 | 임의 선택 금지, `affiliation_id = NULL`, private ambiguous report |
| CPF 형식 의심 | 5 | 원문 확인 후 승인된 값 또는 `NULL`; 자동 보정 금지 |
| 전화번호 형식 의심 | 1 | 원문 확인 후 승인된 값 또는 `NULL`; 자동 보정 금지 |
| 공백만 있는 CPF | 1 | `NULL`로 정규화 |

최종 파일을 다시 검사하면 건수는 달라질 수 있다. 위 숫자는 회귀 확인용 기준이지 강제로 맞춰야 할 목표값이 아니다.

## 5. 구현할 도구와 결과물

예정 구조:

```text
scripts/members/
├─ validate-members.ts
├─ prepare-members.ts
├─ import-members.ts
└─ lib/
   ├─ csv.ts
   ├─ normalize.ts
   ├─ relations.ts
   └─ reports.ts

supabase/
├─ 004_phase2_import_rpc.sql
├─ 004a_phase2_import_rpc_secret_key_compat.sql
└─ 005_phase2_remove_import_rpc.sql

reports/phase2/                 # 전체 Git ignore
├─ validation-summary.json
├─ validation-warnings.csv
├─ unresolved-sponsors.csv
├─ ambiguous-sponsors.csv
├─ prepared-import.local.json
└─ rollback-ids.local.json
```

TypeScript 실행에는 `tsx`를 dev dependency로 사용한다. 브라우저용 `src/utils/csv.ts`는 잘못된 상태값을 기본값으로 바꾸고 일부 값을 느슨하게 정규화하므로 production validator로 재사용하지 않는다. 공통으로 쓸 수 있는 순수 정규화 규칙만 테스트를 통해 별도 module로 옮긴다.

## 6. strict validation 규칙

### 파일 구조 오류

- UTF-8 또는 UTF-8 BOM이 아니면 중단
- header 중복·누락·알 수 없는 필드가 있으면 중단
- 열 수가 header와 다른 행이 있으면 중단
- 빈 trailing row 외의 빈 행이 있으면 경고
- 원본 SHA-256과 corrections manifest의 기준 hash가 다르면 중단

### 값 오류로 import 중단

- 비어 있지 않은 회원번호 중복
- 회원번호에 숫자 외 문자 존재
- boolean이 승인된 표현이 아님
- side가 `좌`, `우`, 빈 값이 아님
- `member_status`가 `active`, `withdrawn`, `review`가 아님
- 비어 있지 않은 생년월일이 실제 달력상 유효한 8자리 날짜가 아님
- 비어 있지 않은 국가 코드가 영문 대문자 두 글자가 아님
- 같은 행이 자기 자신을 sponsor로 지정
- DB text/date/boolean으로 변환할 수 없음
- prepared payload가 schema 제약을 위반함

### 경고와 정보

- 회원번호·이름·국가 없음
- CPF·전화번호 형식 의심
- sponsor 미입력
- sponsor 정확 일치 후보 0명 또는 2명 이상
- 관계 방향은 있지만 sponsor가 없음
- `review`, `withdrawn`, `is_hidden = true` 분포

오류가 1건이라도 있으면 `prepare`와 `import --apply`는 실행되지 않는다.

## 7. 정규화 규칙

DB 입력 직전에만 다음 변환을 적용한다.

```text
빈 문자열·공백 문자열 → NULL
member_number          → 앞뒤 공백 제거, 숫자 문자열 유지
birth_date YYYYMMDD    → YYYY-MM-DD
좌 / 우                → left / right
country_code           → 영문 대문자 두 글자 또는 NULL
boolean                → true / false
```

이름·닉네임·메모·sponsor 원문은 앞뒤 공백과 연속 공백만 정리하며 번역, 철자 교정, 부분 삭제를 자동으로 하지 않는다. CPF·전화번호도 숫자가 있다는 이유만으로 임의 변환하지 않고 보정 manifest에서 승인한 규칙만 적용한다.

## 8. sponsor 관계 준비

모든 회원에 UUID를 먼저 부여한 prepared payload를 만든다. 관계 후보는 정규화된 다음 값의 정확 일치만 사용한다.

1. `nickname`
2. `name`
3. `member_number`

정규화 범위:

- 앞뒤 공백 제거
- 연속 공백 하나로 축소
- 영문 대소문자 무시

하지 않는 것:

- 부분 일치
- 단어 분해
- 발음·번역 추측
- 여러 후보 중 첫 번째 자동 선택

결과:

```text
정확히 1명 → affiliation_id에 prepared UUID 저장
0명        → NULL + unresolved report
2명 이상   → NULL + ambiguous report
자기 자신   → 오류로 중단
```

`direct_parent_id`와 `direct_parent_side`는 Phase 2에서 추측하지 않고 `NULL`로 둔다.

## 9. dry run과 J님 승인 지점

### Dry run 출력

터미널과 공개 보고에는 값 없이 다음 집계만 표시한다.

```text
source SHA-256
전체·입력 가능 행 수
오류·경고 건수
NULL 변환 건수
상태·flag·국가·side 분포
sponsor 단일 연결·미해결·복수·미입력 건수
prepared payload hash
예상 DB insert/update 건수
```

### 승인 1 — 오류 보정

J님이 6개 오류 행의 보정 또는 `NULL` 전환을 확인한다. 승인 내용은 source hash와 함께 local corrections manifest에 기록한다.

### 승인 2 — 경고 수용

이름·국가·sponsor·CPF·전화번호 경고를 수정할지 그대로 import할지 범주별로 확인한다.

### 승인 3 — production apply

다음을 다시 보여준 뒤 명시적으로 승인받는다.

- 대상 project ref
- `members` 현재 행 수 0
- source/prepared hash
- 예상 insert 1,378건
- 관계 update 예상 건수
- backup/rollback 준비 상태

계획서 승인만으로 production import까지 자동 승인된 것으로 간주하지 않는다.

## 10. 원자적 import 설계

### 환경변수

로컬 전용 `.env.import.local`에만 둔다.

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
EXPECTED_SUPABASE_PROJECT_REF
```

`VITE_` 접두사를 붙이지 않으며 source, report, terminal 출력, GitHub Secret이 아닌 곳에 key를 복사하지 않는다.

### 일회성 RPC

`004_phase2_import_rpc.sql`은 다음 성격의 함수를 만든다.

- `anon`, `authenticated`, `public` 실행 권한 없음
- `service_role`만 실행 가능
- 호출 시작 시 `members`가 0행인지 확인
- prepared payload 전체 건수와 예상 건수 확인
- 기본 행 insert 후 `affiliation_id`, `side` 반영
- 최종 행 수·관계 수·제약 위반 여부 확인
- 하나라도 실패하면 transaction 전체 rollback
- 성공 시 값이 아닌 집계만 반환

하나의 RPC 호출은 PostgreSQL transaction 하나이므로 1단계 insert와 2단계 관계 update 사이에 실패해도 부분 행이 남지 않는다.

성공과 사후 검증이 끝나면 `005_phase2_remove_import_rpc.sql`로 import 함수를 제거한다. service role key도 로컬 import 환경에서 제거하거나 rotate 여부를 확인한다.

## 11. import 실행 안전장치

`import-members.ts`의 기본 동작은 dry run이다. 실제 반영에는 다음을 모두 요구한다.

```text
--apply
--expected-count 1378
--source-sha256 <승인 hash>
--prepared-sha256 <승인 hash>
```

추가 안전장치:

- target project ref가 `EXPECTED_SUPABASE_PROJECT_REF`와 다르면 중단
- `members`가 0행이 아니면 중단
- source나 prepared payload가 승인 이후 바뀌면 중단
- terminal에 개인정보를 출력하지 않음
- request 실패 시 retry로 중복 insert하지 않고 DB count를 다시 확인
- 성공 응답을 받지 못한 경우 자동 재실행 금지

## 12. 사후 검증

### DB 집계

- 전체 `members` = 1,378
- 비어 있지 않은 `member_number` unique
- status, flag, country, side 분포가 prepared summary와 일치
- `affiliation_id`가 모두 존재하는 row를 참조
- 자기 참조 없음
- `direct_parent_id`는 전부 `NULL`
- `created_at`, `updated_at` 존재
- RLS 활성 상태 유지

### 권한

- 익명 SELECT는 데이터 0건
- 미허용 로그인 사용자 SELECT는 데이터 0건
- 두 Admin SELECT는 1,378건
- 두 Admin DELETE는 계속 차단
- 일회성 import RPC는 제거됐거나 실행 권한 없음

### 개인정보

- source·prepared payload·private report가 Git status에 나타나지 않음
- 새 `dist`에 실제 회원 marker가 없음
- GitHub Issue·commit·devlog에는 count와 hash만 존재

### 표본 확인

J님이 값이 아닌 검증 대상 행을 private report에서 선택해 다음 범주를 직접 확인한다.

- 회원번호 없는 2명
- 이름 없는 2명
- 국가 미확인 5명
- sponsor 정상 연결 사례
- sponsor 미해결·복수 후보 사례
- 생년월일 보정 5건
- 자기 sponsor 보정 1건

## 13. rollback 원칙

RPC 실패는 자동 rollback되어 DB가 0행이어야 한다.

성공 후 J님 검수에서 중대한 문제가 발견되면 자동 삭제하지 않는다. prepared payload의 UUID 목록을 담은 `rollback-ids.local.json`과 현재 DB hash/count를 대조하고, Phase 3 쓰기가 시작되지 않았음을 확인한 뒤 별도 transaction으로만 되돌린다.

rollback transaction 순서:

1. 대상 UUID와 현재 1,378행이 정확히 일치하는지 확인
2. 해당 행의 self-reference FK를 `NULL`로 해제
3. 정확한 UUID 목록만 service role로 삭제
4. `members = 0` 확인
5. 원인 수정 후 validation부터 다시 시작

공유 Supabase project 전체를 과거 시점으로 복원하면 다른 앱 데이터가 함께 되돌아갈 수 있으므로, 전체 restore는 project 장애 같은 최후 수단으로만 사용한다.

## 14. Phase 2에서 하지 않는 것

- 실제 회원 CSV 또는 report를 Git에 commit
- 브라우저 bundle에 실제 회원정보 포함
- 앱 UI를 Supabase 조회로 전환
- 회원 추가·수정·숨김 UI의 DB 연결
- `direct_parent_id` 추측
- sponsor 부분 일치 자동 연결
- 경고값 자동 수정
- production table 비우기 또는 전체 덮어쓰기 기능 추가
- Phase 3 이후 재실행 가능한 상시 import endpoint 유지

이 항목은 Phase 3 이후 각 단계에서 별도로 처리한다.

## 15. 예상 결과물

```text
docs/plans/phase-2-member-data-migration-plan.md
scripts/members/validate-members.ts
scripts/members/prepare-members.ts
scripts/members/import-members.ts
scripts/members/lib/*
supabase/004_phase2_import_rpc.sql
supabase/005_phase2_remove_import_rpc.sql
.env.import.example
docs/reports/phase-2-implementation.md        # 개인정보 없는 요약
reports/phase2/*                              # local-only private 결과
```

## 16. Phase 2 완료 판정

```text
[ ] source hash와 corrections manifest 고정
[ ] validation 오류 0건
[ ] 모든 경고 범주 J님 승인
[ ] prepared payload와 관계 report 생성
[ ] production apply 직전 별도 승인
[ ] target members 0행·project ref·backup 확인
[ ] 원자적 RPC import 성공
[ ] members 1,378행과 집계 일치
[ ] affiliation 관계 집계 일치
[ ] 익명·미허용 SELECT 차단
[ ] 두 Admin SELECT 성공·DELETE 실패
[ ] import RPC 제거
[ ] PII source/report가 Git·dist에 없음
[ ] Phase 2 개인정보 없는 결과 보고서와 개발 로그 작성
```

## 17. Phase 2 시작 시 첫 작업

J님이 Phase 2 구현을 승인하면 production import부터 실행하지 않는다. 가장 먼저 다음 세 가지를 함께 처리한다.

1. 최종 CSV의 새 SHA-256과 현재 오류·경고 기준선 재확인
2. strict validator와 local-only corrections manifest 구조 구현
3. 가짜 fixture로 validator·prepare·원자적 rollback 경로 테스트

가짜 데이터의 dry run과 실패 rollback을 통과한 뒤 실제 CSV의 보정 승인 단계로 넘어간다.
