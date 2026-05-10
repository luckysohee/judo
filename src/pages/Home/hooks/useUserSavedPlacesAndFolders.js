import { useCallback, useEffect, useState } from "react";

import { supabase } from "../../../lib/supabase";
import { getFolders, getSavedPlacesMap } from "../../../utils/storage";

/**
 * Home의 저장/폴더·커스텀 장소·사용자 저장 폴더 매핑을 한 묶음으로 관리.
 *
 * - localStorage 기반 폴더/저장 맵을 mount + `judo_storage_updated` 이벤트 시 갱신
 * - 더 이상 사용하지 않는 `judo_custom_places` 키 정리(빈 배열 유지)
 * - 인증 로딩 종료 후 user 변화에 맞춰 supabase에서 사용자 저장 폴더 매핑 fetch
 *
 * @param {{ user: any, authLoading: boolean }} args
 */
export function useUserSavedPlacesAndFolders({ user, authLoading }) {
  const [folders, setFolders] = useState([]);
  const [savedMap, setSavedMap] = useState({});
  const [customPlaces, setCustomPlaces] = useState([]);
  const [userSavedPlaces, setUserSavedPlaces] = useState({});

  const refreshStorage = useCallback(() => {
    setFolders(getFolders());
    setSavedMap(getSavedPlacesMap());
  }, []);

  const refreshCustomPlaces = useCallback(() => {
    localStorage.removeItem("judo_custom_places");
    setCustomPlaces([]);
  }, []);

  const userId = user?.id ?? null;

  const loadUserSavedPlaces = useCallback(async () => {
    try {
      if (!userId) {
        setUserSavedPlaces({});
        return;
      }
      const { data, error } = await supabase
        .from("user_saved_places")
        .select(
          `
          place_id,
          user_saved_place_folders(
            folder_key,
            system_folders(
              name,
              color,
              icon
            )
          )
        `,
        )
        .eq("user_id", userId);

      if (error) {
        console.error("❌ 사용자 저장 장소 로드 실패:", error);
        setUserSavedPlaces({});
        return;
      }

      const folderMap = {};
      data?.forEach((item) => {
        const f =
          item.user_saved_place_folders?.map((upf) => ({
            key: upf.folder_key,
            name: upf.system_folders?.name,
            color: upf.system_folders?.color,
            icon: upf.system_folders?.icon,
          })) || [];
        folderMap[item.place_id] = f;
      });

      setUserSavedPlaces(folderMap);
      console.log("✅ 사용자 저장 장소 로드:", folderMap);
    } catch (e) {
      console.error("❌ 사용자 저장 장소 로드 중 오류:", e);
      setUserSavedPlaces({});
    }
  }, [userId]);

  /** mount: localStorage 기반 폴더/저장맵 + 더미 커스텀 장소 정리 */
  useEffect(() => {
    /** mount-only 동기 초기화 — setState 캐스케이드는 의도됨 */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshStorage();
    refreshCustomPlaces();
  }, [refreshStorage, refreshCustomPlaces]);

  /** 저장/폴더 변경 외부 알림 → 재계산 */
  useEffect(() => {
    const onUpdate = () => refreshStorage();
    window.addEventListener("judo_storage_updated", onUpdate);
    return () => window.removeEventListener("judo_storage_updated", onUpdate);
  }, [refreshStorage]);

  /** 인증 로딩 종료 + user 변화 시 supabase에서 사용자 저장 폴더 매핑 fetch */
  useEffect(() => {
    if (authLoading) return;
    /** supabase는 외부 system이므로 setState in effect 의도됨 */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUserSavedPlaces();
  }, [authLoading, loadUserSavedPlaces]);

  return {
    folders,
    savedMap,
    customPlaces,
    userSavedPlaces,
    refreshStorage,
    refreshCustomPlaces,
    loadUserSavedPlaces,
  };
}
