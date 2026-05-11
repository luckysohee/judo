# Release Candidate Scope (Launch 후보 컷)

목표: 현재까지 구현된 기능을 **“런칭 후보 버전(Release Candidate)”**으로 묶고,
이번 릴리즈에 포함/제외 범위를 명확히 분리한다.

---

## 1) 이번 릴리즈에 포함되는 기능

### A) 컬렉션/코스
- 컬렉션(코스) 생성/편집/공개(visibility) 기본 플로우
- 컬렉션 상세/리스트/그리드 노출
- 커버 표시: 수동 cover + (cover 비어 있을 때) 자동 대표 커버 fallback

### B) 저장/좋아요/공유
- 컬렉션 저장/저장 해제
- 컬렉션 좋아요/좋아요 해제
- 컬렉션 공유(링크 복사/공유 시도)

### C) vibe / search / tag
- 홈 상단 상황(tag) 레일 탐색
- 컬렉션 검색/태그 페이지 탐색
- vibe caption / 태그 기반 노출(가능한 범위에서)

### D) remix / lineage
- 리믹스 생성(원본 기반 복제) 플로우
- lineage(원본/자식) 기반 탐색 섹션/표시(가능한 화면에서)

### E) activation / re-engagement
- first session activation (lightweight onboarding block)
  - 상황 칩 + CTA (A/B: activation_cta)
  - funnel 로그(노출/클릭/첫 행동)
- re-engagement (push 없이) 홈 상단 revisit 배너
  - 저장 태그 신작 / 픽한 사람 신작 / featured 신작 / 저장한 코스의 새 리믹스(heuristic)
  - dismiss 가능

### F) observability / A-B / admin insights
- Home section impression 로그 (IntersectionObserver 기반 1회)
- collection interaction 로그 (클릭/공유 등)
- home_layout A/B (layout variant) + guardrails
- activation funnel / CTA bucket / outcome quality(Admin 비교 기반)
- Admin Collection Insights 대시보드(CTR/guardrails/funnel 등)

---

## 2) 이번 릴리즈에서 제외하는 기능

- push notification(푸시 알림)
- 결제/구독
- 장소 리뷰 작성(UGC 리뷰/평점 작성)
- full AI generation(전면 AI 생성/자동 제작)
- native app(iOS/Android 네이티브 앱)

---

## 3) P0 Launch Blockers (런칭 차단)

- **빌드/런타임**
  - `npm run build` 실패
  - 홈/검색/컬렉션 상세 등 핵심 화면에서 흰 화면/무한 로딩/크래시
- **데이터 쓰기 플로우**
  - 컬렉션 생성/편집이 실패하거나 잘못된 데이터가 저장됨
  - 저장/좋아요 토글이 동작하지 않음(또는 상태가 유지되지 않음)
- **권한/RLS**
  - 비공개 컬렉션이 타인/비로그인에 노출되는 등 권한 사고
  - 필수 데이터 조회가 RLS로 전부 막혀 UI가 기능 불가
- **관측/실험 로그의 안정성**
  - best-effort 로그 insert 실패가 UI를 막거나, 재시도 폭주로 네트워크 장애 유발
- **스테이징/프로덕션 분리**
  - staging/prod Supabase 연결이 섞여 운영 지표/데이터가 오염될 위험

---

## 4) P1 Polish (런칭 전 다듬기)

- **카피/온보딩 UX**
  - activation block 카피/칩/CTA 톤 개선
  - activation_cta 버킷별 action이 “의도한 섹션”으로 확실히 연결되는지 점검
- **관측 데이터 품질**
  - funnel 로그 누락률(특히 bucket/cta_bucket null) 감소
  - Admin에서 지표가 “해석 가능한” 형태로 보이는지(표본/누락/이상치)
- **성능**
  - Home 초기 렌더(레이아웃/레일 lazy mount) 체감 개선 유지
  - cover 이미지 offscreen fetch 최소화 유지
- **UI/안정성**
  - revisit 배너의 signal 우선순위/노이즈(너무 자주 뜨는지) 튜닝
  - dismiss 동작이 과하게 permanent 되지 않는지(재노출 사이클 확인)

---

## 5) 이후 v1.1 후보

- push 기반 re-engagement(알림/딥링크)
- activation conversion dashboard 고도화(기간/코호트/환경 필터)
- outcome quality 지표 확장(예: N-day 저장/픽/리믹스/검색 재사용 등)
- 실험 운영 툴링(override UI, 안전한 kill switch, 버전 업 전략)
- 로그 파이프라인 정리(app_env 필터링/테이블 분리/집계 RPC 등)
- 추천/검색 품질 개선(이번 릴리즈 컷에서는 로직 안정 우선)

---

## 6) 배포 전 최종 확인 링크

- QA checklist: `docs/QA_RELEASE_CHECKLIST.md`
- deploy/rollback checklist: `docs/DEPLOY_ROLLBACK_CHECKLIST.md`
- staging/production guide: `docs/STAGING_PRODUCTION_GUIDE.md`

