# 회원 계보 찾기 앱 — Codex 실서비스 전환 작업 계획서

- 작성일: 2026-07-18
- 정식 주소: `member.nangok.app`
- 현재 기술 스택: React 19 + TypeScript + Vite
- 현재 데이터 방식: 내장 JSON/CSV + `localStorage`
- 목표 데이터 방식: Supabase Auth + Postgres + RLS
- 사용자: 엄마(Admin), J(Admin)

---

## 1. 지금 Codex로 넘어가는 이유

현재는 화면과 핵심 사용 흐름이 거의 확정되었고, 최종 회원 명단도 정리되었다. 남은 일은 새 앱을 처음부터 구상하는 작업이 아니라 다음을 기존 코드 전체에 연결하는 작업이다.

- Supabase 테이블과 관계 컬럼 생성
- Google 로그인
- 사용자 두 명만 허용하는 권한 설정
- RLS 정책
- CSV 최초 일괄 이전
- `localStorage` 데이터 계층을 Supabase로 교체
- 실제 추가·수정·숨기기
- 웹폰트 빌드 확인
- GitHub 배포 및 `member.nangok.app` 연결
- 보안·빌드·실사용 테스트

이 단계부터는 한 파일씩 답을 받아 복사하는 것보다, Codex가 저장소 전체를 읽고 파일을 수정하며 빌드와 테스트까지 실행하는 방식이 효율적이다.

단, 한 번에 전부 구현시키지 않고 아래 Phase별로 나누어 진행한다. 각 Phase가 끝날 때마다 직접 확인한 뒤 다음 단계로 넘어간다.

---

## 2. 현재 상태

### 2.1 현재 소스 구조

기존 MVP에는 다음 구조가 있다.

```text
src/
├─ components/
│  ├─ Header.tsx
│  ├─ SearchBar.tsx
│  ├─ FilterTabs.tsx
│  ├─ MemberCard.tsx
│  ├─ MemberEditor.tsx
│  ├─ MemberPicker.tsx
│  ├─ ManagementPanel.tsx
│  └─ ...
├─ data/
│  └─ seedMembers.json
├─ lib/
│  └─ storage.ts
├─ utils/
│  ├─ csv.ts
│  ├─ formatters.ts
│  └─ relations.ts
├─ App.tsx
├─ types.ts
└─ styles.css
```

현재 `storage.ts`가 `seedMembers.json`과 `localStorage`를 사용한다. UI와 관계 계산 로직은 최대한 유지하고, 데이터 입출력 부분만 Supabase로 교체한다.

### 2.2 최종 CSV

최종 파일: `ngmembers.csv`

현재 자동 검사 결과:

```text
회원 레코드                   1,378명
회원번호가 없는 사람             2명
중복된 비어 있지 않은 회원번호    0건
이름이 비어 있는 행               2건
허용되지 않은 member_status       1건 (`no`)
주 사업자                         92명
관심 회원                         38명
```

회원번호가 없는 두 사람은 가입 예정 또는 회원번호 확인 전 단계이므로 정상적으로 허용한다.

Supabase 이전 전 반드시 수정하거나 판단할 항목:

1. `member_status = no`인 행을 `active`, `withdrawn`, `review` 중 하나로 변경
2. 이름이 비어 있는 두 행을 확인
3. 빈 회원번호는 빈 문자열이 아니라 DB의 `NULL`로 저장
4. 빈 국가 코드도 `NULL`로 저장
5. 공백만 있는 CPF·메모 값은 `NULL`로 정리

### 2.3 확정된 데이터 규칙

```text
name
회사에 등록된 이름

nickname
엄마가 실제로 쓰는 한국어 이름
공동 사용자 이름도 승인된 닉네임 하나로 통일

member_number
회사 회원번호
가입 예정자는 NULL 허용

country_code
KR / BR / US / MX / CO 등
XX = 글로벌 회원
NULL = 국가 미확인

member_status
active / withdrawn / review

is_anchor_member
주 사업자

is_favorite
관심 회원

is_hidden
앱에서 숨김
```

