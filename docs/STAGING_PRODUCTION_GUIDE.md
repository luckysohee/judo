# Staging / Production 환경 분리 가이드

목표: **실험 로그·QA·운영 데이터**를 안전하게 분리하고, 배포/롤백 시 사고 반경을 줄인다.

이 문서는 코드 변경 없이 운영 규칙을 정리한 가이드다.

---

## 환경 정의

- **dev**
  - 로컬 개발(개발자 PC) + 로컬 Vite + (선택) dev Supabase
  - 목적: 빠른 개발/디버깅, 실험/로그는 필요 시만

- **staging**
  - 배포 전 QA/검증 환경
  - 목적: 기능 검증 + 실험/관측 파이프라인 검증 + 마이그레이션 검증
  - 원칙: **production과 동일한 아키텍처**, 단 디버그/오버라이드는 staging에서만 허용

- **production**
  - 실제 사용자 운영 환경
  - 원칙: 디버그/테스트/오버라이드 비활성화, 로그/관측은 best-effort로 안전하게

---

## 1) 환경 변수 정리 (dev / staging / production)

### 공통 원칙
- **(P0)** 환경 변수는 “기능 플래그”가 아니라 “환경 선택/리소스 연결(예: Supabase)” 중심으로 둔다.
- **(P0)** secret은 절대 클라이언트 번들에 포함하지 않는다(서비스 롤 키, 관리자 키 등).
- **(P1)** `VITE_*`는 Vite에서 클라이언트에 포함될 수 있으므로, 공개 가능한 값만 사용한다.

### 권장 환경 변수 목록(최소)

#### Supabase 연결
- **`VITE_SUPABASE_URL`**
- **`VITE_SUPABASE_ANON_KEY`**

#### 앱 환경 구분
- **`VITE_APP_ENV`**: `dev` | `staging` | `production`
  - 런타임에서 “콘솔/디버그/오버라이드” 허용 여부를 결정하는 기준값

#### (선택) 실험/관측 관련
- **`VITE_ENABLE_OBSERVABILITY`**: `true|false` (기본 `true`)
  - 관측 로그 insert를 전체적으로 끄고 싶을 때(장애 대응)

- **`VITE_ENABLE_EXPERIMENTS`**: `true|false` (기본 `true`)
  - A/B 배정 자체를 끄고 “기본 레이아웃”으로 고정할 때

#### (staging 전용) 강제 bucket override
- **`VITE_EXPERIMENT_OVERRIDE_HOME_LAYOUT`**: 예) `home_layout_v1` 또는 `home_layout_v2`
  - **staging에서만 사용**, production에서는 항상 비활성화(무시)

> 참고: 현재 코드베이스는 일부 debug/verbose 기능을 env로 토글하는 구조가 아닐 수 있다.  
> 이 문서는 “원칙/전략/권장 변수”이며, 실제 적용은 다음 작업으로 단계적으로 진행한다.

---

## 2) Supabase project 분리 전략

### 권장 구조 (P0)
- **Supabase project 2개 이상**으로 분리
  - `judo-staging` (staging)
  - `judo-prod` (production)

### 분리 이유
- **데이터 오염 방지**: QA/테스트 클릭/노출 로그가 운영 지표를 오염시키지 않음
- **마이그레이션 안전성**: staging에서 schema/rls 변경 검증 후 prod 적용
- **권한/키 관리 단순화**: env별 anon key / url을 완전히 분리

### 마이그레이션 운영 (P0)
- 동일한 `supabase/migrations/*`를 **staging → production** 순으로 적용
- staging에서 최소 24시간 관측 후 prod 적용(가능하면)
- RLS 정책은 **staging과 prod 동일**을 원칙으로 유지(“staging에서만 완화”는 지양)

---

## 3) 실험(A/B) 로그 분리 전략

### 1순위: Supabase project 자체를 분리 (P0)
staging과 production이 다른 Supabase 프로젝트를 쓰면,
- `home_section_impression_logs`
- `collection_interaction_logs`
같은 테이블이 동일해도 데이터가 섞이지 않는다.

### 2순위(보완): 테이블 레벨 분리 (P1)
만약 project 분리가 어려운 과도기라면, 최소한:
- 테이블을 env별로 분리 (예: `*_staging`, `*_prod`)
- 또는 `app_env` 컬럼을 추가해 쿼리에서 필터

> 단, 테이블 분리는 운영 복잡도가 커지므로 project 분리가 가능한 경우 1순위를 권장한다.

---

## 4) staging에서만 허용할 기능

### debug logs / verbose console (P1)
staging에서만 허용:
- 네트워크 응답/오류 상세 로그
- 실험 bucket/노출 로그 insert 결과 로그(성공/실패)
- 성능 측정(console.time, render profiling 등)

production에서는:
- 사용자에게 혼란을 주거나 PII/내부 정보를 노출할 수 있는 로그를 금지

### 실험 강제 bucket override (P0)
staging에서 QA 재현을 위해:
- `VITE_EXPERIMENT_OVERRIDE_HOME_LAYOUT=home_layout_v1|v2`
- 강제 배정 시에도 로그에는 `experiment_bucket`이 명시적으로 기록되어야 함

production에서는:
- override 변수를 읽지 않거나 무시(항상 랜덤+고정 배정만)

---

## 5) production에서 비활성화할 것

### 개발용 console (P1)
production에서는:
- `console.log` 기반의 개발 로그 제거/비활성화(가능하면 빌드 단계에서 strip)
- 에러는 `console.error` 최소한만(또는 별도 error reporting로 전송)

### test buttons / mock data (P0)
production에서 절대 노출되면 안 되는 것:
- QA/테스트용 버튼
- mock/seed 데이터 로딩
- 강제 상태 변경(관리자 기능이 아닌데도 노출되는 토글)

---

## 6) 운영 관측(Observability) 데이터 안전성

### best-effort 원칙 (P0)
노출/클릭 로그는:
- insert 실패해도 **UI/핵심 흐름이 멈추면 안 됨**
- 네트워크 장애 시 재시도 폭주가 발생하지 않도록 설계(현재는 best-effort + 제한적 재시도 수준 권장)

### A/B 가드레일 (P0)
Admin insights에서 최소한 확인:
- bucket별 sample size / impressions / clicks / CTR
- impressions < 100 “표본 부족” 표시
- experiment_bucket 누락 비율(Null/empty)

---

## 7) 권장 운영 플로우 (요약)

1. dev에서 기능 개발
2. staging 배포
3. staging에서 QA + 로그/실험/insights 검증
4. staging 마이그레이션/권한/RLS 이상 없으면 production 배포
5. production 배포 후 짧은 관측(핵심 에러/CTR/로그 누락) → 이상 시 롤백

