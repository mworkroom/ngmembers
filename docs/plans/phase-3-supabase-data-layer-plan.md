# 회원앱 Phase 3 실행 계획서

- 작성일: 2026-07-18
- 대상: React 회원 UI의 `localStorage`·demo fixture 데이터 계층을 Supabase `members`로 교체
- 선행 상태: Phase 1 Auth/RLS 완료, Phase 2 production import 1,378행·관계 1,271건 완료, 일회성 import RPC 제거
- 이번 문서의 역할: 실제 회원 UI를 production DB에 연결하기 전 보안 보정, 데이터 접근 구조, 쓰기·충돌·검증 기준을 확정
- 중요: 계획서 작성 단계에서는 앱 코드와 production DB 권한·데이터를 변경하지 않는다.

## 1. Phase 3의 목표

Phase 3에서는 로그인과 ngmembers Admin 권한 확인을 통과한 뒤 production `members`를 읽고, 현재 UI의 조회·검색·계보 탐색·추가·수정·숨김을 Supabase에 연결한다.

```text
production 권한 기준선 재확인
→ members 최소 권한 보정
→ DB row ↔ 앱 MemberRecord 변환 계층
→ 전체 1,378행 안전 로드
→ async loading/error/retry
→ 추가·수정·숨김 연결
→ 동시 수정 충돌 감지
→ localStorage·demo·CSV 교체 기능 제거
→ 격리된 CRUD 검사
→ production 두 Admin 검증
```

Phase 3가 끝나면 다음이 성립해야 한다.

- 로그인 전·미허용 계정에는 회원 데이터가 보이지 않음
- 두 Admin은 같은 1,378행을 읽고 같은 기능을 사용함
- 검색·필터·카드·관계 이동은 현재 동작을 유지함
- 추가·수정·숨김 결과가 새로고침과 다른 브라우저에서 유지됨
- 브라우저에는 publishable key만 있고 회원 데이터는 메모리에만 존재함
- 쓰기 중복·동시 수정 충돌·부분 로드가 조용히 성공 처리되지 않음
- 일반 세션은 DELETE와 TRUNCATE를 할 수 없음
- CSV 전체 교체, 샘플 초기화, 복원, 영구 삭제 기능이 운영 UI에 없음

## 2. 현재 기준선

### Production DB

2026-07-18 Supabase MCP 읽기 전용 확인 결과:

```text
members                           1,378행
affiliation 관계                  1,271건
member_number NULL                    2건
name NULL                             2건
RLS                               활성
정책                              SELECT / INSERT / UPDATE Admin
DELETE                            anon·authenticated 모두 불가
import RPC                        제거 완료
```

현재 index:

- `members_pkey`
- `members_member_number_unique`
- `members_affiliation_id_index`
- `members_direct_parent_id_index`

UUID primary key가 전체 로드 cursor에 사용되고, 두 관계 FK index는 계보 관계 검증에 사용된다.

### 현재 프론트엔드

- `App.tsx`가 `loadMembers()`로 Phase 1 demo 데이터를 동기 로드함
- 회원 배열 전체를 `localStorage`에 저장함
- 검색·필터·관계 계산은 전체 회원 배열을 브라우저 메모리에서 처리함
- 추가·수정·숨김·복원·CSV 교체·샘플 초기화가 로컬 배열만 변경함
- DB snake_case와 `MemberRecord` camelCase 변환 계층이 없음
- loading·fetch error·write pending·동시 수정 conflict 상태가 없음

### Phase 3 시작 전에 발견한 권한 문제

`authenticated`에는 의도한 `SELECT`, `INSERT`, `UPDATE` 외에 다음 기본 table 권한이 남아 있다.

```text
TRUNCATE
REFERENCES
TRIGGER
```

특히 `TRUNCATE`는 RLS를 거치지 않고 전체 테이블을 비울 수 있으므로 앱 연결 전에 반드시 제거한다. 이 문제는 데이터나 RLS policy 오류가 아니라 기존 default grant가 남은 권한 계층 문제다.

## 3. Phase 3 범위

### 구현 범위

- `members` table 권한 최소화와 회귀 검사
- 필요하면 간접 관계 cycle을 막는 DB trigger
- Supabase Database TypeScript type 생성
- DB row ↔ 앱 record mapper
- 회원 repository/service
- `useMembers` async hook
- 전체 회원 로딩·재시도·새로고침
- 회원 추가
- 회원 수정
- 회원 숨김
- `updated_at` 기반 동시 수정 충돌 감지
- 로그인 해제 시 메모리 데이터 폐기
- localStorage 회원 저장과 demo fixture 제거
- CSV import/export·샘플 초기화·복원 action 제거
- 가짜 fixture unit/integration test와 production 권한 검사

