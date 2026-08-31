# App Store / Play Review Notes — 주도 (JUDO)

심사·콘솔 제출 시 붙여 넣을 요약입니다.

---

## Guideline 1.2 — User Generated Content (iOS) / UGC 정책

| 요구 | 구현 |
|------|------|
| 불쾌 콘텐츠 신고 | 코스·장소·프로필 **⋯ → 신고하기** → `content_reports` |
| 악성 유저 차단 | **⋯ → 사용자 차단** → `user_blocks` · `/safety` |
| 약관 동의 | 로그인·신청 시 **이용약관 체크박스** 필수 |
| 운영 삭제 | `/admin/reports` 숨김·기각 |
| 연락처 | `LEGAL.contactEmail` |

**SLA:** 신고 접수 후 보통 **24시간 이내** 1차 검토 목표.

---

## Guideline 4.2 — Minimum Functionality (네이티브)

Capacitor 하이브리드. 단순 북마크 웹이 아닙니다.

| 기능 | 구현 |
|------|------|
| 위치 | `@capacitor/geolocation` — 주변 검색 · **한잔 체크인 GPS** |
| 사진 | `@capacitor/camera` **갤러리만** (촬영 권한 없음) |
| 공유 | `@capacitor/share` |
| 햅틱 | `@capacitor/haptics` |
| StatusBar / Splash | Capacitor 플러그인 |

**OS 푸시는 현재 미출시** — 부팅 시 알림 권한을 요청하지 않습니다. (과도한 권한 예방)

---

## 권한 선언 근거 (iOS / Android 공통)

| 권한 | 이유 |
|------|------|
| 위치 (사용 중) | 주변 장소·코스, 체크인 거리 확인. **백그라운드 위치 없음** |
| 사진 보관함 | 사용자가 고른 장소/프로필 이미지 업로드 |
| 카메라 촬영 | **요청하지 않음** |
| 푸시 알림 | **요청하지 않음** (미구현) |
| 주소록 / SMS | **요청하지 않음** |

Play Data Safety 상세: `docs/play-data-safety.md`

---

## Apple Privacy Nutrition / PrivacyInfo

`ios/App/App/PrivacyInfo.xcprivacy` — 이메일·이름·User ID·정확한 위치·사진·검색·앱 상호작용 등.  
**트래킹(ATT) 없음** (`NSPrivacyTracking` = false).

---

## Demo account

클로즈드 알파 allowlist 심사 계정을 App Review / Play 테스트에 제공해 주세요.
