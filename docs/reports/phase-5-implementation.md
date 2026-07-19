# Phase 5 보안·배포·운영 구현 보고서

- 작성일: 2026-07-19
- 대상: `ngmembers` 저장소의 최종 검사와 Pages 배포 gate
- 원칙: 실제 회원 데이터·Supabase 권한·DNS·OAuth 설정은 변경하지 않음

## Work Summary

Phase 5 계획에 따라 Phase 1–4 자동 검사를 하나의 최종 gate로 묶고, source·dist·Git history·tracked private file·Supabase SQL 계약을 배포 전에 확인하도록 정리했다. GitHub Actions는 전체 history를 checkout한 뒤 `verify:phase5`가 통과한 경우에만 Pages artifact를 생성한다.

## Work Completed

- `scripts/verify-phase-5.mjs` 추가
  - Phase 1–4 검사와 production build 재실행
  - tracked `reports/`, local environment와 prepared payload 검사
  - source·working tree·dist의 `sb_secret_`, service role JWT, Google Client Secret 형태 검사
  - 현재 또는 Git history에서 확보된 PII marker의 source·dist·history 대조
  - `dist/index.html`의 hashed JS/CSS 실제 파일 존재와 source map 부재 검사
  - source/dist 외부 Pretendard stylesheet link 일치 검사
  - members 최소 권한, DELETE policy 부재, cycle trigger·advisory lock, Admin function execute 계약 검사
- `package.json`에 `npm run verify:phase5` 추가
- `.github/workflows/deploy-pages.yml` 수정
  - `fetch-depth: 0`으로 Git history 검사 기반 확보
  - 기존 Phase 3 검사 대신 최종 Phase 5 gate 실행
  - gate 실패 시 기존과 같이 artifact 업로드와 deploy 단계로 진행하지 않음
- `supabase/tests/phase5_security_audit.sql` 추가
  - production에서 실행 가능한 읽기 전용 privilege·policy·function·trigger·count·cycle 확인 쿼리
  - 임시 회원 row 생성이나 권한 변경을 포함하지 않음
- README, Supabase 운영 안내, ROADMAP에 Phase 5 검사와 외부 운영 확인 절차 반영

## Decisions

- GitHub Pages custom domain, DNS, Supabase Site URL, Google OAuth redirect는 외부 상태를 바꾸므로 저장소 작업에서 자동 변경하지 않았다.
- production write smoke test는 실제 회원 데이터와 권한을 변경할 수 있으므로 승인·backup·정리 경로가 없는 상태에서 실행하지 않았다.
- 외부 Pretendard는 Phase 4에서 확정한 jsDelivr stylesheet link를 유지하고, build 산출물에 link가 보존되는지만 자동 검사한다. 실제 Network 응답·computed style·fallback은 production 브라우저 확인 항목으로 남겼다.
- PII 검사 결과는 값 자체를 출력하지 않고 scope와 파일 count만 출력한다. Git history에 marker baseline이 없으면 이를 성공으로 추정하지 않고, 검사 가능한 history text blob 기준으로 기록한다.

## Verification

실행 결과는 다음에 기록한다.

```text
npm ci
npm run verify:phase5
```

결과:

- `npm ci`: 실행 중인 Windows 개발 서버가 esbuild 실행 파일을 잠가 `EPERM`으로 중단됨. 개발 서버를 종료하지 않고 `npm install --ignore-scripts`로 로컬 의존성을 복구함. CI의 깨끗한 Ubuntu 환경에서는 workflow의 `npm ci`를 사용함.
- 로컬 `npm run verify:phase5`: 통과
- Phase 1 안전 검사: 통과, PII baseline 없음
- Phase 2 typecheck·테스트·private file 검사: 통과
- Phase 3 build·테스트·정적 repository/RLS 검사: 통과
- Phase 4 build·Phase 3/4 테스트: 통과 (Phase 3 8개, Phase 4 6개)
- 최종 build 및 dist asset hash/source map/외부 stylesheet 검사: 통과
- Git history secret·PII marker 검사와 Supabase 정적 계약 검사: 통과
- Supabase production 읽기 전용 감사 SQL: Dashboard 권한 확인 후 기록
- custom domain·HTTPS: J님 승인 후 기록
- Google OAuth production callback: J님과 두 Admin 계정 확인 후 기록
- PC·iPhone·iPad 실사용: 인증 세션과 기기 확인 후 기록

## Current Status

- 저장소 내 Phase 5 최종 gate와 CI 연결은 구현 완료다.
- Supabase 권한·행 수·관계 수·cycle은 `supabase/tests/phase5_security_audit.sql` 실행 전까지 production 기준으로 확정하지 않는다.
- DNS·Pages custom domain·HTTPS·OAuth·실사용 smoke test는 외부 계정 또는 설정 접근이 필요해 미완료다.
- 기존 working tree의 J님 수정 파일은 덮어쓰지 않았다.

## Next Steps

- GitHub Actions에서 승인된 `main` commit으로 최종 gate와 artifact를 실행한다.
- Supabase Dashboard에서 읽기 전용 감사 SQL 결과를 기록한다.
- J님 승인 후 `member.nangok.app` DNS/Pages 설정과 production OAuth redirect를 확인한다.
- 두 Admin 계정으로 PC·iPhone·iPad smoke test를 수행하고 결과를 이 보고서와 devlog에 추가한다.
