import axios from "axios";

export function getGooglePlacesApiKey() {
  return (process.env.GOOGLE_PLACES_API_KEY || "").trim();
}

function isValidGooglePhotoResourceName(name) {
  if (typeof name !== "string" || name.includes("..")) return false;
  if (!name.startsWith("places/") || !name.includes("/photos/")) return false;
  const segs = name.split("/");
  return segs.length >= 4 && segs[0] === "places" && segs[2] === "photos";
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isApiKeyServiceBlocked(googleBody) {
  const details = googleBody?.error?.details;
  if (!Array.isArray(details)) return false;
  return details.some((d) => d?.reason === "API_KEY_SERVICE_BLOCKED");
}

async function fetchGooglePlacePhotosForDetail(key, chosen) {
  const name =
    typeof chosen?.name === "string" && chosen.name.startsWith("places/")
      ? chosen.name
      : typeof chosen?.id === "string" && chosen.id
        ? `places/${chosen.id}`
        : null;
  if (!name) return [];
  const placeId = name.replace(/^places\//, "");
  const { data } = await axios.get(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "photos",
      },
      timeout: 12000,
    }
  );
  return Array.isArray(data?.photos) ? data.photos : [];
}

async function collectGooglePhotoUrlsFromSearchResults(key, places, maxPlaces) {
  const cap = Math.min(
    Math.max(1, maxPlaces),
    Array.isArray(places) ? places.length : 0
  );
  const mergedUrls = [];
  const attributions = new Set();
  const seenPhoto = new Set();
  for (let pi = 0; pi < cap && mergedUrls.length < 4; pi++) {
    const p = places[pi];
    let photos = Array.isArray(p?.photos) ? p.photos : [];
    if (photos.length === 0) {
      try {
        const fromDetail = await fetchGooglePlacePhotosForDetail(key, p);
        if (fromDetail.length > 0) photos = fromDetail;
      } catch {
        /* skip */
      }
    }
    for (const ph of photos) {
      const photoName = ph?.name;
      if (!isValidGooglePhotoResourceName(photoName)) continue;
      if (seenPhoto.has(photoName)) continue;
      seenPhoto.add(photoName);
      mergedUrls.push(
        `/api/google-place-photo-media?photoName=${encodeURIComponent(photoName)}`
      );
      const aa = ph.authorAttributions;
      if (Array.isArray(aa)) {
        for (const a of aa) {
          if (a?.displayName) attributions.add(String(a.displayName));
        }
      }
      if (mergedUrls.length >= 4) break;
    }
  }
  return { imageUrls: mergedUrls, attributions: [...attributions] };
}

async function fetchGooglePlacePhotosLegacy(key, textQuery, lat, lng, hasCoords) {
  const params = { query: textQuery, key };
  if (hasCoords) {
    params.location = `${lat},${lng}`;
    params.radius = 2000;
  }
  const { data } = await axios.get(
    "https://maps.googleapis.com/maps/api/place/textsearch/json",
    { params, timeout: 12000 }
  );
  const st = data?.status;
  if (st === "REQUEST_DENIED" || st === "INVALID_REQUEST") {
    throw new Error(data?.error_message || st || "legacy textsearch 거절");
  }
  if (st !== "OK" && st !== "ZERO_RESULTS") {
    throw new Error(data?.error_message || st || "legacy textsearch 실패");
  }
  let results = Array.isArray(data.results) ? data.results : [];
  if (hasCoords && results.length > 1) {
    results = [...results].sort((a, b) => {
      const alat = a.geometry?.location?.lat;
      const alng = a.geometry?.location?.lng;
      const blat = b.geometry?.location?.lat;
      const blng = b.geometry?.location?.lng;
      if (
        !Number.isFinite(alat) ||
        !Number.isFinite(alng) ||
        !Number.isFinite(blat) ||
        !Number.isFinite(blng)
      ) {
        return 0;
      }
      return (
        haversineKm(lat, lng, alat, alng) - haversineKm(lat, lng, blat, blng)
      );
    });
  }
  const imageUrls = [];
  const attributionSet = new Set();
  for (const r of results) {
    for (const ph of r.photos || []) {
      const ref = ph.photo_reference;
      if (typeof ref === "string" && ref.trim() && imageUrls.length < 4) {
        imageUrls.push(
          `/api/google-place-photo-legacy?photoReference=${encodeURIComponent(ref.trim())}`
        );
        for (const h of ph.html_attributions || []) {
          const t = String(h).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
          if (t) attributionSet.add(t);
        }
      }
      if (imageUrls.length >= 4) break;
    }
    if (imageUrls.length >= 4) break;
  }
  return { imageUrls, attributions: [...attributionSet] };
}

