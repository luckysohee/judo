import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useToast } from "../Toast/ToastProvider";
import { addPlaceToCollection } from "../../api/collections";
import { ensurePlaceUuidForPick } from "../../utils/resolvePlaceUuidForPick";
import { searchPlacesForCollectionAdd } from "../../utils/searchPlacesForCollectionAdd";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEBOUNCE_MS = 320;

/**
 * 컬렉션 편집에서 장소를 검색·선택해 추가하는 바텀시트.
 *
 * @param {{
 *   collectionId: string,
 *   existingPlaceIds: string[],
 *   onClose: () => void,
 *   onAdded: () => void | Promise<void>,
 *   setPlaceBusy?: (busy: boolean) => void,
 * }} props
 */
export default function CollectionAddPlaceSearchSheet({
  collectionId,
  existingPlaceIds,
  onClose,
  onAdded,
  setPlaceBusy,
}) {
  const { showToast } = useToast();
  const inputRef = useRef(null);
  const searchSeq = useRef(0);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [dbRows, setDbRows] = useState([]);
  const [kakaoDocs, setKakaoDocs] = useState([]);
  const [searchError, setSearchError] = useState("");
  const [pickingKey, setPickingKey] = useState(null);

  const existingSet = useMemo(
    () =>
      new Set(
        (Array.isArray(existingPlaceIds) ? existingPlaceIds : [])
          .map((id) => String(id ?? "").trim())
          .filter((id) => UUID_RE.test(id)),
      ),
    [existingPlaceIds],
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const el = inputRef.current;
    if (el) {
      const id = window.requestAnimationFrame(() => {
        try {
          el.focus();
        } catch {
          /* ignore */
        }
      });
      return () => window.cancelAnimationFrame(id);
    }
    return undefined;
  }, []);

  useEffect(() => {
    const term = debouncedQuery.replace(/[%_\\]/g, "").trim();
    if (term.length < 2) {
      setDbRows([]);
      setKakaoDocs([]);
      setSearchError("");
      setSearching(false);
      return undefined;
    }

    const seq = ++searchSeq.current;
    let cancelled = false;

    (async () => {
      setSearching(true);
      setSearchError("");
      try {
        const { dbRows: d, kakaoDocs: k } = await searchPlacesForCollectionAdd(
          term,
        );
        if (cancelled || seq !== searchSeq.current) return;
        setDbRows(d);
        setKakaoDocs(k);
      } catch (e) {
        if (cancelled || seq !== searchSeq.current) return;
        console.error("CollectionAddPlaceSearchSheet search:", e);
        setSearchError(e?.message || "검색에 실패했습니다.");
        setDbRows([]);
        setKakaoDocs([]);
      } finally {
        if (!cancelled && seq === searchSeq.current) setSearching(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const performAddToCollection = useCallback(
    async (placeUuid) => {
      const cid = String(collectionId ?? "").trim();
      if (!UUID_RE.test(cid) || !UUID_RE.test(placeUuid)) return false;

      if (existingSet.has(placeUuid)) {
        showToast("이미 추가된 장소예요.", "info", 2500);
        return false;
      }

      const { data, error } = await addPlaceToCollection(cid, placeUuid, null);
      if (error) {
        const msg = error.message || String(error);
        if (
          error.code === "23505" ||
          /duplicate|unique|23505/i.test(msg)
        ) {
          showToast("이미 추가된 장소예요.", "info", 2500);
        } else {
          showToast(msg || "추가에 실패했습니다.", "error", 3000);
        }
        return false;
      }
      if (!data) {
        showToast("추가에 실패했습니다.", "error", 3000);
        return false;
      }
      showToast("컬렉션에 추가했어요.", "success", 2200);
      await onAdded?.();
      onClose?.();
      return true;
    },
    [collectionId, existingSet, onAdded, onClose, showToast],
  );

  const handlePickDb = useCallback(
    async (row) => {
      const id = String(row?.id ?? "").trim();
      const key = `db:${id}`;
      if (!UUID_RE.test(id) || pickingKey) return;
      setPickingKey(key);
      setPlaceBusy?.(true);
      try {
        await performAddToCollection(id);
      } finally {
        setPickingKey(null);
        setPlaceBusy?.(false);
      }
    },
    [performAddToCollection, pickingKey, setPlaceBusy],
  );

  const handlePickKakao = useCallback(
    async (doc) => {
      const kid = String(doc?.id ?? "").trim();
      const key = `kakao:${kid}`;
      if (!kid || !/^\d+$/.test(kid) || pickingKey) return;

      setPickingKey(key);
      setPlaceBusy?.(true);
      try {
        const uuid = await ensurePlaceUuidForPick(doc, {
          createIfMissing: true,
        });
        if (!uuid || !UUID_RE.test(uuid)) {
          showToast(
            "이 장소를 저장할 수 없어요. 잠시 후 다시 시도해 주세요.",
            "error",
            3000,
          );
          return;
        }
        await performAddToCollection(uuid);
      } catch (e) {
        console.error("CollectionAddPlaceSearchSheet pick kakao:", e);
        showToast(e?.message || "장소 추가에 실패했습니다.", "error", 3000);
      } finally {
        setPickingKey(null);
        setPlaceBusy?.(false);
      }
    },
    [performAddToCollection, pickingKey, setPlaceBusy, showToast],
  );

  const sheet = (
    <div style={styles.overlay} onClick={onClose}>
      <div
        style={styles.sheet}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="장소 검색하여 추가"
      >
        <div style={styles.handle} aria-hidden="true" />
        <div style={styles.header}>
          <div style={styles.headerTitle}>장소 추가</div>
          <button type="button" onClick={onClose} style={styles.closeBtn}>
            닫기
          </button>
        </div>

        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="장소 이름·주소 검색 (2글자 이상)"
          style={styles.searchInput}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
        />

        <div style={styles.body}>
          {debouncedQuery.replace(/[%_\\]/g, "").trim().length < 2 ? (
            <div style={styles.muted}>검색어를 2글자 이상 입력해 주세요.</div>
          ) : searching ? (
            <div style={styles.muted}>검색 중…</div>
          ) : searchError ? (
            <div style={styles.errBox}>{searchError}</div>
          ) : dbRows.length === 0 && kakaoDocs.length === 0 ? (
            <div style={styles.muted}>검색 결과가 없습니다.</div>
          ) : (
            <ul style={styles.ul}>
              {dbRows.map((row) => {
                const id = String(row.id ?? "").trim();
                const key = `db:${id}`;
                const busy = pickingKey === key;
                const name = String(row.name || "이름 없음").trim() || "이름 없음";
                const addr =
                  String(row.address || "").trim() || "주소 정보 없음";
                const cat = String(row.category || "").trim() || "—";
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => handlePickDb(row)}
                      disabled={busy || !UUID_RE.test(id)}
                      style={{
                        ...styles.row,
                        ...(busy ? styles.rowBusy : null),
                      }}
                    >
                      <span style={styles.rowMain}>
                        <span style={styles.rowTitle}>{name}</span>
                        <span style={styles.rowAddr}>{addr}</span>
                        <span style={styles.rowMeta}>{cat}</span>
                      </span>
                      <span style={styles.rowAction}>
                        {busy ? "추가 중…" : "담기"}
                      </span>
                    </button>
                  </li>
                );
              })}
              {kakaoDocs.map((doc) => {
                const kid = String(doc.id ?? "").trim();
                const key = `kakao:${kid}`;
                const busy = pickingKey === key;
                const name =
                  String(doc.place_name || "이름 없음").trim() || "이름 없음";
                const addr =
                  String(doc.road_address_name || doc.address_name || "").trim() ||
                  "주소 정보 없음";
                const cat =
                  String(doc.category_name || "").trim() || "—";
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => handlePickKakao(doc)}
                      disabled={busy}
                      style={{
                        ...styles.row,
                        ...(busy ? styles.rowBusy : null),
                      }}
                    >
                      <span style={styles.rowMain}>
                        <span style={styles.rowTitle}>{name}</span>
                        <span style={styles.rowAddr}>{addr}</span>
                        <span style={styles.rowMeta}>{cat}</span>
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
    maxHeight: "85vh",
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
  searchInput: {
    marginTop: 12,
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 10,
    border: "1px solid #444",
    background: "#0f0f0f",
    color: "#fff",
    padding: "10px 12px",
    fontSize: 14,
  },
  body: {
    marginTop: 12,
    overflowY: "auto",
    flex: 1,
    minHeight: 80,
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
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#fff",
  },
  rowAddr: {
    fontSize: 12,
    color: "#aaa",
    lineHeight: 1.35,
  },
  rowMeta: {
    fontSize: 11,
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
};
