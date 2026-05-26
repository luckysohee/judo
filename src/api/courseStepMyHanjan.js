import { supabase } from "./client";
import { checkinIdMatchesStepPlace } from "../utils/checkinIdMatchesStepPlace";
import { checkinPlaceKeyFromPlace } from "../utils/checkinPlaceKeyFromPlace";

/**
 * @param {object} step
 * @returns {Set<string>}
 */
function collectStepCheckinLookupKeys(step) {
  const keys = new Set();
  const pid = String(step?.place_id ?? "").trim();
  if (pid) keys.add(pid);
  const pl = step?.places || step?.place;
  if (pl && typeof pl === "object") {
    const plId = pl.id != null ? String(pl.id).trim() : "";
    if (plId) keys.add(plId);
    const k = checkinPlaceKeyFromPlace({
      id: plId || pid,
      place_id: pl.place_id,
      kakao_place_id: pl.kakao_place_id ?? step?.kakao_place_id,
      kakaoId: pl.kakaoId,
    });
    if (k) keys.add(k);
  } else if (step?.kakao_place_id) {
    const k = checkinPlaceKeyFromPlace({
      id: pid,
      kakao_place_id: step.kakao_place_id,
    });
    if (k) keys.add(k);
  }
  return keys;
}

/**
 * 코스 스텝 중 내가 한잔함(`check_ins`) 기록이 있는 `place_id`(UUID) 집합.
 * @param {object[]} steps
 * @returns {Promise<Set<string>>}
 */
export async function fetchMyHanjanStepPlaceIds(steps) {
  const list = Array.isArray(steps) ? steps.filter(Boolean) : [];
  if (list.length === 0) return new Set();

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user?.id) return new Set();

  const lookupKeys = new Set();
  for (const step of list) {
    for (const k of collectStepCheckinLookupKeys(step)) {
      lookupKeys.add(k);
    }
  }
  if (lookupKeys.size === 0) return new Set();

  const { data, error } = await supabase
    .from("check_ins")
    .select("place_id")
    .eq("user_id", user.id)
    .in("place_id", [...lookupKeys]);

  if (error) {
    console.warn("[fetchMyHanjanStepPlaceIds]", error);
    return new Set();
  }

  const checkinKeys = new Set(
    (data || [])
      .map((r) => String(r.place_id ?? "").trim())
      .filter(Boolean)
  );
  if (checkinKeys.size === 0) return new Set();

  const out = new Set();
  for (const step of list) {
    const pid = String(step.place_id ?? "").trim();
    const pl = step.places || step.place;
    for (const ck of checkinKeys) {
      if (checkinIdMatchesStepPlace(ck, pid, pl) && pid) {
        out.add(pid);
      }
    }
  }
  return out;
}
