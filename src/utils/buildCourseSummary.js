/** 프로필별 한 줄 요약 (AI 없음) */
export function buildCourseSummary(course) {
  if (!course?.steps?.length) return "";

  const first = course.steps[0];
  const second = course.steps[1];
  const walkMinutes = Math.max(
    1,
    Math.round((second?.walkDistanceMeters || 0) / 70)
  );

  const key = course.profileKey;

  if (key === "mood") {
    return `${first.place.name}에서 시작해 ${second.place.name}로 이어지는 분위기 중심 코스예요. 도보 ${walkMinutes}분 안쪽이에요.`;
  }

  if (key === "featured") {
    return `큐레이터들이 자주 겹쳐 찍은 ${first.place.name} → ${second.place.name} 조합이에요. 도보 약 ${walkMinutes}분.`;
  }

  return `${first.place.name}에서 1차를 시작하고 ${second.place.name}로 이어지는 무난한 정석 코스예요. 도보 약 ${walkMinutes}분.`;
}
