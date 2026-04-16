// 서버 프록시를 통한 카카오 API 호출
// 비우면 동일 출처 `/api/*` (Vite dev에서 proxy → server:4000)
const API_BASE_URL = (
  import.meta.env.VITE_AI_API_BASE_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  ""
).replace(/\/$/, "");

/**
 * @param {string} placeId 카카오 장소 숫자 id
 * @param {{ query?: string, x?: number, y?: number }} [opts] query=장소명, x=경도·y=위도(WGS84) — keyword 검색 매칭용
 */
export async function getKakaoPlaceDetailsViaProxy(placeId, opts = {}) {
  try {
    const base = API_BASE_URL;
    const url = base ? `${base}/api/kakao/place-details` : "/api/kakao/place-details";
    const body = { placeId };
    if (typeof opts.query === "string" && opts.query.trim()) {
      body.query = opts.query.trim();
    }
    if (opts.x != null && Number.isFinite(Number(opts.x))) {
      body.x = Number(opts.x);
    }
    if (opts.y != null && Number.isFinite(Number(opts.y))) {
      body.y = Number(opts.y);
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (import.meta.env.DEV) {
        console.warn("kakao place-details", {
          proxyHttp: response.status,
          kakaoHttp: data?.status,
          error: data?.error,
          hint: data?.hint,
          kakao: data?.kakao,
        });
      }
      return null;
    }
    return data.documents?.[0] || null;
  } catch (error) {
    console.error("프록시 카카오 API 호출 실패:", error);
    return null;
  }
}

function collectPhotoUrlsFromKakaoDetail(details) {
  if (!details || typeof details !== "object") return [];
  const out = [];
  const push = (u) => {
    if (typeof u === "string" && u.trim() && !out.includes(u)) out.push(u);
  };
  push(
    details.thumbnail_url ||
      details.thumbnail ||
      details.photo_url ||
      details.image_url
  );
  const lists = [
    details.photos,
    details.photo_urls,
    details.place_photo_list,
    details.images,
  ];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (typeof item === "string") push(item);
      else if (item && typeof item === "object") {
        push(item.url || item.image_url || item.thumbnail_url || item.origin_url);
      }
    }
  }
  return out;
}

export async function getKakaoPlaceBasicInfoViaProxy(placeId, opts = {}) {
  const details = await getKakaoPlaceDetailsViaProxy(placeId, opts);

  if (!details) {
    return null;
  }

  const photo_urls = collectPhotoUrlsFromKakaoDetail(details);

  return {
    place_name: details.place_name,
    place_id: details.id,
    address: details.address_name || details.road_address_name,
    phone: details.phone,
    category_group_name: details.category_group_name,
    category_name: details.category_name,
    x: details.x,
    y: details.y,
    place_url: details.place_url,
    rating: details.rating || 0,
    review_count: details.review_count || 0,
    thumbnail_url: photo_urls[0] || null,
    photo_urls,
  };
}

/**
 * 브라우저 → Vite proxy → 서버 → 카카오 키워드 검색 (CORS 회피)
 * @param {{ query: string, x?: number, y?: number, radius?: number, size?: number }} opts
 */
/**
 * 지번·도로명 주소 → 좌표 (키워드 검색 실패·무좌표 장소 보강용)
 * @param {{ query: string, size?: number }} opts
 */
export async function searchKakaoAddressViaProxy(opts) {
  const query = typeof opts?.query === "string" ? opts.query.trim() : "";
  if (!query) {
    return { documents: [] };
  }
  try {
    const base = API_BASE_URL;
    const url = base ? `${base}/api/kakao/address` : "/api/kakao/address";
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        size:
          opts.size != null && Number.isFinite(Number(opts.size))
            ? Math.min(15, Math.max(1, Number(opts.size)))
            : 5,
      }),
    });
    if (!response.ok) {
      console.warn("searchKakaoAddressViaProxy HTTP", response.status);
      return { documents: [] };
    }
    const data = await response.json();
    return { documents: Array.isArray(data.documents) ? data.documents : [] };
  } catch (e) {
    console.error("searchKakaoAddressViaProxy:", e);
    return { documents: [] };
  }
}

export async function searchKakaoKeywordViaProxy(opts) {
  const query = typeof opts?.query === "string" ? opts.query.trim() : "";
  if (!query) {
    return { documents: [] };
  }
  try {
    const base = API_BASE_URL;
    const url = base ? `${base}/api/kakao/search` : "/api/kakao/search";
    const px = opts.x != null ? Number(opts.x) : NaN;
    const py = opts.y != null ? Number(opts.y) : NaN;
    const body = {
      query,
      size: opts.size != null ? Number(opts.size) : 15,
    };
    if (Number.isFinite(px) && Number.isFinite(py)) {
      body.x = px;
      body.y = py;
      body.radius =
        opts.radius != null && Number.isFinite(Number(opts.radius))
          ? Number(opts.radius)
          : 500;
    }
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      console.warn("searchKakaoKeywordViaProxy HTTP", response.status);
      return { documents: [] };
    }
    const data = await response.json();
    return { documents: Array.isArray(data.documents) ? data.documents : [] };
  } catch (e) {
    console.error("searchKakaoKeywordViaProxy:", e);
    return { documents: [] };
  }
}