### 이번 Phase에서 하지 않는 것

- 회원 영구 DELETE
- 숨긴 회원 복원 UI
- CSV 전체 import·export
- 샘플 데이터 초기화
- `direct_parent_id` 자동 추측
- sponsor 부분 일치 자동 연결
- Supabase Realtime publication 또는 WebSocket 구독
- 서버 full-text search
- 문구·용어·폰트·카드 디자인 개편
- 공개 배포와 production domain 설정

문구·UI·폰트는 Phase 4, 배포는 Phase 5에서 처리한다.

## 4. 공식 Supabase 변경사항 반영

Phase 3 구현 시 다음 현재 동작을 기준으로 한다.

- Data API 노출과 RLS는 별도 계층이다. `authenticated` table grant를 migration에 명시한다.
- 새 table의 자동 Data API 노출 기본값이 변경되고 있으므로 default grant에 의존하지 않는다.
- `UPDATE`는 RLS `SELECT` policy도 필요하다. 현재 Admin SELECT·UPDATE policy를 함께 유지한다.
- 공식 client의 GET/HEAD transient retry는 idempotent read에만 적용된다. POST/PATCH 쓰기는 자동 재시도하지 않고 UI가 결과를 확인한다.
- 프로젝트 TypeScript 5.8은 2027년 예정인 Supabase JavaScript TypeScript 5.0 최소 버전보다 높다.

참고:

- Data API explicit grant: https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
- JavaScript `range`: https://supabase.com/docs/reference/javascript/using-modifiers-range
- RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- API key: https://supabase.com/docs/guides/getting-started/api-keys

## 5. DB 보안 보정

### 5.1 migration 생성 방식

구현 시작 시 CLI 명령을 추측하지 않고 `supabase --help`, `supabase migration --help`로 현재 CLI를 확인한다. 새 migration은 다음 명령으로 생성하고 CLI가 만든 timestamp filename을 사용한다.

```text
supabase migration new phase3_members_access_hardening
```

기존 production을 위한 새 migration과 새 project 설치용 `003_rls_policies.sql`을 함께 고친다. production에는 검증된 새 migration만 한 번 적용한다.

### 5.2 최소 table 권한

보정 원칙:

```sql
revoke all on public.members from public, anon, authenticated;
grant select, insert, update on public.members to authenticated;
```

검증할 결과:

| role | SELECT | INSERT | UPDATE | DELETE | TRUNCATE | REFERENCES | TRIGGER |
| --- | --- | --- | --- | --- | --- | --- | --- |
| public | X | X | X | X | X | X | X |
| anon | X | X | X | X | X | X | X |
| authenticated | O | O | O | X | X | X | X |

`service_role`의 운영 관리 권한은 이 migration에서 변경하지 않는다. 프론트엔드는 service role을 사용하지 않는다.

### 5.3 RLS 유지

현재 세 policy를 유지한다.

- `members_select_admin`
- `members_insert_admin`
- `members_update_admin`

모두 `TO authenticated`와 `has_ngmembers_admin_access()` 검사를 함께 사용한다. 단순히 `TO authenticated`만 사용하는 policy로 완화하지 않는다.

### 5.4 관계 cycle 방어

현재 DB는 자기 참조만 차단하고 간접 cycle은 클라이언트만 검사한다. API 직접 호출이나 두 Admin의 동시 수정으로 cycle이 만들어지지 않도록 다음을 검토하고 가짜 DB test를 통과하면 migration에 포함한다.

- `affiliation_id` chain의 간접 cycle 차단
- `direct_parent_id` chain의 간접 cycle 차단
- trigger function은 기본 `SECURITY INVOKER` 사용
- `search_path = ''` 고정
- recursive CTE에 자기 ID가 발견되면 check violation으로 중단
- 정상 관계·NULL·관계 변경은 허용
- 기존 1,378행에 cycle 0건인 상태를 적용 전 확인

권한 오류를 해결하기 위해 `SECURITY DEFINER`를 추가하지 않는다.

### 5.5 migration 적용 후 Advisor

- Security Advisor와 Performance Advisor 실행
- 이번 migration이 만든 새 경고 0건 확인
- 공유 project의 기존 다른 앱 경고는 별도 목록으로 분리하고 임의 수정하지 않음

