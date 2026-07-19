# Phase 4 최종 문구·UI·웹폰트 구현 계획

- 작성일: 2026-07-19
- 선행 단계: Phase 1–3 완료, production CRUD 실사용 확인
- 대상: 로그인 후 회원 검색·카드·편집·관리 화면과 웹폰트
- 제외: DB schema/RLS 변경, 데이터 재이전, 영구 삭제·복원, 배포 도메인 변경

## 1. 목적

Phase 4의 목적은 이미 정상 작동하는 Supabase 데이터 계층을 유지하면서 엄마가 실제로 이해하기 쉬운 문구와 정보 구조로 화면을 마무리하는 것이다.

이번 단계에서는 다음을 해결한다.

- 여러 파일에 흩어진 사용자 문구를 한 곳에서 관리한다.
- 과거 계획과 삭제된 이전 저장소 Issue에서 보존된 요구 충돌을 현재 기준으로 확정한다.
- 검색 대상과 검색 안내 문구를 일치시킨다.
- 회원번호 미등록, 닉네임, 국가, 메모, 확인 필요 상태의 표시 규칙을 통일한다.
- 접힌 카드의 정보량을 제한하고 펼친 카드에서 상세 정보를 명확히 보여준다.
- 관리 화면에서 기술적인 데이터 용어를 줄인다.
- 외부 CDN에 의존하는 Pretendard를 Vite build 안에 포함한다.
- PC와 작은 모바일 화면에서 기존 디자인을 유지하며 회귀를 검사한다.

## 2. 현재 기준선

### 2.1 완료되어 고정할 기능

- Google 로그인과 두 Admin의 동일 권한
- production 회원 1,378행 전체 로드
- 이름·닉네임·회원번호·전화번호 검색
- 전체·주요 사업자·관심 회원 필터
- 회원 카드 펼치기와 관계 회원 이동
- 회원 추가·수정·숨김
- `updated_at` 기반 동시 수정 충돌 처리
- 새로고침·다른 브라우저 반영
- RLS와 DELETE·TRUNCATE 차단
- GitHub Actions의 Vite `dist` Pages 배포

위 기능의 repository 계약, DB mapper, RLS, migration은 Phase 4에서 변경하지 않는다.

### 2.2 현재 UI에서 확인된 불일치

| 범주 | 현재 구현 | Phase 4에서 정리할 내용 |
| --- | --- | --- |
| 기준 회원 | `주요 사업자` | 모든 사용자 화면에서 동일하게 유지 |
| 관계 | `스폰서`, `소속`, `라인` 혼용 | 엄마가 이해하는 한 용어 체계로 통일 |
| 이름 | `가입 이름` | 최종 사용자 용어 확정 |
| 상태 | `활동`, `탈퇴`, `확인 필요` | 카드·편집기·관리 화면 표현 통일 |
| 회원번호 없음 | 카드에서 생략, 데이터 확인 사유로 집계 | 허용된 미등록 값으로 표시하고 자동 오류에서 제외 |
| 확인 배지 | status와 자동 데이터 검사 결과를 합산 | 사용자가 지정한 `review` 상태와 시스템 무결성 알림 분리 |
| 검색 | 네 필드를 검색하지만 일부 빈 결과 문구는 두 필드만 언급 | 검색 대상·placeholder·빈 결과 안내 일치 |
| 국가 | 접힌 카드, 일부 상세 조건에서 표시 | 접힘·상세·편집 화면 규칙 통일 |
| 메모 | 펼친 카드에 표시, 검색에는 미포함 | 표시·검색 포함 여부 확정 |
| 닉네임 | 한글 두 글자 이상 | 영문·숫자·공동 사용자 이름 허용 범위 확정 |
| 관리 | 데이터 확인·탈퇴·숨김·스폰서 미완료 | 일상 관리와 기술 점검을 분리하고 문구 단순화 |
| 폰트 | `index.html`의 외부 Pretendard stylesheet link 유지 | 로컬 asset 번들링 |

## 3. 범위와 비범위

### 3.1 포함

- 사용자 노출 문구와 ARIA label 정리
- 검색 대상·순위·안내 문구의 일치
- 닉네임 입력 검증 규칙 조정
- 국가·회원번호·메모·상태 표시 규칙
- 카드의 접힘/펼침 정보 구조
- 회원 편집기 section과 도움말
- 관리 메뉴와 데이터 확인 사유
- `labels.ts` 또는 동등한 단일 문구 모듈
- 외부 Pretendard stylesheet 요청·적용·fallback 검증
- 반응형·접근성·긴 문자열 검증
- 관련 단위·정적 검사와 문서 갱신

