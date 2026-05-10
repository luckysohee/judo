import { useEffect } from "react";
import { supabase } from "../../../lib/supabase";

/**
 * 「잔 리스트 → 수정」으로 잔 올리기 탭에 들어왔을 때, 해당 장소가 어느 저장 폴더에
 * 들어있는지 `user_saved_place_folders`에서 읽어 폼의 선택된 폴더 키 셋을 동기화한다.
 *
 * 큐레이터인 경우 user_id == auth uid 행과 user_id == curators.id 행이 분리되어 있을
 * 수 있어, OR 조건으로 둘 다 조회한다.
 */
export function useStudioEditingPlaceFolderSync({
  user,
  editingPlaceId,
  setAddPlaceSelectedFolders,
}) {
  useEffect(() => {
    if (!user?.id || !editingPlaceId) return;
    let cancelled = false;
    (async () => {
      const { data: curRow } = await supabase
        .from("curators")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      const curPk = curRow?.id ?? null;
      let req = supabase
        .from("user_saved_places")
        .select(`id, user_saved_place_folders ( folder_key )`)
        .eq("place_id", editingPlaceId);
      if (curPk && String(curPk) !== String(user.id)) {
        req = req.or(`user_id.eq.${user.id},user_id.eq.${curPk}`);
      } else {
        req = req.eq("user_id", user.id);
      }
      const { data: rows, error } = await req;
      if (cancelled) return;
      if (error || !rows?.length) {
        setAddPlaceSelectedFolders([]);
        return;
      }
      const keySet = new Set();
      for (const row of rows) {
        for (const l of row.user_saved_place_folders || []) {
          if (l.folder_key) keySet.add(l.folder_key);
        }
      }
      setAddPlaceSelectedFolders([...keySet]);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, editingPlaceId, setAddPlaceSelectedFolders]);
}