## 6. 목표 프론트 구조

예정 구조:

```text
src/
├─ hooks/
│  ├─ useAuth.ts
│  └─ useMembers.ts
├─ lib/
│  ├─ supabase.ts
│  ├─ memberMapper.ts
│  └─ memberRepository.ts
├─ types/
│  └─ database.ts
└─ test-fixtures/
   └─ members.ts              # 개인정보 없는 test 전용, production import 금지
```

실제 파일 이름은 기존 구조와 충돌하면 조정할 수 있지만 다음 책임은 분리한다.

### `database.ts`

- production schema에서 생성한 Supabase Database type
- 회원 값이나 UUID 같은 실제 row data는 포함하지 않음
- `createClient<Database>()`에 연결

### `memberMapper.ts`

- DB snake_case → React camelCase
- React form → DB insert/update payload
- `date`, nullable text, status, side 변환
- 변환 실패 시 조용한 기본값 대신 명시적 오류

### `memberRepository.ts`

외부에 다음 함수만 제공한다.

```text
listMembers()
createMember(input)
updateMember(id, expectedUpdatedAt, input)
hideMember(id, expectedUpdatedAt)
```

만들지 않는 함수:

```text
deleteMember()
truncateMembers()
restoreMember()
replaceMembersFromCsv()
```

### `useMembers.ts`

- 최초 fetch와 완전성 확인
- loading·error·retry·refresh 상태
- create/update/hide pending 상태
- Supabase 반환 row로 메모리 배열 갱신
- stale response와 unmount 이후 state update 방지
- sign-out 또는 authorization 상실 시 배열 즉시 비움

## 7. DB row와 앱 type 변환

### 7.1 읽기 변환

DB nullable text는 현재 UI가 다루기 쉬운 빈 문자열로 변환하되 원래 의미를 잃지 않는다.

```text
member_number NULL     → memberNumber ""
name NULL              → name ""
birth_date NULL        → birthDate ""
birth_date YYYY-MM-DD  → birthDate YYYYMMDD
country_code NULL      → countryCode ""
```

`MemberRecord`에는 동시 수정 검사를 위해 다음을 추가한다.

```text
createdAt
updatedAt
```

Phase 2 private `importWarnings`는 DB에 저장되지 않았으므로 production record의 영속 field로 사용하지 않는다. 화면의 확인 항목은 현재 DB 값과 관계 상태에서 계산한다.

### 7.2 쓰기 변환

```text
빈 문자열·공백 문자열 → NULL
memberNumber          → 숫자 문자열 또는 NULL
birthDate YYYYMMDD    → 유효한 YYYY-MM-DD 또는 오류
countryCode           → 대문자 두 글자 또는 NULL
side/status           → 허용 enum만 전송
```

CPF와 전화번호는 Phase 2 결정대로 DB `text` 원문을 유지한다. 화면 입력 정규화는 사용자가 입력한 숫자 범위 안에서만 수행하고, DB write mapper가 임의로 자릿수를 보정하거나 거부하지 않는다.

### 7.3 빈 회원번호·이름

production에는 회원번호 NULL 2명, 이름 NULL 2명이 실제 승인 데이터로 존재한다. 따라서 unrelated field를 수정할 때 빈 회원번호나 이름 때문에 저장이 막히면 안 된다.

- form의 강제 `required`와 client 필수 검사를 제거하거나 nullable 정책에 맞게 조정
- 비어 있으면 DB `NULL` 유지
- 화면 fallback은 Phase 4 문구 결정 전 기존 formatter의 안전한 대체값 사용
- 값이 있는 회원번호의 unique 제약은 DB가 계속 보장

## 8. 전체 회원 로딩 전략

현재 검색·계보 계산은 전체 회원 graph가 필요하므로 Phase 3에서는 server search로 쪼개지 않고 전체 1,378행을 로그인 후 메모리에 올린다.

단일 `.select()`에 의존하지 않는다. Supabase project의 row limit로 1,000행만 조용히 반환될 수 있기 때문이다.

### 8.1 UUID cursor batch

권장 방식:

```text
page size 500
ORDER BY id ASC
첫 page: LIMIT 500
다음 page: id > lastId, LIMIT 500
마지막 page가 500 미만이면 종료
```

UUID primary key index를 사용하므로 깊은 OFFSET scan을 피한다. 현재 1,378행은 3회 요청으로 완료된다.