### 3.2 제외

- `members` table 컬럼 추가·삭제
- RLS policy, grant, trigger 변경
- CSV 재import와 기존 회원 일괄 보정
- 회원 영구 DELETE·숨김 복원 UI
- Realtime 도입
- server-side 검색이나 pagination 구조 변경
- 별도 Admin/Editor 역할 분리
- custom domain과 OAuth redirect 변경
- 전체 시각 디자인 재설계

## 4. 구현 전 승인 표

아래 항목은 옛 Issue 번호를 기준으로 결정하지 않고 현재 앱과 보존 문서를 기준으로 다시 승인한다. 권장안은 기존 production 계획과 현재 사용성을 함께 고려한 기본값이다.

| 항목 | 권장안 | 대안 | 영향 |
| --- | --- | --- | --- |
| 기준 회원 명칭 | `주요 사업자`로 확정 | 없음 | badge, filter, editor checkbox |
| affiliation 명칭 | `소속` | `스폰서` | 카드, picker, 관리 화면 |
| anchor path 명칭 | `소속 경로` | `라인` 또는 숨김 | 펼친 카드 관계 영역 |
| 이름 필드 | `가입 이름` 유지 | `회사 등록 이름` | editor, 데이터 확인 문구 |
| 상태 | `활동 회원`·`탈퇴 회원`·`확인 필요` | 짧은 `활동`·`탈퇴` | badge, select, 관리 메뉴 |
| 검색 대상 | 이름·닉네임·회원번호·전화번호·메모로 확정 | 없음 | 메모는 가장 낮은 검색 순위 |
| 닉네임 | 한국어 두 글자 이상 포함, 영문·숫자·공백 허용 | 없음 | editor validation, 데이터 확인 |
| 국가 | 접힘·펼침 상단 요약은 영어 두 글자 코드, 펼친 카드 본문은 한국어 국가명 | 모든 카드에서 코드만 표시 | 카드 가독성 |
| 메모 | 검색 포함, 접힌 카드에 10글자 미리보기로 확정 | 펼친 카드에서 전체 내용 표시 | 빠른 회원 식별 |
| 회원번호 없음 | `회원번호 미등록` 표시, 오류 아님 | 완전 생략 | 카드·관리 목록 |
| review badge | `member_status = review`일 때만 표시 | 자동 검사와 합산 | 사용자 지정 상태 의미 |

### 승인 원칙

- J님이 별도 변경을 요청하지 않은 항목은 권장안으로 구현한다.
- 실제 회원 데이터를 근거로 새로운 자동 보정 규칙을 만들지 않는다.
- 문구 결정은 DB enum이나 컬럼 이름을 바꾸지 않고 표시 계층에서만 처리한다.
- 구현 도중 새 충돌이 발견되면 임의 결정하지 않고 승인 표에 추가한다.

## 5. 문구 구조

### 5.1 단일 문구 모듈

`src/content/labels.ts`를 추가해 사용자 노출 용어를 기능별로 모은다.

```ts
export const labels = {
  app: {},
  member: {},
  relation: {},
  status: {},
  search: {},
  management: {},
  validation: {}
} as const;
```

대상:

- Header title과 action
- SearchBar placeholder·aria-label·빈 결과
- filter label
- MemberCard badge·관계·상세·action
- MemberEditor label·hint·validation
- MemberPicker placeholder
- ManagementPanel menu·description·empty state
- AuthGate의 사용자 안내 문구 중 앱 고유 용어

### 5.2 문구 모듈에 넣지 않을 것

- PostgreSQL 오류 원문
- DB enum 값과 column 이름
- 테스트용 fixture 값
- 동적 count 전체 문장 생성 로직
- 개발자용 로그와 report 문구

### 5.3 기술 문구 처리

사용자 화면에서는 다음 표현을 직접 노출하지 않는다.

- RLS, RPC, UUID, cursor, mapper
- affiliation ID, direct parent ID
- 원본 row, schema, migration
- `NULL`, enum, constraint

필요한 경우 `미등록`, `연결되지 않음`, `다시 시도해주세요` 같은 행동 가능한 문구로 바꾼다.

## 6. 검색 계획

### 6.1 기본 검색 계약

확정된 검색 대상에 메모를 추가한다.

