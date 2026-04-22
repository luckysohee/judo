import { useEffect } from "react";

function callPanTo(mapApi, lat, lng) {
  if (!mapApi || typeof mapApi.panTo !== "function") return;
  if (mapApi.panTo.length >= 2) {
    mapApi.panTo(lat, lng);
    return;
  }
  mapApi.panTo({ lat, lng });
}

/** `mapRef`는 MapView ref( imperative `panTo(lat,lng)` ) 또는 `{ panTo({lat,lng}) }` */
export function useMapCenterOnFirstHighlighted(mapRef, highlightedPlaces) {
  useEffect(() => {
    const mapApi = mapRef?.current;
    if (!mapApi || !Array.isArray(highlightedPlaces) || highlightedPlaces.length === 0)
      return;
    const p = highlightedPlaces[0];
    const lat = Number(p?.lat);
    const lng = Number(p?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    callPanTo(mapApi, lat, lng);
  }, [mapRef, highlightedPlaces]);
}
