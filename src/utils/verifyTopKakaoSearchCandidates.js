import { verifyKakaoPlaceStillListed } from "./kakaoAPIProxy";

/** 홈 검색 리스트·마커 상위 구간만 카카오 재검증 (API 부하 상한) */
const DEFAULT_TOP_N = 14;
const DEFAULT_CONCURRENCY = 3;

function kakaoNumericId(place) {
  const raw =
    place?.id ?? place?.kakao_place_id ?? place?.place_id ?? place?.kakaoId;
  const s = raw != null ? String(raw).trim() : "";
  return /^\d+$/.test(s) ? s : null;
}

function kakaoQueryLabel(place) {
  return (
    (place?.place_name && String(place.place_name).trim()) ||
    (place?.name && String(place.name).trim()) ||
    ""
  );
}

function coordsForVerify(place) {
  const lat = parseFloat(place?.y ?? place?.lat);
  const lng = parseFloat(place?.x ?? place?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { lat: null, lng: null };
  }
  return { lat, lng };
}

function mergeVerifiedKakaoFields(place, doc) {
  if (!doc || typeof doc !== "object") return place;
  return {
    ...place,
    place_name: doc.place_name || place.place_name,
    name: doc.place_name || place.name,
    x: doc.x ?? place.x,
    y: doc.y ?? place.y,
    address_name: doc.address_name || place.address_name,
    road_address_name: doc.road_address_name || place.road_address_name,
    category_name: doc.category_name || place.category_name,
    phone: doc.phone || place.phone,
  };
}

/**
 * 스코어링 직후 `scoredPlaces` 상위 N개만 카카오 키워드 재매칭으로 존재 여부 검증.
 * 숫자 id가 아닌 행(DB UUID 등)은 그대로 둔다.
 *
 * @param {object[]} scoredPlaces
 * @param {{ topN?: number, concurrency?: number }} [opts]
 */
export async function verifyTopKakaoSearchCandidates(scoredPlaces, opts = {}) {
  if (!Array.isArray(scoredPlaces) || scoredPlaces.length === 0) {
    return scoredPlaces;
  }

  const topN =
    opts.topN != null && Number.isFinite(Number(opts.topN))
      ? Math.min(40, Math.max(1, Number(opts.topN)))
      : DEFAULT_TOP_N;
  const concurrency =
    opts.concurrency != null && Number.isFinite(Number(opts.concurrency))
      ? Math.min(8, Math.max(1, Number(opts.concurrency)))
      : DEFAULT_CONCURRENCY;

  const head = scoredPlaces.slice(0, topN);
  const tail = scoredPlaces.slice(topN);

  const verifyOne = async (place) => {
    const id = kakaoNumericId(place);
    if (!id) {
      return { keep: true, place };
    }
    const query = kakaoQueryLabel(place).slice(0, 100);
    if (!query) {
      return { keep: true, place };
    }
    const { lat, lng } = coordsForVerify(place);
    const hasCoords = lat != null && lng != null;
    const v = await verifyKakaoPlaceStillListed(id, {
      query,
      x: hasCoords ? lng : undefined,
      y: hasCoords ? lat : undefined,
    });
    if (v.softFail) {
      return { keep: true, place };
    }
    if (!v.document) {
      if (import.meta.env.DEV) {
        console.warn("[kakao-search-verify] dropped", id, query.slice(0, 40));
      }
      return { keep: false, place };
    }
    return { keep: true, place: mergeVerifiedKakaoFields(place, v.document) };
  };

  const keptHead = [];
  for (let i = 0; i < head.length; i += concurrency) {
    const batch = head.slice(i, i + concurrency);
    const results = await Promise.all(batch.map(verifyOne));
    for (const r of results) {
      if (r.keep) keptHead.push(r.place);
    }
  }

  return [...keptHead, ...tail];
}