1. 회원번호 정확 일치
2. 이름 정확 일치
3. 닉네임 정확 일치
4. 전화번호 정확 일치
5. 회원번호·이름·닉네임 접두 일치
6. 전화번호 포함
7. 이름·닉네임 포함
8. 메모 포함

현재 accent 제거, 대소문자 무시, 구분 문자 제거 정규화는 유지한다.

### 6.2 검색 문구

- placeholder는 실제 대상 네 필드를 모두 표시한다.
- 빈 결과 안내도 동일한 네 필드를 안내한다.
- 정확한 회원번호 한 건만 자동 펼침을 유지한다. 닉네임·이름·전화번호·메모 검색 결과는 접힌 카드로 표시한다.
- 검색 결과 count와 검색 해제 action을 유지한다.

### 6.3 메모 검색 조건

- 메모는 가장 낮은 ranking으로 포함한다.
- placeholder가 지나치게 길어지면 `이름·회원번호·연락처 등으로 검색`처럼 축약한다.
- 검색 결과 카드를 자동으로 펼치지 않는다.
- 메모 검색 단위 테스트를 별도로 추가한다.

## 7. 표시와 입력 규칙

### 7.1 회원번호

- DB `NULL`과 앱의 빈 문자열 변환은 유지한다.
- 접힌 카드와 관리 목록에서 없으면 `회원번호 미등록`을 표시한다.
- `collectMemberIssues`에서 회원번호 없음은 오류 사유에서 제외한다.
- 신규 입력은 빈 값 허용, 값이 있으면 숫자와 중복만 검사한다.

### 7.2 이름

- 이름 `NULL`은 기존 데이터의 허용 값으로 유지한다.
- 화면 fallback `이름 미확인`을 유지한다.
- 이름 없음의 자동 issue 처리 여부는 회원번호와 함께 제거하는 것을 기본으로 한다.
- 편집기에서 빈 이름 저장은 Phase 3 계약대로 허용한다.

### 7.3 닉네임

권장안:

- 빈 값 허용
- 기존 import 값은 형식 때문에 자동 issue로 만들지 않음
- 신규 입력 또는 사용자가 변경한 값은 trim 후 한국어 두 글자 이상 포함
- 한국어·영문·숫자·일반 공백과 혼합 표기 허용
- 제어 문자와 한국어가 없는 값은 거부

DB schema는 text이므로 migration 없이 client validation과 안내만 바꾼다.

### 7.4 국가

- 편집기는 `국가 선택`, `한국`, `브라질`, `멕시코`, `글로벌` 드롭다운을 사용한다.
- 저장값은 각각 빈 값, `KR`, `BR`, `MX`, `XX`를 유지한다.
- 빈 값은 `국가 미확인`으로 표시한다.
- 접힌 카드와 펼친 카드 상단 요약에서는 영어 두 글자 코드만 표시한다.
- 펼친 카드 본문의 국가 정보 row에서는 한국어 국가명을 표시한다.
- 국가 선택지는 단일 문구 module에서 관리한다.

### 7.5 메모

- 검색 대상에 포함하되 기존 필드보다 낮은 순위로 처리한다.
- 접힌 카드에서 메모가 있을 때만 최대 10글자 미리보기를 표시한다.
- 실제 저장값은 자르지 않고 긴 값에만 말줄임표를 붙인다.
- `tel:` link와 섞이지 않도록 일반 text로 렌더링
- 긴 메모는 줄바꿈하며 카드 가로 폭을 넘지 않음

### 7.6 확인 필요 상태

- `member.status === "review"`만 사용자 지정 `확인 필요` badge를 만든다.
- 중복 번호, 고아 관계, cycle 같은 무결성 문제는 관리 화면의 별도 데이터 점검으로 유지한다.
- 허용된 미등록 값과 닉네임 형식은 자동 issue에서 제외한다.
- 무결성 문제가 있다고 카드에 자동 badge를 붙일지는 제외하고 관리 화면에서만 보이는 것을 기본으로 한다.

## 8. 카드 UI 계획

### 8.1 접힌 카드

항상 한눈에 확인할 정보만 유지한다.

- 표시 이름
- 닉네임
- 회원번호 또는 `회원번호 미등록`
- 국가 코드 oval badge: `BR`은 `#e8f8fd`, `KR`은 `#f0edf7`, 나머지는 `#d9dde3`
- 메모가 있으면 최대 10글자 미리보기
- 펼치기 affordance

긴 이름은 한 줄 말줄임 처리하고 `title` 또는 접근 가능한 전체 이름을 유지한다.