---

## 3. 최종 UI 범위

현재 승인된 UI를 유지한다. Codex가 임의로 디자인을 전면 변경하지 않는다.

### 3.1 메인 화면

```text
회원 계보 찾기                [+ 회원 추가] [관리]

[이름·닉네임·회원번호·전화번호 검색]

[전체] [주 사업자] [관심 회원]
```

접힌 카드:

```text
Demo Member With A Long Name…
테스트 소속 · 10000001 · XX
```

규칙:

- 본명은 한 줄
- 넘치는 이름은 말줄임
- 닉네임이 없으면 빈 자리를 만들지 않음
- 회원번호가 없으면 `회원번호 미등록`
- `XX`는 `글로벌`로 표시
- 접힌 카드에는 최소 정보만 표시

### 3.2 펼친 카드

```text
전체 본명
닉네임
회원번호 · 국가

[주 사업자] [관심 회원] [탈퇴 회원] [확인 필요]

소속
테스트 알파 · 좌

바로 위 회원
김OO
※ 직계 관계가 정확히 입력된 경우에만 표시

생년월일 · 만 나이
전화번호
CPF
메모

연결된 회원
좌 목록
우 목록
위치 미확인 목록

[수정] [숨기기]
```

규칙:

- `active`는 상태 배지를 표시하지 않음
- `withdrawn`만 `탈퇴 회원`
- `review`만 `확인 필요`
- 직계 부모 미입력은 오류나 확인 필요로 자동 분류하지 않음
- `최상위 상위 회원 미연결` 같은 기술 문구는 사용자 화면에 표시하지 않음
- 관계 이동 대상 이름은 클릭 가능
- 연결된 회원은 회원번호 숫자가 작은 순서로 정렬
- 배지는 현재 파스텔톤 유지

### 3.3 관리 화면

J와 엄마 모두 같은 `admin` 역할을 사용하며 앱 안에서 가능한 작업도 동일하다.

- 검색
- 회원 추가
- 회원 수정
- 회원 숨기기
- 로그아웃

실제 권한 차이가 없으므로 역할별 화면 분기를 만들지 않는다. 숨긴 회원의 복원·영구 삭제와 데이터 직접 관리는 앱 기능으로 제공하지 않으며, 필요한 경우 J가 Supabase Dashboard에서 처리한다.

운영 앱에서는 `CSV로 전체 교체`, `샘플 데이터 초기화` 기능을 제거한다. 실제 데이터를 실수로 덮어쓰는 기능은 두지 않는다.

---

## 4. 목표 아키텍처

```text
React / Vite
    │
    ├─ Supabase Auth
    │    └─ Google 로그인
    │
    └─ Supabase Postgres
         ├─ workspaces (기존 공용)
         ├─ workspace_members (기존 공용)
         └─ members
```

### 중요한 보안 원칙

- 회원 데이터는 이름·생년월일·전화번호·CPF가 포함된 개인정보다.
- 최종 GitHub 저장소와 빌드 파일에 CSV나 `seedMembers.json`을 포함하지 않는다.
- 현재 CSV 내장형 HTML은 공개 배포하지 않는다.
- 프론트엔드에는 publishable/anon key만 사용한다.
- service role key는 브라우저 코드, `VITE_` 환경변수, GitHub 소스에 절대 넣지 않는다.
- 모든 데이터 접근은 로그인 + RLS를 통과해야 한다.
- `DELETE` 권한과 삭제 버튼은 만들지 않는다.

---

## 5. Supabase 데이터베이스 설계

## 5.1 `members` 테이블

권장 SQL 구조:

