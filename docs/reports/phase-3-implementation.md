# Phase 3 Supabase Data Layer 구현 보고서

- 작성일: 2026-07-18
- 범위: production `members` 연결 코드, migration 적용과 사후 검증
- 개인정보: 실제 회원 row, Auth UUID, key, CSV 값은 이 문서에 포함하지 않음

## 구현 결과

production schema에서 생성한 `Database` type을 Supabase client에 연결하고 DB row와 React `MemberRecord` 사이 mapper를 추가했다. mapper는 nullable text를 화면의 빈 문자열로 읽고 쓰기에서는 다시 `NULL`로 바꾸며, 날짜·국가·side·status·timestamp가 지원 범위를 벗어나면 일부 기본값으로 바꾸지 않고 전체 로드를 실패시킨다.

repository는 `id ASC`, 500행 limit, `id > cursor` 방식으로 전체 회원을 읽는다. 첫 page의 exact count, ID 중복, cursor 진행, 중간 빈 page와 최종 count 일치를 확인하므로 1,000행 제한이나 중간 요청 실패가 부분 성공으로 표시되지 않는다.

회원 추가는 DB가 반환한 UUID와 timestamp row를 사용한다. 수정과 숨김은 `id`와 기존 `updated_at`을 함께 조건으로 사용하며 반환 row가 없으면 충돌로 분류하고 전체 데이터를 다시 읽는다. repository에는 DELETE, TRUNCATE, 복원, CSV 전체 교체 함수가 없다.

`useMembers`와 App에는 최초 loading, error, retry, focus refresh, write pending, stale response·unmount 방지 상태를 연결했다. editor가 열려 있을 때 자동 refresh를 중지하고, 로그아웃·권한 상실 시 AuthGate가 App을 즉시 unmount하도록 세션 변경 순간 권한 상태도 다시 확인한다.

Phase 1 demo fixture와 회원 localStorage 저장, CSV import/export, 샘플 초기화, 숨김 복원 UI를 제거했다. 기존 두 storage key는 브라우저에 남은 테스트 개인정보를 지우기 위해 앱 시작 시 삭제만 한다.

## DB migration

Supabase CLI가 생성한 `supabase/migrations/20260718024656_phase3_members_access_hardening.sql`에 다음을 작성했다.

- `public`, `anon`, `authenticated`의 기존 `members` 권한 전부 회수
- `authenticated`에 SELECT·INSERT·UPDATE만 명시적으로 재부여
- 기존 RLS 활성 상태와 세 Admin policy 유지
- `affiliation_id`, `direct_parent_id`의 자기 참조·간접 cycle 차단 trigger
- 서로 다른 row의 동시 관계 변경을 직렬화하는 transaction advisory lock
- trigger function의 `SECURITY INVOKER`, 빈 `search_path`, public/anon/authenticated EXECUTE 회수

새 project 설치용 `supabase/003_rls_policies.sql`도 같은 권한·trigger 정의로 동기화했다. 격리된 빈 DB용 `supabase/tests/phase3_members_access_and_cycle.sql`은 최소 권한과 두 간접 cycle 차단을 검사하고 가짜 행을 rollback한다.

J님이 Docker와 유료 development branch 검증 생략 및 production 적용을 명시적으로 승인한 뒤, `phase3_members_access_hardening` 이름으로 운영 migration history에 등록해 적용했다. migration은 회원 행을 갱신하지 않고 table 권한·함수·trigger만 변경한다.

## Production 적용 전후 기준선

- members: 1,378행
- 숨김: 0행
- affiliation 관계: 1,271건
- direct parent 관계: 0건
- 회원번호 NULL: 2건
- 이름 NULL: 2건
- affiliation cycle: 0건
- direct parent cycle: 0건
- mapper 지원 범위를 벗어난 member number·side·country·status·timestamp: 0건
- RLS: 활성
- policy: SELECT / INSERT / UPDATE Admin 세 개
- import RPC: 없음
- 적용 전 authenticated 초과 권한: TRUNCATE / REFERENCES / TRIGGER
- 적용 후 authenticated 권한: SELECT / INSERT / UPDATE
- 적용 후 public·anon 권한: 없음
- 적용 후 DELETE / TRUNCATE / REFERENCES / TRIGGER 권한: 없음

위 데이터 집계는 적용 전후 동일했다. Advisor에는 공유 project의 다른 앱 함수, index, 기존 workspace policy 관련 경고가 이미 존재하지만, 적용 후 이번 `members` table과 순환 방지 함수에 관련된 신규 Security/Performance 경고는 0건이다. 기존 경고는 이번 범위에서 수정하지 않았다.

## 자동 검증

다음 검사를 통과했다.

- `npm run verify:phase1`
  - 82개 파일 PII·secret·DELETE 안전 검사
- `npm run verify:phase2`
  - TypeScript 검사, 가짜 fixture 테스트 5개, import/RPC 격리 검사
- `npm run verify:phase3`
  - TypeScript와 Vite production build 91 modules
  - mapper·pagination·conflict 단위 테스트 8개
  - 27개 src 파일에서 localStorage write, CSV·restore·delete repository 경로 부재 확인
- 로컬 브라우저
  - 로그인 전 회원 shell 미노출
  - console warning/error 0건
- production migration 사후 검사
  - 활성 RLS와 SELECT·INSERT·UPDATE Admin policy 세 개 유지
  - `members_prevent_relation_cycle` trigger 활성 상태
  - 함수 `SECURITY INVOKER`, `VOLATILE`, 빈 `search_path` 확인
  - public·anon·authenticated 함수 직접 EXECUTE 권한 없음
  - 롤백 transaction에서 affiliation·direct parent 자기 참조가 각각 check violation으로 차단
  - rollback 후 회원 1,378행과 자기 참조 0건 확인
  - migration history 등록과 관련 Advisor 신규 경고 0건 확인

## 남은 검증

로컬 Docker와 유료 Supabase development branch 검증은 J님 승인으로 생략했다. Production migration과 DB 수준 사후 검증은 완료했으며, 실제 Admin 세션의 앱 CRUD와 충돌 처리는 아직 확인하지 않았다.

1. 두 Admin에서 전체 1,378행 로드 확인
2. create/update/hide와 새로고침·다른 브라우저 반영 검증
3. 두 세션의 동일 row 동시 수정으로 conflict refresh 검증

production write smoke test에는 J님이 승인한 가짜 1행 또는 실제 편집 1건만 사용한다. 가짜 row를 사용하면 exact UUID를 확인한 뒤 일반 브라우저 세션이 아닌 승인된 관리 경로로 정리한다.
