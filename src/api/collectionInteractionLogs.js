import { supabase } from "./client";

/** @enum {string} */
export const COLLECTION_INTERACTION_SOURCE_SECTION = {
  HOME_HOT_COLLECTIONS: "home_hot_collections",
  HOME_CURATOR_ACTIVITY_FEED: "home_curator_activity_feed",
  HOME_PUBLIC_COLLECTIONS_RAIL: "home_public_collections_rail",
  HOME_TAG_RAIL: "home_tag_rail",
  HOME_PERSONAL_RECOMMENDATIONS: "home_personal_recommendations",
  HOME_REVISIT_CARD: "home_revisit_card",
  COLLECTION_TAG_LIST: "collection_tag_list",
  COLLECTION_SEARCH: "collection_search",
  PUBLIC_COLLECTIONS_GRID: "public_collections_grid",
  COLLECTION_DETAIL_SHARE: "collection_detail_share",
  COLLECTION_DETAIL_RECOMMENDATIONS: "collection_detail_recommendations",
  COLLECTION_DETAIL_REMIX_CHILDREN: "collection_detail_remix_children",
};

/** @enum {string} */
export const COLLECTION_INTERACTION_EVENT = {
  COLLECTION_OPEN: "collection_open",
  COLLECTION_SHARE_SUCCESS: "collection_share_success",
};

function isSchemaColumnError(err) {
  const msg = String(err?.message || err || "").toLowerCase();
  return /column|42703|does not exist/.test(msg);
}

/**
 * 클릭/공유 성공 후 비동기 INSERT. 실패해도 UI 에 영향 없음.
 *
 * @param {{
 *   eventType: string,
 *   sourceSection: string,
 *   collectionId: string,
 *   clickedRank?: number | null,
 *   userId?: string | null,
 *   experimentBucket?: string | null,
 * }} args
 *   `userId` 생략 시 `getUser()` 로 보강(익명이면 null).
 */
export function logCollectionInteraction({
  eventType,
  sourceSection,
  collectionId,
  clickedRank = null,
  userId,
  experimentBucket = null,
}) {
  const cid = String(collectionId ?? "").trim();
  if (!cid) return;

  void (async () => {
    try {
      let resolvedUserId = userId;
      if (resolvedUserId === undefined) {
        const { data } = await supabase.auth.getUser();
        resolvedUserId = data?.user?.id ?? null;
      }

      let rank = null;
      if (clickedRank != null && Number.isFinite(Number(clickedRank))) {
        rank = Math.floor(Number(clickedRank));
      }

      const base = {
        event_type: eventType,
        source_section: sourceSection,
        collection_id: cid,
        clicked_rank: rank,
        user_id: resolvedUserId,
      };
      const exp =
        typeof experimentBucket === "string" ? experimentBucket.trim() : "";
      const withExp = exp ? { ...base, experiment_bucket: exp } : base;

      let { error } = await supabase.from("collection_interaction_logs").insert(withExp);
      if (error && exp && isSchemaColumnError(error)) {
        ({ error } = await supabase.from("collection_interaction_logs").insert(base));
      }

      if (error && import.meta.env.DEV) {
        console.warn("collection_interaction_logs:", error.message);
      }
    } catch (e) {
      if (import.meta.env.DEV) console.warn("collection_interaction_logs:", e);
    }
  })();
}
