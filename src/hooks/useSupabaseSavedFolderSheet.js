import { useCallback, useEffect, useState } from "react";

import { supabase } from "../lib/supabase";
import {
  deleteOwnCustomSystemFolder,
  insertSystemFolderRow,
  selectSystemFoldersOrdered,
  updateOwnCustomSystemFolder,
} from "../utils/systemFoldersSupabase";
import {
  mapSavedPlaceRowForFolderSheet,
  SAVED_FOLDER_SHEET_FALLBACKS,
} from "../utils/mapSavedPlaceRowForFolderSheet";

/**
 * 홈 「내 저장」·`/saved` 공통 — system_folders + user_saved_places.
 * @param {string | null | undefined} userId
 */
export function useSupabaseSavedFolderSheet(userId) {
  const uid = String(userId || "").trim();
  const [folders, setFolders] = useState([]);
  const [savedPlacesByFolder, setSavedPlacesByFolder] = useState({});
  const [loading, setLoading] = useState(Boolean(uid));
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!uid) {
      setFolders([]);
      setSavedPlacesByFolder({});
      setLoading(false);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data: sfRows, error: sfErr } =
        await selectSystemFoldersOrdered(supabase, uid);
      if (sfErr) console.warn("system_folders:", sfErr.message);

      const { data: savedRows, error: savErr } = await supabase
        .from("user_saved_places")
        .select(
          `
          id,
          place_id,
          places ( id, name, address, lat, lng, kakao_place_id ),
          user_saved_place_folders ( folder_key )
        `
        )
        .eq("user_id", uid);

      if (savErr) {
        setError(savErr.message || "저장 목록을 불러오지 못했습니다.");
        setFolders([]);
        setSavedPlacesByFolder({});
        return;
      }

      const defs = sfRows?.length ? sfRows : SAVED_FOLDER_SHEET_FALLBACKS;
      const nextFolders = defs.map((f) => ({
        id: String(f.key),
        key: String(f.key),
        name: f.name,
        color: f.color,
        icon: f.icon,
      }));
      const nextMap = {};
      for (const f of nextFolders) nextMap[f.id] = [];

      for (const row of savedRows || []) {
        const place = mapSavedPlaceRowForFolderSheet(row);
        if (!place) continue;
        const links = row.user_saved_place_folders;
        if (!Array.isArray(links)) continue;
        for (const link of links) {
          const k = String(link?.folder_key || "").trim();
          if (!k) continue;
          if (!nextMap[k]) nextMap[k] = [];
          if (!nextMap[k].some((p) => p.id === place.id)) {
            nextMap[k].push(place);
          }
        }
      }

      setFolders(nextFolders);
      setSavedPlacesByFolder(nextMap);
    } catch (e) {
      setError(e?.message || "저장 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const createFolder = useCallback(
    async (name, color) => {
      const n = String(name || "").trim();
      if (!n) throw new Error("폴더 이름을 입력해 주세요.");
      if (!uid) throw new Error("로그인이 필요합니다.");
      const key = `custom_${Date.now()}`;
      const { error: insErr } = await insertSystemFolderRow(supabase, {
        key,
        name: n,
        color: color || "#3498DB",
        icon: "📁",
        description: "",
        sort_order: folders.length + 1,
        is_active: true,
        created_by: uid,
      });
      if (insErr) throw new Error(insErr.message || "폴더를 만들지 못했습니다.");
      await reload();
    },
    [uid, folders.length, reload]
  );

  const updateFolder = useCallback(
    async (folderId, { name, color }) => {
      const key = String(folderId || "").trim();
      const { error: updErr } = await updateOwnCustomSystemFolder(supabase, key, {
        name,
        color,
      });
      if (updErr) throw new Error(updErr.message || "폴더를 수정하지 못했습니다.");
      await reload();
    },
    [reload]
  );

  const deleteFolder = useCallback(
    async (folderId) => {
      const key = String(folderId || "").trim();
      if (!/^custom_/u.test(key)) {
        throw new Error("기본 폴더는 삭제할 수 없습니다.");
      }
      if (!uid) throw new Error("로그인이 필요합니다.");
      const { error: delErr } = await deleteOwnCustomSystemFolder(
        supabase,
        uid,
        key
      );
      if (delErr) throw new Error(delErr.message || "폴더를 삭제하지 못했습니다.");
      await reload();
    },
    [uid, reload]
  );

  return {
    folders,
    savedPlacesByFolder,
    loading,
    error,
    reload,
    createFolder,
    updateFolder,
    deleteFolder,
  };
}
