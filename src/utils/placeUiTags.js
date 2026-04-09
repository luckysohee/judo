/** 쾌속 잔 채우기 등 UI에 보이면 안 되는 내부용 태그 마커 */
const INTERNAL_NORMALIZED = "쾌속잔채우기";

export function isHiddenInternalPlaceTag(tag) {
  if (typeof tag !== "string") return false;
  return tag.replace(/\s+/g, "") === INTERNAL_NORMALIZED;
}

export function filterPlaceTagsForDisplay(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.filter((t) => !isHiddenInternalPlaceTag(t));
}
