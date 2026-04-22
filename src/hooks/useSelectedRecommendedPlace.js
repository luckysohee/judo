import { useCallback, useState } from "react";

export function useSelectedRecommendedPlace() {
  const [selectedRecommendedPlace, setSelectedRecommendedPlaceState] =
    useState(null);
  const [matchedMapPlace, setMatchedMapPlaceState] = useState(null);

  const openRecommendedPlace = useCallback((place, matchedPlace) => {
    setSelectedRecommendedPlaceState(place ?? null);
    setMatchedMapPlaceState(matchedPlace ?? null);
  }, []);

  const closeRecommendedPlaceDetail = useCallback(() => {
    setSelectedRecommendedPlaceState(null);
    setMatchedMapPlaceState(null);
  }, []);

  const setSelectedRecommendedPlace = useCallback((place) => {
    setSelectedRecommendedPlaceState(place ?? null);
    setMatchedMapPlaceState(null);
  }, []);

  return {
    selectedRecommendedPlace,
    matchedMapPlace,
    setSelectedRecommendedPlace,
    openRecommendedPlace,
    closeRecommendedPlaceDetail,
  };
}
