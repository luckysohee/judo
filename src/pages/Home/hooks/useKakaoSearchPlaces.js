import { useCallback, useState } from "react";

/**
 * 검색 화면이 지도에 표시할 카카오 후보 두 종을 한 묶음으로 관리.
 *
 * - `kakaoPlaces`: 검색 결과로 확정된 후보(엔터/검색 제출, 자동완성 픽 결과 누적)
 * - `kakaoTypingPreviewPlaces`: 타이핑 중 노출되는 자동완성 후보(쿼리 미확정)
 *
 * `resetAll()`은 새 검색 시작/취소 시 두 배열을 모두 비우기 위한 helper.
 */
export function useKakaoSearchPlaces() {
  const [kakaoPlaces, setKakaoPlaces] = useState([]);
  const [kakaoTypingPreviewPlaces, setKakaoTypingPreviewPlaces] = useState([]);

  const resetAll = useCallback(() => {
    setKakaoPlaces([]);
    setKakaoTypingPreviewPlaces([]);
  }, []);

  return {
    kakaoPlaces,
    setKakaoPlaces,
    kakaoTypingPreviewPlaces,
    setKakaoTypingPreviewPlaces,
    resetAll,
  };
}