```sql
create table public.members (
  id uuid primary key default gen_random_uuid(),

  member_number text null,
  name text null,
  nickname text null,

  is_anchor_member boolean not null default false,
  is_favorite boolean not null default false,

  sponsor_name_raw text null,
  affiliation_id uuid null
    references public.members(id)
    on delete restrict,

  side text null
    check (side in ('left', 'right')),

  direct_parent_id uuid null
    references public.members(id)
    on delete restrict,

  direct_parent_side text null
    check (direct_parent_side in ('left', 'right')),

  birth_date date null,
  phone text null,
  country_code text null,
  cpf text null,
  notes text null,

  member_status text not null default 'active'
    check (member_status in ('active', 'withdrawn', 'review')),

  is_hidden boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

회원번호는 비어 있을 수 있지만, 값이 있는 경우에는 중복될 수 없게 한다.

```sql
create unique index members_member_number_unique
on public.members (member_number)
where member_number is not null
  and btrim(member_number) <> '';
```

추가 제약:

```sql
alter table public.members
add constraint members_country_code_format
check (
  country_code is null
  or country_code ~ '^[A-Z]{2}$'
);
```

`XX`도 두 글자 코드이므로 허용된다.

### 컬럼 의미

```text
affiliation_id
기존 시트의 sponsor_name_raw로 연결한 소속 기준 회원
실제 직계 부모가 아닐 수 있음

direct_parent_id
실제 바로 위 회원을 확인한 경우에만 입력

side
affiliation_id 기준 좌/우

direct_parent_side
direct_parent_id 기준 좌/우
```

기존 데이터에서는 `affiliation_id`를 주로 사용하고, `direct_parent_id`는 향후 앱에서 점진적으로 채운다.

## 5.2 기존 공용 워크스페이스와 사용자 연결

별도 `app_users` 테이블을 만들지 않고, 기존 엄마용 앱 Supabase project의 `workspaces`와 `workspace_members`를 재사용한다.

```text
ngmembers workspace ID
00000000-0000-0000-0000-000000000003

J auth.users.id       admin
엄마 auth.users.id    admin
```

권한 연결 기준은 이메일 문자열이 아니라 기존 Supabase Auth 사용자 UUID다. 일반 클라이언트가 워크스페이스 멤버십을 추가·수정하지 못하게 하고, ngmembers 데이터 정책은 위 workspace ID의 Admin 멤버십 행을 확인한다. 기존 공용 schema에는 활성 상태 컬럼이 없으므로 멤버십 행의 존재가 활성 접근을 의미한다.

## 5.3 RLS

`members` 테이블에 RLS를 활성화한다.

허용된 로그인 사용자에게만:

- SELECT
- INSERT
- UPDATE

를 허용한다.

만들지 않는 정책:

- DELETE

따라서 프론트엔드에 버그가 있거나 사용자가 API를 직접 호출해도 일반 로그인 세션으로 회원 행을 삭제할 수 없어야 한다.

J와 엄마는 모두 Admin으로서 동일하게 SELECT/INSERT/UPDATE를 사용한다. DELETE 정책은 누구에게도 만들지 않는다.

---

## 6. Google 로그인

### 구현 항목

- Supabase Google Provider 활성화
- 로그인 화면
- Google 로그인 버튼
- 로그인 세션 유지
- 앱 새로고침 후 세션 복원
- 로그아웃
- 허용되지 않은 Google 계정 안내
- 인증 로딩 화면
- 인증 실패 화면

### 허용 계정 처리

로그인 성공 후 `auth.uid()`와 `workspace_members`의 ngmembers 멤버십을 확인한다.

```text
ngmembers의 Admin 멤버십 행 있음
→ 앱 진입

