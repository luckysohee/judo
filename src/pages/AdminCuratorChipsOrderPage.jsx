import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { adminTopNavButtonStyle } from "../styles/adminTopNavButton";
import { GRADE_LABELS_KO } from "../utils/curatorGradeRules";

function curatorLabel(row) {
  const handle = String(row?.slug || row?.username || "").trim();
  const nick = String(row?.name || row?.display_name || "").trim();
  if (handle && nick && handle.toLowerCase() !== nick.toLowerCase()) {
    return { primary: `@${handle}`, secondary: nick };
  }
  if (handle) return { primary: `@${handle}`, secondary: "" };
  if (nick) return { primary: nick, secondary: "" };
  const uid = String(row?.user_id || "").trim();
  return { primary: uid ? uid.slice(0, 8) : "큐레이터", secondary: "" };
}

function sortByChipOrder(rows) {
  return [...(Array.isArray(rows) ? rows : [])].sort((a, b) => {
    const ao = Number(a?.home_chip_order);
    const bo = Number(b?.home_chip_order);
    const aOrd = Number.isFinite(ao) ? ao : 0;
    const bOrd = Number.isFinite(bo) ? bo : 0;
    if (aOrd !== bOrd) return aOrd - bOrd;
    const at = new Date(a?.created_at || 0).getTime();
    const bt = new Date(b?.created_at || 0).getTime();
    return bt - at;
  });
}

const styles = {
  page: {
    height: "100dvh",
    maxHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    backgroundColor: "#111111",
    color: "#ffffff",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  header: {
    flexShrink: 0,
    zIndex: 10,
    backgroundColor: "#111111",
    padding: "8px 12px",
    borderBottom: "1px solid #222222",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: "17px",
    fontWeight: 800,
    lineHeight: 1.25,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  lead: {
    flexShrink: 0,
    padding: "12px 16px 8px",
    fontSize: "13px",
    color: "rgba(255,255,255,0.6)",
    lineHeight: 1.45,
  },
  list: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    padding: "0 12px 28px",
  },
  row: (hidden) => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 12px",
    marginBottom: 8,
    borderRadius: 12,
    border: hidden
      ? "1px solid rgba(248,113,113,0.35)"
      : "1px solid #2a2a2a",
    backgroundColor: hidden ? "rgba(248,113,113,0.06)" : "#171717",
    opacity: hidden ? 0.72 : 1,
  }),
  order: {
    flexShrink: 0,
    width: 28,
    fontSize: 13,
    fontWeight: 800,
    color: "rgba(46,204,113,0.95)",
    textAlign: "center",
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 14,
    fontWeight: 800,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  sub: {
    marginTop: 2,
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  actions: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    flexShrink: 0,
  },
  moveBtn: {
    border: "1px solid #333",
    background: "#1f1f1f",
    color: "#fff",
    borderRadius: 8,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    lineHeight: 1,
  },
  moveBtnDisabled: {
    opacity: 0.35,
    cursor: "not-allowed",
  },
  hideBtn: (hidden) => ({
    border: hidden
      ? "1px solid rgba(46,204,113,0.45)"
      : "1px solid rgba(248,113,113,0.4)",
    background: hidden
      ? "rgba(46,204,113,0.12)"
      : "rgba(248,113,113,0.1)",
    color: hidden ? "#86efac" : "#fca5a5",
    borderRadius: 8,
    padding: "6px 8px",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
    lineHeight: 1.2,
    whiteSpace: "nowrap",
  }),
  status: {
    flexShrink: 0,
    padding: "8px 16px 12px",
    fontSize: 12,
    fontWeight: 700,
    color: "rgba(255,255,255,0.55)",
  },
  statusOk: { color: "#2ECC71" },
  statusErr: { color: "#f87171" },
};

export default function AdminCuratorChipsOrderPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: qErr } = await supabase
        .from("curators")
        .select(
          "id, user_id, slug, username, name, display_name, grade, status, home_chip_order, home_chip_hidden, created_at"
        )
        .order("home_chip_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (qErr) {
        const msg = String(qErr.message || "");
        if (/home_chip_order|home_chip_hidden/i.test(msg)) {
          throw new Error(
            "DB 컬럼이 없어요. supabase/migrations/RUN_curators_home_chip_order.sql 을 SQL Editor에서 다시 실행해 주세요."
          );
        }
        throw qErr;
      }
      setRows(sortByChipOrder(data || []));
    } catch (e) {
      setRows([]);
      setError(e?.message || "목록을 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      setLoading(false);
      setError("로그인이 필요해요.");
      return;
    }
    void load();
  }, [authLoading, user?.id, load]);

  const persistOrder = useCallback(
    async (nextRows) => {
      setSaving(true);
      setMessage("");
      setError("");
      try {
        const updates = nextRows.map((row, i) => ({
          id: row.id,
          home_chip_order: i + 1,
        }));
        const results = await Promise.all(
          updates.map(({ id, home_chip_order }) =>
            supabase
              .from("curators")
              .update({ home_chip_order })
              .eq("id", id)
              .select("id")
              .maybeSingle()
          )
        );
        const failed = results.find((r) => r.error);
        if (failed?.error) {
          throw failed.error;
        }
        setRows(
          nextRows.map((row, i) => ({
            ...row,
            home_chip_order: i + 1,
          }))
        );
        setMessage("순서를 저장했어요. 홈 새로고침 후 칩에 반영됩니다.");
      } catch (e) {
        setError(e?.message || "순서 저장에 실패했어요.");
        await load();
      } finally {
        setSaving(false);
      }
    },
    [load]
  );

  const move = useCallback(
    (index, dir) => {
      if (saving) return;
      const j = index + dir;
      if (j < 0 || j >= rows.length) return;
      const next = [...rows];
      const tmp = next[index];
      next[index] = next[j];
      next[j] = tmp;
      setRows(next);
      void persistOrder(next);
    },
    [rows, saving, persistOrder]
  );

  const toggleHidden = useCallback(
    async (row) => {
      if (saving || !row?.id) return;
      const nextHidden = !row.home_chip_hidden;
      setSaving(true);
      setMessage("");
      setError("");
      try {
        const { error: uErr } = await supabase
          .from("curators")
          .update({ home_chip_hidden: nextHidden })
          .eq("id", row.id)
          .select("id")
          .maybeSingle();
        if (uErr) throw uErr;
        setRows((prev) =>
          prev.map((r) =>
            r.id === row.id ? { ...r, home_chip_hidden: nextHidden } : r
          )
        );
        setMessage(
          nextHidden
            ? "홈 칩에서 숨겼어요. 홈 새로고침 후 반영됩니다."
            : "홈 칩에 다시 보이게 했어요. 홈 새로고침 후 반영됩니다."
        );
      } catch (e) {
        setError(e?.message || "숨김 설정을 저장하지 못했어요.");
      } finally {
        setSaving(false);
      }
    },
    [saving]
  );

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <button
          type="button"
          onClick={() => navigate("/admin")}
          style={adminTopNavButtonStyle}
          aria-label="관리자로"
          title="관리자로"
        >
          ←
        </button>
        <div style={styles.title}>홈 큐레이터 칩 순서·숨김</div>
        <button
          type="button"
          onClick={() => void load()}
          style={adminTopNavButtonStyle}
          disabled={loading || saving}
          aria-label="새로고침"
        >
          ↻
        </button>
      </header>

      <p style={styles.lead}>
        위쪽이 홈 칩 왼쪽(앞)입니다. ↑↓는 순서, 「숨기기」는 홈 필터 칩에서만
        가립니다(장소·프로필은 그대로).
      </p>

      {error ? (
        <p style={{ ...styles.status, ...styles.statusErr }}>{error}</p>
      ) : null}
      {message ? (
        <p style={{ ...styles.status, ...styles.statusOk }}>{message}</p>
      ) : null}
      {saving ? <p style={styles.status}>저장 중…</p> : null}

      <div style={styles.list}>
        {loading ? (
          <p style={styles.status}>불러오는 중…</p>
        ) : rows.length === 0 && !error ? (
          <p style={styles.status}>등록된 큐레이터가 없어요.</p>
        ) : (
          rows.map((row, i) => {
            const label = curatorLabel(row);
            const gradeKo = GRADE_LABELS_KO[row.grade] || row.grade || "";
            const hidden = Boolean(row.home_chip_hidden);
            return (
              <div key={row.id} style={styles.row(hidden)}>
                <div style={styles.order}>{i + 1}</div>
                <div style={styles.main}>
                  <div style={styles.name}>
                    {label.primary}
                    {hidden ? " · 숨김" : ""}
                  </div>
                  <div style={styles.sub}>
                    {[label.secondary, gradeKo, row.status]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <button
                  type="button"
                  style={{
                    ...styles.hideBtn(hidden),
                    ...(saving ? styles.moveBtnDisabled : null),
                  }}
                  disabled={saving}
                  aria-pressed={hidden}
                  aria-label={hidden ? "칩 다시 보이기" : "칩 숨기기"}
                  onClick={() => void toggleHidden(row)}
                >
                  {hidden ? "보이기" : "숨기기"}
                </button>
                <div style={styles.actions}>
                  <button
                    type="button"
                    style={{
                      ...styles.moveBtn,
                      ...(i === 0 || saving ? styles.moveBtnDisabled : null),
                    }}
                    disabled={i === 0 || saving}
                    aria-label="위로"
                    onClick={() => move(i, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    style={{
                      ...styles.moveBtn,
                      ...(i >= rows.length - 1 || saving
                        ? styles.moveBtnDisabled
                        : null),
                    }}
                    disabled={i >= rows.length - 1 || saving}
                    aria-label="아래로"
                    onClick={() => move(i, 1)}
                  >
                    ↓
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
