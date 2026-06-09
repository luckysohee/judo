import { createSupabaseServiceClient } from "./supabaseServiceRole.js";
import { computeDensityGridCellSize } from "../src/utils/densityGridCellSize.js";

function aggregatePlacesToDensityGrid(places, { south, west, north, east, cell }) {
  const buckets = new Map();

  for (const p of places || []) {
    const lat = Number(p?.lat);
    const lng = Number(p?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < south || lat > north || lng < west || lng > east) continue;
    const gy = Math.floor((lat - south) / cell);
    const gx = Math.floor((lng - west) / cell);
    const key = `${gy}:${gx}`;
    let b = buckets.get(key);
    if (!b) {
      b = { sumLat: 0, sumLng: 0, count: 0 };
      buckets.set(key, b);
    }
    b.sumLat += lat;
    b.sumLng += lng;
    b.count += 1;
  }

  return [...buckets.values()]
    .map((b) => ({
      lat: b.sumLat / b.count,
      lng: b.sumLng / b.count,
      count: b.count,
    }))
    .filter((b) => b.count >= 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 80);
}

async function fetchAllPlaceCoordsInBounds(sb, { south, west, north, east }) {
  const pageSize = 1000;
  let from = 0;
  const rows = [];
  while (from < 12000) {
    const res = await sb
      .from("places")
      .select("lat,lng")
      .gte("lat", south)
      .lte("lat", north)
      .gte("lng", west)
      .lte("lng", east)
      .not("lat", "is", null)
      .not("lng", "is", null)
      .range(from, from + pageSize - 1);
    if (res.error) {
      if (/column .* does not exist/i.test(String(res.error.message || ""))) {
        break;
      }
      return { rows: [], error: res.error };
    }
    const chunk = Array.isArray(res.data) ? res.data : [];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }
  return { rows, error: null };
}

async function fetchDensityFallback(sb, { south, west, north, east, level }) {
  const cell = computeDensityGridCellSize(level, south, west, north, east);
  const { rows, error } = await fetchAllPlaceCoordsInBounds(sb, {
    south,
    west,
    north,
    east,
  });
  if (error) {
    return { clusters: [], total: 0, cell, error };
  }

  const clusters = aggregatePlacesToDensityGrid(rows, {
    south,
    west,
    north,
    east,
    cell,
  });
  return { clusters, total: rows.length, cell, error: null };
}

/**
 * GET /api/places-density-in-bounds?south=&west=&north=&east=&level=
 * 줌 아웃용 그리드 집계 — join 없이 빠르게 숫자 클러스터만.
 */
export async function handlePlacesDensityInBounds(req, res) {
  const q = req.query || {};
  const south = Number(q.south);
  const west = Number(q.west);
  const north = Number(q.north);
  const east = Number(q.east);
  const level = Number.isFinite(Number(q.level)) ? Math.floor(Number(q.level)) : 8;

  if (![south, west, north, east].every((n) => Number.isFinite(n))) {
    return res.status(400).json({
      ok: false,
      message: "bounds required: south, west, north, east (numbers)",
    });
  }

  const cell = computeDensityGridCellSize(level, south, west, north, east);

  const { client: sb, error: envErr } = createSupabaseServiceClient();
  if (envErr || !sb) {
    return res.status(503).json({
      ok: false,
      message:
        "Supabase service role 키가 server 환경변수에 없어요 (SUPABASE_SERVICE_ROLE_KEY)",
    });
  }

  const { data, error } = await sb.rpc("get_place_density_in_bounds", {
    south,
    west,
    north,
    east,
    p_level: level,
    p_cell_size: cell,
  });

  if (!error && data && typeof data === "object") {
    const clusters = Array.isArray(data.clusters) ? data.clusters : [];
    const total = Number(data.total_in_bounds) || 0;
    return res.json({
      ok: true,
      clusters,
      total_in_bounds: total,
      level,
      cell_size: Number(data.cell_size) || cell,
    });
  }

  if (error && !/function .* does not exist|42883/i.test(String(error.message || ""))) {
    console.warn("get_place_density_in_bounds", error.message || error);
  }

  const fallback = await fetchDensityFallback(sb, {
    south,
    west,
    north,
    east,
    level,
  });
  if (fallback.error) {
    console.error("places_density_fallback_failed", fallback.error);
    return res.status(500).json({
      ok: false,
      message: fallback.error.message || "density fetch failed",
    });
  }

  return res.json({
    ok: true,
    clusters: fallback.clusters,
    total_in_bounds: fallback.total,
    level,
    cell_size: fallback.cell,
    fallback: true,
  });
}
