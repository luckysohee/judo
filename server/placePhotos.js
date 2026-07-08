import { createSupabaseServiceClient } from "./supabaseServiceRole.js";
import { fetchKakaoPlaceOgImageUrl } from "./kakaoPlaceOgImage.js";
import { resolveGooglePlacePhotos } from "./googlePlacePhotosResolve.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET = "curator-place-photos";
const LEGACY_MUMBAI_HOST = "juordxxsjecjmgmbnzox.supabase.co";

function rewriteLegacyStorageUrl(url, supabaseUrl) {
  const u = String(url || "").trim();
  if (!u) return "";
  const host = String(supabaseUrl || "")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  if (!host || !u.includes(LEGACY_MUMBAI_HOST)) return u;
  return u.replace(LEGACY_MUMBAI_HOST, host);
}

function curatorPublicUrl(supabaseUrl, storagePath) {
  const base = String(supabaseUrl || "").replace(/\/$/, "");
  if (!base || !storagePath) return "";
  const url = `${base}/storage/v1/object/public/${BUCKET}/${storagePath}`;
  return rewriteLegacyStorageUrl(url, base);
}

async function fetchCuratorPhotoRows(sb, supabaseUrl, { placeId, kakaoPlaceId }) {
  const byPath = new Map();

  const pull = async (column, value) => {
    if (value == null || value === "") return;
    const { data, error } = await sb
      .from("curator_place_photos")
      .select("id,curator_id,storage_path,created_at")
      .eq(column, value)
      .order("created_at", { ascending: false });
    if (error) {
      console.warn("place-photos curator", column, error.message);
      return;
    }
    for (const row of data || []) {
      if (!row?.storage_path || byPath.has(row.storage_path)) continue;
      byPath.set(row.storage_path, {
        id: row.id,
        curator_id: row.curator_id,
        storage_path: row.storage_path,
        created_at: row.created_at,
        public_url: curatorPublicUrl(supabaseUrl, row.storage_path),
      });
    }
  };

  await Promise.all([
    pull("kakao_place_id", kakaoPlaceId != null ? String(kakaoPlaceId) : null),
    pull("place_id", placeId && UUID_RE.test(placeId) ? placeId : null),
  ]);

  return [...byPath.values()].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
}

/**
 * 큐레이터 → 카카오 og → 구글 순 병합 (서버에서 병렬 조회)
 */
export async function resolvePlacePhotos({
  placeId,
  kakaoPlaceId,
  name,
  address,
  lat,
  lng,
}) {
  const { client: sb, error: envErr } = createSupabaseServiceClient();
  const supabaseUrl = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ""
  ).trim();

  const curatorPromise =
    sb && !envErr
      ? fetchCuratorPhotoRows(sb, supabaseUrl, { placeId, kakaoPlaceId })
      : Promise.resolve([]);

  const kakaoPromise =
    kakaoPlaceId && /^\d+$/.test(String(kakaoPlaceId))
      ? fetchKakaoPlaceOgImageUrl(String(kakaoPlaceId))
      : Promise.resolve(null);

  const nameTrim = String(name || "").trim();
  const googlePromise = nameTrim
    ? resolveGooglePlacePhotos({
        name: nameTrim,
        address: String(address || "").trim(),
        lat: Number.isFinite(Number(lat)) ? Number(lat) : null,
        lng: Number.isFinite(Number(lng)) ? Number(lng) : null,
      })
    : Promise.resolve({ imageUrls: [], attributions: [] });

  const [curatorRows, kakaoUrl, google] = await Promise.all([
    curatorPromise,
    kakaoPromise,
    googlePromise,
  ]);

  const urls = [];
  const sources = [];
  const seen = new Set();
  const add = (url, source) => {
    const u = String(url || "").trim();
    if (!u || seen.has(u)) return;
    seen.add(u);
    urls.push(u);
    if (!sources.includes(source)) sources.push(source);
  };

  for (const row of curatorRows) {
    add(row.public_url, "curator");
  }
  if (kakaoUrl) add(kakaoUrl, "kakao");
  for (const u of google.imageUrls || []) {
    add(u, "google");
  }

  return {
    urls,
    heroUrl: urls[0] || null,
    sources,
    attributions: Array.isArray(google.attributions) ? google.attributions : [],
    curator_photos: curatorRows,
  };
}

/**
 * GET /api/place-photos?placeId=&kakaoPlaceId=&name=&address=&lat=&lng=
 */
export async function handlePlacePhotos(req, res) {
  const placeId =
    typeof req.query.placeId === "string" ? req.query.placeId.trim() : "";
  const kakaoPlaceId =
    typeof req.query.kakaoPlaceId === "string"
      ? req.query.kakaoPlaceId.trim()
      : "";
  const name = typeof req.query.name === "string" ? req.query.name.trim() : "";
  const address =
    typeof req.query.address === "string" ? req.query.address.trim() : "";
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);

  if (!placeId && !kakaoPlaceId && !name) {
    return res.status(400).json({
      ok: false,
      message: "placeId, kakaoPlaceId, name 중 하나는 필요합니다",
    });
  }

  if (placeId && !UUID_RE.test(placeId)) {
    return res.status(400).json({
      ok: false,
      message: "placeId must be a UUID",
    });
  }

  try {
    const payload = await resolvePlacePhotos({
      placeId: placeId || null,
      kakaoPlaceId: kakaoPlaceId || null,
      name,
      address,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
    });

    return res.json({
      ok: true,
      ...payload,
    });
  } catch (e) {
    console.error("place-photos", e?.message || e);
    return res.status(500).json({
      ok: false,
      message: e?.message || "place-photos failed",
      urls: [],
      heroUrl: null,
      sources: [],
      attributions: [],
      curator_photos: [],
    });
  }
}