허용되지 않은 이메일
→ 데이터 요청 차단
→ “사용 권한이 없는 계정입니다”
→ 로그아웃 버튼
```

### Redirect URL

개발:

```text
http://127.0.0.1:5173
http://localhost:5173
```

운영:

```text
https://member.nangok.app
```

Supabase Auth와 Google OAuth 양쪽에 필요한 URL을 정확히 등록한다.

---

## 7. 최종 CSV 이전

Dashboard에서 단순히 CSV를 넣는 것보다, 검증과 관계 연결을 자동화하는 import script를 만든다.

### 7.1 파일

```text
scripts/
├─ validate-members.ts
└─ import-members.ts
```

### 7.2 검증 스크립트

`validate-members.ts`가 검사할 내용:

#### 오류로 중단

- 필수 헤더 누락
- 비어 있지 않은 회원번호 중복
- 허용되지 않은 `member_status`
- 허용되지 않은 boolean 값
- 허용되지 않은 `side`
- 잘못된 생년월일
- 동일 행에서 자기 자신을 상위 회원으로 지정
- 입력할 수 없는 DB 타입

#### 경고로 출력

- 회원번호 없음
- 이름 없음
- 국가 미확인
- sponsor 이름을 찾지 못함
- sponsor 이름이 여러 회원과 일치
- CPF 형식 의심
- 전화번호 형식 의심

결과 예:

```text
총 1,378행
입력 가능 1,375행
오류 3건
경고 27건
```

오류가 1건이라도 있으면 DB import를 실행하지 않는다.

### 7.3 최초 import: 2단계

#### 1단계 — 회원 기본 행 입력

관계 ID 없이 모든 회원을 먼저 넣는다.

```text
member_number
name
nickname
flags
birth_date
phone
country_code
cpf
notes
member_status
is_hidden
sponsor_name_raw
```

빈 문자열은 모두 `NULL`로 변환한다.

생년월일:

```text
20000101 → 2000-01-01
```

좌우:

```text
좌 → left
우 → right
빈칸 → NULL
```

#### 2단계 — `affiliation_id` 연결

각 `sponsor_name_raw`를 다음 값과 정확히 비교한다.

1. `nickname`
2. `name`
3. `member_number`

공백·대소문자만 정규화한다. 단어를 임의로 쪼개거나 부분 일치로 연결하지 않는다.

```text
정확히 1명 일치 → affiliation_id 저장
0명 일치        → NULL + unresolved report
2명 이상 일치   → NULL + ambiguous report
```

공동 사용자 이름처럼 정리한 값도 전체 문자열이 정확히 일치해야 연결한다.

### 7.4 import 결과물

```text
reports/
├─ import-summary.json
├─ unresolved-sponsors.csv
├─ ambiguous-sponsors.csv
└─ validation-warnings.csv
```

이 파일들은 개인정보가 포함될 수 있으므로 공개 GitHub에 커밋하지 않는다. `.gitignore`에 추가한다.

### 7.5 운영 시작 후 원칙

최초 import 이후에는 CSV 전체 덮어쓰기를 사용하지 않는다.

- 신규 회원: 앱에서 추가
- 기존 회원: 앱에서 수정
- 사용 중단: 숨기기
- 잘못된 중복: J가 확인 후 숨기기
- 대량 수정 필요 시 먼저 DB 백업 후 별도 migration script 작성

---

## 8. 프론트엔드 Supabase 전환

## 8.1 패키지

```bash
npm install @supabase/supabase-js
```

테스트 도구가 없다면:

```bash
npm install -D vitest
```

## 8.2 새 파일

```text
src/
├─ lib/
│  └─ supabase.ts
├─ services/
│  └─ members.ts
├─ hooks/
│  ├─ useAuth.ts
│  └─ useMembers.ts
└─ content/
   └─ labels.ts
