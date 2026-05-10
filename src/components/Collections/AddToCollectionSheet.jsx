import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useToast } from "../Toast/ToastProvider";
import {
  addPlaceToCollection,
  createCollection,
  fetchMyCollections,
} from "../../api/collections";
import { ensurePlaceUuidForPick } from "../../utils/resolvePlaceUuidForPick";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * "컬렉션에 추가" 바텀시트.
 *
 * - 내 컬렉션 목록(`fetchMyCollections`) 을 불러와 클릭 시 `addPlaceToCollection` 호출.
 * - 카카오 장소처럼 `places.id` UUID 가 없는 행은 `ensurePlaceUuidForPick` 로 places 행을 확보한 뒤 추가
 *   (픽 버튼이 같은 헬퍼를 쓰므로 동일한 places 행에 자연스럽게 매핑된다).
 * - 컬렉션이 0개면 인라인 "새 컬렉션 만들기" 미니 폼 노출.
 *
 * @param {{ place: object, onClose: () => void }} props
 */
export default function AddToCollectionSheet({ place, onClose }) {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [resolvedPlaceUuid, setResolvedPlaceUuid] = useState(null);
  const [resolvedError, setResolvedError] = useState("");

  const [creating, setCreating] = useState(false);
  const [showInlineCreate, setShowInlineCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createVisibility, setCreateVisibility] = useState("public");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const rows = await fetchMyCollections();
        if (cancelled) return;
        setItems(Array.isArray(rows) ? rows : []);
        if (Array.isArray(rows) && rows.length === 0) {
          setShowInlineCreate(true);
        }
      } catch (e) {
        if (cancelled) return;
        console.error("AddToCollectionSheet load:", e);
        setLoadError(e?.message || "컬렉션 목록을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setResolvedError("");
      setResolvedPlaceUuid(null);
      try {
        const uid = await ensurePlaceUuidForPick(place, {
          createIfMissing: true,
        });
        if (cancelled) return;
        if (uid && UUID_RE.test(uid)) {
          setResolvedPlaceUuid(uid);
        } else {
          setResolvedError(
            "이 장소를 DB와 매칭할 수 없어요. (places.id 미확보)",
          );
        }
      } catch (e) {
        if (cancelled) return;
        console.error("AddToCollectionSheet resolve uuid:", e);
        setResolvedError(e?.message || "장소 ID 확인에 실패했습니다.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [place]);

  const placeName =
    String(place?.name || place?.place_name || "이 장소").trim() || "이 장소";

  const handlePick = useCallback(
    async (collection) => {
      if (!collection?.id || busyId) return;
      if (!resolvedPlaceUuid) {
        showToast(
          resolvedError || "장소 ID 확인 중입니다. 잠시 후 다시 시도해주세요.",
          "error",
          3000,
        );
        return;
      }
      setBusyId(collection.id);
      try {
        const { error } = await addPlaceToCollection(
          collection.id,
          resolvedPlaceUuid,
          null,
        );
        if (error) {
          const msg = error.message || String(error);
          if (
            error.code === "23505" ||
            /duplicate|unique/i.test(msg)
          ) {
            showToast("이미 이 컬렉션에 있어요.", "info", 2500);
          } else {
            showToast(msg || "추가에 실패했어요.", "error", 3000);
          }
          return;
        }
        showToast(`「${collection.title || "컬렉션"}」에 담았어요.`, "success", 2500);
        onClose?.();
      } finally {
        setBusyId(null);
      }
    },
    [busyId, resolvedPlaceUuid, resolvedError, showToast, onClose],
  );

  const handleInlineCreate = useCallback(
    async (e) => {
      e.preventDefault();
      const t = createTitle.trim();
      if (!t || creating) return;
      setCreating(true);
      try {
        const { data, error } = await createCollection({
          title: t,
          description: null,
          visibility: createVisibility,
        });
        if (error || !data?.id) {
          showToast(error?.message || "컬렉션 생성에 실패했어요.", "error", 3000);
          return;
        }
        setItems((prev) => [
          { ...data, place_count: 0 },
          ...prev,
        ]);
        setCreateTitle("");
        setShowInlineCreate(false);
        await handlePick(data);
      } finally {
        setCreating(false);
      }
    },
    [createTitle, createVisibility, creating, showToast, handlePick],
  );

  const sheet = (
    <div style={styles.overlay} onClick={onClose}>
      <div
        style={styles.sheet}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="컬렉션에 추가"
      >
        <div style={styles.handle} aria-hidden="true" />
        <div style={styles.header}>
          <div style={styles.headerTitle}>컬렉션에 추가</div>
          <button type="button" onClick={onClose} style={styles.closeBtn}>
            닫기
          </button>
        </div>
        <div style={styles.subTitle}>
          <strong>{placeName}</strong> 을(를) 어디에 담을까요?
        </div>

        {resolvedError ? (
          <div style={styles.warnBox}>{resolvedError}</div>
        ) : null}

        <div style={styles.body}>
          {loading ? (
            <div style={styles.muted}>불러오는 중…</div>
          ) : loadError ? (
            <div style={styles.errBox}>{loadError}</div>
          ) : items.length === 0 ? (
            <div style={styles.muted}>아직 만든 컬렉션이 없어요.</div>
          ) : (
            <ul style={styles.ul}>
              {items.map((c) => {
                const busy = busyId === c.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => handlePick(c)}
                      disabled={busy || !resolvedPlaceUuid}
                      style={{
                        ...styles.row,
                        ...(busy ? styles.rowBusy : null),
                      }}
                    >
                      <span style={styles.rowMain}>
                        <span style={styles.rowTitle}>
                          {c.title || "(제목 없음)"}
                        </span>
                        <span style={styles.rowMeta}>
                          {c.visibility === "private" ? "비공개" : "공개"} ·
                          장소 {Number(c.place_count) || 0}
                        </span>
                      </span>
                      <span style={styles.rowAction}>
                        {busy ? "추가 중…" : "담기"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div style={styles.divider} />

        {showInlineCreate ? (
          <form onSubmit={handleInlineCreate} style={styles.createForm}>
            <input
              type="text"
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              placeholder="새 컬렉션 제목"
              style={styles.input}
              maxLength={120}
              autoFocus
            />
            <select
              value={createVisibility}
              onChange={(e) => setCreateVisibility(e.target.value)}
              style={{ ...styles.input, maxWidth: 110 }}
            >
              <option value="public">공개</option>
              <option value="private">비공개</option>
            </select>
            <button
              type="submit"
              disabled={creating || !createTitle.trim() || !resolvedPlaceUuid}
              style={styles.primaryBtn}
            >
              {creating ? "만드는 중…" : "만들고 담기"}
            </button>
          </form>
        ) : (
          <div style={styles.bottomActions}>
            <button
              type="button"
              onClick={() => setShowInlineCreate(true)}
              style={styles.ghostBtn}
            >
              + 새 컬렉션 만들기
            </button>
            <button
              type="button"
              onClick={() => {
                onClose?.();
                navigate("/my-collections");
              }}
              style={styles.linkBtn}
            >
              관리 페이지로 →
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(sheet, document.body);
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 600,
    background: "rgba(0,0,0,0.55)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  sheet: {
    width: "100%",
    maxWidth: 560,
    background: "#141414",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: "10px 16px 18px",
    color: "#eee",
    boxShadow: "0 -10px 30px rgba(0,0,0,0.5)",
    maxHeight: "82vh",
    display: "flex",
    flexDirection: "column",
  },
  handle: {
    width: 36,
    height: 4,
    background: "#3a3a3a",
    borderRadius: 999,
    margin: "4px auto 10px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: "#fff",
  },
  closeBtn: {
    border: "1px solid #3a3a3a",
    background: "#1a1a1a",
    color: "#fff",
    borderRadius: 999,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  subTitle: {
    marginTop: 8,
    fontSize: 13,
    color: "#bdbdbd",
    lineHeight: 1.4,
  },
  body: {
    marginTop: 12,
    overflowY: "auto",
    flex: 1,
    minHeight: 60,
  },
  ul: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  row: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    background: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: 12,
    padding: "12px 14px",
    color: "#fff",
    cursor: "pointer",
    textAlign: "left",
  },
  rowBusy: {
    opacity: 0.6,
    cursor: "default",
  },
  rowMain: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#fff",
  },
  rowMeta: {
    fontSize: 12,
    color: "#888",
  },
  rowAction: {
    fontSize: 12,
    fontWeight: 800,
    color: "#9ad3a4",
    flexShrink: 0,
  },
  muted: {
    fontSize: 13,
    color: "#888",
    padding: "10px 2px",
  },
  errBox: {
    fontSize: 13,
    color: "#e74c3c",
    padding: "8px 10px",
    background: "rgba(231,76,60,0.08)",
    borderRadius: 8,
    border: "1px solid rgba(231,76,60,0.35)",
  },
  warnBox: {
    marginTop: 8,
    fontSize: 12,
    color: "#f1c40f",
    padding: "6px 10px",
    background: "rgba(241,196,15,0.08)",
    borderRadius: 8,
    border: "1px solid rgba(241,196,15,0.4)",
  },
  divider: {
    height: 1,
    background: "#262626",
    margin: "12px 0 10px",
  },
  bottomActions: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
  },
  ghostBtn: {
    border: "1px dashed rgba(46,204,113,0.55)",
    background: "transparent",
    color: "#9ad3a4",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  },
  linkBtn: {
    border: "none",
    background: "transparent",
    color: "#bdbdbd",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  createForm: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  input: {
    flex: 1,
    minWidth: 140,
    borderRadius: 10,
    border: "1px solid #444",
    background: "#0f0f0f",
    color: "#fff",
    padding: "10px 12px",
    fontSize: 13,
  },
  primaryBtn: {
    border: "none",
    background: "linear-gradient(145deg,#2ecc71,#27ae60)",
    color: "#fff",
    borderRadius: 10,
    padding: "10px 14px",
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
  },
};
