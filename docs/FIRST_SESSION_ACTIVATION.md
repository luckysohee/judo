# First Session Activation (첫 세션 활성화) 전략

목표: 처음 들어온 사용자가 **30초 안에 “주도는 코스/분위기 기반 술지도 앱이다”를 체감**하고, **첫 행동(저장/픽/컬렉션 생성) 중 하나**로 연결되게 한다.

중요: 이 문서는 **전략/정의/최소 구현 우선순위**를 정리한 문서다.  
추천/검색/`useCourseSearch` score 로직은 **절대 건드리지 않는다**(노출 순서/CTA/로그만).

---

## 1) Activation 목표

### 1.1 30초 안에 주도의 정체 이해
사용자가 “이 앱은 단순 장소 검색이 아니라, **코스(흐름)와 분위기(vibe)로 술지도를 탐색/저장하는 앱**”임을 이해하는 상태.

### 1.2 첫 행동으로 연결
30초 이내 또는 첫 세션 내에 아래 중 하나를 성공하도록 유도:
- **첫 컬렉션 저장**(first_collection_save)
- **첫 큐레이터 팔로우/픽**(first_follow_curator)
- **첫 컬렉션 생성**(first_collection_create)

---

## 2) First-time user 판단 규칙

### 2.1 localStorage key 구조(권장)
- Key: **`judo_activation_v1`**
- Value(JSON string) 예시:

```json
{
  "first_seen_at": "2026-05-11T00:12:34.000Z",
  "completed_at": null,
  "completed_by": null,
  "events": {
    "first_home_view": "2026-05-11T00:12:35.000Z",
    "first_collection_save": null,
    "first_follow_curator": null,
    "first_collection_create": null
  }
}
```

### 2.2 completed 상태 정의
Activation 완료(activated) 조건:
- `completed_at`이 존재하고
- `completed_by`가 다음 중 하나
  - `"save"`: 첫 저장으로 완료
  - `"follow"`: 첫 큐레이터 팔로우/픽으로 완료
  - `"create"`: 첫 컬렉션 생성으로 완료

First-time(또는 미활성화) 조건:
- localStorage에 키가 **없거나**
- `completed_at`이 **없음**

### 2.3 guardrail(파싱 실패 시 복구)
localStorage 값이 다음 중 하나면 **자동 복구(초기화 후 재할당)**:
- JSON 파싱 실패
- 필수 필드(`first_seen_at`, `events`) 누락/타입 불일치
- `events`에 알 수 없는 값이 들어와 downstream 로깅이 깨질 위험이 있는 경우

복구 정책(권장):
- 기존 값을 폐기하고 **새 상태로 초기화**
- `first_seen_at`은 복구 시점으로 설정

---

## 3) Home lightweight onboarding UX

목표: “과한 모달 없이” 상단에서 가볍게 인지/행동 유도.

### 3.1 구성 요소(최소)

#### (A) copy (1~2줄)
예시 카피(택1 또는 A/B 테스트):
- “지금 기분/상황에 맞는 **코스**를 골라 술지도를 시작해요.”
- “**분위기(vibe)**로 탐색하고, 마음에 드는 코스는 저장해두세요.”

#### (B) 추천 상황 chips (즉시 탐색)
초기 노출은 3개 정도로 제한(밀도/결정 피로 최소화).
- `야장`, `노포`, `분위기` (예시)

클릭 동작(권장):
- Home의 “상황 rail(태그)” 섹션으로 스크롤 이동 또는 해당 탭을 활성화
- **score 로직 변경 없이** UI 이동/탭 선택만 수행

#### (C) “코스 하나 저장해보기” CTA
버튼 예시:
- “코스 1개 저장해보기”
- “지금 뜨는 코스 저장하고 시작”

클릭 동작(권장):
- Home에서 이미 노출 중인 섹션(예: Hot Collections)으로 스크롤 이동
- 또는 “공개 컬렉션 레일”의 첫 카드로 이동

> 핵심: 사용자가 “코스/분위기” 문맥을 읽고 **저장 행동**으로 자연스럽게 연결되게 한다.

### 3.2 노출 조건(권장)
다음 조건을 모두 만족할 때만 노출:
- first-time(activation 미완료)
- Home 최초 진입 직후(첫 홈 뷰)이며
- 첫 진입 후 30초 이내(또는 스크롤/클릭 전까지)
- 과한 모달을 띄우지 않고, **상단 레이아웃의 일부로 표시**

