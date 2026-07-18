# Phase 1 Supabase 적용 안내

이 디렉터리는 실제 회원 CSV를 넣지 않고 schema, 워크스페이스 접근, RLS만 준비한다. SQL은 파일명 순서대로 Supabase SQL Editor에서 실행한다.

## 1. 적용 전 확인

기존 엄마용 project를 재사용하므로 먼저 DB 백업을 만든다. `workspaces`, `workspace_members`가 이미 있으면 아래 쿼리로 컬럼을 비교한다.

```sql
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('workspaces', 'workspace_members')
order by table_name, ordinal_position;
```

`002_workspace_access.sql`이 기대하는 핵심 컬럼은 다음과 같다.

```text
workspaces: id uuid, name text
workspace_members: workspace_id uuid, user_id uuid, role text, created_at timestamptz
```

2026-07-18 실제 공용 schema 확인 결과 별도의 활성 상태 컬럼은 없다. 따라서 멤버십 행의 존재가 활성 접근을 의미하며, 접근을 중지하려면 해당 workspace membership 행을 SQL Editor에서 제거한다. 공용 `role`은 기존 앱이 다른 역할을 쓸 수 있으므로 테이블 전체 check constraint로 제한하지 않고 ngmembers helper에서만 `admin` 역할을 요구한다.

기존 schema가 다르면 파일을 그대로 실행하지 말고 기존 앱과 함께 쓸 수 있도록 매핑을 먼저 조정한다. 같은 이름의 테이블이 다른 구조로 존재하면 `create table if not exists`는 그 구조를 바꾸지 않으며, 후속 SQL이 실패해 불일치를 드러낸다.

## 2. SQL 적용 순서

1. `001_members_schema.sql`
2. `002_workspace_access.sql`
3. `003_rls_policies.sql`

모든 DDL은 같은 파일을 다시 실행할 수 있도록 `if not exists`, `create or replace`, policy/trigger 재생성을 사용한다. 다만 기존 object가 같은 이름에 다른 정의로 존재하면 자동 병합하지 않는다. SQL Editor 오류를 무시하지 말고 적용을 중단한 뒤 schema를 비교한다.

## 3. 두 Admin 계정 연결

Supabase Dashboard의 Authentication > Users에서 J님과 엄마 계정의 `auth.users.id` UUID를 확인한다. 이메일 대신 UUID만 아래 쿼리에 넣고 SQL Editor에서 실행한다.

```sql
begin;

insert into public.workspace_members (
  workspace_id,
  user_id,
  role
)
values
  ('00000000-0000-0000-0000-000000000003', '<J_AUTH_USER_UUID>', 'admin'),
  ('00000000-0000-0000-0000-000000000003', '<MOTHER_AUTH_USER_UUID>', 'admin')
on conflict (workspace_id, user_id)
do update set
  role = excluded.role;

commit;
```

UUID placeholder를 실제 값으로 바꾸기 전에는 실행하지 않는다. DB password, service role key, Google Client Secret은 이 저장소나 채팅에 기록하지 않는다.

확인:

```sql
select workspace_id, user_id, role, created_at
from public.workspace_members
where workspace_id = '00000000-0000-0000-0000-000000000003';
```

## 4. Google OAuth 설정

Supabase Dashboard에서 Google provider를 활성화하고 기존 Google OAuth Client를 재사용한다. Redirect URL 초기값은 다음과 같다.

```text
http://127.0.0.1:5173
http://localhost:5173
https://mworkroom.github.io/ngmembers/
```

Supabase의 callback URL은 Dashboard에 표시되는 project별 `/auth/v1/callback` 값을 Google Cloud Console의 승인된 redirect URI에 등록한다. Google Client Secret은 Dashboard에만 저장한다.

## 5. RLS 수동 검사

먼저 SQL Editor에서 개인정보가 아닌 임시 행 하나를 만든다.

```sql
insert into public.members (member_number, name, nickname, country_code)
values ('phase1-check', 'Phase One Test Member', '테스트 계정', 'XX')
returning id;
```

그다음 브라우저 또는 Supabase API client에서 다음 여섯 가지를 확인하고 결과를 기록한다.

1. 로그아웃 상태/publishable key만 사용한 SELECT는 임시 행을 반환하지 않는다.
2. ngmembers 멤버십이 없는 로그인 계정의 SELECT는 임시 행을 반환하지 않는다.
3. J Admin 계정은 SELECT·INSERT·UPDATE에 성공한다.
4. 엄마 Admin 계정은 SELECT·INSERT·UPDATE에 성공한다.
5. 두 Admin 계정에서 `members.delete().eq('id', testId)`는 권한 오류로 실패한다.
6. 로그인한 두 계정에서 `get_ngmembers_access()`는 `{ is_authorized: true, role: 'admin' }`을 반환한다. 접근을 중지한 계정은 멤버십 행을 삭제한 뒤 `is_authorized: false`가 되어야 한다.

테스트 행의 영구 삭제는 일반 세션이 아니라 SQL Editor에서만 수행한다. `members` DELETE policy는 만들지 않았고 `authenticated` role의 DELETE grant도 회수했다.

## 6. 환경변수

`.env.example`을 `.env.local`로 복사하고 project URL과 publishable/anon key만 설정한다.

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

프론트엔드는 `sb_secret_` key와 legacy JWT의 `service_role` claim을 감지하면 회원 화면을 열지 않는다.
