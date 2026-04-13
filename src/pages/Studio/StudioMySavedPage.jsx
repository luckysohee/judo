import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import {
  selectSystemFoldersOrdered,
  insertSystemFolderRow,
} from "../../utils/systemFoldersSupabase";

/** DB 조회 실패 시 SaveModal과 동일 키·표시 (현재 시드 7개 — system_folders 추가 시 자동 반영) */
const FALLBACK_SYSTEM_FOLDERS = [
  { key: "after_party", name: "2차", color: "#FF8C42", icon: "🍺", sort_order: 1 },
  { key: "date", name: "데이트", color: "#FF69B4", icon: "💘", sort_order: 2 },
  { key: "hangover", name: "해장", color: "#87CEEB", icon: "🥣", sort_order: 3 },
  { key: "solo", name: "혼술", color: "#9B59B6", icon: "👤", sort_order: 4 },
  { key: "group", name: "회식", color: "#F1C40F", icon: "👥", sort_order: 5 },
  { key: "must_go", name: "찐맛집", color: "#27AE60", icon: "🌟", sort_order: 6 },
  { key: "terrace", name: "야외/뷰", color: "#5DADE2", icon: "🌅", sort_order: 7 },
];

function savedPlaceLabel(item) {
  if (!item || typeof item !== "object") return "이름 없음";
  const row = item.places ?? item.place;
  const name =
    row?.name ??
    row?.place_name ??
    row?.title ??
    item.place_name ??
    item.name ??
    "";
  return String(name || "").trim() || "이름 없음";
}

function savedPlaceId(item) {
  if (!item || typeof item !== "object") return null;
  const row = item.places;
  if (row && row.id != null) return String(row.id);
  if (item.place_id != null) return String(item.place_id);
  return null;
}