### 8.2 완전성 확인

- 첫 요청에서 exact count를 함께 얻거나 별도 HEAD count 사용
- 받은 ID 중복 0건 확인
- 최종 배열 길이와 DB count 일치 확인
- 빈 page 또는 cursor 정체 시 오류 처리
- 중간 page가 실패하면 partial 배열을 화면에 노출하지 않고 전체 fetch 실패로 처리
- hardcoded 1,378은 migration 직후 회귀 기준으로만 사용하고 이후 추가 회원은 동적 count에 포함

### 8.3 검색과 index

1,378명 규모에서는 기존 브라우저 검색·정렬·관계 index를 유지한다.

- 이름·닉네임·회원번호·전화번호 검색 유지
- `buildRelationIndex`는 fetch 완료 후 한 번 계산
- member별 sponsor를 추가 query하는 N+1 요청 금지
- server full-text index는 Phase 3에서 추가하지 않음
- 실제 성능 문제가 측정되기 전 검색 index를 추측해 만들지 않음

## 9. Async 화면 상태

### 최초 로딩

- AuthGate가 Admin 권한을 확인한 뒤에만 `listMembers()` 시작
- fetch 완료 전 demo 회원을 잠깐 보여주지 않음
- 기술적인 JSON/SQL 오류 대신 재시도 가능한 데이터 로딩 화면 표시
- 오류가 나도 로그인 session과 데이터 오류를 구분

### 재시도와 refresh

- read는 재시도 버튼 제공
- window focus/visibility 복귀 시 필요하면 전체 refresh
- 사용자가 editor를 열어 입력 중이면 자동 refresh로 form을 덮지 않음
- write는 자동 재시도하지 않음

### 로그아웃과 권한 상실

- member 배열, relation index, 열린 editor와 상세 카드 state 초기화
- localStorage·IndexedDB·Cache Storage에 회원 row 저장 금지
- console, toast, error report에 row 전체나 CPF·전화번호 출력 금지

## 10. 쓰기 동작

### 공통 원칙

- UI는 server-confirmed update 사용
- 요청 성공 전 성공 toast를 표시하지 않음
- 저장 중 submit/hide 버튼 비활성화
- 같은 action의 이중 클릭 방지
- 성공 응답의 반환 row로 해당 record 교체
- 실패하면 기존 화면 배열 유지
- raw Supabase error를 개인정보와 함께 console에 출력하지 않음

### 10.1 회원 추가

1. client form validation
2. insert payload mapping
3. `.insert(payload).select().single()`
4. DB가 생성한 UUID·timestamp를 포함한 row 수신
5. mapper 통과 후 배열에 추가
6. 검색·필터를 안전하게 조정하고 새 회원 카드로 이동

중복 회원번호는 client 배열에서 먼저 안내하되, 최종 판단은 DB unique index에 맡긴다. `23505`는 사용자용 중복 안내로 변환한다.

### 10.2 회원 수정

수정 시작 시 record의 `updatedAt`을 보관한다.

```text
UPDATE members
WHERE id = selectedId
  AND updated_at = expectedUpdatedAt
RETURNING row
```

반환 row가 0건이면 다른 기기에서 먼저 수정됐거나 권한이 바뀐 것으로 본다. 전체 데이터를 다시 읽고 “다른 화면에서 변경되어 최신 정보를 불러왔습니다”를 표시하며 사용자가 변경 내용을 다시 검토하게 한다.

### 10.3 회원 숨김

- `is_hidden = true`만 update
- 수정과 같은 `updatedAt` conflict 조건 사용
- 성공 응답 후 목록에서 제거
- DELETE 요청을 사용하지 않음
- 앱 안의 복원 action은 제거

### 10.4 오류 코드 처리

| 범주 | 예시 | 사용자 처리 |
| --- | --- | --- |
| unique | `23505` | 회원번호 중복 안내 |
| FK | `23503` | 선택한 관계 대상이 바뀌었음을 안내하고 refresh |
| check | `23514` | 입력 형식 또는 관계 오류 안내 |
| RLS/권한 | `42501` | 권한 재확인·로그아웃 안내 |
| conflict | 반환 row 0건 | 최신 데이터 refresh 후 재검토 |
| network | 연결 실패 | 기존 화면 유지, 수동 재시도 |

## 11. 두 Admin 동기화 원칙

Phase 3의 필수 동기화는 Supabase를 단일 진실 원본으로 사용하는 것이다.

