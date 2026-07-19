# ngmembers Roadmap

회원앱을 안전한 실서비스로 바꾸는 전체 순서입니다.

## Phase 0 — 현재 상태 확인 ✅

- 기존 코드·UI·데이터 흐름 분석
- build, CSV, 개인정보, 웹폰트 문제 확인
- public 저장소를 새로 초기화

## Phase 1 — 안전한 기반과 로그인 ✅

- 실제 개인정보와 과거 bundle 제거
- 정상 Vite build 복구
- Supabase schema와 RLS 작성
- Google 로그인과 두 Admin 계정 설정
- ngmembers workspace `00000000-0000-0000-0000-000000000003` 연결
- 아직 최종 회원 데이터는 넣지 않음

## Phase 2 — 최종 CSV 이전 ✅

- CSV 오류·경고 재검사
- 빈 값은 `NULL`로 변환
- 1,378명 기본 데이터 import
- sponsor 관계 연결 결과 확인
- J님 승인 후 production import

## Phase 3 — 앱을 실제 DB에 연결 ✅

- localStorage와 seed 제거
- 회원 조회·추가·수정·숨김 연결
- J님과 엄마가 같은 Admin 기능 사용
- 영구 삭제·복원은 앱에 만들지 않고 Supabase Dashboard에서 처리
- 새로고침과 다른 기기에서도 같은 데이터 확인

## Phase 4 — 최종 문구·UI·웹폰트

- 승인된 용어와 문구 반영
- 카드 정보와 관리 화면 정리
- 웹폰트를 Vite build에 정상 포함
- 기존 디자인을 유지하며 모바일 확인

## Phase 5 — 보안 검사와 배포

- RLS·DELETE 차단·PII bundle 최종 검사
- GitHub Actions와 안전한 Pages 배포
- `member.nangok.app` 연결
- Google OAuth production URL 설정
- PC·iPhone·iPad 실사용 확인

```text
현재 위치: Phase 3 production 적용·실사용 검증 완료 → Phase 4 계획 완료·문구 승인 대기
```
