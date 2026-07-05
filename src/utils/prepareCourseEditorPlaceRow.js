import { mapPlaceRowForCourse } from "../api/places";
import { supabase } from "../lib/supabase";
import { getKakaoPlaceDetailsViaProxy } from "./kakaoAPIProxy";
import { isLikelyKoreaWgs84, resolvePlaceWgs84 } from "./placeCoords";
import { ensurePlaceUuidForPick } from "./resolvePlaceUuidForPick";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 코스 에디터 `addPlaceToCourse`와 동일한 ensure 입력 형태 */
export function normalizeHitForPlaceEnsure(hit) {
  if (!hit || typeof hit !== "object") return null;
  const doc = hit._kakaoDoc;
  if (doc && doc.id != null) {
    return {
      id: String(doc.id),
      place_name: doc.place_name,
      name: doc.place_name,
      road_address_name: doc.road_address_name,
      address_name: doc.address_name,
      address: doc.road_address_name || doc.address_name,
      category_name: doc.category_name,
      category: doc.category_name,
      y: doc.y,
      x: doc.x,
      kakao_place_id: String(doc.id),
    };
  }
  const idStr = String(hit.id ?? "").trim();
  if (idStr.startsWith("kakao_")) {
    const kid = idStr.slice("kakao_".length);
    if (/^\d+$/.test(kid)) {
      return {
        ...hit,
        id: kid,
        kakao_place_id: kid,
        place_name: hit.name || hit.place_name,
        name: hit.name || hit.place_name,
      };
    }
  }
  if (/^\d+$/.test(idStr)) {
    return {
      ...hit,
      kakao_place_id: idStr,
      place_name: hit.name || hit.place_name,
      name: hit.name || hit.place_name,
    };
  }
  return hit;
}

async function enrichHitWithKakaoDetails(hit) {
  const normalized = normalizeHitForPlaceEnsure(hit);
  if (!normalized) return hit;
  const kakaoId = String(
    normalized.kakao_place_id ??
      (String(normalized.id || "").match(/^\d+$/) ? normalized.id : "")
  ).trim();
  if (!/^\d+$/.test(kakaoId)) return normalized;

  const wgs = resolvePlaceWgs84(normalized);
  if (wgs && isLikelyKoreaWgs84(wgs.lat, wgs.lng)) return normalized;

  const doc = await getKakaoPlaceDetailsViaProxy(kakaoId, {
    query: String(normalized.name || normalized.place_name || "").trim(),
  });
  if (!doc) return normalized;

  return {
    ...normalized,
    place_name: doc.place_name || normalized.name,
    name: doc.place_name || normalized.name,
    road_address_name: doc.road_address_name,
    address_name: doc.address_name,
    category_name: doc.category_name,
    category: doc.category_name,
    y: doc.y,
    x: doc.x,
    kakao_place_id: String(doc.id || kakaoId),
    _kakaoDoc: doc,
  };
}

async function syncPlaceRecordFromHit(placeId, hit) {
  const wgs = resolvePlaceWgs84(hit);
  if (!wgs || !isLikelyKoreaWgs84(wgs.lat, wgs.lng)) return;
  const patch = {
    lat: wgs.lat,
    lng: wgs.lng,
    name: String(hit.place_name || hit.name || "").trim() || undefined,
    address: String(
      hit.road_address_name || hit.address_name || hit.address || ""
    ).trim(),
    category: String(hit.category_name || hit.category || "").trim(),
  };
  const kid = String(hit.kakao_place_id || "").trim();
  if (/^\d+$/.test(kid)) patch.kakao_place_id = kid;
  Object.keys(patch).forEach((k) => {
    if (patch[k] === "" || patch[k] == null) delete patch[k];
  });
  if (Object.keys(patch).length === 0) return;
  await supabase.from("places").update(patch).eq("id", placeId);
}

/**
 * 검색·AI 후보 → 잔 코스 에디터 placeRow (UUID + place_lat/lng 보장).
 * @param {object} hit
 * @param {{ memo?: string, stay_minutes?: number|null }} [opts]
 */
