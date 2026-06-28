/**
 * 내가 픽(팔로우)한 큐레이터들이 올린 장소 집합 — 개인 추천 가산용.
 *
 * - 픽 관계: public.user_profile_follows (follower_id / following_id = auth uid)
 * - curator_places.curator_id = auth uid (CURATOR_PLACES_CURATOR_ID_MODE=user_id)
 * - 큐레이터 핸들/별명은 추천 이유 문구("@handle 픽")에 사용
 */

import { supabase } from "../lib/supabase";

const DEFAULT_PLACE_LIMIT = 1000;

/**
 * @param {string} userId auth uid (viewer)
 * @param {{client?:import("@supabase/supabase-js").SupabaseClient, limit?:number}} [opts]
 * @returns {Promise<{ placeIds: Set<string>, placeIdToCurator: Map<string,{handle:string,name:string}> }>}
 */
export async function fetchPickedCuratorPlaces(userId, opts = {}) {
  const uid = String(userId || "").trim();
  const empty = { placeIds: new Set(), placeIdToCurator: new Map() };
  if (!uid) return empty;

  const client = opts.client || supabase;
  const limit = Number(opts.limit) || DEFAULT_PLACE_LIMIT;

  const { data: follows, error: fErr } = await client
    .from("user_profile_follows")
    .select("following_id")
    .eq("follower_id", uid);

  if (fErr) {
    if (import.meta.env?.DEV) {
      console.warn("[pickedCuratorPlaces] follows:", fErr.message || fErr);
    }
    return empty;
  }

  const followingIds = [
    ...new Set(
      (follows || []).map((r) => String(r?.following_id ?? "").trim()).filter(Boolean)
    ),
  ];
  if (!followingIds.length) return empty;

  const curatorByUserId = new Map();
  const { data: curators } = await client
    .from("curators")
    .select("user_id, slug, username, name, display_name")
    .in("user_id", followingIds);
  for (const c of curators || []) {
    const key = String(c?.user_id ?? "").trim();
    if (!key) continue;
    const handle = String(c?.slug || c?.username || "").trim();
    const name = String(c?.name || c?.display_name || "").trim();
    curatorByUserId.set(key, { handle, name });
  }

  const { data: cps, error: cpErr } = await client
    .from("curator_places")
    .select("place_id, curator_id")
    .in("curator_id", followingIds)
    .or("is_archived.is.null,is_archived.eq.false")
    .limit(limit);

  if (cpErr) {
    if (import.meta.env?.DEV) {
      console.warn("[pickedCuratorPlaces] curator_places:", cpErr.message || cpErr);
    }
    return empty;
  }

  const placeIds = new Set();
  const placeIdToCurator = new Map();
  for (const cp of cps || []) {
    const pid = String(cp?.place_id ?? "").trim();
    if (!pid) continue;
    placeIds.add(pid);
    if (!placeIdToCurator.has(pid)) {
      const info = curatorByUserId.get(String(cp?.curator_id ?? "").trim());
      if (info) placeIdToCurator.set(pid, info);
    }
  }

  return { placeIds, placeIdToCurator };
}