```

### `supabase.ts`

환경변수:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

`.env.example`만 저장소에 포함한다. 실제 값은 `.env.local` 또는 GitHub Actions Secrets/Variables에 넣는다.

### `members.ts`

담당 기능:

```text
fetchMembers()
createMember()
updateMember()
hideMember()
```

만들지 않는 함수:

```text
deleteMember()
```

DB의 snake_case와 React의 camelCase 변환을 한곳에서 처리한다.

### `useAuth.ts`

- session 확인
- 로그인
- 로그아웃
- 허용 사용자/role 확인
- auth loading/error 상태

### `useMembers.ts`

- 최초 데이터 fetch
- 로딩·오류·재시도
- 추가·수정·숨기기 후 화면 상태 갱신
- 낙관적 업데이트 또는 Supabase 반환 행으로 교체

1,378명 정도는 로그인 후 한 번 받아 브라우저에서 검색·정렬해도 충분하므로, 기존 클라이언트 검색 로직을 유지한다.

## 8.3 제거할 코드·데이터

운영 버전에서는 다음을 제거한다.

```text
src/data/seedMembers.json
src/lib/storage.ts
브라우저 localStorage 회원 저장
샘플 초기화 기능
운영 화면의 CSV 전체 교체
```

개발 테스트용 fixture가 필요하면 개인정보가 없는 가짜 회원 10명 이하로 새로 만든다.

---

## 9. 문구 수정 방식

엄마가 사용하는 용어를 나중에 쉽게 바꿀 수 있도록 UI 문구를 한 파일에 모은다.

```text
src/content/labels.ts
```

예:

```ts
export const labels = {
  appTitle: "회원 계보 찾기",
  anchorMember: "주 사업자",
  favoriteMember: "관심 회원",
  affiliation: "소속",
  directParent: "바로 위 회원",
  linkedMembers: "연결된 회원",
  withdrawn: "탈퇴 회원",
  review: "확인 필요",
  unregisteredNumber: "회원번호 미등록"
};
```

Codex는 문자열을 여러 컴포넌트에 직접 흩어 쓰지 않는다.

문구 변경 목록은 구현 전에 J가 최종 전달하고, Phase 4에서 한 번에 적용한다.

---

## 10. 회원 입력·수정 규칙

### 회원번호

- 빈칸 허용
- 저장 시 `""`가 아니라 `NULL`
- 값이 있으면 숫자만 허용
- 중복 번호는 저장 차단
- 빈칸이면 카드에 `회원번호 미등록`

### 이름

- 회사 등록 이름
- 빈칸 허용 여부는 기존 데이터 때문에 DB상 허용
- 신규 입력 UI에서는 원칙적으로 필수
- 기존 이름 미확인 행은 `review` 사용 가능

### 닉네임

- 선택 입력
- 엄마가 정한 한국어 이름
- 관계 선택 검색에 포함
- 신규 입력에서는 한글 최소 2글자 규칙 적용
- 기존 정리 데이터는 임의로 자동 수정하지 않음

### 소속

자유 텍스트 입력 금지.

```text
[이름·닉네임·회원번호로 검색]
→ 기존 회원 선택
→ 좌/우 선택
```

저장값:

```text
affiliation_id
side
```

`sponsor_name_raw`는 선택 당시의 닉네임 또는 이름을 참고 기록으로 저장하거나, 기존 값 보존 목적으로만 유지한다.

### 바로 위 회원

- 기본 입력 화면에서는 접힌 선택 항목
- 정확히 확인한 경우에만 선택
- `direct_parent_id`, `direct_parent_side`
- 자기 자신 선택 금지
- 순환 관계 저장 금지

### 상태

```text
active
withdrawn
review
```

화면 선택 문구:

```text
활동 회원
탈퇴 회원
확인 필요
```

---

## 11. 자동 데이터 검사

엄마 화면을 복잡하게 만들지 않도록 자동 오류는 기본 카드에 모두 표시하지 않는다.

### 카드 배지

사용자가 직접 지정한 상태만 표시:

- `withdrawn`
- `review`

### J 관리 화면의 데이터 검사

- 회원번호 중복
- 이름 없음
- 잘못된 상태값
- 존재하지 않는 `affiliation_id`
- 존재하지 않는 `direct_parent_id`
- 자기 자신 연결
- 관계 순환
- `sponsor_name_raw` 미해결
- 동일 sponsor 후보 여러 명

직계 부모 미입력은 오류가 아니다.

회원번호 미등록도 가입 예정자에게 허용되므로 자동 오류가 아니라 정보로 취급한다.

---

## 12. 웹폰트

Codex가 현재 적용 상태와 경로를 먼저 확인한다.

권장 구조:

```text
src/assets/fonts/
└─ <사용할 폰트>.woff2
```

`styles.css`:

```css
@font-face {
  font-family: "MemberAppFont";
  src: url("./assets/fonts/<사용할 폰트>.woff2") format("woff2");
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
}

