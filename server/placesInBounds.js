import { createSupabaseServiceClient } from "./supabaseServiceRole.js";
import { createTtlCache } from "./simpleTtlCache.js";

/** 동일 bbox 재요청·warmup+Home 동시 호출 완화 (인스턴스 메모리) */
const PLACES_IN_BOUNDS_CACHE_TTL_MS = 90 * 1000;
const placesInBoundsCache = createTtlCache(160, PLACES_IN_BOUNDS_CACHE_TTL_MS);
/** @type {Map<string, Promise<object>>} */
const placesInBoundsInflight = new Map();

function boundsCacheKey(south, west, north, east, limit) {
  const r4 = (n) => Number(n).toFixed(4);
  return `${r4(south)}_${r4(west)}_${r4(north)}_${r4(east)}_${limit}`;
}

async function fetchPlacesInBoundsFallback(sb, { south, west, north, east, limit }) {
  const placesSelectVariants = [
    [
      "id",
      "name",
      "category",
      "lat",
      "lng",
      "tags",
      "address",
      "phone",
      "kakao_place_id",
      "is_public",
    ],
    ["id", "name", "lat", "lng", "tags", "address", "kakao_place_id"],
    ["id", "name", "lat", "lng", "address", "kakao_place_id"],
    ["id", "name", "lat", "lng", "kakao_place_id"],
    ["id", "name", "lat", "lng"],
  ];
  let placesRes = null;
  for (const cols of placesSelectVariants) {
    placesRes = await sb
      .from("places")
      .select(cols.join(","))
      .gte("lat", south)
      .lte("lat", north)
      .gte("lng", west)
      .lte("lng", east)
      .limit(limit);
    if (!placesRes.error) break;
    if (!/column .* does not exist/i.test(String(placesRes.error.message || ""))) {
      break;
    }
  }
  const { data: placesRaw, error: pErr } = placesRes;
  if (pErr) return { places: [], joinRows: [], error: pErr };

  const places = Array.isArray(placesRaw) ? placesRaw : [];
  if (places.length === 0) return { places: [], joinRows: [], error: null };

  const placeIds = [...new Set(places.map((p) => String(p?.id || "")).filter(Boolean))];

  let cps = [];
  let cpErr = null;
  const cpColumnsPreferred = [
    "id",
    "place_id",
    "curator_id",
    "is_archived",
    "one_line_reason",
    "menu_reason",
    "one_line_review",
    "tags",
    "moods",
    "alcohol_types",
  ].join(",");
  const cpColumnsCompat = [
    "id",
    "place_id",
    "curator_id",
    "is_archived",
    "one_line_reason",
    "one_line_review",
    "tags",
    "moods",
    "alcohol_types",
  ].join(",");

  const cpSelectVariants = [cpColumnsPreferred, cpColumnsCompat, "id,place_id,curator_id,is_archived,one_line_reason,tags,moods"];
  let cpRes = null;
  for (const cols of cpSelectVariants) {
    cpRes = await sb
      .from("curator_places")
      .select(cols)
      .in("place_id", placeIds)
      .eq("is_archived", false);
    if (!cpRes.error) break;
    if (!/column .* does not exist/i.test(String(cpRes.error.message || ""))) {
      break;
    }
  }
  cps = Array.isArray(cpRes.data) ? cpRes.data : [];
  cpErr = cpRes.error || null;
  if (cpErr) return { places, joinRows: [], error: cpErr };

  const curatorIds = [
    ...new Set(cps.map((r) => String(r?.curator_id || "").trim()).filter(Boolean)),
  ];
  let curatorMap = new Map();
  if (curatorIds.length > 0) {
    const { data: curs, error: cErr } = await sb
      .from("curators")
      .select("user_id,username,display_name")
      .in("user_id", curatorIds);
    if (cErr) return { places, joinRows: [], error: cErr };
    for (const c of curs || []) {
      const uid = String(c?.user_id || "").trim();
      if (uid) {
        curatorMap.set(uid, {
          user_id: uid,
          username: c?.username || "",
          display_name: c?.display_name || "",
        });
      }
    }
  }

  const placeMap = new Map(places.map((p) => [String(p.id), p]));
  const joinRows = cps
    .map((cp) => {
      const pid = String(cp?.place_id || "");
      const place = placeMap.get(pid);
      if (!place) return null;
      const cid = String(cp?.curator_id || "");
      return {
        ...cp,
        menu_reason: cp?.menu_reason ?? "",
        places: place,
        curators: curatorMap.get(cid) || { username: "", display_name: "" },
      };
    })
    .filter(Boolean);

  return { places, joinRows, error: null };
}

