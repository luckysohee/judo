import { useCallback, useEffect, useState } from "react";

import { supabase } from "../../../lib/supabase";
import { getCustomPlaces } from "../../../utils/customPlacesStorage";
import { getFolders, getSavedPlacesMap } from "../../../utils/storage";

/**
 * 홈: 로컬 폴더·저장 맵·커스텀 장소 + 로그인 시 Supabase `user_saved_places` 묶음.
 *
 * @param {{ user: { id?: string } | null, authLoading: boolean }} args
 */
export function useUserSavedPlacesAndFolders({ user, authLoading }) {
  const [folders, setFolders] = useState(() => getFolders());
  const [savedMap, setSavedMap] = useState(() => getSavedPlacesMap());
  const [customPlaces, setCustomPlaces] = useState(() => getCustomPlaces());
  const [userSavedPlaces, setUserSavedPlaces] = useState({});

  const refreshStorage = useCallback(() => {
    setFolders(getFolders());
    setSavedMap(getSavedPlacesMap());
  }, []);

  const refreshCustomPlaces = useCallback(() => {
    setCustomPlaces(getCustomPlaces());
  }, []);

  const loadUserSavedPlaces = useCallback(async () => {
    const uid = user?.id;
    if (!uid) {
      setUserSavedPlaces({});
      return;
    }

    const { data, error } = await supabase
      .from("user_saved_places")
      .select(
        `
        place_id,
        user_saved_place_folders (
          folder_key,
          system_folders ( name, color, icon )
        )
      `
      )
      .eq("user_id", uid);

    if (error) {
      console.warn("user_saved_places:", error.message);
      setUserSavedPlaces({});
      return;
    }

    const next = {};
    for (const row of data || []) {
      const pid = row.place_id != null ? String(row.place_id).trim() : "";
      if (!pid) continue;

      const links = row.user_saved_place_folders;
      if (!Array.isArray(links) || links.length === 0) continue;

      const list = [];
      const seen = new Set();
      for (const link of links) {
        const key = String(link?.folder_key ?? "").trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const sf = link?.system_folders;
        list.push({
          key,
          name: sf?.name,
          color: sf?.color,
          icon: sf?.icon,
        });
      }

      if (list.length === 0) continue;
      if (next[pid]) {
        const merged = [...next[pid]];
        for (const item of list) {
          if (!merged.some((m) => m.key === item.key)) merged.push(item);
        }
        next[pid] = merged;
      } else {
        next[pid] = list;
      }
    }

    setUserSavedPlaces(next);
  }, [user?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onUpdate = () => {
      refreshStorage();
    };
    window.addEventListener("storage", onUpdate);
    window.addEventListener("judo_storage_updated", onUpdate);
    return () => {
      window.removeEventListener("storage", onUpdate);
      window.removeEventListener("judo_storage_updated", onUpdate);
    };
  }, [refreshStorage]);

  useEffect(() => {
    if (authLoading) return;
    void loadUserSavedPlaces();
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
