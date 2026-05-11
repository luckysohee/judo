# Deploy / Rollback 체크리스트 (Staging → Production)

목표: 배포 전후에 “필수 확인”을 표준화해 사고를 줄인다.

---

## 배포(Deploy) 체크리스트

### A) 코드/빌드 (P0)
- [ ] **`npm run build` 성공**
- [ ] **`npm run lint` exit 0**
- [ ] 배포 대상 브랜치/커밋 SHA 기록
- [ ] QA 체크리스트(P0 스모크) 기준 통과 (참고: `docs/QA_RELEASE_CHECKLIST.md`)

### B) 환경 변수/리소스 연결 (P0)
- [ ] `VITE_APP_ENV` 값이 목표 환경과 일치
  - staging 배포: `staging`
  - production 배포: `production`
- [ ] `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`가 목표 프로젝트로 연결
  - staging: staging Supabase
  - prod: prod Supabase
- [ ] (staging만) 실험 강제 bucket override를 사용할 경우 기록
  - 예: `VITE_EXPERIMENT_OVERRIDE_HOME_LAYOUT`
- [ ] (production) debug/override 변수가 켜져 있지 않음
  - verbose console / mock / test buttons / override

### C) DB 마이그레이션 (P0)
- [ ] staging Supabase에 마이그레이션 적용 완료
- [ ] production Supabase에 마이그레이션 적용(또는 적용 계획/윈도우 확정)
- [ ] RLS 정책이 staging/prod에서 동일한지 확인
- [ ] 아래 테이블/컬럼 존재 확인
  - [ ] `collection_interaction_logs`
  - [ ] `home_section_impression_logs`
  - [ ] `collection_interaction_logs.experiment_bucket`
  - [ ] `home_section_impression_logs.experiment_bucket`

### D) 배포 직후 스모크 (P0)
- [ ] Guest 홈 진입: 첫 렌더/검색바 동작
- [ ] 로그인 홈 진입: 상단 레일/토글 동작
- [ ] 컬렉션 카드 클릭 → 상세 이동
- [ ] 컬렉션 검색 → 결과 클릭 이동
- [ ] Admin insights 진입(가능 시): 클릭/노출/CTR 표가 렌더되는지

### E) 배포 직후 관측(운영 확인) (P0)
- [ ] 콘솔 런타임 에러(흰 화면/무한 렌더) 없음
- [ ] 네트워크에서 핵심 API 4xx/5xx 급증 없음
- [ ] 관측 로그(best-effort)가 폭주하지 않음(초당 다수 insert 등)
- [ ] 실험 bucket 누락 비율이 비정상적으로 높지 않음

---

## 롤백(Rollback) 체크리스트

### 트리거 기준 (P0)
아래 중 하나라도 해당하면 즉시 롤백 판단:
- [ ] 홈/로그인/검색/컬렉션 상세 등 **핵심 플로우가 동작 불가**
- [ ] 사용자 데이터 손상 위험(잘못된 쓰기/권한/삭제)
- [ ] 대규모 5xx/네트워크 장애 유발
- [ ] 브라우저 콘솔에 치명적 런타임 에러가 지속적으로 발생

### 롤백 절차 (P0)
- [ ] 롤백 대상(이전 안정 버전) 커밋 SHA 확인
- [ ] 배포 시스템에서 이전 버전으로 롤백 수행
- [ ] 롤백 완료 후 즉시 스모크 재검증
  - [ ] Guest 홈
  - [ ] 로그인 홈
  - [ ] 컬렉션 상세
  - [ ] 검색
- [ ] 운영/QA 채널에 롤백 공지(시간/원인/영향 범위/다음 액션)

### DB 변경이 포함된 배포의 롤백 주의 (P0)
- schema 변경이 포함된 경우, “코드만 롤백”이 안전한지 확인:
  - [ ] 새 컬럼 추가(호환)만 있으면 코드 롤백은 비교적 안전
  - [ ] 컬럼 삭제/타입 변경/정책 변경이 있으면 롤백이 위험할 수 있음
- [ ] RLS 정책 변경이 포함되면, 정책 롤백이 필요한지 판단

### 롤백 후 사후 조치 (P1)
- [ ] 실패 원인 1줄 요약 + 재현 조건 기록
- [ ] 로그(콘솔/네트워크/insights) 캡처
- [ ] hotfix 여부/재배포 계획 수립