body {
  font-family:
    "MemberAppFont",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    "Noto Sans KR",
    sans-serif;
}
```

검증 항목:

1. `npm run build` 후 `dist/assets`에 폰트가 생성되는지
2. 빌드된 CSS가 올바른 해시 경로를 가리키는지
3. 배포 시 새 `dist` 전체가 업로드되는지
4. Chrome Network에서 폰트 응답이 200인지
5. Computed Style에서 실제 폰트가 선택되는지
6. 모바일에서 굵기 적용이 일치하는지

폰트 파일만 `assets`에 수동 복사하고 예전 `index.html`을 유지하는 방식은 사용하지 않는다. 매 수정 후 새로 빌드한 `dist` 전체를 배포한다.

---

## 13. 테스트

## 13.1 유틸리티 테스트

- 회원번호 숫자 정렬
- 이름·닉네임·회원번호·전화번호 검색
- 만 나이 계산
- 전화번호 표시
- CPF 표시
- `KR`, `BR`, `XX`, `NULL` 국가 표시
- 관계 연결
- 주요 사업자 경로
- 순환 관계 차단
- CSV 값 → DB 값 변환

## 13.2 인증·RLS 테스트

반드시 직접 확인:

1. 로그아웃 상태에서 회원 SELECT 실패
2. 허용된 Google 계정으로 로그인 성공
3. 허용되지 않은 Google 계정은 데이터 접근 실패
4. J와 엄마 계정으로 SELECT/INSERT/UPDATE 성공
5. 브라우저에서 DELETE 요청을 직접 보내도 실패
6. publishable key만으로 로그인 없이 데이터 조회 불가
7. service role key가 빌드 파일에 없음

## 13.3 실사용 테스트

- 회원번호 검색
- 긴 해외 이름 검색
- 닉네임 검색
- 전화번호 검색
- 주 사업자 필터
- 관심 회원 필터
- 카드 펼침
- 소속 회원 클릭 이동
- 좌·우 연결 회원 목록
- 회원번호 없는 가입 예정자 추가
- 회원번호가 생긴 뒤 수정
- 중복 번호 저장 차단
- 탈퇴·확인 필요 상태 변경
- 숨기기
- 숨긴 항목이 일반 앱 화면에서 제외됨
- 새로고침 후 데이터 유지
- 다른 기기에서 같은 데이터 확인

## 13.4 개인정보 노출 검사

배포 전에 `dist`에서 실제 회원 이름이 발견되지 않아야 한다.

예:

```bash
grep -R "KNOWN_PRIVATE_MEMBER_MARKER" dist
grep -R "KNOWN_PRIVATE_PHONE_MARKER" dist
```

결과가 없어야 한다.

---

## 14. GitHub와 배포

### 저장소

- 기존 MVP 코드를 Git 저장소에 넣음
- 가능하면 private repository 사용
- `ngmembers.csv`, import report, 실제 `.env`는 커밋 금지
- `.gitignore`에 개인정보 파일 패턴 추가

예:

```gitignore
.env
.env.*
!.env.example

