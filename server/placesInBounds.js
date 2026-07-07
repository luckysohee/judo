import { createSupabaseServiceClient } from "./supabaseServiceRole.js";
import { createTtlCache } from "./simpleTtlCache.js";

/** 동일 bbox 재요청·warmup+Home 동시 호출 완화 (인스턴스 메모리) */
const PLACES_IN_BOUNDS_CACHE_TTL_MS = 3 * 60 * 1000;
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
  // bbox 후보를 넉넉히(최대 1000) 가져와 큐레이터 우선 정렬 후 limit 만큼 자른다.
  // (limit 만 바로 자르면 큐레이터 술집이 임의로 잘려 코스에 안 들어옴 → 을지로 버그 원인)
  const candidateCap = Math.max(limit, Math.min(1000, limit * 6));
  let placesRes = null;
  for (const cols of placesSelectVariants) {
    placesRes = await sb
      .from("places")
      .select(cols.join(","))
      .gte("lat", south)
      .lte("lat", north)
      .gte("lng", west)
      .lte("lng", east)
      .limit(candidateCap);
    if (!placesRes.error) break;
    if (!/column .* does not exist/i.test(String(placesRes.error.message || ""))) {
      break;
    }
  }
  const { data: placesRaw, error: pErr } = placesRes;
  if (pErr) return { places: [], joinRows: [], error: pErr };

  const allPlaces = Array.isArray(placesRaw) ? placesRaw : [];
  if (allPlaces.length === 0) return { places: [], joinRows: [], error: null };

  const candidateIds = [
    ...new Set(allPlaces.map((p) => String(p?.id || "")).filter(Boolean)),
  ];

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
    "tags",
    "moods",
    "alcohol_types",
  ].join(",");

  const cpSelectVariants = [
    cpColumnsPreferred,
    cpColumnsCompat,
    "id,place_id,curator_id,is_archived,one_line_reason,tags,moods",
  ];
  // place_id 청크(200)로 나눠 조회 — bbox 후보가 1000까지 늘었으므로
  for (let i = 0; i < candidateIds.length; i += 200) {
    const idChunk = candidateIds.slice(i, i + 200);
    let cpRes = null;
    for (const cols of cpSelectVariants) {
      cpRes = await sb
        .from("curator_places")
        .select(cols)
        .in("place_id", idChunk)
        .eq("is_archived", false);
      if (!cpRes.error) break;
      if (!/column .* does not exist/i.test(String(cpRes.error.message || ""))) {
        break;
      }
    }
    if (cpRes.error) {
      cpErr = cpRes.error;
      break;
    }
    cps = cps.concat(Array.isArray(cpRes.data) ? cpRes.data : []);
  }
  if (cpErr) return { places: allPlaces.slice(0, limit), joinRows: [], error: cpErr };

  // 큐레이터 수 기준 우선 정렬 후 limit 만큼 자른다(RPC 정상 동작과 동일한 우선순위).
  const curatorCountByPlace = new Map();
  for (const cp of cps) {
    const pid = String(cp?.place_id || "");
    if (!pid) continue;
    curatorCountByPlace.set(pid, (curatorCountByPlace.get(pid) || 0) + 1);
  }
  const orderedPlaces = [...allPlaces].sort((a, b) => {
    const ca = curatorCountByPlace.get(String(a?.id || "")) || 0;
    const cb = curatorCountByPlace.get(String(b?.id || "")) || 0;
    if ((cb > 0 ? 1 : 0) !== (ca > 0 ? 1 : 0)) return (cb > 0 ? 1 : 0) - (ca > 0 ? 1 : 0);
    return cb - ca;
  });
  const places = orderedPlaces.slice(0, limit);
  const keptPlaceIds = new Set(places.map((p) => String(p?.id || "")));
  // 잘려나간 장소의 큐레이터 행은 제외(joinRows 는 노출되는 places 와 일치해야 함)
  cps = cps.filter((cp) => keptPlaceIds.has(String(cp?.place_id || "")));

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
    const msg = error.message || String(error);
    const schemaDrift = /column .* does not exist/i.test(msg);
    if (schemaDrift) {
      console.warn("get_places_in_bounds schema drift — using fallback:", msg);
    } else {
      console.error("get_places_in_bounds", error);
    }
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
          : schemaDrift
            ? "DB migration needed: curator_places.one_line_review (see supabase/migrations/20260628120000_*.sql)"
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
