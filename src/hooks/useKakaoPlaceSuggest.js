import { useEffect, useRef, useState } from "react";
import { searchKakaoKeywordViaProxy } from "../utils/kakaoAPIProxy";
import {
  filterKakaoKeywordRowsForMealIntent,
  isMealFocusedKakaoQuery,
} from "../utils/filterKakaoKeywordResultsForMealIntent";

function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 1000);
}

function resolveOrigin(userLocation, mapRef) {
  if (
    userLocation?.lat != null &&
    userLocation?.lng != null &&
    Number.isFinite(Number(userLocation.lat)) &&
    Number.isFinite(Number(userLocation.lng))
  ) {
    return { lat: Number(userLocation.lat), lng: Number(userLocation.lng) };
  }
  const c = mapRef?.current?.getCenter?.();
  if (c && typeof c === "object") {
    const lat = typeof c.getLat === "function" ? c.getLat() : Number(c.lat);
    const lng = typeof c.getLng === "function" ? c.getLng() : Number(c.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  return null;
}

async function fetchKakaoRows(keyword, origin) {
  const mealFocusedQuery = isMealFocusedKakaoQuery(keyword);

  const processRawRows = (raw) => {
    let rows = Array.isArray(raw) ? raw : [];
    if (origin) {
      rows = rows
        .map((place) => {
          const plat = parseFloat(place.y);
          const plng = parseFloat(place.x);
          const dist =
            Number.isFinite(plat) && Number.isFinite(plng)
              ? haversineDistanceMeters(
                  origin.lat,
                  origin.lng,
                  plat,
                  plng
                )
              : null;
          return dist != null ? { ...place, distance: dist } : place;
        })
        .sort(
          (a, b) =>
            (Number(a.distance) || 1e12) - (Number(b.distance) || 1e12)
        );
    }
    rows = filterKakaoKeywordRowsForMealIntent(keyword, rows);
    return rows.slice(0, 15);
  };

  const fetchViaProxy = async () => {
    try {
      const { documents } = await searchKakaoKeywordViaProxy({
        query: keyword,
        size: 15,
        ...(origin
          ? { x: origin.lng, y: origin.lat, radius: 20000 }
          : {}),
      });
      return processRawRows(documents);
    } catch (e) {
      console.warn("useKakaoPlaceSuggest proxy:", e);
      return [];
    }
  };

  if (!window.kakao?.maps?.services) {
    return fetchViaProxy();
  }

  return new Promise((resolve) => {
    const ps = new window.kakao.maps.services.Places();
    const searchOptions = {
      ...(mealFocusedQuery ? { category_group_code: "FD6" } : {}),
      size: mealFocusedQuery ? 30 : 15,
      ...(origin
        ? {
            location: new window.kakao.maps.LatLng(origin.lat, origin.lng),
            radius: 20000,
            sort: window.kakao.maps.services.SortBy.DISTANCE,
          }
        : {}),
    };

    ps.keywordSearch(
      keyword,
      (data, status) => {
        const ok =
          status === window.kakao.maps.services.Status.OK &&
          Array.isArray(data) &&
          data.length > 0;
        if (ok) {
          resolve(processRawRows(data));
          return;
        }
        void fetchViaProxy().then(resolve);
      },
      searchOptions
    );
  });
}

/**
 * 홈 검색 오버레이용 카카오 장소 제안 (SearchBar와 동일 소스).
 *
 * @param {{
 *   query: string,
 *   enabled?: boolean,
 *   userLocation?: { lat: number, lng: number } | null,
 *   mapRef?: import('react').RefObject<any>,
 *   debounceMs?: number,
 * }} args
 */
export function useKakaoPlaceSuggest({
  query,
  enabled = true,
  userLocation = null,
  mapRef = null,
  debounceMs = 300,
}) {
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const tokenRef = useRef(0);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      setResults([]);
      setIsLoading(false);
      return undefined;
    }

    const keyword = String(query || "").trim();
    if (!keyword) {
      setResults([]);
      setIsLoading(false);
      return undefined;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    setIsLoading(true);

    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      const token = ++tokenRef.current;
      const origin = resolveOrigin(userLocation, mapRef);
      void fetchKakaoRows(keyword, origin).then((rows) => {
        if (token !== tokenRef.current) return;
        setResults(rows);
        setIsLoading(false);
      });
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [query, enabled, userLocation, mapRef, debounceMs]);

  return {
    results,
    isLoading,
    hasResults: results.length > 0,
  };
}
