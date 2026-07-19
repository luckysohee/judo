-- 등급 카운트: curator_places + 직접 만든 curator_courses (스크랩 제외)
-- `curators.total_places` 컬럼명 유지 — 앱에서 합산값을 저장.
-- grade_from_place_count 구간(브론즈~다이아)은 동일.

COMMENT ON FUNCTION public.grade_from_place_count(int) IS
  '등급 기여 점수(장소 1 + 직접 만든 코스×가중치, 앱 기본 3) → bronze/silver/gold/platinum/diamond';

COMMENT ON COLUMN public.curators.total_places IS
  '등급용 기여 점수. 앱이 추천 장소 수 + (직접 만든 코스 수 × 가중치)로 동기화. 스크랩 코스 제외.';

COMMENT ON TABLE public.curator_grade_review_queue IS
  '가중 기여 점수로 추천 등급이 현재 등급보다 높을 때 관리자 승급 검토 알림';
