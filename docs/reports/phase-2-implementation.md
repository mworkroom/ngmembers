# 회원앱 Phase 2 구현 보고서

- 구현일: 2026-07-18 (Asia/Seoul)
- 범위: strict CSV validation, local-only 보정·준비, 원자적 import RPC와 제거 migration
- production 상태: 반영 완료. 1,378행·sponsor 관계 1,271건을 원자적으로 import하고 사후 검증 후 일회성 RPC를 제거함

## 1. 구현 결과

실제 회원 값을 Git이나 terminal에 노출하지 않고 다음 흐름을 구현했다.

```text
저장소 밖 원본 CSV
→ Git ignore 작업본과 source SHA-256 고정
→ strict validation과 private report
→ source hash에 묶인 corrections.local.json 승인
→ deterministic UUID와 prepared payload 생성
→ 대상 project/빈 members/backup/hash 재확인
→ service_role 전용 RPC 한 번으로 기본 행 + sponsor 관계 반영
→ DB 집계 검증
→ 일회성 RPC 제거
```

브라우저용 `src/utils/csv.ts`는 재사용하지 않았다. 운영 이전은 잘못된 boolean·status·side·날짜를 자동 기본값으로 완화하면 안 되므로 별도의 중단형 parser와 validator를 사용한다.
CSV boolean은 대소문자를 무시한 `TRUE`/`FALSE`만 허용하고, status는 `active`·`withdrawn`·`review` 소문자만 허용한다.

## 2. 추가한 결과물

- `scripts/members/validate-members.ts`: UTF-8·header·열 수·필드·관계 strict validation
- `scripts/members/prepare-members.ts`: 승인 manifest 확인, deterministic UUID, prepared payload와 rollback ID 생성
- `scripts/members/import-members.ts`: 기본 dry-run, service-role credential·project ref·빈 table·source/prepared hash·backup 확인 후 단일 RPC 호출
- `scripts/members/lib/*`: CSV parser, 정규화, sponsor exact match, report, hash와 payload 검증
- `scripts/members/__fixtures__/valid-members.csv`: 개인정보 없는 3행 가짜 fixture
- `supabase/004_phase2_import_rpc.sql`: `service_role` 전용 원자적 2단계 import
- `supabase/004a_phase2_import_rpc_secret_key_compat.sql`: 이미 적용된 004의 새 `sb_secret_*` key 호환 보정
- `supabase/005_phase2_remove_import_rpc.sql`: 검증 완료 후 일회성 RPC 제거
- `supabase/tests/phase2_import_rollback.sql`: 빈 검증 DB에서 실행하는 가짜 rollback 검사
- `.env.import.example`: 브라우저와 분리된 local-only import 환경 예시

`reports/phase2/` 전체와 `.env.import.local`은 Git에서 제외된다. 실제 CSV, prepared payload, rollback UUID, sponsor private report와 service role key는 이 디렉터리 또는 로컬 환경에만 둔다.

## 3. 최신 CSV 재검증

J님이 다시 전달한 CSV를 원본 그대로 보존하고 `reports/phase2/ngmembers-phase2.csv` 작업본으로 복사해 검사했다.

| 항목 | 결과 |
| --- | ---: |
| SHA-256 | `3d0f2d8e06958e6bd957a46120e81b48d461fdf8cddfdd6fe5aebddb3af2ab1b` |
| 크기 | 137,993 bytes |
| 인코딩 | BOM 없는 UTF-8 |
| 회원 행 | 1,378 |
| import 중단 오류 | 0 |
| 경고 | 80건 / 78행 |
| sponsor 단일 연결 예상 | 1,271 |
| sponsor 미해결 | 67 |
| sponsor 복수 후보 | 1 |
| sponsor 미입력 | 39 |

이전 기준선의 잘못된 생년월일 5건과 자기 sponsor 1건은 최신 CSV에서 모두 해소됐다. 현재 경고 분포는 다음과 같다.

| 경고 코드 | 건수 |
| --- | ---: |
| `member_number_missing` | 2 |
| `name_missing` | 2 |
| `country_code_missing` | 5 |
| `sponsor_unresolved` | 67 |
| `sponsor_ambiguous` | 1 |
| `cpf_suspicious` | 1 |
| `cpf_whitespace_only` | 1 |
| `phone_suspicious` | 1 |

스폰서 미입력 39건은 추측 연결하지 않는 정보 항목이며 경고 80건에는 포함하지 않았다. 검증 결과와 실제 값이 필요한 sponsor report는 `reports/phase2/`에만 생성했다.

## 4. 승인 manifest

첫 validation이 source hash를 넣은 `reports/phase2/corrections.local.json`을 만들었다. 승인 전에는 `prepare`가 `APPROVED_MANIFEST_REQUIRED`로 정상 차단되는 것을 확인했다.

J님은 2026-07-18에 현재 CSV를 그대로 이전하는 방향으로 모든 경고 범주를 승인했다. 회원번호·이름·국가의 실제 미등록 값과 공백 CPF는 `NULL`, sponsor 미해결·복수 후보는 임의 연결 없이 `affiliation_id = NULL`, CPF·전화번호 형식 의심값은 Supabase `text` 원문으로 이전해 사용자가 나중에 확인·수정하는 것으로 기록했다. 실제 값 보정은 없어 `corrections`는 빈 배열이다.

오류가 없는 최신 CSV를 그대로 사용한다면 `corrections`는 빈 배열로 유지한다. 경고를 수정하지 않고 수용하기로 한 범주만 다음 구조로 기록한다.

