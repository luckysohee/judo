# Play Console — Data Safety & 권한 제출 가이드 (주도 / JUDO)

Google Play **데이터 보안(Data Safety)** 양식과 `AndroidManifest.xml` 권한이  
실제 앱·SDK 동작과 일치하도록 작성할 때 쓰는 체크리스트입니다.

최종 갱신: 코드 기준 `@capacitor/push-notifications`·카메라 촬영 권한 **미사용**.

---

## 1. 선언된 Android 권한 (필수만)

| 권한 | 사용 여부 | 핵심 기능 근거 |
|------|-----------|----------------|
| `INTERNET` | ✅ | API·지도·인증·이미지 로딩 |
| `ACCESS_COARSE_LOCATION` | ✅ | 주변 검색 보조 |
| `ACCESS_FINE_LOCATION` | ✅ | **한잔(체크인) GPS 거리 검증**, 내 위치·주변 추천 |
| `READ_MEDIA_IMAGES` (API 33+) | ✅ | 큐레이터 **장소/프로필 사진** 갤러리 선택 |
| `READ_EXTERNAL_STORAGE` (maxSdk 32) | ✅ | Android 12 이하 동일 목적 |
| `CAMERA` | ❌ 제거됨 | 촬영 기능 없음 (갤러리만) |
| `POST_NOTIFICATIONS` | ❌ 제거됨 | OS 푸시 미출시 (부팅 시 권한 요청 안 함) |
| SMS / CONTACTS / PHONE / 마이크 | ❌ | 미사용 |

**제출 서류에 쓸 한 줄 요약**

> 위치는 주변 맛집·코스 탐색과 체크인 거리 확인에만 사용하며, 사진 권한은 사용자가 선택한 이미지를 업로드할 때만 사용합니다. 주소록·SMS·카메라 촬영·푸시 알림 권한은 요청하지 않습니다.

런타임: 위치·사진은 **해당 기능 사용 시점**에만 시스템 다이얼로그를 띄웁니다 (부팅 시 일괄 요청 없음).

---

## 2. 사용 중인 SDK / 서비스 (Analytics·Crash 포함)

| SDK / 서비스 | 앱에 포함? | Data Safety에 반영 |
|--------------|------------|-------------------|
| Supabase Auth + DB + Storage | ✅ | 계정·프로필·UGC·검색 로그 |
| Kakao Maps JS / Place API | ✅ (웹뷰) | 지도·장소 조회 (기기에서 카카오 쪽으로 요청) |
| Google Places (서버/프록시 사진 등) | ✅ (선택 env) | 장소 사진·메타 |
| Capacitor Geolocation / Camera(갤러리) / Share / Haptics / StatusBar / Splash / App | ✅ | 위치·사진·공유 등 기기 기능 |
| **Firebase Analytics / Crashlytics** | ❌ | 체크하지 않음 |
| **Amplitude / Mixpanel / AppsFlyer / Adjust** | ❌ | 체크하지 않음 |
| **Sentry / Bugsnag** | ❌ | 체크하지 않음 |
| **OneSignal / FCM 푸시** | ❌ (패키지 제거) | 푸시 토큰·알림 미수집 |

자체 분석: `search_logs` / place click 등 **Supabase RPC** (`src/utils/searchAnalytics.js`) — 제3자 광고 SDK 아님.

---

## 3. Data Safety 양식 — 권장 체크 항목

Play Console → 앱 콘텐츠 → **데이터 보안**

### 데이터 수집 여부
- **예, 수집하는 사용자 또는 기기 데이터가 있습니다.**

### 수집·공유 데이터 유형 (예시 매핑)

| Play 카테고리 | 수집? | 연결(계정)? | 목적 | 비고 |
|---------------|-------|-------------|------|------|
| 이름 | 예 | 예 | 앱 기능 | 프로필·큐레이터 표시명 |
| 이메일 | 예 | 예 | 앱 기능·계정 관리 | OAuth (Google/Kakao) |
| 사용자 ID | 예 | 예 | 앱 기능 | Supabase `auth.users` / profiles |
| 대략적 위치 | 예 | 예 | 앱 기능 | 주변 검색 (정밀과 함께 사용 가능) |
| 정확한 위치 | 예 | 예 | 앱 기능 | 체크인 거리 검증 · 내 위치 |
| 사진 | 예 | 예 | 앱 기능 | 사용자가 업로드한 장소/프로필 이미지 |
| 앱 활동 — 앱 상호작용 / 검색 기록 | 예 | 예(로그인 시) | 앱 기능 · 분석 | 검색어·클릭 로그 (자체) |
| 기기 ID (광고 ID 등) | **아니오** (현재) | — | — | 광고 SDK 없음 |
| 연락처 / SMS / 통화 기록 | **아니오** | — | — | |
| 오디오 / 건강 / 금융 | **아니오** | — | — | |

### 보안 관행
- 전송 중 암호화: **예** (HTTPS)
- 사용자가 삭제 요청 가능: 정책·문의 이메일 기준으로 **예**로 두는 것을 권장 (`LEGAL.contactEmail`)
- 독립 보안 검토: 해당 없으면 아니오

### 판매 / 광고
- 데이터 판매: **아니오**
- 광고·광고 ID 목적 수집: **아니오** (현재 코드 기준)

Kakao/Google API는 **제3자로 데이터 전송**될 수 있으므로,  
「서비스 제공을 위한 제3자 처리」 설명이 필요하면 개인정보처리방침·약관(제10조)과 맞출 것.

---

## 4. 나중에 추가할 때 (회귀 주의)

| 기능 추가 시 | Manifest / Data Safety |
|--------------|------------------------|
| OS 푸시 (FCM) | `POST_NOTIFICATIONS` + Data Safety에 기기 ID/푸시 토큰 · 앱 기능 목적 |
| 카메라 촬영 | `CAMERA` + iOS `NSCameraUsageDescription` + Data Safety 사진 |
| Firebase Crashlytics | Crash 로그·기기 정보 항목 체크 |
| 광고 SDK | 광고 ID·트래킹 관련 항목 전부 재검토 |

기능 없이 권한만 넣지 말 것. 권한 추가 시 이 문서와 `docs/app-store-review-notes.md`를 함께 수정.

---

## 5. 관련 파일

- `android/app/src/main/AndroidManifest.xml`
- `ios/App/App/Info.plist`
- `ios/App/App/PrivacyInfo.xcprivacy`
- `src/lib/native/bootstrap.js` (푸시 미요청)
- `src/lib/native/camera.js` (갤러리만)
- `src/utils/searchAnalytics.js` (자체 검색 분석)
