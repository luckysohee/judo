import { useEffect, useState } from "react";
import { fetchUserPickedPlaces } from "../../../api/placePicks";
import { devWarn } from "../studioHomeModule.js";

/**
 * 스튜디오 「잔 픽」 탭 진입 시 한 번 `place_picks`를 로드한다.
 * curator_places 와는 무관한 별도 테이블이며, 다른 탭에서는 호출하지 않는다.
 *
 * @param {{ user: { id?: string } | null | undefined, activeSection: string }} args
 */
export function useStudioPlacePicks({ user, activeSection }) {
  const [studioPlacePicks, setStudioPlacePicks] = useState([]);
  const [studioPlacePicksLoading, setStudioPlacePicksLoading] = useState(false);

  useEffect(() => {
    if (activeSection !== "picks" || !user?.id) return undefined;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 탭 진입 시 로딩 플래그를 동기로 켜는 의도
    setStudioPlacePicksLoading(true);
    fetchUserPickedPlaces(user.id, { limit: 200 })
      .then((rows) => {
        if (!cancelled) setStudioPlacePicks(Array.isArray(rows) ? rows : []);
      })
      .catch((e) => {
        devWarn("StudioHome place_picks:", e);
        if (!cancelled) setStudioPlacePicks([]);
      })
      .finally(() => {
        if (!cancelled) setStudioPlacePicksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSection, user?.id]);

  return {
    studioPlacePicks,
    studioPlacePicksLoading,
    setStudioPlacePicks,
  };
}