async function loadPlacesInBoundsPayload(sb, { south, west, north, east, limit }) {
  let data = null;
  let error = null;
  try {
    const rpcRes = await sb.rpc("get_places_in_bounds", {
      south,
      west,
      north,
      east,
      p_limit: limit,
    });
    data = rpcRes.data;
    error = rpcRes.error;
  } catch (e) {
    error = e;
    console.warn("get_places_in_bounds thrown", e?.message || e);
  }

  if (error) {
    console.error("get_places_in_bounds", error);
    const msg = error.message || String(error);
    const timedOut =
      error?.name === "AbortError" ||
      error?.name === "TimeoutError" ||
      /aborted|timeout/i.test(msg);
    if (/bounds_too_large/i.test(msg)) {
      return { error: "bounds_too_large", timedOut: false };
    }
    const fallback = await fetchPlacesInBoundsFallback(sb, {
      south,
      west,
      north,
      east,
      limit,
    });
    if (fallback.error) {
      console.error("get_places_in_bounds fallback_failed", fallback.error);
      return {
        error: timedOut
          ? "places query timed out — check Supabase/Railway env"
          : msg,
        timedOut,
      };
    }
    return {
      ok: true,
      places: fallback.places,
      join_rows: fallback.joinRows,
      limit,
      fallback: true,
    };
  }

  if (!data || typeof data !== "object") {
    return { error: "empty rpc payload", timedOut: false };
  }

  const places = Array.isArray(data.places) ? data.places : [];
  const joinRows = Array.isArray(data.join_rows) ? data.join_rows : [];

  return {
    ok: true,
    places,
    join_rows: joinRows,
    limit,
  };
}

/**
 * GET /api/places-in-bounds?south=&west=&north=&east=&limit=
 * Supabase RPC `get_places_in_bounds` — service role 전용.
 */
export async function handlePlacesInBounds(req, res) {
  const q = req.query || {};
  const south = Number(q.south);
  const west = Number(q.west);
  const north = Number(q.north);
  const east = Number(q.east);
  if (![south, west, north, east].every((n) => Number.isFinite(n))) {
    return res.status(400).json({
      ok: false,
      message: "bounds required: south, west, north, east (numbers)",
    });
  }

  const rawLim = Number(q.limit);
  const limit = Math.min(
    200,
    Math.max(1, Number.isFinite(rawLim) ? Math.floor(rawLim) : 80),
  );

  const cacheKey = boundsCacheKey(south, west, north, east, limit);
  const cached = placesInBoundsCache.get(cacheKey);
  if (cached) {
    return res.json({ ...cached, cached: true });
  }

  let inflight = placesInBoundsInflight.get(cacheKey);
  if (!inflight) {
    inflight = (async () => {
      const { client: sb, error: envErr } = createSupabaseServiceClient();
      if (envErr || !sb) {
        return {
          status: 503,
          body: {
            ok: false,
            message:
              "Supabase service role 키가 server 환경변수에 없어요 (SUPABASE_SERVICE_ROLE_KEY)",
          },
        };
      }

      const payload = await loadPlacesInBoundsPayload(sb, {
        south,
        west,
        north,
        east,
        limit,
      });

      if (payload.ok) {
        placesInBoundsCache.set(cacheKey, payload);
        return { status: 200, body: payload };
      }

      if (payload.error === "bounds_too_large") {
        return {
          status: 400,
          body: { ok: false, message: "bounds too large" },
        };
      }

      return {
        status: payload.timedOut ? 504 : 500,
        body: {
          ok: false,
          message: payload.error || "places-in-bounds failed",
        },
      };
    })().finally(() => {
      placesInBoundsInflight.delete(cacheKey);
    });
    placesInBoundsInflight.set(cacheKey, inflight);
  }

  const result = await inflight;
  return res.status(result.status).json(result.body);
}
