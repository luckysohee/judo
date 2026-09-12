# 스토어 제출 체크리스트 — 주도 (JUDO)

앱스토어·플레이스토어 **제출 직전**에 한 줄씩 지워 나가면 됩니다.  
상세 근거는 `docs/app-store-review-notes.md`, `docs/play-data-safety.md`를 참고하세요.

최종 코드 기준: UGC 신고·차단·약관/개인정보 페이지·복제 방지·Capacitor 네이티브(푸시·카메라 촬영 없음).

---

## 0. 이미 끝난 것 (코드·DB)

- [x] `/privacy` 개인정보 처리방침
- [x] `/terms` 이용약관 + UGC 조항
- [x] `/safety` 신고·차단 설정
- [x] `content_reports` / `user_blocks` / 약관 동의 컬럼 (Supabase SQL 적용)
- [x] 잔코스·맛집첩 무단 복제 방지 SQL
- [x] Capacitor: 위치·갤러리·공유·햅틱 (푸시·촬영 권한 제거)
- [x] `LEGAL` 문의 메일·운영자명 (`lucky.sohee.jang@gmail.com` / 장소희)
- [x] Play Data Safety 가이드 (`docs/play-data-safety.md`)
- [x] App Review 메모 (`docs/app-store-review-notes.md`)

---

## 1. 배포·스모크 (웹)

- [ ] `main` 최신이 프로덕션(Vercel 등)에 배포됨
- [ ] `https://<도메인>/privacy` 열림 · 운영자·문의 메일 정상
- [ ] `https://<도메인>/terms` 열림
- [ ] `https://<도메인>/safety` 열림 (로그인 후 차단 목록)
- [ ] 코스/프로필 **⋯ → 신고하기** → 접수됨 (Supabase `content_reports` 확인)
- [ ] **사용자 차단** → `user_blocks` 행 생성 · 피드에서 숨김
- [ ] 알파 allowlist ON이면 심사/테스트 계정이 allowlist에 있음

---

## 2. 네이티브 빌드 (로컬)

```bash
npm ci
npm run build
npx cap sync
```

- [ ] iOS: Xcode에서 아카이브 · 서명·번들 ID (`com.judo.map` 등) 확인
- [ ] Android: AAB 빌드 · Play App Signing 확인
- [ ] 실기기: 위치 권한 **사용 중일 때만** 요청되는지
- [ ] 실기기: 사진 **갤러리만** (카메라 촬영 다이얼로그 없음)
- [ ] 실기기: 부팅 직후 **알림 권한 팝업 없음**
- [ ] 공유 시트·햅틱 동작 확인

---

## 3. 법적·콘솔 메타 (수동)

- [ ] `src/config/legal.js` — 사업자등록 후 `businessRegistrationNumber` / `businessAddress` / 상호 갱신
- [ ] App Store Connect: 개인정보 URL → `https://<도메인>/privacy`
- [ ] App Store Connect: 이용약관 URL → `https://<도메인>/terms` (또는 EULA)
- [ ] App Store Connect: 지원 URL · 마케팅 URL
- [ ] Play Console: 개인정보처리방침 URL 동일
- [ ] Play Console → 앱 콘텐츠 → **데이터 보안** (`docs/play-data-safety.md` 대로 기입)
- [ ] Play Console → 앱 콘텐츠 → **광고 ID** = 사용 안 함 (현재)
- [ ] iOS Privacy Nutrition Labels ↔ `ios/App/App/PrivacyInfo.xcprivacy`

---

## 4. 심사 노트에 적을 것

App Review / Play 테스트 메모에 포함:

1. **UGC**: 신고·차단 위치 (`⋯` 메뉴, `/safety`), 운영 검토 SLA 24시간, 문의 `LEGAL.contactEmail`
2. **네이티브**: 위치=주변·체크인, 사진=갤러리 업로드만, 푸시 미구현
3. **데모 계정**: 알파 allowlist 이메일 + 비밀번호(또는 소셜 로그인 안내)
4. **딥링크(있으면)**: 코스/장소 예시 URL

복붙용 초안은 `docs/app-store-review-notes.md`.

---

## 5. 제출 직전 최종

| 스토어 | 체크 |
|--------|------|
| **iOS** | 1.2 UGC · 4.2 최소 기능 · 권한 문구 · PrivacyInfo · 스크린샷 · 연령 등급 |
| **Android** | Data Safety · 권한 선언 일치 · 타겟 API · 콘텐츠 등급 · 스크린샷 |

- [ ] TestFlight / 내부 테스트 트랙에서 회귀 한 바퀴
- [ ] 스크린샷·설명문·키워드 언어(한국어) 준비
- [ ] 제출

---

## 6. 제출 후

- [ ] 신고 메일(`lucky.sohee.jang@gmail.com`)·`/admin/reports` 모니터링
- [ ] 거절 시 사유별: UGC 재설명 / 권한 재정렬 / 데모 계정 재제공

---

## 관련 파일

| 문서·코드 | 용도 |
|-----------|------|
| `docs/app-store-review-notes.md` | 심사관용 요약 |
| `docs/play-data-safety.md` | Play Data Safety 기입 |
| `src/config/legal.js` | 운영자·문의·약관 버전 |
| `supabase/migrations/20260831120000_ugc_safety_reports_blocks.sql` | UGC 테이블 |
| `supabase/migrations/20260901120000_*.sql` / `…140000_*.sql` | 복제 방지 |
| `android/.../AndroidManifest.xml` | 권한 |
| `ios/App/App/Info.plist` · `PrivacyInfo.xcprivacy` | iOS 권한·프라이버시 |