data/private/
reports/
ngmembers.csv
*members*.csv
src/data/seedMembers.json
```

### GitHub Actions

작업:

```text
npm ci
npm run build
```

필요한 build 환경변수:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

service role key는 정적 앱 빌드에 사용하지 않는다.

### 도메인

1. 임시 GitHub Pages 주소에서 로그인·저장 테스트
2. GitHub Pages Custom Domain에 `member.nangok.app` 설정
3. Cloudflare DNS 레코드 연결
4. HTTPS 확인
5. Supabase Redirect URL에 운영 주소 추가
6. Google OAuth Redirect 설정 확인
7. iPhone/iPad/PC에서 재로그인 테스트

---

## 15. Phase별 실행 계획

## Phase 0 — 기준선 확정

Codex 작업:

- 프로젝트 전체 읽기
- 현재 UI와 데이터 흐름 설명
- `npm ci`
- `npm run build`
- 변경 전 기준 커밋
- 현재 웹폰트 상태 확인
- final CSV 자동 검사
- 개인정보가 내장된 파일 목록 보고

완료 기준:

- 기존 앱이 빌드됨
- 변경 전 동작이 보존됨
- 데이터 오류 목록이 생성됨
- 구현 전에 수정할 문구 목록을 J에게 보고

이 단계에서는 기능을 바꾸지 않는다.

---

## Phase 1 — Supabase schema, Auth, RLS

Codex 작업:

```text
supabase/
├─ 001_members_schema.sql
├─ 002_workspace_access.sql
├─ 003_rls_policies.sql
└─ README.md
```

- `members`
- 기존 `workspaces`·`workspace_members`를 이용한 접근 연결
- updated_at trigger
- unique index
- check constraints
- RLS
- SELECT/INSERT/UPDATE 정책
- DELETE 정책 없음
- Google login용 프론트 auth 기본 구조
- `.env.example`

완료 기준:

- SQL을 새/기존 Supabase project에서 재실행 가능
- 익명 사용자는 데이터 접근 불가
- 허용 사용자만 접근 가능
- DELETE가 DB 수준에서 차단됨
- 앱은 아직 실데이터를 import하지 않아도 됨

---

## Phase 2 — CSV 검증과 최초 import

Codex 작업:

- `validate-members.ts`
- `import-members.ts`
- 관계 2단계 연결
- import report 생성
- 빈 문자열 → NULL
- `birth_date` 변환
- `좌/우` 변환
- sponsor 정확 일치 연결

완료 기준:

- 최종 CSV 1,378행 검증
- 예상된 빈 회원번호 2행 import 가능
- 비어 있지 않은 회원번호 중복 0
- 오류가 있는 상태에서는 import 중단
- 모든 행 기본 insert 성공
- 관계 연결 결과 집계 제공
- 미해결·중복 sponsor 목록 제공
- import를 두 번 실수로 실행하지 않도록 보호

이 Phase가 끝난 뒤 J가 보고서를 확인하고 실제 production import를 승인한다.

---

## Phase 3 — 프론트 데이터 계층 교체

Codex 작업:

- `@supabase/supabase-js`
- Supabase client
- Auth hook
- Members service/hook
- async loading/error/retry
- localStorage 제거
- seed data 제거
- add/edit/hide 실 DB 연결
- 두 Admin 계정의 동일한 관리 UI

완료 기준:

- 로그인 전 데이터가 보이지 않음
- 로그인 후 1,378명 로드
- 검색·필터·카드 UI가 기존과 동일
- 추가·수정·숨김이 새로고침 후 유지
- 다른 브라우저에서도 변경사항 확인
- 삭제 함수와 버튼 없음

---

## Phase 4 — 최종 문구·기능·폰트

Codex 작업:

- `labels.ts` 도입
- 엄마가 쓰는 용어로 문구 교체
- 회원번호 미등록 처리
- `XX → 글로벌`
- 승인된 카드 구조 반영
- 관리 메뉴 단순화
- 웹폰트 빌드 경로 수정
- 가격표 앱과 시각적 일관성 확인

완료 기준:

- 기존 승인 UI와 일치
- 엄마 화면에 기술 문구가 없음
- 접힌 카드가 복잡하지 않음
- 긴 이름 말줄임
- 펼친 카드에서 전체 이름
- 웹폰트가 실제 배포본에서 적용됨

---

## Phase 5 — 보안·테스트·배포

Codex 작업:

- 유틸 테스트
- RLS 테스트 절차
- build 검사
- PII bundle 검사
- README
- GitHub Actions
- 배포
- custom domain 안내

완료 기준:

- `npm run build` 성공
- 테스트 성공
- 실제 개인정보가 소스·dist에 없음
- 허용되지 않은 사용자는 조회 불가
- DELETE 불가
- 임시 주소 실사용 테스트 성공
- `member.nangok.app` 연결 성공

---

## 16. Codex 작업 규칙

Codex에 반드시 전달할 규칙:

1. 현재 확정된 UI를 임의로 재설계하지 않는다.
2. 작은 화면에서 정보량을 늘리지 않는다.
3. 회원 데이터 삭제 기능을 만들지 않는다.
4. service role key를 프론트엔드에 넣지 않는다.
5. 실제 CSV·seed JSON을 GitHub나 `dist`에 포함하지 않는다.
6. 자동 연결은 정확히 한 명과 일치할 때만 한다.
7. 직계 부모 미입력을 오류로 취급하지 않는다.
8. 빈 회원번호를 허용하고 DB에는 `NULL`로 저장한다.
9. 각 Phase 종료 시 빌드·테스트 결과와 변경 파일을 보고한다.
10. 각 Phase별로 별도 커밋을 만든다.
11. 계획 밖의 schema 변경은 먼저 설명하고 승인을 받는다.
12. 기존 작동 기능을 제거할 때는 이유를 보고한다.

---

## 17. J가 준비할 것

Codex 작업 전:

- 현재 최신 회원앱 소스
- 최종 `ngmembers.csv`
- 엄마가 확정한 최종 문구 목록
- 사용할 웹폰트 파일의 로컬 위치
- 기존 엄마용 앱 Supabase project 정보
- 기존 Supabase Auth에서 J와 엄마의 사용자 UUID
- ngmembers workspace에 두 사용자를 모두 `admin`으로 연결
- GitHub repository
- 배포 방식

보안상 Codex 채팅이나 GitHub 코드에 직접 적지 않을 것:

- service role key
- DB password
- 개인 Google OAuth client secret

필요한 값은 `.env.local`, Supabase Dashboard, GitHub Secret에만 넣는다.

---

## 18. Codex 첫 프롬프트

아래 문구와 이 계획서를 함께 전달한다.

```text
첨부한 회원앱 React/Vite 프로젝트를 실서비스용 Supabase 앱으로 전환하려고 합니다.

