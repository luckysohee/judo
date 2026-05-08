import { useCallback, useState } from "react";

/**
 * 검색 라이프사이클 부속 메타 상태 4개를 하나로 묶음.
 *
 * - `searchLoadingLabel`: 검색 진행 중 노출되는 라벨 (예: "유저 찾는 중…")
 * - `searchExpandUX`: 무결과/빈약한 결과 시 띄우는 「조건 완화 제안」 패널 데이터
 * - `yajangFallbackBanner`: 야장 검색 0건 → 5km 큐레이터 폴백 안내 배너
 * - `searchDistanceOrigin`: 추천 리스트 거리·도보 표시용 기준 좌표
 *
 * `resetAll()`은 새 검색 진입/취소 시 4개 모두 한 번에 초기화하기 위함.
 */
export function useSearchStatusMeta() {
  const [searchLoadingLabel, setSearchLoadingLabel] = useState("");
  const [searchExpandUX, setSearchExpandUX] = useState(null);
  const [yajangFallbackBanner, setYajangFallbackBanner] = useState(null);
  const [searchDistanceOrigin, setSearchDistanceOrigin] = useState(null);

  const resetAll = useCallback(() => {
    setSearchLoadingLabel("");
    setSearchExpandUX(null);
    setYajangFallbackBanner(null);
    setSearchDistanceOrigin(null);
  }, []);

  return {
    searchLoadingLabel,
    setSearchLoadingLabel,
    searchExpandUX,
    setSearchExpandUX,
    yajangFallbackBanner,
    setYajangFallbackBanner,
    searchDistanceOrigin,
    setSearchDistanceOrigin,
    resetAll,
  };
}
