import { useEffect, useMemo, useState } from "react";
import {
  fetchUserSearchTasteSignals,
  searchSignalsHaveEnough,
} from "../utils/userSearchTasteSignals";
import { fetchPickedCuratorPlaces } from "../utils/pickedCuratorPlaces";

const EMPTY = {
  searchSignals: null,
  pickedPlaceIds: new Set(),
  pickedPlaceInfo: new Map(),
};

/**
 * 로그인 사용자 본인의 검색 이력 신호 + 픽한 큐레이터 장소를 한 번 로드.
 * (HomeTodayTasteSuggest 개인 맞춤 추천용 — 본인 데이터만, RLS 보호)
 *
 * @param {{ userId?: string|null, authLoading?: boolean, enabled?: boolean }} opts
 */
export function usePersonalTasteSignals({ userId, authLoading = false, enabled = true }) {
  const [state, setState] = useState(EMPTY);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    const uid = String(userId || "").trim();
    if (!uid || !enabled) {
      setState(EMPTY);
      return;
    }

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [searchSignals, picked] = await Promise.all([
          fetchUserSearchTasteSignals(uid),
          fetchPickedCuratorPlaces(uid),
        ]);
        if (cancelled) return;
        setState({
          searchSignals,
          pickedPlaceIds: picked.placeIds,
          pickedPlaceInfo: picked.placeIdToCurator,
        });
      } catch (e) {
        if (!cancelled) {
          if (import.meta.env?.DEV) {
            console.warn("[usePersonalTasteSignals]", e?.message || e);
          }
          setState(EMPTY);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, authLoading, enabled]);

  const hasPersonalSignals = useMemo(() => {
    return (
      searchSignalsHaveEnough(state.searchSignals) ||
      (state.pickedPlaceIds && state.pickedPlaceIds.size > 0)
    );
  }, [state]);

  return {
    searchSignals: state.searchSignals,
    pickedPlaceIds: state.pickedPlaceIds,
    pickedPlaceInfo: state.pickedPlaceInfo,
    hasPersonalSignals,
    loading,
  };
}