export async function prepareCourseEditorPlaceRow(hit, opts = {}) {
  let normalized = await enrichHitWithKakaoDetails(hit);
  if (!normalized) return null;

  const uuid = await ensurePlaceUuidForPick(normalized, {
    createIfMissing: true,
  });
  if (!uuid || !UUID_RE.test(uuid)) return null;

  await syncPlaceRecordFromHit(uuid, normalized);

  const { data, error } = await supabase
    .from("places")
    .select(
      "id, name, place_name, address, category, category_name, lat, lng, kakao_place_id"
    )
    .eq("id", uuid)
    .maybeSingle();

  const meta = mapPlaceRowForCourse(
    !error && data
      ? data
      : {
          id: uuid,
          name: normalized.name || normalized.place_name,
          address:
            normalized.address ||
            normalized.road_address_name ||
            normalized.address_name,
          category: normalized.category || normalized.category_name,
          lat: normalized.lat,
          lng: normalized.lng,
          y: normalized.y,
          x: normalized.x,
          kakao_place_id: normalized.kakao_place_id,
        }
  );

  const wgs =
    resolvePlaceWgs84(meta) ||
    resolvePlaceWgs84(normalized) ||
    (Number.isFinite(meta.lat) && Number.isFinite(meta.lng)
      ? { lat: meta.lat, lng: meta.lng }
      : null);

  if (!wgs || !isLikelyKoreaWgs84(wgs.lat, wgs.lng)) return null;

  const memo = opts.memo != null ? String(opts.memo).trim() : "";
  const stayRaw = opts.stay_minutes;
  const stay_minutes =
    stayRaw != null && stayRaw !== "" && Number.isFinite(Number(stayRaw))
      ? String(Math.max(0, Math.floor(Number(stayRaw))))
      : "";

  return {
    key: `seed-${uuid}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    place_id: uuid,
    place_name: meta.name,
    place_address: meta.address,
    place_category: meta.category,
    place_lat: wgs.lat,
    place_lng: wgs.lng,
    kakao_place_id: meta.kakao_place_id || normalized.kakao_place_id || null,
    memo: memo.slice(0, 500),
    stay_minutes,
  };
}

/**
 * AI 초안 → 에디터 시드 (장소 순서·좌표 중심, 글은 기본 비움).
 * @param {object} result — runStudioCourseSuggestionPipeline 반환값
 * @param {{ includeAiText?: boolean }} [opts]
 */
export async function buildStudioCourseEditorSeedFromSuggestion(
  result,
  opts = {}
) {
  const includeAiText = opts.includeAiText === true;
  const draft = result?.draft;
  const map =
    result?.placeByKey instanceof Map ? result.placeByKey : new Map();
  const steps = Array.isArray(draft?.steps) ? draft.steps : [];

  const placeRows = [];
  let skipped = 0;

  for (const step of steps) {
    const key = String(step?.placeKey || "").trim();
    const hit = map.get(key);
    if (!hit) {
      skipped += 1;
      continue;
    }

    let memo = "";
    if (includeAiText) {
      const bits = [
        String(step?.memo || "").trim(),
        String(step?.visit_tip || "").trim(),
      ].filter(Boolean);
      memo = bits.join(" · ");
    }

    const row = await prepareCourseEditorPlaceRow(hit, {
      memo,
      stay_minutes: includeAiText ? step?.stay_minutes : null,
    });
    if (!row) {
      skipped += 1;
      continue;
    }
    placeRows.push(row);
  }

  if (placeRows.length < 2) {
    const err = new Error(
      "에디터에 넣을 장소가 2곳 미만입니다. 카카오·좌표를 확인할 수 없는 장소는 제외됐어요."
    );
    err.code = "INSUFFICIENT_EDITOR_PLACES";
    err.skippedSteps = skipped;
    throw err;
  }

  const q = String(result?.query || "").trim();
  const parsed = result?.parsed && typeof result.parsed === "object" ? result.parsed : {};

  let description = "";
  if (includeAiText) {
    const parts = [];
    const desc = String(draft?.description || "").trim();
    if (desc) parts.push(desc);
    const tips = (Array.isArray(draft?.route_tips) ? draft.route_tips : [])
      .map((t) => String(t || "").trim())
      .filter(Boolean);
    if (tips.length) {
      parts.push(["동선 팁", ...tips.map((t) => `· ${t}`)].join("\n"));
    }
    description = parts.join("\n\n").slice(0, 2000);
  }

  return {
    title:
      String(draft?.title || "").trim().slice(0, 200) ||
      q.slice(0, 200) ||
      "새 코스",
    description,
    area:
      String(draft?.area || parsed.area || "").trim().slice(0, 80) || "",
    themeTags: includeAiText
      ? (Array.isArray(draft?.theme_tags) ? draft.theme_tags : [])
          .map((t) => String(t || "").trim())
          .filter(Boolean)
          .slice(0, 8)
      : [],
    placeRows,
    sourceQuery: q,
  };
}
