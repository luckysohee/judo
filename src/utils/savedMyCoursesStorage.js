import { placeId } from "./generateCourseOptions.js";

/** 1차·2차 장소 id 조합 — DB unique(pair_key) 및 중복 저장 방지 */
export function pairKeyFromCourseSnapshot(snapshot) {
  const s0 = snapshot?.steps?.[0]?.place?.id;
  const s1 = snapshot?.steps?.[1]?.place?.id;
  const a = s0 != null ? String(s0) : "";
  const b = s1 != null ? String(s1) : "";
  if (!a || !b) return "";
  return `${a}::${b}`;
}

/** 현재 코스 카드 → DB 저장용 스냅샷 + pairKey */
export function snapshotFromMyOwnCourse(course) {
  const steps = (course?.steps || []).map((s) => ({
    step: s.step,
    label: s.label,
    stayMinutes: s.stayMinutes,
    walkDistanceMeters: s.walkDistanceMeters,
    place: {
      id: placeId(s.place),
      name: s.place?.name,
      lat: s.place?.lat,
      lng: s.place?.lng,
    },
  }));
  const snap = {
    title: course?.profileTitle || "나만의 코스",
    steps,
    sourceCourseKey: course?.key,
  };
  return { ...snap, pairKey: pairKeyFromCourseSnapshot(snap) };
}