```json
{
  "version": 1,
  "sourceSha256": "승인한 source SHA-256",
  "approvedBy": "승인자",
  "approvedAt": "ISO-8601 시각",
  "corrections": [],
  "warningApprovals": {
    "warning_code": {
      "decision": "accept",
      "reason": "검토 근거"
    }
  }
}
```

실제 값 보정이 필요하면 `corrections`에 CSV 행 번호, 필드, 대체 값 또는 `null`, 이유를 기록한다. manifest의 source hash가 다르거나 승인 정보가 없거나 현재 남은 경고 코드가 모두 승인되지 않으면 prepared payload는 생성되지 않는다.

## 5. 실행 방법

### Validation

```powershell
npm run members:validate -- reports/phase2/ngmembers-phase2.csv `
  --report-dir reports/phase2 `
  --init-corrections
```

### 승인 후 prepare

```powershell
npm run members:prepare -- reports/phase2/ngmembers-phase2.csv `
  --corrections reports/phase2/corrections.local.json `
  --report-dir reports/phase2
```

### 오프라인 dry-run

```powershell
npm run members:import -- `
  --prepared reports/phase2/prepared-import.local.json `
  --source reports/phase2/ngmembers-phase2.csv
```

### Production 읽기 전용 preflight

```powershell
npm run members:import -- `
  --preflight `
  --prepared reports/phase2/prepared-import.local.json `
  --source reports/phase2/ngmembers-phase2.csv
```

Preflight는 credential 종류와 URL/project ref, 두 hash를 검증하고 `members` count만 조회한다. RPC를 호출하거나 DB 값을 변경하지 않는다.

### 승인된 production apply

`004_phase2_import_rpc.sql`을 먼저 적용하고 `.env.import.local`에 세 값을 설정한다. 아래 모든 placeholder는 직전 dry-run에서 승인한 값으로 넣는다.

```powershell
npm run members:import -- `
  --apply `
  --prepared reports/phase2/prepared-import.local.json `
  --source reports/phase2/ngmembers-phase2.csv `
  --expected-count 1378 `
  --source-sha256 <approved-source-sha256> `
  --prepared-sha256 <approved-prepared-sha256> `
  --confirm-project-ref <expected-project-ref> `
  --backup-confirmed
```

첫 production 호출은 HTTP 403으로 실패했고 PostgreSQL 로그에서 `phase2 import requires service_role`을 확인했다. 새 `sb_secret_*` key는 실제 `service_role` 권한과 RPC EXECUTE 권한을 가졌지만 JWT가 아니어서, 이미 적용된 004의 `request.jwt.claim.role` 검사가 정상 요청을 잘못 거부한 것이 원인이었다. 트랜잭션은 정상 rollback되어 `members = 0`을 유지했다.

새 설치용 004에서는 JWT claim 검사를 제거하고 PostgreSQL 함수 EXECUTE 권한으로 호출자를 제한한다. 이미 004가 적용된 production에는 `004a_phase2_import_rpc_secret_key_compat.sql`이 기존 함수 정의에서 레거시 claim 검사만 제거하고 같은 실행 권한을 재확인한다. RPC 오류 시 script는 자동 재호출하지 않고 현재 `members` count만 다시 확인한다. RPC도 import 전에 RLS 활성 상태를 확인한다. 성공 후 권한과 집계를 별도로 확인한 다음 `005_phase2_remove_import_rpc.sql`을 적용한다.

## 6. 검증 결과

- `npm run typecheck:members`: 통과
- `npm run test:phase2`: 5개 통과
  - strict fixture validation과 exact sponsor 연결
  - 잘못된 달력 날짜와 자기 sponsor 차단
  - source-bound 승인과 deterministic prepared hash
  - 승인되지 않은 경고 차단
  - RPC lock·권한·제거·rollback SQL 계약
- 최신 CSV strict validation: 오류 0건
- 승인 전 최신 CSV prepare: `APPROVED_MANIFEST_REQUIRED`로 의도대로 차단
- 승인 후 prepared payload 생성: 성공
  - source SHA-256: `3d0f2d8e06958e6bd957a46120e81b48d461fdf8cddfdd6fe5aebddb3af2ab1b`
  - prepared SHA-256: `bbcd01edd0aa2ed9ed1f00e620af93c09735f0325c43b8805e258065d7832288`
  - 예상 insert 1,378건, sponsor 관계 update 1,271건
- Supabase 미연결 오프라인 dry-run: 성공
- Supabase 읽기 전용 preflight: target ref·credential·두 hash 검증 성공
  - 최초 확인에서 Phase 1 `phase1-check` marker 1행을 발견해 안전 중단
  - J님이 정확한 테스트 행을 삭제한 뒤 재검사해 현재 `members = 0` 확인
  - 알려진 Phase 1 test marker 0행
  - `readyForApplyPreconditions = true`
  - 사전 확인 단계에서는 DB write와 import RPC 호출 없음
- 첫 production RPC: HTTP 403, DB 변경 없이 rollback 및 `members = 0` 확인
- 새 secret key 호환 보정 후 수동 1회 재시도: HTTP 200
  - 회원 1,378행
  - sponsor 관계 1,271건
  - direct parent 0건, 누락 timestamp 0건
  - 자기 관계·고아 관계·중복 회원번호 각 0건
  - RLS 활성, `anon`·`authenticated` DELETE 권한 없음
  - ngmembers Admin 멤버십 2건
- `005_phase2_remove_import_rpc.sql` 적용 및 함수 제거 확인
- 제거 후 최종 재검사: 회원 1,378행·관계 1,271건 유지

## 7. 후속 관리

1. `.env.import.local`의 service role/secret key를 제거하거나 import 전용 key를 Dashboard에서 폐기한다.
2. Phase 3에서 앱의 조회·추가·수정·숨김 동작을 실제 `members` 테이블에 연결한다.
