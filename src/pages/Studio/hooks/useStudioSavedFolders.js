import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "../../../lib/supabase";
import {
  deleteOwnCustomSystemFolder,
  insertSystemFolderRow,
  selectSystemFoldersOrdered,
  updateOwnCustomSystemFolder,
} from "../../../utils/systemFoldersSupabase";
import { upsertUserSavedPlaceFolders } from "../../../utils/upsertUserSavedPlaceFolders";
import { fetchCuratorPlacesMergedWithPlaces } from "../../../utils/supabasePlaces";
import {
  dedupeCuratorPlacesByPlaceId,
  devWarn,
  FALLBACK_SAVED_FOLDER_DEFS,
  isDeletableUserSavedFolderKey,
  mapCuratorJoinRowsToMyPlaces,
  studioSavedPlaceId,
} from "../studioHomeModule.js";

/**
 * 스튜디오 잔 리스트 / 잔 올리기에서 쓰는 카카오 「저장」 폴더(system_folders + user_saved_places).
 *
 * @param {{ user: object | null, activeSection: string, setMyPlaces: function, setAddPlaceSelectedFolders: function, getCuratorRowId: () => unknown }} args
 * `getCuratorRowId`는 부모에서 `curators` 행 PK를 ref로 동기화해 두고 읽도록 한다
 * (큐레이터 프로필 state가 이 훅보다 아래에 선언되는 경우).
 */