export default function StudioMySavedPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [folderDefs, setFolderDefs] = useState(FALLBACK_SYSTEM_FOLDERS);
  const [byFolder, setByFolder] = useState(() => ({}));
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState(null);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderSaving, setFolderSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setLoadError("");
    try {
      const { data: sfRows, error: sfErr } =
        await selectSystemFoldersOrdered(supabase);

      if (!sfErr && sfRows?.length) {
        setFolderDefs(sfRows);
      } else if (sfErr) {
        console.warn("system_folders:", sfErr.message);
      }

      const { data: savedRows, error: savErr } = await supabase
        .from("user_saved_places")
        .select(
          `
          id,
          place_id,
          places ( id, name, address ),
          user_saved_place_folders ( folder_key )
        `
        )
        .eq("user_id", user.id);

      if (savErr) {
        setLoadError(savErr.message || "저장 목록을 불러오지 못했습니다.");
        setByFolder({});
        return;
      }

      const defList = sfRows?.length ? sfRows : FALLBACK_SYSTEM_FOLDERS;
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

      setByFolder(next);
    } catch (e) {
      setLoadError(e?.message || "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/", { replace: true });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (user?.id) load();
  }, [user?.id, load]);

  const folders = useMemo(() => {
    return [...folderDefs].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );
  }, [folderDefs]);

  const selectedPlaces = selectedKey ? byFolder[selectedKey] || [] : [];

  const handleAddNewFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    const key = `custom_${Date.now()}`;
    const maxSo = Math.max(
      0,
      ...folders.map((f) => Number(f.sort_order) || 0)
    );
    setFolderSaving(true);
    try {
      if (!user?.id) {
        alert("로그인이 필요합니다.");
        return;
      }
      const { error } = await insertSystemFolderRow(supabase, {
        key,
        name,
        color: "#3498DB",
        icon: "📁",
        description: "",
        sort_order: maxSo + 1,
        is_active: true,
        created_by: user.id,
      });
      if (error) {
        alert(
          error.message ||
            "폴더를 추가하지 못했습니다. Supabase에 INSERT 정책이 있는지 확인하세요."
        );
        return;
      }
      setNewFolderName("");
      setShowNewFolderInput(false);
      await load();
    } finally {
      setFolderSaving(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div style={styles.skeleton}>
        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px" }}>
          불러오는 중…
        </span>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <button
          type="button"
          onClick={() => navigate("/studio")}
          style={styles.backBtn}
        >
          ← 스튜디오
        </button>
        <h1 style={styles.title}>내 저장</h1>
        <p style={styles.sub}>
          폴더만 보입니다. 잔 올리기·잔 리스트는 스튜디오에서 관리하세요.
        </p>
      </header>

      {loadError ? (
        <div style={styles.error}>{loadError}</div>
      ) : null}

      {loading ? (
        <div style={styles.muted}>폴더 불러오는 중…</div>
      ) : (
        <>
          <div style={styles.grid}>
            {folders.map((f) => {
              const list = byFolder[f.key] || [];
              const n = list.length;
              const active = selectedKey === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() =>
                    setSelectedKey((k) => (k === f.key ? null : f.key))
                  }
                  style={{
                    ...styles.folderButton,
                    border: `2px solid ${f.color}`,
                    backgroundColor: active
                      ? f.color
                      : "rgba(255, 255, 255, 0.05)",
                    ...(active ? styles.folderButtonActive : {}),
                  }}
                >
                  <span style={styles.folderIcon}>{f.icon}</span>
                  <span
                    style={{
                      ...styles.folderName,
                      color: active ? "#fff" : f.color,
                    }}
                  >
                    {f.name}
                  </span>
                  <span
                    style={{
                      ...styles.folderCount,
                      color: active ? "rgba(255,255,255,0.92)" : f.color,
                    }}
                  >
                    {n}
                  </span>
                </button>
              );
            })}
            {!showNewFolderInput ? (
              <button
                type="button"
                onClick={() => setShowNewFolderInput(true)}
                style={styles.addFolderButton}
              >
                <span style={styles.addFolderIcon}>+</span>
                <span style={styles.addFolderText}>새 폴더</span>
              </button>
            ) : null}
          </div>
          {showNewFolderInput ? (
            <div style={styles.newFolderInputBelow}>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="폴더 이름"
                style={styles.newFolderInput}
                autoFocus
                onKeyDown={(e) =>
                  e.key === "Enter" && !folderSaving && handleAddNewFolder()
                }
              />
              <div style={styles.newFolderInputActions}>
                <button
                  type="button"
                  disabled={folderSaving}
                  onClick={handleAddNewFolder}
                  style={styles.newFolderOk}
                >
                  {folderSaving ? "…" : "✓"}
                </button>
                <button
                  type="button"
                  disabled={folderSaving}
                  onClick={() => {
                    setShowNewFolderInput(false);
                    setNewFolderName("");
                  }}
                  style={styles.newFolderCancel}
                >
                  ✕
                </button>
              </div>
            </div>
          ) : null}

          {selectedKey ? (
            <section style={styles.detail}>
              <div style={styles.detailHead}>
                <span style={{ fontWeight: 800, color: "#fff" }}>
                  {folders.find((x) => x.key === selectedKey)?.name}
                </span>
                <span style={{ color: "rgba(255,255,255,0.45)", fontSize: "12px" }}>
                  {selectedPlaces.length}곳
                </span>
              </div>
              {selectedPlaces.length === 0 ? (
                <p style={styles.muted}>이 폴더에 저장된 장소가 없어요.</p>
              ) : (
                <ul style={styles.placeList}>
                  {selectedPlaces.map((row) => {
                    const pid = savedPlaceId(row);
                    const label = savedPlaceLabel(row);
                    return (
                      <li key={row.id || `${selectedKey}-${label}`}>
                        {pid ? (
                          <button
                            type="button"
                            style={styles.placeLink}
                            onClick={() => navigate(`/place/${pid}`)}
                          >
                            {label}
                          </button>
                        ) : (
                          <span style={styles.placeStatic}>{label}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100dvh",
    backgroundColor: "#1a1a1a",
    color: "#eee",
    padding: "12px 14px 24px",
    maxWidth: "360px",
    margin: "0 auto",
    boxSizing: "border-box",
  },
  skeleton: {
    minHeight: "100dvh",
    backgroundColor: "#1a1a1a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  header: { marginBottom: "14px" },
  backBtn: {
    border: "none",
    background: "#333",
    color: "#fff",
    padding: "6px 12px",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    marginBottom: "8px",
  },
  title: {
    margin: "0 0 4px 0",
    fontSize: "16px",
    fontWeight: 800,
    letterSpacing: "-0.02em",
  },
  sub: {
    margin: 0,
    fontSize: "11px",
    lineHeight: 1.4,
    color: "rgba(255,255,255,0.45)",
  },
  error: {
    color: "#e74c3c",
    fontSize: "12px",
    marginBottom: "10px",
  },
  muted: {
    color: "rgba(255,255,255,0.45)",
    fontSize: "12px",
  },
  /** SaveModal `folderGrid2x4` 와 동일 레이아웃 */
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gridTemplateRows: "repeat(2, auto)",
    gap: "10px",
    alignItems: "stretch",
    width: "100%",
    maxWidth: "320px",
    marginLeft: "auto",
    marginRight: "auto",
    justifyItems: "stretch",
  },
  /** SaveModal `folderButton` 와 동일 치수·질감 */
  folderButton: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 6px",
    borderRadius: "8px",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    cursor: "pointer",
    transition: "all 0.2s ease",
    minHeight: "55px",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
    position: "relative",
    zIndex: 10,
    boxSizing: "border-box",
    minWidth: 0,
    width: "100%",
    font: "inherit",
    textAlign: "center",
  },
  folderButtonActive: {
    transform: "scale(0.95)",
  },
  folderIcon: {
    fontSize: "16px",
    marginBottom: "3px",
    lineHeight: 1,
  },
  folderName: {
    fontSize: "11px",
    fontWeight: "bold",
    textAlign: "center",
    lineHeight: 1.2,
  },
  folderCount: {
    fontSize: "10px",
    fontWeight: 700,
    marginTop: "2px",
    opacity: 0.95,
    lineHeight: 1,
  },
  detail: {
    marginTop: "16px",
    paddingTop: "14px",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    maxWidth: "320px",
    marginLeft: "auto",
    marginRight: "auto",
  },
  detailHead: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: "8px",
  },
  placeList: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  placeLink: {
    width: "100%",
    textAlign: "left",
    border: "none",
    background: "rgba(255, 255, 255, 0.05)",
    color: "#7eb8ff",
    padding: "8px 10px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
  placeStatic: {
    display: "block",
    padding: "8px 10px",
    borderRadius: "8px",
    background: "rgba(255, 255, 255, 0.05)",
    fontSize: "13px",
    color: "rgba(255,255,255,0.85)",
  },
  /** SaveModal `addFolderButton` / `newFolderInputBelow` 동일 */
  addFolderButton: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 6px",
    border: "2px dashed rgba(255, 255, 255, 0.3)",
    borderRadius: "8px",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    cursor: "pointer",
    transition: "all 0.2s ease",
    minHeight: "55px",
    color: "rgba(255, 255, 255, 0.6)",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
    position: "relative",
    zIndex: 10,
    boxSizing: "border-box",
    minWidth: 0,
    width: "100%",
    font: "inherit",
  },
  addFolderIcon: {
    fontSize: "16px",
    marginBottom: "3px",
    lineHeight: 1,
  },
  addFolderText: {
    fontSize: "11px",
    fontWeight: "bold",
    textAlign: "center",
  },
  newFolderInputBelow: {
    marginTop: "10px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "10px",
    border: "2px solid #3498DB",
    borderRadius: "8px",
    backgroundColor: "#1a1a1a",
    boxSizing: "border-box",
    width: "100%",
    maxWidth: "320px",
    marginLeft: "auto",
    marginRight: "auto",
  },
  newFolderInput: {
    padding: "6px 8px",
    border: "1px solid #333",
    borderRadius: "4px",
    backgroundColor: "#252525",
    color: "#ffffff",
    fontSize: "12px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  newFolderInputActions: {
    display: "flex",
    gap: "6px",
    justifyContent: "flex-end",
  },
  newFolderOk: {
    backgroundColor: "#3498DB",
    color: "white",
    border: "none",
    borderRadius: "4px",
    padding: "4px 10px",
    fontSize: "12px",
    cursor: "pointer",
  },
  newFolderCancel: {
    backgroundColor: "#e74c3c",
    color: "white",
    border: "none",
    borderRadius: "4px",
    padding: "4px 10px",
    fontSize: "12px",
    cursor: "pointer",
  },
};