### 3.3 숨김 조건(권장)
다음 중 하나면 즉시 숨김:
- activation completed(`completed_at` set)
- 사용자가 첫 저장/첫 픽/첫 컬렉션 생성 중 하나를 완료
- 사용자가 해당 블록을 명시적으로 닫음(닫기 아이콘 제공 시)

---

## 4) Activation funnel 이벤트 정의

이벤트는 “한 번만” 기록되는 것을 원칙으로 한다(중복 방지).

### 4.1 이벤트 목록
- **`first_home_view`**
  - 정의: activation 미완료 상태에서 Home이 실제로 사용자 viewport에 진입하여 “시작”이 확인된 시점
- **`first_collection_save`**
  - 정의: 사용자가 최초로 컬렉션 저장을 성공한 시점
- **`first_follow_curator`**
  - 정의: 사용자가 최초로 큐레이터를 팔로우/픽 성공한 시점
- **`first_collection_create`**
  - 정의: 사용자가 최초로 컬렉션 생성 성공한 시점

> 성공 기준 권장: 서버 응답 OK(가능한 경우).  
> 단, 최소 구현에서는 “UI 상태가 성공으로 확정되는 순간”을 기준으로 할 수 있다.

---

## 5) Conversion 측정 방식

### 5.1 분모/분자 정의
- **분모(denominator)**: `first_home_view` 수(또는 유니크 user_id)
- **분자(numerator)**:
  - `first_collection_save`
  - `first_follow_curator`
  - `first_collection_create`

추가로 “activation 완료(어떤 방식이든)” 전환:
- numerator = `completed_at`(또는 위 3개 이벤트 중 하나라도 발생)

### 5.2 최근 N일 기준
운영에서 보는 기본 window(권장):
- 최근 **7일**(기본) + 최근 **1일**(이상 탐지)

### 5.3 bucket(A/B) 비교 가능 구조
실험을 운영하려면 이벤트/로그에 다음이 함께 기록 가능해야 한다:
- `experiment_bucket` (예: `home_layout_v1`, `home_layout_v2`)
- (가능하면) `app_env`(staging/prod), `created_at`

권장 집계:
- bucket별 분모/분자 및 CTR(전환율) 비교
- bucket 누락률(Null/empty)도 함께 표시

---

## 6) Observability / Guardrail

### 6.1 이벤트 누락률
운영에서 다음을 확인할 수 있어야 한다:
- `experiment_bucket IS NULL`(또는 빈 값) 비율
- `first_home_view` 대비 downstream 이벤트가 **0에 수렴**하면 로깅 파이프라인 이상 가능성

### 6.2 sample 부족
최소 표본 기준(권장):
- impressions(또는 first_home_view) < **100**이면 “표본 부족”으로 표시

### 6.3 duplicate logging 방지
원칙:
- 이벤트는 “최초 1회만” 기록

권장 방법:
- localStorage의 `events.<event_name>`이 이미 존재하면 다시 기록하지 않음
- 관측 로그 레이어에서도 session 단위 dedup(예: 같은 섹션 impression 1회) 적용

---

## 7) 최소 구현 우선순위

### Phase 1: localStorage + lightweight CTA (P0)
- first-time/activated 판정(localStorage)
- Home 상단 lightweight 블록(copy + chips + CTA)
- activation 완료 상태 저장(`completed_at`, `completed_by`)

### Phase 2: funnel logging (P1)
- `first_home_view` / `first_collection_save` / `first_follow_curator` / `first_collection_create`
- best-effort insert + schema/컬럼 미적용 시 안전한 fallback
- duplicate logging 방지(localStorage + session dedup)

### Phase 3: admin conversion dashboard (P1~P0)
- Admin/analytics에서 최근 N일 conversion 테이블 제공
- bucket별 sample size / CTR / 표본 부족 표시 / bucket 누락률 표시
- staging에서 실험 강제 bucket override QA 지원

---

## 8) Non-goals (금지사항)

- 추천/검색/`useCourseSearch` 점수 로직 수정 금지
- 알고리즘 변경 없이 **UX 구성/노출 순서/CTA/로그**만으로 activation을 개선한다