### 8.2 펼친 카드

정보 순서:

1. 상태·주요 사업자·관심 회원 badge
2. 소속 회원과 위치
3. 소속 경로
4. 바로 위 회원과 위치
5. 생년월일·전화번호·CPF·국가·메모
6. 연결된 회원
7. 수정·숨기기 action

빈 section은 공간을 만들지 않는다. 실제 관계가 없는 경우 기술적인 fallback 설명을 추가하지 않는다.

### 8.3 연결된 회원

- 좌·우·위치 미확인 grouping 유지
- 처음 8명과 더 보기 유지
- 회원번호가 없으면 빈 문자열 대신 `미등록` 표시
- 긴 이름·닉네임·번호가 모바일 가로 폭을 넘지 않도록 검사

## 9. 편집 UI 계획

- 기본 정보, 소속, 선택적 직계 관계, 연락처·추가 정보 구조 유지
- 사용자 용어를 labels와 동기화
- 회원번호·이름 빈 값 허용을 hint로 명확히 함
- 닉네임 최종 규칙을 placeholder·hint·validation에 동일 적용
- 국가는 한국어 드롭다운으로 선택하고 카드 상단 요약은 영어 코드, 본문 정보 row는 한국어 국가명을 표시
- unresolved sponsor 원문은 사용자에게 필요한 참고일 때만 `기존 기록`으로 표현
- 저장 중, 충돌, 오류 문구는 현재 비동기 동작을 바꾸지 않고 이해하기 쉽게 조정
- 관계 picker는 이름·닉네임·회원번호 검색을 유지

## 10. 관리 화면 계획

### 10.1 첫 화면

다음 세 항목을 주 메뉴로 유지한다.

- 확인이 필요한 회원
- 탈퇴 회원
- 숨긴 회원

소속 연결 미완료는 자주 쓰지 않는 보조 section으로 둔다.

### 10.2 자동 점검 항목

다음은 허용된 값이므로 점검 count에서 제외한다.

- 회원번호 미등록
- 이름 미등록
- 국가 미확인
- direct parent 미입력
- 승인된 기존 닉네임 형식

다음은 계속 점검한다.

- 중복된 비어 있지 않은 회원번호
- 존재하지 않는 관계 ID
- 자기 관계
- cycle
- 사용자가 지정한 review 상태

### 10.3 숨긴 회원

- count와 목록 확인만 제공
- 앱 안 복원·삭제 action을 만들지 않음
- Supabase Dashboard 관리 원칙 유지
- 숨긴 회원 row는 눌러 일반 검색 화면으로 이동하지 않음

## 11. 웹폰트 계획

### 11.1 현재 구성

`index.html`은 jsDelivr의 Pretendard stylesheet를 외부 웹폰트로 연결하고 있다. 이 구조에서는 폰트 파일을 저장소에 복사하지 않고, stylesheet와 font 파일의 네트워크 응답 및 실제 적용 여부를 확인한다.

CSS의 `font-family` 순서는 기존 디자인 의도에 따라 유지하며, Phase 4에서 임의로 변경하지 않는다.

### 11.2 검증

- `index.html`의 외부 Pretendard stylesheet link 유지
- production build의 `dist/index.html`에도 link가 유지되는지 확인
- production Network에서 stylesheet와 Pretendard font 요청 상태 확인
- 외부 stylesheet 또는 font 요청의 CORS·404·차단 오류 확인
- computed style에서 실제 선택된 font family 확인
- 외부 웹폰트가 실패해도 기존 system fallback으로 화면이 유지되는지 확인

### 11.3 중단 조건

외부 stylesheet 또는 font가 운영 환경에서 반복적으로 차단되거나, license·배포 정책 변경으로 현재 URL을 사용할 수 없으면 임의로 로컬 파일을 추가하지 않고 J님에게 확인한다.

## 12. 구현 순서

1. 승인 표의 최종 선택 기록
2. `labels.ts`와 country/status label map 추가
3. 검색 대상·ranking·안내 문구 동기화
4. 회원번호·닉네임·review issue 규칙 조정
5. 접힌 카드와 펼친 카드 정보 구조 정리
6. 편집기 label·hint·validation 정리
7. 관리 메뉴와 점검 사유 단순화
8. 외부 Pretendard stylesheet와 CSS 적용 상태 검증
9. 단위·정적 검사 추가
10. 로컬 production build 브라우저 검증
11. GitHub Pages 배포 후 production 확인
12. 보고서·devlog·README·ROADMAP 갱신