export function useStudioSavedFolders({
  user,
  activeSection,
  setMyPlaces,
  setAddPlaceSelectedFolders,
  getCuratorRowId,
}) {
  const prevActiveSectionForListFolderRef = useRef(null);

  const [savedFolderDefs, setSavedFolderDefs] = useState(FALLBACK_SAVED_FOLDER_DEFS);
  const [savedByFolder, setSavedByFolder] = useState(() => ({}));
  const [savedFoldersLoadError, setSavedFoldersLoadError] = useState("");
  const [savedFoldersLoading, setSavedFoldersLoading] = useState(false);
  const [savedFolderKey, setSavedFolderKey] = useState(null);
  const [savedShowNewFolder, setSavedShowNewFolder] = useState(false);
  const [savedNewFolderName, setSavedNewFolderName] = useState("");
  const [savedFolderSaving, setSavedFolderSaving] = useState(false);
  const [savedFoldersEditMode, setSavedFoldersEditMode] = useState(false);
  const [savedFolderMetaDeletingKey, setSavedFolderMetaDeletingKey] =
    useState(null);
  const [savedFolderEditName, setSavedFolderEditName] = useState("");
  const [savedFolderEditColor, setSavedFolderEditColor] = useState("#3498DB");
  const [savedFolderEditIcon, setSavedFolderEditIcon] = useState("📁");
  const [savedFolderMetaSaving, setSavedFolderMetaSaving] = useState(false);
  const [savedFoldersListExpanded, setSavedFoldersListExpanded] =
    useState(false);

  const loadSavedFolders = useCallback(async () => {
    if (!user?.id) return;
    setSavedFoldersLoading(true);
    setSavedFoldersLoadError("");
    try {
      const sfPromise = selectSystemFoldersOrdered(supabase, user.id);
      const savPromise = supabase
        .from("user_saved_places")
        .select(
          `
          id,
          place_id,
          places ( id, name, address ),
          user_saved_place_folders ( folder_key )
        `,
        )
        .eq("user_id", user.id);

      const [sfResult, savResult] = await Promise.all([sfPromise, savPromise]);

      const { data: sfRows, error: sfErr } = sfResult;
      const { data: savedRows, error: savErr } = savResult;

      if (!sfErr && sfRows?.length) {
        setSavedFolderDefs(sfRows);
      } else if (sfErr) {
        devWarn("system_folders:", sfErr.message);
      }

      if (savErr) {
        setSavedFoldersLoadError(
          savErr.message || "저장 폴더 목록을 불러오지 못했습니다.",
        );
        setSavedByFolder({});
        return;
      }

      const defList = sfRows?.length ? sfRows : FALLBACK_SAVED_FOLDER_DEFS;
      const next = {};
      defList.forEach((f) => {
        next[f.key] = [];
      });

      (savedRows || []).forEach((row) => {
        const links = row.user_saved_place_folders;
        if (!links?.length) return;
        links.forEach((l) => {
          const k = l?.folder_key;
          if (!k) return;
          if (!next[k]) next[k] = [];
          next[k].push(row);
        });
      });

      setSavedByFolder(next);
    } catch (e) {
      setSavedFoldersLoadError(e?.message || "오류가 발생했습니다.");
    } finally {
      setSavedFoldersLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (
      (activeSection === "list" || activeSection === "add") &&
      user?.id
    ) {
      void loadSavedFolders();
    }
  }, [activeSection, user?.id, loadSavedFolders]);

  useEffect(() => {
    const prev = prevActiveSectionForListFolderRef.current;
    if (
      activeSection === "list" &&
      prev != null &&
      prev !== "list"
    ) {
      setSavedFoldersListExpanded(false);
    }
    prevActiveSectionForListFolderRef.current = activeSection;
  }, [activeSection]);

  const sortedSavedFolders = useMemo(() => {
    return [...savedFolderDefs].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );
  }, [savedFolderDefs]);

  const hasDeletableSavedFolders = useMemo(
    () => sortedSavedFolders.some((f) => isDeletableUserSavedFolderKey(f.key)),
    [sortedSavedFolders],
  );

  useEffect(() => {
    if (!savedFoldersEditMode || !savedFolderKey) return;
    if (!isDeletableUserSavedFolderKey(savedFolderKey)) return;
    const f = savedFolderDefs.find((x) => x.key === savedFolderKey);
    if (!f) return;
    setSavedFolderEditName(String(f.name || "").trim());
    setSavedFolderEditColor(f.color || "#3498DB");
    setSavedFolderEditIcon(String(f.icon || "📁").trim() || "📁");
  }, [savedFoldersEditMode, savedFolderKey, savedFolderDefs]);

  const reloadStudioMyPlaces = useCallback(async () => {
    if (!user?.id) return;
    let data = [];
    try {
      data = await fetchCuratorPlacesMergedWithPlaces(supabase, user.id);
    } catch (e) {
      devWarn("reloadStudioMyPlaces:", e?.message || e);
      return;
    }
    const deduped = dedupeCuratorPlacesByPlaceId(data);
    setMyPlaces(mapCuratorJoinRowsToMyPlaces(deduped));
  }, [user?.id, setMyPlaces]);

  const handleDeleteSavedFolder = async (key) => {
    if (!user?.id) return;
    if (!isDeletableUserSavedFolderKey(key)) return;
    if (
      !window.confirm(
        "이 폴더에 넣어 둔 잔은 내 저장·스튜디오 잔 리스트(추천)에서 모두 사라집니다. 다른 폴더에도 같이 넣었어도 해당 저장·추천이 지워집니다. 폴더 목록에서도 사라집니다. 계속할까요?",
      )
    ) {
      return;
    }
    setSavedFolderMetaDeletingKey(key);
    try {
      const folderItems = savedByFolder[key] || [];
      const hintSavedIds = folderItems.map((r) => r.id).filter(Boolean);
      const hintPlaceIds = folderItems
        .map((r) => {
          if (r?.place_id != null) return String(r.place_id);
          if (r?.places?.id != null) return String(r.places.id);
          return null;
        })
        .filter(Boolean);
      const hint = {
        savedPlaceIds: hintSavedIds,
        placeIds: hintPlaceIds,
        curatorRowId: getCuratorRowId?.() ?? null,
      };

      const { error } = await deleteOwnCustomSystemFolder(
        supabase,
        user.id,
        key,
        hint,
      );
      if (error) {
        alert(error.message || "삭제하지 못했습니다.");
        return;
      }
      setSavedFolderKey((k) => (k === key ? null : k));
      setAddPlaceSelectedFolders((prev) => prev.filter((fk) => fk !== key));
      await loadSavedFolders();
      await reloadStudioMyPlaces();
    } finally {
      setSavedFolderMetaDeletingKey(null);
    }
  };

  const handleSaveSavedFolderMeta = useCallback(async () => {
    if (!savedFolderKey || !isDeletableUserSavedFolderKey(savedFolderKey)) return;
    const name = savedFolderEditName.trim();
    if (!name) {
      alert("폴더 이름을 입력해주세요.");
      return;
    }
    setSavedFolderMetaSaving(true);
    try {
      const { error } = await updateOwnCustomSystemFolder(supabase, savedFolderKey, {
        name,
        color: savedFolderEditColor,
        icon: savedFolderEditIcon.trim() || "📁",
      });
      if (error) {
        alert(error.message || "폴더를 수정하지 못했습니다.");
        return;
      }
      await loadSavedFolders();
    } finally {
      setSavedFolderMetaSaving(false);
    }
  }, [
    savedFolderKey,
    savedFolderEditName,
    savedFolderEditColor,
    savedFolderEditIcon,
    loadSavedFolders,
  ]);

  const savedFolderPlaceIdSet = useMemo(() => {
    if (!savedFolderKey) return null;
    const rows = savedByFolder[savedFolderKey] || [];
    const ids = new Set();
    for (const row of rows) {
      const id = studioSavedPlaceId(row);
      if (id) ids.add(String(id));
    }
    return ids;
  }, [savedFolderKey, savedByFolder]);

  const insertCustomSystemFolderRow = useCallback(
    async (trimmedName) => {
      if (!trimmedName) return { ok: false };
      if (!user?.id) {
        return {
          ok: false,
          error: { message: "로그인이 필요합니다." },
        };
      }
      const key = `custom_${Date.now()}`;
      const maxSo = Math.max(
        0,
        ...savedFolderDefs.map((f) => Number(f.sort_order) || 0),
      );
      const { error } = await insertSystemFolderRow(supabase, {
        key,
        name: trimmedName,
        color: "#3498DB",
        icon: "📁",
        description: "",
        sort_order: maxSo + 1,
        is_active: true,
        created_by: user.id,
      });
      if (error) {
        return { ok: false, error };
      }
      await loadSavedFolders();
      return { ok: true, key };
    },
    [savedFolderDefs, loadSavedFolders, user?.id],
  );

  const persistUserSavedPlaceFolders = useCallback(
    (placeUuid, folderKeys) =>
      upsertUserSavedPlaceFolders(supabase, {
        placeId: placeUuid,
        folderKeys,
        firstSavedFrom: "studio",
        authUser: user,
      }),
    [user],
  );

  const handleAddSavedFolder = async () => {
    const name = savedNewFolderName.trim();
    if (!name) return;
    setSavedFolderSaving(true);
    try {
      const res = await insertCustomSystemFolderRow(name);
      if (!res.ok) {
        if (res.error) {
          alert(
            res.error.message ||
              "폴더를 추가하지 못했습니다. Supabase에 INSERT 정책이 있는지 확인하세요.",
          );
        }
        return;
      }
      setSavedNewFolderName("");
      setSavedShowNewFolder(false);
    } finally {
      setSavedFolderSaving(false);
    }
  };

  return {
    savedFolderDefs,
    savedByFolder,
    savedFoldersLoadError,
    savedFoldersLoading,
    savedFolderKey,
    setSavedFolderKey,
    savedShowNewFolder,
    setSavedShowNewFolder,
    savedNewFolderName,
    setSavedNewFolderName,
    savedFolderSaving,
    savedFoldersEditMode,
    setSavedFoldersEditMode,
    savedFolderMetaDeletingKey,
    savedFolderEditName,
    setSavedFolderEditName,
    savedFolderEditColor,
    setSavedFolderEditColor,
    savedFolderEditIcon,
    setSavedFolderEditIcon,
    savedFolderMetaSaving,
    savedFoldersListExpanded,
    setSavedFoldersListExpanded,
    loadSavedFolders,
    sortedSavedFolders,
    hasDeletableSavedFolders,
    handleDeleteSavedFolder,
    handleSaveSavedFolderMeta,
    savedFolderPlaceIdSet,
    insertCustomSystemFolderRow,
    persistUserSavedPlaceFolders,
    handleAddSavedFolder,
  };
}