- 각 브라우저 로그인·새로고침 시 DB 전체를 다시 읽음
- create/update/hide 성공 후 해당 브라우저 state 즉시 반영
- 다른 브라우저는 새로고침 또는 focus refresh에서 변경 확인
- `updated_at` 조건으로 오래된 화면의 덮어쓰기 차단

Realtime은 이번 단계에 넣지 않는다. 두 Admin·1,378행 규모에서는 focus refresh와 conflict detection으로 요구를 충족할 수 있고, Realtime publication·RLS event authorization·구독 정리라는 별도 복잡성을 만들 필요가 없다. 실사용에서 즉시 동기화가 필요하다고 확인되면 후속 단계로 분리한다.

## 12. 제거·변경할 기존 기능

### 제거

- `src/lib/storage.ts`의 회원 load/save
- `src/data/demoMembers.ts` production import
- Phase 1 demo `localStorage` persistence
- CSV로 전체 교체
- 현재 데이터 CSV export
- 샘플 데이터 초기화
- 숨긴 회원 복원 버튼
- 관련 confirm dialog와 callback

### 한 번만 실행할 브라우저 정리

Phase 1 demo key와 과거 key를 앱 시작 시 제거한다.

```text
nangok-member-mvp-v1
nangok-member-phase1-demo-v1
```

이 정리는 DB 데이터를 건드리지 않는다. 기존 브라우저에 사용자가 테스트 입력한 개인정보가 남지 않게 하기 위한 local cleanup이다.

### 유지

- 검색 ranking
- filter와 count
- 카드 접기·펼치기
- 계보·연결 회원 계산
- cycle client 사전 검사
- 추가·수정·숨김 UI의 현재 디자인
- Google Auth와 Admin gate

## 13. 구현 순서

### Step 0 — 기준선 고정

- production count 1,378, 관계 1,271 재확인
- RLS policy·grant·index snapshot 기록
- current build와 Phase 1·2 verify 통과
- 실제 row 값을 terminal·문서에 출력하지 않음

### Step 1 — 권한 hardening

- migration 생성
- authenticated 과잉 권한 제거
- fresh install용 `003_rls_policies.sql` 동기화
- 필요 시 cycle trigger migration 작성
- 가짜 환경에서 SQL test
- Advisor 실행
- production 적용 전 J님에게 SQL diff와 영향 설명

### Step 2 — typed data layer

- Database type 생성
- Supabase client generic 연결
- mapper와 repository 구현
- 500행 UUID cursor loader와 completeness check 구현
- mapper·pagination unit test

### Step 3 — read 연결

- `useMembers` loading/error/retry 구현
- App의 `loadMembers` 제거
- 로그인 후 production 1,378행 로드
- 검색·필터·관계·관리 count 회귀 검사
- NULL 회원번호·이름 row 렌더링 확인

### Step 4 — write 연결

- create
- update with `updated_at`
- hide with `updated_at`
- pending·error·conflict UI
- DB 반환 row로 state 갱신

### Step 5 — 위험 기능 제거

- localStorage 회원 저장 제거
- demo fixture production 제거
- CSV import/export·reset 제거
- restore 제거
- delete 함수·요청·버튼이 없는지 정적 검사

### Step 6 — 통합 검증

- 가짜 3~10행의 격리된 Supabase 환경에서 CRUD
- 두 session conflict test
- 새로고침·다른 브라우저 반영
- 익명·미허용 계정 차단
- production read smoke test
- 승인된 방식으로만 production write smoke test

## 14. 테스트 전략

### Unit test

- snake_case ↔ camelCase 전 필드 mapping
- NULL ↔ 빈 문자열
- 날짜 양방향 변환과 잘못된 날짜 차단
- country/side/status 변환
- 500/500/378 cursor page 결합
- duplicate ID·cursor 정체·중간 실패 차단
- Supabase 오류 코드 → 사용자 메시지
- conflict 반환 0건 처리

모든 fixture는 가짜 값만 사용한다.

### SQL/RLS test

- public·anon: 모든 table action 차단
- 미허용 authenticated: SELECT 0행, INSERT/UPDATE 실패
- 허용 Admin: SELECT/INSERT/UPDATE 성공
- authenticated DELETE 실패
- authenticated TRUNCATE 실패
- 관계 FK와 자기 참조 차단
- cycle trigger를 추가했다면 간접 cycle 차단
- import RPC 부재

### Browser test

