import { supabase } from "./client";

/** @enum {string} */
export const HOME_SECTION_NAME = {
  HOME_HOT_COLLECTIONS: "home_hot_collections",
  HOME_CURATOR_ACTIVITY_FEED: "home_curator_activity_feed",
  HOME_PUBLIC_COLLECTIONS_RAIL: "home_public_collections_rail",
  HOME_TAG_RAIL: "home_tag_rail",
  HOME_SIMILAR_USERS: "home_similar_users",
};

const _sessionDedup = new Set();

function isSchemaColumnError(err) {
  const msg = String(err?.message || err || "").toLowerCase();
  return /column|42703|does not exist/.test(msg);
}

/**
 * Home 섹션 impression 로그. 실패해도 UI 영향 없음.
 *
 * @param {{
 *   sectionName: string,
 *   itemCount: number,
 *   loggedIn: boolean,
 *   followedOnly?: boolean,
 *   userId?: string | null,
 *   experimentBucket?: string | null,
 * }} args
 */
export function logHomeSectionImpression({
  sectionName,
  itemCount,
  loggedIn,
  followedOnly = false,
  userId,
  experimentBucket = null,
}) {
  const key = String(sectionName ?? "").trim();
  if (!key) return;

  const count = Number.isFinite(Number(itemCount)) ? Math.max(0, Math.floor(Number(itemCount))) : 0;
  const li = Boolean(loggedIn);
  const fo = Boolean(followedOnly);
  const exp = typeof experimentBucket === "string" ? experimentBucket.trim() : "";
  const dedupKey = `${key}::${exp || "-"}`;
  if (_sessionDedup.has(dedupKey)) return;
  _sessionDedup.add(dedupKey);

  void (async () => {
    try {
      let resolvedUserId = userId;
      if (resolvedUserId === undefined) {
        const { data } = await supabase.auth.getUser();
        resolvedUserId = data?.user?.id ?? null;
      }
      const base = {
        section_name: key,
        item_count: count,
        logged_in: li,
        followed_only: fo,
        user_id: resolvedUserId,
      };
      const withExp = exp ? { ...base, experiment_bucket: exp } : base;
      let { error } = await supabase.from("home_section_impression_logs").insert(withExp);
      if (error && exp && isSchemaColumnError(error)) {
        // 컬럼이 아직 없으면 best-effort로 재시도(운영 롤아웃 중 안전).
        ({ error } = await supabase.from("home_section_impression_logs").insert(base));
      }
      if (error && import.meta.env.DEV) {
        console.warn("home_section_impression_logs:", error.message);
      }
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn("home_section_impression_logs:", e?.message || e);
      }
    }
  })();
}

