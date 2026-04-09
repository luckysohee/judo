import { getSupabaseServiceClient } from "./placeBlogInsightsCache.js";

export const CURATOR_EMBEDDING_MODEL = "text-embedding-3-small";
export const CURATOR_EMBEDDING_DIM = 1536;

export async function countRowsWithEmbedding(sb) {
  const { count, error } = await sb
    .from("curator_places")
    .select("id", { count: "exact", head: true })
    .not("one_line_embedding", "is", null)
    .eq("is_archived", false);
  if (error) return 0;
  return count ?? 0;
}

export async function runTrgmSearch(sb, params) {
  const { data, error } = await sb.rpc("search_curator_places_trgm", {
    p_query: params.query,
    p_curator_id: params.curatorId ?? null,
    p_limit: params.limit ?? 40,
    p_max_distance_m: params.maxDistanceM ?? null,
    p_origin_lat: params.originLat ?? null,
    p_origin_lng: params.originLng ?? null,
  });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function runVectorSearch(sb, embedding, params) {
  const { data, error } = await sb.rpc("search_curator_places_vector", {
    p_query_embedding: embedding,
    p_curator_id: params.curatorId ?? null,
    p_limit: params.limit ?? 40,
    p_max_distance_m: params.maxDistanceM ?? null,
    p_origin_lat: params.originLat ?? null,
    p_origin_lng: params.originLng ?? null,
  });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

function mergeHybrid(trgmRows, vecRows) {
  const wText = 1;
  const wVec = 0.85;
  const byPlace = new Map();
  for (const r of trgmRows) {
    const pid = String(r.place_id);
    byPlace.set(pid, {
      curator_place_id: r.curator_place_id,
      place_id: r.place_id,
      text_score: r.text_score,
      vector_score: null,
      distance_m: r.distance_m,
      hybrid_score: (Number(r.text_score) || 0) * wText,
    });
  }
  for (const r of vecRows) {
    const pid = String(r.place_id);
    const vs = Number(r.vector_score) || 0;
    const ex = byPlace.get(pid);
    if (ex) {
      ex.vector_score = vs;
      ex.hybrid_score = (ex.hybrid_score || 0) + vs * wVec;
    } else {
      byPlace.set(pid, {
        curator_place_id: r.curator_place_id,
        place_id: r.place_id,
        text_score: null,
        vector_score: vs,
        distance_m: r.distance_m,
        hybrid_score: vs * wVec,
      });
    }
  }
  return [...byPlace.values()].sort(
    (a, b) => (b.hybrid_score || 0) - (a.hybrid_score || 0)
  );
}

/**
 * @param {object} opts
 * @param {import("openai").default} opts.openai
 * @param {boolean} opts.hasOpenAi
 * @param {string} opts.query
 * @param {string} [opts.mode] auto | trgm | vector | hybrid
 * @param {string} [opts.curatorId]
 * @param {number} [opts.limit]
 * @param {number|null} [opts.maxDistanceM]
 * @param {number|null} [opts.originLat]
 * @param {number|null} [opts.originLng]
 */
export async function searchCuratorPlaces(opts) {
  const sb = getSupabaseServiceClient();
  if (!sb) {
    return {
      ok: false,
      rows: [],
      mode: "disabled",
      reason: "supabase_service_unavailable",
    };
  }

  const q = String(opts.query || "").trim();
  if (!q) {
    return { ok: true, rows: [], mode: "empty_query" };
  }

  const limit = Math.min(Math.max(Number(opts.limit) || 40, 1), 200);
  const base = {
    query: q,
    curatorId: opts.curatorId,
    limit,
    maxDistanceM: opts.maxDistanceM ?? null,
    originLat: opts.originLat ?? null,
    originLng: opts.originLng ?? null,
  };

  let mode = opts.mode || "auto";
  let trgmRows = [];
  try {
    trgmRows = await runTrgmSearch(sb, base);
  } catch (e) {
    console.error("search_curator_places_trgm", e);
    trgmRows = [];
  }

  const embedCount = await countRowsWithEmbedding(sb);
  const canVector = Boolean(opts.hasOpenAi) && embedCount >= 2;

  if (mode === "auto") {
    mode = canVector ? "hybrid" : "trgm";
  }

  if (mode === "trgm") {
    return { ok: true, rows: trgmRows, mode: "trgm" };
  }

  if (!canVector) {
    return { ok: true, rows: trgmRows, mode: "trgm_fallback_no_embeddings" };
  }

  let embedding;
  try {
    const emb = await opts.openai.embeddings.create({
      model: CURATOR_EMBEDDING_MODEL,
      input: q.slice(0, 8000),
    });
    embedding = emb.data[0]?.embedding;
  } catch (e) {
    console.error("curator search embedding", e);
    return { ok: true, rows: trgmRows, mode: "trgm_embedding_error" };
  }

  if (!embedding || embedding.length !== CURATOR_EMBEDDING_DIM) {
    return { ok: true, rows: trgmRows, mode: "trgm_bad_embedding_dim" };
  }

  let vecRows = [];
  try {
    vecRows = await runVectorSearch(sb, embedding, base);
  } catch (e) {
    console.error("search_curator_places_vector", e);
    return { ok: true, rows: trgmRows, mode: "trgm_vector_rpc_error" };
  }

  if (mode === "vector") {
    return { ok: true, rows: vecRows, mode: "vector" };
  }

  return { ok: true, rows: mergeHybrid(trgmRows, vecRows), mode: "hybrid" };
}
