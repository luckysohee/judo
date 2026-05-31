/** `check_ins` / 한잔 통계 RPC 키 — 카카오 숫자 id 우선 (PlacePreviewCard 와 동일 규칙) */
export function checkinPlaceKeyFromPlace(place) {
  if (!place || typeof place !== "object") return null;
  const raw =
    place.place_id ?? place.kakao_place_id ?? place.kakaoId ?? null;
  const k =
    typeof raw === "string" && /^\d+$/.test(raw)
      ? raw
      : typeof raw === "number" && Number.isFinite(raw)
      ? String(Math.trunc(raw))
      : null;
  if (k) return String(k);
  const id = place.id;
  if (id != null && String(id).trim() !== "") return String(id).trim();
  return null;
}
