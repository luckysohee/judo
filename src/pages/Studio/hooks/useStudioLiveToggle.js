import { useState } from "react";
import { devLog } from "../studioHomeModule.js";

const INITIAL_STATS = {
  followerCount: 0,
  savedByFollowers: 0,
  totalPlaces: 0,
  overlappingPlaces: 0,
  isLive: false,
  notificationSent: false,
};

/**
 * 잔 아카이브 「라이브」 토글과 시작 확인 모달 — 네이티브 confirm 대신 ×·배경·Esc로 취소.
 * `stats`는 라이브 상태(`isLive`, `notificationSent`)와 함께 사용되며, 다른 카운트 필드는
 * 추후 채워 넣기 위한 placeholder다.
 */
export function useStudioLiveToggle() {
  const [stats, setStats] = useState(INITIAL_STATS);
  const [liveStartConfirmOpen, setLiveStartConfirmOpen] = useState(false);

  const endLive = () => {
    setStats((prev) => ({ ...prev, isLive: false, notificationSent: false }));
  };

  const handleLiveStartWithNotification = () => {
    devLog("알림 발송됨");
    setStats((prev) => ({ ...prev, isLive: true, notificationSent: true }));
    setLiveStartConfirmOpen(false);
  };

  const handleLiveStartWithoutNotification = () => {
    setStats((prev) => ({ ...prev, isLive: true, notificationSent: false }));
    setLiveStartConfirmOpen(false);
  };

  return {
    stats,
    liveStartConfirmOpen,
    setLiveStartConfirmOpen,
    endLive,
    handleLiveStartWithNotification,
    handleLiveStartWithoutNotification,
  };
}