각 단계는 이전 단계가 통과한 뒤 진행한다. UI 작업 중 production 데이터 값을 자동 수정하지 않는다.

## 13. 테스트 계획

### 13.1 단위 테스트

- 문구 key 누락 검사
- 검색 다섯 필드의 정확·접두·포함 ranking과 메모 최하위 순위
- accent·공백·구분 문자 정규화
- 빈 회원번호 표시와 정렬
- 닉네임 최종 validation
- 국가 label map과 unknown code fallback
- review badge와 system issue 분리
- 허용된 미등록 값이 관리 issue에 포함되지 않음

### 13.2 기존 회귀 검사

- Phase 1 PII·secret·DELETE 안전 검사
- Phase 2 private import 파일 격리 검사
- Phase 3 mapper·pagination·conflict 테스트
- TypeScript와 Vite production build
- frontend bundle에 service role/secret key 없음
- DB schema와 migration diff 없음

### 13.3 브라우저 검사

PC:

- 로그인 후 1,378명 load
- 다섯 검색 대상과 메모 검색 시 접힌 카드 유지
- filter count
- 카드 접기·펼치기·관계 이동
- 추가·수정·숨김 회귀
- 관리 메뉴 count와 빈 화면

모바일 기준:

- 390px 안팎 iPhone portrait
- 768px 안팎 iPad portrait
- header action 줄바꿈
- 검색창과 clear button
- 긴 해외 이름과 긴 닉네임
- editor scroll·keyboard 영역
- 관계 목록과 action button
- 가로 overflow 0

접근성:

- dialog title과 close label
- keyboard Escape
- button과 input focus 표시
- badge에만 의존하지 않는 상태 text
- 펼침 상태 `aria-expanded`

### 13.4 웹폰트 검사

- production Network에서 외부 Pretendard stylesheet와 font 요청 상태 확인
- 외부 요청의 CORS·404·차단 오류 0건
- computed font family에 Pretendard 적용
- font load 실패 시 system fallback으로 화면 유지

## 14. 완료 기준

- 승인된 용어가 모든 사용자 화면에서 일관됨
- 사용자 문구가 단일 module에서 관리됨
- 검색 대상과 placeholder·빈 결과 안내가 일치함
- 빈 회원번호·이름·국가를 허용 값으로 처리함
- review badge와 system 무결성 issue가 분리됨
- 접힌 카드가 이름·닉네임·번호·국가·짧은 메모 중심으로 단순함
- 펼친 카드에서 전체 이름과 필요한 상세 정보 확인 가능
- 관리 화면에 DB 기술 용어가 없음
- 삭제·복원 UI가 추가되지 않음
- DB schema·RLS·repository write 계약 변경 없음
- production `dist/index.html`에 외부 Pretendard stylesheet link가 유지됨
- Phase 1–3 검사와 Phase 4 신규 테스트 통과
- PC·iPhone·iPad 기준 가로 overflow와 console 오류 0건
- GitHub Pages production에서 동일 화면과 외부 웹폰트 적용 확인

## 15. 중단 조건

다음 상황에서는 구현을 멈추고 J님에게 확인한다.

- 승인 표와 상충하는 새 요구가 발견됨
- 문구 변경에 DB enum 또는 schema 변경이 필요함
- 검색 대상 확대가 예상치 못한 개인정보 노출을 만듦
- 실제 회원값 일괄 변경이 필요함
- 영구 삭제·복원 요구가 생김
- 외부 웹폰트 URL·CORS·배포 정책을 확인할 수 없음
- 기존 Phase 3 CRUD·conflict 테스트가 실패함
- production bundle에서 secret key 또는 실제 CSV가 발견됨

## 16. 산출물

- `src/content/labels.ts`
- 외부 웹폰트 연결·적용 검증 결과
- 검색·표시·검증 규칙 변경
- 카드·편집·관리 UI 변경
- Phase 4 단위·정적 검사
- `docs/reports/phase-4-implementation.md`
- `docs/devlog/YYYY-MM-DD.md`
- 갱신된 README와 ROADMAP

## 17. Phase 4 이후

Phase 4가 완료되면 Phase 5에서는 UI 요구를 더 추가하지 않고 최종 보안·배포 마감만 수행한다.

- RLS·grant·DELETE 차단 최종 확인
- source·dist PII와 secret 검사
- custom domain `member.nangok.app`
- Google OAuth production redirect
- 실제 iPhone·iPad 실사용 확인
- 최종 운영 문서와 key 정리
