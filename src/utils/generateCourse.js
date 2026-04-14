import { generateCourseOptions } from "./generateCourseOptions.js";

export {
  calculateCoursePlaceScore,
  placeId,
} from "./generateCourseOptions.js";

/**
 * 단일 최고 코스 (하위 호환). 다중 후보는 `generateCourseOptions` 사용.
 */
export function generateCourse({ parsedQuery, places = [] }) {
  const list = generateCourseOptions({
    parsedQuery,
    places,
    maxOptions: 1,
  });
  return list[0] ?? null;
}
