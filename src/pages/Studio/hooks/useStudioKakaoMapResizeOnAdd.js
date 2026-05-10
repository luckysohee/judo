import { useEffect } from "react";
import { devLog } from "../studioHomeModule.js";

/**
 * 「잔 올리기」 탭으로 들어오면 카카오맵을 강제로 리사이즈한다.
 * 다른 탭에서 가려져 있는 동안 컨테이너 크기가 0으로 잡히는 문제 방지용.
 */
export function useStudioKakaoMapResizeOnAdd({ mapRef, activeSection }) {
  useEffect(() => {
    if (mapRef.current && activeSection === "add") {
      const timer = setTimeout(() => {
        if (mapRef.current) {
          if (window.kakao && window.kakao.maps) {
            try {
              window.kakao.maps.event.trigger(mapRef.current, "resize");
            } catch (error) {
              devLog("지도 리사이즈 실패:", error);
            }
          }
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [activeSection, mapRef]);
}
