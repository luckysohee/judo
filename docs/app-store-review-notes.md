# App Store Review Notes — 주도 (JUDO)

심사 시 「Guideline 1.2 / 4.2」 대응용 요약입니다. App Review Information 메모에 붙여 넣어도 됩니다.

## Guideline 1.2 — User Generated Content

| 요구 | 구현 |
|------|------|
| 불쾌 콘텐츠 신고 | 코스·장소·프로필 상세의 **⋯ → 신고하기**. `content_reports` 테이블에 접수 |
| 악성 유저 차단 | **⋯ → 사용자 차단**. `user_blocks` + 스튜디오 「차단한 사용자」에서 해제 |
| 약관 동의 | 알파 로그인·기능 로그인 프롬프트에서 **이용약관 체크박스** 필수 |
| 운영 삭제·조치 | `/admin/reports` 신고 큐에서 **숨김·조치 / 기각**. 코스 비공개, 장소 보관, 큐레이터 정지 |
| 연락처 | 약관·신고 시트: 운영 이메일 (`LEGAL.contactEmail`) |

**처리 SLA:** 신고는 보통 **24시간 이내** 1차 검토를 목표로 합니다.

## Guideline 4.2 — Minimum Functionality (네이티브)

단순 웹 감싸기가 아닌 Capacitor 하이브리드 앱입니다.

| 네이티브 기능 | 설명 |
|---------------|------|
| **위치 (Geolocation)** | 주변 검색·한잔(체크인) GPS 거리 검증 — `@capacitor/geolocation` |
| **카메라/사진** | 장소·프로필 사진 — `@capacitor/camera` + 권한 문자열 |
| **공유 시트** | 코스/장소 공유 — `@capacitor/share` |
| **햅틱** | 체크인 등 피드백 — `@capacitor/haptics` |
| **StatusBar / Splash** | 네이티브 크롬 — `@capacitor/status-bar`, `@capacitor/splash-screen` |
| **푸시 알림** | 권한 요청·디바이스 토큰 등록 — `@capacitor/push-notifications` (APNs/FCM 서버 연동은 배포 환경에서 완료) |

핵심 UX인 **위치 기반 한잔 체크인**, **지도·코스**, **큐레이터 스튜디오**는 모바일 앱 고유 경험입니다.

## Demo account

클로즈드 알파 allowlist에 등록된 심사 계정을 제공해 주세요. (별도 기입)
