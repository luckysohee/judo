import { getKakaoPlaceBasicInfoViaProxy } from "./kakaoAPIProxy.js";
import { fetchKakaoPlaceOg } from "../api/kakaoPlaceOg.js";
import {
  curatorPhotoPublicUrl,
  fetchCuratorPlacePhotoRows,
} from "./curatorPlacePhotos.js";
import { kakaoNumericPlaceId, resolvePlaceWgs84 } from "./placeCoords.js";

const CACHE_PREFIX = "judo:placePhoto:";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function placeKeywordQuery(place) {
  if (!place) return "";
  const n =
    (typeof place.name === "string" && place.name.trim()) ||
    (typeof place.place_name === "string" && place.place_name.trim()) ||
    "";
  if (n) return n;
  const addr =
    (typeof place.address === "string" && place.address.trim()) ||
    (typeof place.road_address_name === "string" &&
      place.road_address_name.trim()) ||
    (typeof place.address_name === "string" && place.address_name.trim()) ||
    "";
  if (addr) return addr.split(/\s+/).filter(Boolean).slice(0, 8).join(" ");
  return "";
}

function internalPlaceUuid(place) {
  const id = typeof place?.id === "string" ? place.id.trim() : "";
  return UUID_RE.test(id) ? id : null;
}

/** enrichment 후에도 안정적인 venue 키 */
export function buildPlacePhotoVenueKey(place) {
  if (!place) return "";
  const kid = String(kakaoNumericPlaceId(place) ?? "").trim();
  if (kid) return `k:${kid}`;
  const pid = internalPlaceUuid(place);
  if (pid) return `p:${pid}`;
  const wgs = resolvePlaceWgs84(place);
  if (wgs?.lat != null && wgs?.lng != null) {
    return `geo:${Number(wgs.lat).toFixed(5)},${Number(wgs.lng).toFixed(5)}`;
  }
  const q = placeKeywordQuery(place);
  return q ? `q:${q}` : "";
}

export function readPlacePhotoCache(venueKey) {
  if (!venueKey || typeof sessionStorage === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(`${CACHE_PREFIX}${venueKey}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed?.at || Date.now() - parsed.at > CACHE_TTL_MS) return [];
    return Array.isArray(parsed.urls)
      ? parsed.urls.filter((u) => typeof u === "string" && u)
      : [];
  } catch {
    return [];
  }
}

export function writePlacePhotoCache(venueKey, urls) {
  if (!venueKey || typeof sessionStorage === "undefined") return;
  const list = [...new Set((urls || []).filter((u) => typeof u === "string" && u))];
  if (!list.length) return;
  try {
    sessionStorage.setItem(
      `${CACHE_PREFIX}${venueKey}`,
      JSON.stringify({ at: Date.now(), urls: list })
    );
  } catch {
    /* quota */
  }
}

export function preloadPlacePhotoUrls(urls) {
  for (const u of urls || []) {
    if (typeof u !== "string" || !u) continue;
    const img = new Image();
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.src = u;
  }
}

function mergeInto(target, urls) {
  for (const u of urls || []) {
    if (typeof u === "string" && u && !target.includes(u)) target.push(u);
  }
  return target;
}

/**
 * 카드 열리기 전에 큐레이터·카카오 썸네일을 미리 받아 sessionStorage + 브라우저 캐시에 넣는다.
 * @param {object|null} place
 */
export function prefetchPlacePhotos(place) {
  if (!place || typeof place !== "object") return;

  const venueKey = buildPlacePhotoVenueKey(place);
  if (!venueKey) return;

  const cached = readPlacePhotoCache(venueKey);
  if (cached.length > 0) {
    preloadPlacePhotoUrls(cached);
    return;
  }

  const kid = kakaoNumericPlaceId(place);
  const placeId = internalPlaceUuid(place);
  const collected = [];

  const commit = () => {
    if (!collected.length) return;
    writePlacePhotoCache(venueKey, collected);
    preloadPlacePhotoUrls(collected);
  };

  const inlineThumb = String(
    place?.image || place?.thumbnail_url || place?.thumbnail || ""
  ).trim();
  if (inlineThumb) {
    collected.push(inlineThumb);
    commit();
  }

  if (kid || placeId) {
    void fetchCuratorPlacePhotoRows({
      kakaoPlaceId: kid || undefined,
      internalPlaceId: placeId || undefined,
    })
      .then((rows) => {
        const urls = rows
          .map((r) => curatorPhotoPublicUrl(r.storage_path))
          .filter(Boolean);
        mergeInto(collected, urls);
        commit();
      })
      .catch(() => {});
  }

  if (kid && !inlineThumb) {
    void fetchKakaoPlaceOg(kid)
      .then((url) => {
        if (url) {
          mergeInto(collected, [url]);
          commit();
        }
      })
      .catch(() => {});
  }

  if (kid) {
    const query = placeKeywordQuery(place);
    if (query.trim()) {
      const wgs = resolvePlaceWgs84(place);
      void getKakaoPlaceBasicInfoViaProxy(kid, {
        query,
        ...(wgs?.lng != null ? { x: wgs.lng } : {}),
        ...(wgs?.lat != null ? { y: wgs.lat } : {}),
      })
        .then((details) => {
          const urls = [];
          if (details?.thumbnail_url) urls.push(details.thumbnail_url);
          if (Array.isArray(details?.photo_urls)) {
            mergeInto(urls, details.photo_urls);
          }
          if (urls.length) {
            mergeInto(collected, urls);
            commit();
          }
        })
        .catch(() => {});
    }
  }
}
