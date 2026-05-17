import { checkinPlaceKeyFromPlace } from "./checkinPlaceKeyFromPlace";

/**
 * `check_ins.place_id`와 코스 스텝 `places` 행을 같은 기준으로 맞춤.
 */
export function checkinIdMatchesStepPlace(checkinPlaceId, stepPlaceUuid, placesRow) {
  const pid = String(checkinPlaceId ?? "").trim();
  if (!pid) return false;
  const uuid = String(stepPlaceUuid ?? "").trim();
  const candidates = new Set();
  if (uuid) {
    candidates.add(uuid);
    candidates.add(uuid.toLowerCase());
  }
  if (placesRow && typeof placesRow === "object") {
    const plId = placesRow.id != null ? String(placesRow.id).trim() : "";
    if (plId) {
      candidates.add(plId);
      candidates.add(plId.toLowerCase());
    }
    const key = checkinPlaceKeyFromPlace({
      id: placesRow.id ?? uuid,
      place_id: placesRow.place_id,
      kakao_place_id: placesRow.kakao_place_id,
      kakaoId: placesRow.kakaoId,
    });
    if (key) candidates.add(String(key).trim());
  }
  for (const c of candidates) {
    if (c && c === pid) return true;
  }
  return false;
}
