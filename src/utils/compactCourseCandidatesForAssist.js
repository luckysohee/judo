import { placeId } from "./generateCourseOptions.js";

/** 클라 → POST /api/course-compose-assist payload.candidates */
export function compactCourseCandidatesForAssist(courses = []) {
  return (Array.isArray(courses) ? courses : [])
    .filter((c) => c?.key)
    .slice(0, 12)
    .map((c) => ({
      key: String(c.key),
      profileKey: String(c.profileKey || ""),
      profileTitle: String(c.profileTitle || ""),
      totalScore: Number(c.totalScore) || 0,
      steps: (c.steps || []).map((s) => ({
        step: Number(s.step) || 0,
        label: String(s.label || ""),
        walkDistanceMeters: s.walkDistanceMeters ?? null,
        place: {
          id: String(placeId(s.place) ?? ""),
          name: String(s.place?.name || s.place?.place_name || "").trim(),
          region: String(s.place?.region || "").trim(),
          category: String(
            s.place?.category || s.place?.category_name || ""
          ).trim(),
          tags: Array.isArray(s.place?.tags) ? s.place.tags.slice(0, 8) : [],
          vibes: Array.isArray(s.place?.vibes) ? s.place.vibes.slice(0, 6) : [],
          liquorTypes: Array.isArray(s.place?.liquorTypes)
            ? s.place.liquorTypes.slice(0, 4)
            : [],
          comment: String(s.place?.comment || "").slice(0, 120),
        },
      })),
    }));
}