/**
 * @param {{ name: string, address?: string, lat?: number|null, lng?: number|null }} opts
 * @returns {Promise<{ imageUrls: string[], attributions: string[], source?: string }>}
 */
export async function resolveGooglePlacePhotos(opts = {}) {
  const key = getGooglePlacesApiKey();
  if (!key) {
    return { imageUrls: [], attributions: [], error: "GOOGLE_PLACES_API_KEY 없음" };
  }

  const name = String(opts.name || "").trim();
  if (!name) return { imageUrls: [], attributions: [] };

  const addr = String(opts.address || "").trim();
  const textQuery = addr ? `${name} ${addr.slice(0, 120)}` : name;
  const lat = Number(opts.lat);
  const lng = Number(opts.lng);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

  const runSearch = async (withBias) => {
    const body = {
      textQuery,
      pageSize: 8,
      regionCode: "KR",
    };
    if (withBias && hasCoords) {
      body.locationBias = {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: 2000,
        },
      };
      body.rankPreference = "DISTANCE";
    }
    const { data } = await axios.post(
      "https://places.googleapis.com/v1/places:searchText",
      body,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask":
            "places.id,places.name,places.displayName,places.location,places.photos",
        },
        timeout: 12000,
      }
    );
    return Array.isArray(data?.places) ? data.places : [];
  };

  try {
    let places = await runSearch(true);
    if (places.length === 0 && hasCoords) {
      places = await runSearch(false);
    }
    if (places.length === 0) {
      return { imageUrls: [], attributions: [] };
    }

    if (hasCoords && places.length > 1) {
      places = [...places].sort((a, b) => {
        const alat = a.location?.latitude;
        const alng = a.location?.longitude;
        const blat = b.location?.latitude;
        const blng = b.location?.longitude;
        if (
          !Number.isFinite(alat) ||
          !Number.isFinite(alng) ||
          !Number.isFinite(blat) ||
          !Number.isFinite(blng)
        ) {
          return 0;
        }
        return haversineKm(lat, lng, alat, alng) - haversineKm(lat, lng, blat, blng);
      });
    }

    let { imageUrls, attributions } = await collectGooglePhotoUrlsFromSearchResults(
      key,
      places,
      6
    );

    if (imageUrls.length === 0 && hasCoords) {
      const wide = await runSearch(false);
      if (wide.length > 0) {
        const second = await collectGooglePhotoUrlsFromSearchResults(key, wide, 6);
        if (second.imageUrls.length > 0) {
          imageUrls = second.imageUrls;
          attributions = second.attributions;
        }
      }
    }

    return { imageUrls, attributions, source: "google_places" };
  } catch (error) {
    const ge = error.response?.data;
    if (isApiKeyServiceBlocked(ge)) {
      try {
        const leg = await fetchGooglePlacePhotosLegacy(
          key,
          textQuery,
          lat,
          lng,
          hasCoords
        );
        if (leg.imageUrls.length > 0) {
          return {
            imageUrls: leg.imageUrls,
            attributions: leg.attributions,
            source: "google_places_legacy",
          };
        }
      } catch {
        /* fall through */
      }
    }
    return { imageUrls: [], attributions: [], error: error.message };
  }
}