먼저 이 작업 계획서를 끝까지 읽고 Phase 0만 수행해주세요.

중요:
- 아직 Supabase schema나 기능을 구현하지 마세요.
- 현재 프로젝트 구조, 데이터 흐름, UI 동작을 분석하세요.
- npm ci와 npm run build를 실행해 현재 기준선을 확인하세요.
- 개인정보가 seed JSON, CSV, dist 또는 소스에 어디에 포함되어 있는지 목록을 만드세요.
- 최종 ngmembers.csv를 검증하고 오류와 경고를 분리해 보고하세요.
- 현재 웹폰트가 어떤 방식으로 연결되어 있으며 왜 배포에서 적용되지 않을 수 있는지 확인하세요.
- 현재 UI를 임의로 변경하지 마세요.
- 작업 결과, 변경한 파일, 실행한 검사와 다음 Phase 전에 결정해야 할 사항을 정리해주세요.
```

Phase 0 결과를 확인한 뒤 Phase 1을 별도로 지시한다.

---

## 19. 실사용 전 최종 완료 조건

다음 항목이 모두 충족되어야 `member.nangok.app`을 엄마에게 정식 앱으로 전달한다.

```text
[ ] Google 로그인 성공
[ ] J와 엄마만 접근 가능
[ ] 로그인하지 않으면 회원 데이터 조회 불가
[ ] 최종 1,378명 import 완료
[ ] 가입 예정자 2명 정상 표시
[ ] 검색 4종 정상 작동
[ ] 소속 연결과 관계 이동 정상 작동
[ ] 신규 회원 추가 가능
[ ] 수정 가능
[ ] 숨기기 가능
[ ] 앱과 API 모두 삭제 불가
[ ] 숨긴 회원은 앱에서 제외되고 Supabase Dashboard에서만 최종 처리
[ ] 웹폰트 정상 적용
[ ] 실제 회원 데이터가 GitHub와 dist에 없음
[ ] PC·iPhone·iPad 실사용 테스트 완료
[ ] member.nangok.app HTTPS 정상 작동
```