- 로그인 전 회원 shell 미표시
- Admin 로그인 후 정확한 전체 count
- 로딩 중 demo data flash 없음
- 검색 4종과 filter
- 관계 이동·연결 회원 표시
- 회원 추가 후 새로고침 유지
- 회원 수정 후 다른 브라우저 확인
- 회원 숨김 후 일반 목록 제외
- 두 브라우저 동시 수정 conflict 안내
- 로그아웃 즉시 데이터 화면 제거
- console error와 가로 overflow 없음

### PII test

- 실제 회원 row가 source fixture·snapshot·console log에 없음
- `dist`에 실제 회원 marker가 없음
- localStorage에 회원 배열이 없음
- Git status에 CSV·prepared payload·private report가 없음
- service role/secret key가 `VITE_` 변수와 bundle에 없음

## 15. 격리된 CRUD 검증과 production 승인

가장 안전한 순서:

1. Supabase local DB 또는 승인된 development branch에 schema 적용
2. 가짜 회원 3~10명 insert
3. 두 가짜 Admin session으로 CRUD·conflict·RLS 검사
4. migration과 app build 고정
5. production에는 권한 migration과 read 연결 먼저 적용
6. production write smoke test는 J님이 승인한 가짜 1행 또는 실제 편집 1건만 사용
7. 가짜 row를 사용했다면 exact UUID를 확인한 SQL Editor/MCP transaction으로 정리

development branch 생성에 비용이 들면 비용 확인과 J님 승인을 받은 뒤에만 만든다. 격리 환경 없이 production에 임의 test row를 넣지 않는다.

## 16. 실패와 rollback

### 프론트 fetch 실패

- partial list를 사용하지 않음
- DB 변경 없음
- 이전 배포로 되돌리거나 재시도 가능

### 단일 write 실패

- PostgreSQL statement 단위로 rollback
- 화면 배열을 성공 상태로 변경하지 않음
- write 자동 retry 금지

### 프론트 배포 rollback

- DB의 1,378행은 유지
- 이전 Phase 1 demo app으로 코드만 되돌릴 수 있으나 실제 DB 변경을 되돌리지 않음
- rollback build가 localStorage에 실제 DB row를 쓰지 않았는지 확인

### DB migration rollback

- `TRUNCATE`·DELETE 같은 위험 권한은 rollback에서도 다시 부여하지 않음
- cycle trigger에 문제가 있으면 trigger만 별도 migration으로 비활성화
- RLS 또는 Admin access를 완화해 장애를 숨기지 않음

## 17. 완료 조건

```text
[ ] 기존 1,378행·1,271관계 기준선 유지
[ ] authenticated 권한이 SELECT/INSERT/UPDATE만 남음
[ ] DELETE·TRUNCATE 실제 차단
[ ] RLS와 두 Admin access 정상
[ ] Database type과 mapper 구현
[ ] UUID cursor로 전체 row 로드 및 count 일치
[ ] partial fetch 차단
[ ] 검색·필터·카드·계보 회귀 없음
[ ] NULL 회원번호·이름 row 정상 처리
[ ] create가 DB에 저장되고 새로고침 후 유지
[ ] update가 DB에 저장되고 새로고침 후 유지
[ ] hide가 DB에 저장되고 일반 목록에서 제외
[ ] updated_at conflict 감지
[ ] 다른 브라우저에서 변경 확인
[ ] localStorage 회원 저장 제거
[ ] demo fixture production 제거
[ ] CSV import/export·reset·restore 제거
[ ] delete/truncate repository 함수 없음
[ ] 실제 PII가 Git·dist·test log에 없음
[ ] build·Phase 1·2·3 검사 통과
[ ] Security/Performance Advisor 새 경고 0건
[ ] 개인정보 없는 Phase 3 결과 보고서와 개발 로그 작성
```

## 18. Phase 3 구현 시작 시 첫 작업

J님이 구현을 승인하면 App 코드를 바로 바꾸지 않는다. 먼저 다음 세 가지를 완료한다.

1. `authenticated`의 `TRUNCATE`·`REFERENCES`·`TRIGGER` 권한 제거 migration 작성과 가짜 환경 검증
2. production schema 기반 Database type, mapper, UUID cursor loader를 가짜 fixture로 구현
3. 현재 UI에 데이터를 연결하기 전 read-only integration에서 전체 count와 partial fetch 차단 확인

이 세 항목이 통과한 뒤 create/update/hide를 순서대로 연결한다.
