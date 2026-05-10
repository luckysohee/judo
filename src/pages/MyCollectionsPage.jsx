import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  createCollection,
  fetchMyCollections,
} from "../api/collections";

/**
 * 로그인 사용자의 컬렉션 목록 + 새 컬렉션 만들기(최소 폼).
 */
export default function MyCollectionsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [listLoading, setListLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [listError, setListError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const reloadList = useCallback(async () => {
    setListError("");
    try {
      const rows = await fetchMyCollections();
      setItems(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.error("MyCollectionsPage fetch:", e);
      setListError(e?.message || "목록을 불러오지 못했습니다.");
      setItems([]);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return undefined;
    if (!user?.id) {
      navigate("/", { replace: true });
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setListLoading(true);
      await reloadList();
      if (!cancelled) setListLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id, navigate, reloadList]);

  const onCreate = async (e) => {
    e.preventDefault();
    setCreateError("");
    setCreating(true);
    try {
      const { data, error } = await createCollection({
        title,
        description: description.trim() || null,
        visibility,
      });
      if (error) {
        setCreateError(error.message || "생성에 실패했습니다.");
        return;
      }
      if (data?.id) {
        navigate(`/my-collections/${data.id}`);
      } else {
        await reloadList();
        setTitle("");
        setDescription("");
        setVisibility("public");
      }
    } finally {
      setCreating(false);
    }
  };

  if (authLoading || !user?.id) {
    return (
      <div style={styles.page}>
        <div style={styles.center}>불러오는 중…</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <button type="button" onClick={() => navigate(-1)} style={styles.btnGhost}>
          ← 뒤로
        </button>
        <h1 style={styles.title}>내 컬렉션</h1>
      </div>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>새 컬렉션</h2>
        <form onSubmit={onCreate} style={styles.form}>
          <label style={styles.label}>
            제목 <span style={styles.req}>*</span>
            <input
              type="text"
              value={title}
              onChange={(ev) => setTitle(ev.target.value)}
              placeholder="예: 연남 데이트 코스"
              style={styles.input}
              maxLength={120}
              required
            />
          </label>
          <label style={styles.label}>
            설명
            <textarea
              value={description}
              onChange={(ev) => setDescription(ev.target.value)}
              placeholder="선택"
              style={{ ...styles.input, minHeight: 72, resize: "vertical" }}
              rows={3}
              maxLength={2000}
            />
          </label>
          <label style={styles.label}>
            공개 범위
            <select
              value={visibility}
              onChange={(ev) => setVisibility(ev.target.value)}
              style={styles.input}
            >
              <option value="public">공개</option>
              <option value="private">비공개</option>
            </select>
          </label>
          {createError ? (
            <div style={styles.errBox}>{createError}</div>
          ) : null}
          <button
            type="submit"
            disabled={creating || !title.trim()}
            style={styles.btnPrimary}
          >
            {creating ? "만드는 중…" : "만들기"}
          </button>
        </form>
      </section>

      <section style={{ ...styles.card, marginTop: 16 }}>
        <h2 style={styles.sectionTitle}>목록</h2>
        {listLoading ? (
          <div style={styles.muted}>불러오는 중…</div>
        ) : listError ? (
          <div style={styles.errBox}>{listError}</div>
        ) : items.length === 0 ? (
          <div style={styles.muted}>아직 컬렉션이 없습니다.</div>
        ) : (
          <ul style={styles.ul}>
            {items.map((c) => (
              <li key={c.id} style={styles.li}>
                <div style={styles.liMain}>
                  <div style={styles.liTitle}>{c.title || "(제목 없음)"}</div>
                  <div style={styles.liMeta}>
                    {c.visibility === "private" ? "비공개" : "공개"} · 장소{" "}
                    {Number(c.place_count) || 0}
                  </div>
                </div>
                <div style={styles.liActions}>
                  <Link to={`/collection/${c.id}`} style={styles.linkBtn}>
                    보기
                  </Link>
                  <Link to={`/my-collections/${c.id}`} style={styles.linkBtnStrong}>
                    편집
                  </Link>
                </div>
              </li>
            ))}
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
  topBar: { marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 800, margin: "12px 0 0", color: "#fff" },
  card: {
    background: "#1a1a1a",
    border: "1px solid #262626",
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: { fontSize: 15, fontWeight: 700, margin: "0 0 12px", color: "#fff" },
  form: { display: "flex", flexDirection: "column", gap: 12 },
  label: { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "#bdbdbd" },
  req: { color: "#e74c3c" },
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
    justifyContent: "space-between",
    gap: 12,
    padding: 12,
    borderRadius: 10,
    border: "1px solid #333",
    background: "#141414",
  },
  liMain: { flex: 1, minWidth: 0 },
  liTitle: { fontWeight: 700, fontSize: 15, color: "#fff" },
  liMeta: { fontSize: 12, color: "#888", marginTop: 4 },
  liActions: { display: "flex", gap: 8, flexShrink: 0 },
  linkBtn: {
    fontSize: 13,
    fontWeight: 700,
    color: "#9ad3a4",
    textDecoration: "none",
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid rgba(46,204,113,0.35)",
  },
  linkBtnStrong: {
    fontSize: 13,
    fontWeight: 700,
    color: "#fff",
    textDecoration: "none",
    padding: "6px 10px",
    borderRadius: 8,
    background: "rgba(46,204,113,0.2)",
    border: "1px solid rgba(46,204,113,0.5)",
  },
};
