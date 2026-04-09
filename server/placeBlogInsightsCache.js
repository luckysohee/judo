import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function getSupabaseUrl() {
  return (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ""
  ).trim();
}

function getServiceKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    ""
  ).trim();
}

export function isPlaceBlogCacheEnabled() {
  return Boolean(getSupabaseUrl() && getServiceKey());
}

let _serviceClient = null;

export function getSupabaseServiceClient() {
  if (_serviceClient) return _serviceClient;
  const url = getSupabaseUrl();
  const key = getServiceKey();
  if (!url || !key) return null;
  _serviceClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _serviceClient;
}

/** 카카오 숫자 id / naver_… / 기타 통합 검색 id */
export function stableExternalPlaceId(place) {
  const id = String(place?.id ?? "").trim();
  if (!id) return null;
  if (id.startsWith("naver_")) return id;
  if (/^\d+$/.test(id)) return `kakao_${id}`;
  return `ext_${id}`;
}

export function fingerprintFromPosts(posts) {
  if (!Array.isArray(posts) || posts.length === 0) return "";
  const s = posts
    .map((x) => `${x.title || ""}|${String(x.content || "").slice(0, 2000)}`)
    .join("||")
    .slice(0, 12000);
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

function normalizeKeywords(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  return {
    atmosphere: Array.isArray(o.atmosphere) ? o.atmosphere : [],
    menu: Array.isArray(o.menu) ? o.menu : [],
    purpose: Array.isArray(o.purpose) ? o.purpose : [],
    drink: Array.isArray(o.drink) ? o.drink : [],
  };
}

/**
 * @param {string[]} externalIds
 * @returns {Promise<Map<string, import('@supabase/supabase-js').AnyObject>>}
 */
export async function fetchPlaceBlogInsightsBatch(externalIds) {
  const map = new Map();
  const ids = [...new Set(externalIds.filter(Boolean))];
  if (ids.length === 0) return map;
  const sb = getSupabaseServiceClient();
  if (!sb) return map;

  const nowIso = new Date().toISOString();
  const { data, error } = await sb
    .from("place_blog_insights")
    .select(
      "external_place_id,place_name_snapshot,review_count,keywords,summary,content_fingerprint,updated_at,expires_at"
    )
    .in("external_place_id", ids)
    .gt("expires_at", nowIso);

  if (error) {
    console.warn("place_blog_insights select:", error.message);
    return map;
  }
  for (const row of data || []) {
    if (row?.external_place_id) map.set(row.external_place_id, row);
  }
  return map;
}

export async function upsertPlaceBlogInsight({
  externalPlaceId,
  placeNameSnapshot,
  reviewCount,
  keywords,
  summary,
  contentFingerprint,
}) {
  if (!externalPlaceId || !contentFingerprint) return;
  const sb = getSupabaseServiceClient();
  if (!sb) return;

  const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();
  const kw = normalizeKeywords(keywords);

  const { error } = await sb.from("place_blog_insights").upsert(
    {
      external_place_id: externalPlaceId,
      place_name_snapshot: placeNameSnapshot || null,
      review_count: Math.max(0, Number(reviewCount) || 0),
      keywords: kw,
      summary: summary || null,
      content_fingerprint: contentFingerprint,
      updated_at: new Date().toISOString(),
      expires_at: expiresAt,
    },
    { onConflict: "external_place_id" }
  );

  if (error) {
    console.warn("place_blog_insights upsert:", error.message);
  }
}

export function blogInsightFromCacheRow(row, liveReviewCount) {
  const kw = normalizeKeywords(row.keywords);
  return {
    atmosphere: kw.atmosphere,
    menu: kw.menu,
    purpose: kw.purpose,
    drink: kw.drink,
    reviewCount: liveReviewCount,
    source: "naver_blog",
    fromCache: true,
    ...(row.summary ? { summary: String(row.summary).trim() } : {}),
  };
}
