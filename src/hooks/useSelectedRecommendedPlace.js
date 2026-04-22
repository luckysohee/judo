import { useCallback, useState } from "react";

export function useSelectedRecommendedPlace() {
  const [selectedRecommendedPlace, setSelectedRecommendedPlace] =
    useState(null);

  const closeRecommendedPlaceDetail = useCallback(() => {
    setSelectedRecommendedPlace(null);
  }, []);

  return {
    selectedRecommendedPlace,
    setSelectedRecommendedPlace,
    closeRecommendedPlaceDetail,
  };
}
