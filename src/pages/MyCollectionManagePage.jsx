import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  addPlaceToCollection,
  fetchCollectionDetail,
  removePlaceFromCollection,
  reorderCollectionPlaces,
  updateCollection,
} from "../api/collections";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function placeLabel(row) {
  const p = row?.places || {};
  return (
    String(p.name || p.display_name || "이름 없음").trim() || "이름 없음"
  );
}

/**
 * 내 컬렉션 1건 편집 — 메타 수정, 장소 순서(위/아래), 장소 삭제.
 */
export default function MyCollectionManagePage() {
  const { collectionId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [collection, setCollection] = useState(null);

  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editVisibility, setEditVisibility] = useState("public");
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaError, setMetaError] = useState("");

  const [placeBusy, setPlaceBusy] = useState(false);
  const [placeError, setPlaceError] = useState("");

  const [newPlaceId, setNewPlaceId] = useState("");
  const [addingPlace, setAddingPlace] = useState(false);

  const cid = collectionId ? String(collectionId).trim() : "";

  const reload = useCallback(async () => {
    if (!UUID_RE.test(cid)) {
      setLoadError("잘못된 컬렉션 ID입니다.");
      setCollection(null);
      setForbidden(false);
      return;
    }
    setLoadError("");
    try {
      const row = await fetchCollectionDetail(cid);
      if (!row) {
        setCollection(null);
        setForbidden(true);
        return;
      }
      if (user?.id && row.user_id !== user.id) {
        setCollection(null);
        setForbidden(true);
        return;
      }
      setForbidden(false);
      setCollection(row);
      setEditTitle(row.title || "");
      setEditDescription(
        typeof row.description === "string" ? row.description : "",
      );
      setEditVisibility(row.visibility === "private" ? "private" : "public");
    } catch (e) {
      console.error("MyCollectionManagePage load:", e);
      setLoadError(e?.message || "불러오지 못했습니다.");
      setCollection(null);
    }
  }, [cid, user?.id]);

  useEffect(() => {
    if (authLoading) return undefined;
    if (!user?.id) {
      navigate("/", { replace: true });
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      await reload();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id, navigate, reload]);

  const orderedRows = useMemo(() => {
    if (!collection || !Array.isArray(collection.collection_places)) return [];
    return [...collection.collection_places];
  }, [collection]);

  const orderedPlaceIds = useMemo(
    () => orderedRows.map((r) => String(r.place_id || "").trim()).filter(Boolean),
    [orderedRows],
  );

  const onSaveMeta = async (e) => {
    e.preventDefault();
    if (!UUID_RE.test(cid)) return;
    setMetaError("");
    setSavingMeta(true);
    try {
      const { data, error } = await updateCollection(cid, {
        title: editTitle,
        description: editDescription.trim() || null,
        visibility: editVisibility,
      });
      if (error) {
        setMetaError(error.message || "저장에 실패했습니다.");
        return;
      }
      if (!data) {
        setMetaError("수정 권한이 없거나 컬렉션을 찾을 수 없습니다.");
        return;
      }
      await reload();
    } finally {
      setSavingMeta(false);
    }
  };

  const applyReorder = async (nextIds) => {
    if (!UUID_RE.test(cid) || nextIds.length === 0) return;
    setPlaceError("");
    setPlaceBusy(true);
    try {
      const { error } = await reorderCollectionPlaces(cid, nextIds);
      if (error) {
        setPlaceError(error.message || "순서 변경에 실패했습니다.");
        return;
      }
      await reload();
    } finally {
      setPlaceBusy(false);
    }
  };

  const moveUp = async (index) => {
    if (index <= 0 || placeBusy || addingPlace) return;
    const next = [...orderedPlaceIds];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    await applyReorder(next);
  };

  const moveDown = async (index) => {
    if (index >= orderedPlaceIds.length - 1 || placeBusy || addingPlace) return;
    const next = [...orderedPlaceIds];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    await applyReorder(next);
  };

  const removePlace = async (placeId) => {
    if (!UUID_RE.test(cid) || !UUID_RE.test(placeId) || placeBusy || addingPlace) return;
    if (!window.confirm("이 장소를 컬렉션에서 제거할까요?")) return;
    setPlaceError("");
    setPlaceBusy(true);
    try {
      const { data, error } = await removePlaceFromCollection(cid, placeId);
      if (error) {
        setPlaceError(error.message || "삭제에 실패했습니다.");
        return;
      }
      if (!data) {
        setPlaceError("삭제할 행을 찾지 못했습니다.");
        return;
      }
      await reload();
    } finally {
      setPlaceBusy(false);
    }
  };

  const addPlace = async (e) => {
    e.preventDefault();
    const pid = newPlaceId.trim();
    if (!UUID_RE.test(cid) || !UUID_RE.test(pid) || placeBusy || addingPlace) return;
    setPlaceError("");
    setAddingPlace(true);
    try {
      const { data, error } = await addPlaceToCollection(cid, pid, null);
      if (error) {
        const msg = error.message || String(error);
        if (/duplicate|unique|23505/i.test(msg)) {
          setPlaceError("이미 이 컬렉션에 포함된 장소입니다.");
        } else {
          setPlaceError(msg || "추가에 실패했습니다.");
        }
        return;
      }
      if (!data) {
        setPlaceError("추가에 실패했습니다.");
        return;
      }
      setNewPlaceId("");
      await reload();
    } finally {
      setAddingPlace(false);
    }
  };

  if (authLoading || !user?.id) {
    return (
      <div style={styles.page}>
        <div style={styles.center}>불러오는 중…</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.center}>불러오는 중…</div>
      </div>
    );
  }

  if (!UUID_RE.test(cid)) {
    return (
      <div style={styles.page}>
        <button type="button" onClick={() => navigate("/my-collections")} style={styles.btnGhost}>
          ← 목록
        </button>
        <p style={styles.err}>잘못된 주소입니다.</p>
      </div>
    );
  }

  if (forbidden || !collection) {
    return (
      <div style={styles.page}>
        <button type="button" onClick={() => navigate("/my-collections")} style={styles.btnGhost}>
          ← 목록
        </button>
        <p style={styles.err}>
          {loadError || "컬렉션을 찾을 수 없거나 편집 권한이 없습니다."}
        </p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <button type="button" onClick={() => navigate("/my-collections")} style={styles.btnGhost}>
          ← 목록
        </button>
        <Link to={`/collection/${cid}`} style={styles.linkMuted}>
          공개 보기 →
        </Link>
      </div>

      <h1 style={styles.h1}>컬렉션 편집</h1>

      <section style={styles.card}>
        <h2 style={styles.h2}>정보</h2>
        <form onSubmit={onSaveMeta} style={styles.form}>
          <label style={styles.label}>
            제목
            <input
              type="text"
              value={editTitle}
              onChange={(ev) => setEditTitle(ev.target.value)}
              style={styles.input}
              maxLength={120}
              required
            />
          </label>
          <label style={styles.label}>
            설명
            <textarea
              value={editDescription}
              onChange={(ev) => setEditDescription(ev.target.value)}
              style={{ ...styles.input, minHeight: 80, resize: "vertical" }}
              rows={4}
              maxLength={2000}
            />
          </label>
          <label style={styles.label}>
            공개 범위
            <select
              value={editVisibility}
              onChange={(ev) => setEditVisibility(ev.target.value)}
              style={styles.input}
            >
              <option value="public">공개</option>
              <option value="private">비공개</option>
            </select>
          </label>
          {metaError ? <div style={styles.errBox}>{metaError}</div> : null}
          <button type="submit" disabled={savingMeta} style={styles.btnPrimary}>
            {savingMeta ? "저장 중…" : "저장"}
          </button>
        </form>
      </section>

      <section style={{ ...styles.card, marginTop: 16 }}>
        <h2 style={styles.h2}>장소</h2>
        <form onSubmit={addPlace} style={{ ...styles.form, marginBottom: 14 }}>
          <label style={styles.label}>
            장소 추가 (places.id UUID)
            <input
              type="text"
              value={newPlaceId}
              onChange={(ev) => setNewPlaceId(ev.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              style={styles.input}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <button
            type="submit"
            disabled={
              addingPlace ||
              placeBusy ||
              !UUID_RE.test(newPlaceId.trim())
            }
            style={styles.btnSecondary}
          >
            {addingPlace ? "추가 중…" : "추가"}
          </button>
        </form>
        <p style={styles.hint}>
          순서는 아래 ↑↓ 로 바꿉니다. 같은 장소는 한 번만 담을 수 있습니다.
        </p>
        {placeError ? <div style={styles.errBox}>{placeError}</div> : null}
        {orderedRows.length === 0 ? (
          <div style={styles.muted}>아직 담긴 장소가 없습니다.</div>
        ) : (
          <ul style={styles.ul}>
            {orderedRows.map((row, idx) => {
              const pid = String(row.place_id || "").trim();
              return (
                <li key={row.id || `${pid}-${idx}`} style={styles.li}>
                  <div style={styles.liOrder}>{idx + 1}</div>
                  <div style={styles.liBody}>
                    <div style={styles.liTitle}>{placeLabel(row)}</div>
                    {pid ? (
                      <Link to={`/place/${pid}`} style={styles.placeLink}>
                        장소 페이지
                      </Link>
                    ) : null}
                  </div>
                  <div style={styles.liBtns}>
                    <button
                      type="button"
                      disabled={placeBusy || addingPlace || idx === 0}
                      onClick={() => moveUp(idx)}
                      style={styles.iconBtn}
                      aria-label="위로"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={
                        placeBusy || addingPlace || idx === orderedRows.length - 1
                      }
                      onClick={() => moveDown(idx)}
                      style={styles.iconBtn}
                      aria-label="아래로"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      disabled={placeBusy || addingPlace || !UUID_RE.test(pid)}
                      onClick={() => removePlace(pid)}
                      style={styles.dangerBtn}
                    >
                      삭제
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#111",
    color: "#eee",
    padding: 20,
    paddingBottom: 48,
    maxWidth: 560,
    margin: "0 auto",
  },
  center: { padding: 40, textAlign: "center", color: "#888" },
  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  h1: { fontSize: 22, fontWeight: 800, margin: "8px 0 16px", color: "#fff" },
  h2: { fontSize: 15, fontWeight: 700, margin: "0 0 12px", color: "#fff" },
  card: {
    background: "#1a1a1a",
    border: "1px solid #262626",
    borderRadius: 12,
    padding: 16,
  },
  form: { display: "flex", flexDirection: "column", gap: 12 },
  label: { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "#bdbdbd" },
  input: {
    borderRadius: 8,
    border: "1px solid #444",
    background: "#111",
    color: "#fff",
    padding: "10px 12px",
    fontSize: 14,
  },
  btnGhost: {
    border: "1px solid #444",
    background: "#1a1a1a",
    color: "#fff",
    padding: "8px 14px",
    borderRadius: 999,
    fontWeight: 700,
    cursor: "pointer",
  },
  btnPrimary: {
    marginTop: 4,
    border: "none",
    borderRadius: 10,
    background: "linear-gradient(145deg,#2ecc71,#27ae60)",
    color: "#fff",
    padding: "12px 16px",
    fontWeight: 800,
    cursor: "pointer",
  },
  btnSecondary: {
    alignSelf: "flex-start",
    borderRadius: 10,
    border: "1px solid rgba(46,204,113,0.45)",
    background: "rgba(46,204,113,0.12)",
    color: "#9ad3a4",
    padding: "10px 14px",
    fontWeight: 800,
    cursor: "pointer",
  },
  linkMuted: {
    fontSize: 13,
    fontWeight: 700,
    color: "#9ad3a4",
    textDecoration: "none",
  },
  hint: { fontSize: 12, color: "#888", margin: "0 0 12px", lineHeight: 1.45 },
  err: { color: "#e74c3c", marginTop: 16 },
  errBox: {
    fontSize: 13,
    color: "#e74c3c",
    padding: "8px 10px",
    background: "rgba(231,76,60,0.08)",
    borderRadius: 8,
    border: "1px solid rgba(231,76,60,0.35)",
  },
  muted: { fontSize: 13, color: "#888" },
  ul: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 },
  li: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    border: "1px solid #333",
    background: "#141414",
  },
  liOrder: {
    flexShrink: 0,
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "rgba(46,204,113,0.18)",
    border: "1px solid rgba(46,204,113,0.45)",
    color: "#2ecc71",
    fontWeight: 800,
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  liBody: { flex: 1, minWidth: 0 },
  liTitle: { fontWeight: 700, fontSize: 14, color: "#fff" },
  placeLink: {
    display: "inline-block",
    marginTop: 4,
    fontSize: 12,
    color: "#9ad3a4",
  },
  liBtns: { display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 },
  iconBtn: {
    width: 36,
    padding: "4px 0",
    borderRadius: 8,
    border: "1px solid #444",
    background: "#222",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  },
  dangerBtn: {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid rgba(231,76,60,0.45)",
    background: "rgba(231,76,60,0.12)",
    color: "#e74c3c",
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
  },
};
