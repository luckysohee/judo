import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { GRADE_LABELS_KO } from "../utils/curatorGradeRules";
import {
  ADMIN_AUDIT_ACTION_LABEL_KO,
} from "../utils/adminAuditLog";
import { adminTopNavButtonStyle } from "../styles/adminTopNavButton";

const PAGE_SIZE = 25;
const AUDIT_FETCH_LIMIT = 800;

const AUDIT_ACTION_OPTIONS = [
  { value: "", label: "전체 액션" },
  ...Object.entries(ADMIN_AUDIT_ACTION_LABEL_KO).map(([value, label]) => ({
    value,
    label,
  })),
];

function dayStartMs(isoDate) {
  if (!isoDate || typeof isoDate !== "string") return null;
  const d = new Date(`${isoDate}T00:00:00`);
  const t = d.getTime();
  return Number.isNaN(t) ? null : t;
}

function dayEndMs(isoDate) {
  if (!isoDate || typeof isoDate !== "string") return null;
  const d = new Date(`${isoDate}T23:59:59.999`);
  const t = d.getTime();
  return Number.isNaN(t) ? null : t;
}

function tokensMatch(haystack, raw) {
  const q = raw.trim().toLowerCase();
  if (!q) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every((tok) => haystack.includes(tok));
}

function curatorMatches(c, query) {
  const blob = [
    c.username,
    c.user_id,
    c.grade,
    c.status,
    String(c.total_places ?? ""),
    String(c.total_likes ?? ""),
  ]
    .map((x) => String(x ?? "").toLowerCase())
    .join(" ");
  return tokensMatch(blob, query);
}

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#111111",
    color: "#ffffff",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  header: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    backgroundColor: "#111111",
    padding: "8px 12px",
    borderBottom: "1px solid #222222",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "nowrap",
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
  refreshButton: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #444444",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    borderRadius: "999px",
    padding: "7px",
    minWidth: "30px",
    minHeight: "30px",
    boxSizing: "border-box",
    cursor: "pointer",
  },
  content: {
    padding: "8px 12px 24px",
  },
  tabs: {
    display: "flex",
    gap: "6px",
    marginBottom: "10px",
  },
  tab: {
    flex: 1,
    border: "1px solid #333",
    backgroundColor: "#1a1a1a",
    color: "rgba(255,255,255,0.7)",
    borderRadius: "10px",
    padding: "8px 10px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
  },
  tabActive: {
    borderColor: "rgba(46, 204, 113, 0.45)",
    backgroundColor: "#152218",
    color: "#fff",
  },
  filterBlock: {
    marginBottom: "12px",
    padding: "10px 12px",
    borderRadius: "12px",
    border: "1px solid #2a2a2a",
    backgroundColor: "#141414",
  },
  filterLabel: {
    fontSize: "11px",
    fontWeight: 700,
    color: "rgba(255,255,255,0.5)",
    marginBottom: "6px",
    display: "block",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid #3a3a3a",
    backgroundColor: "#0f0f0f",
    color: "#fff",
    fontSize: "14px",
    marginBottom: "8px",
  },
  rowFlex: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    alignItems: "center",
  },
  select: {
    flex: 1,
    minWidth: "140px",
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid #3a3a3a",
    backgroundColor: "#0f0f0f",
    color: "#fff",
    fontSize: "13px",
  },
  dateInput: {
    flex: 1,
    minWidth: "120px",
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid #3a3a3a",
    backgroundColor: "#0f0f0f",
    color: "#fff",
    fontSize: "13px",
  },
  pager: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    marginTop: "12px",
    marginBottom: "8px",
    flexWrap: "wrap",
  },
  pagerBtn: {
    border: "1px solid #444",
    backgroundColor: "#1a1a1a",
    color: "#fff",
    borderRadius: "10px",
    padding: "8px 14px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
  },
  pagerInfo: {
    fontSize: "12px",
    color: "rgba(255,255,255,0.55)",
  },
  row: {
    border: "1px solid #2a2a2a",
    backgroundColor: "#171717",
    borderRadius: "10px",
    padding: "10px 12px",
    marginBottom: "8px",
  },
  rowTitle: {
    fontSize: "15px",
    fontWeight: 800,
    marginBottom: "4px",
  },
  rowMeta: {
    fontSize: "12px",
    color: "rgba(255,255,255,0.55)",
    lineHeight: 1.45,
  },
  openBtn: {
    marginTop: "8px",
    width: "100%",
    border: "1px solid #2a5a2a",
    backgroundColor: "#152a15",
    color: "#2ECC71",
    borderRadius: "8px",
    padding: "7px 10px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  logAction: {
    fontSize: "13px",
    fontWeight: 800,
    color: "#e8eaed",
    marginBottom: "4px",
  },
  logMeta: {
    fontSize: "11px",
    color: "rgba(255,255,255,0.5)",
    fontFamily: "ui-monospace, monospace",
    wordBreak: "break-all",
  },
  empty: {
    color: "#888",
    fontSize: "13px",
    padding: "16px 4px",
  },
  error: {
    color: "#FF6B6B",
    fontSize: "13px",
    marginBottom: "8px",
  },
};

function formatWhen(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

function auditRowMatches(r, textQuery, actionFilter, dateFrom, dateTo) {
  if (actionFilter && r.action !== actionFilter) return false;
  const t = new Date(r.created_at).getTime();
  const fromMs = dayStartMs(dateFrom);
  const toMs = dayEndMs(dateTo);
  if (fromMs != null && t < fromMs) return false;
  if (toMs != null && t > toMs) return false;
  if (!textQuery.trim()) return true;
  const blob = [
    r.action,
    r.actionLabel,
    r.actorLabel,
    r.targetLabel,
    r.metaStr,
  ]
    .map((x) => String(x ?? "").toLowerCase())
    .join(" ");
  return tokensMatch(blob, textQuery);
}

export default function AdminCuratorsAuditPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState("curators");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [curators, setCurators] = useState([]);
  const [auditRows, setAuditRows] = useState([]);
  const [nameByUserId, setNameByUserId] = useState({});

  const [curatorQuery, setCuratorQuery] = useState("");
  const [auditQuery, setAuditQuery] = useState("");
  const [auditAction, setAuditAction] = useState("");
  const [auditDateFrom, setAuditDateFrom] = useState("");
  const [auditDateTo, setAuditDateTo] = useState("");
  const [curatorPage, setCuratorPage] = useState(0);
  const [auditPage, setAuditPage] = useState(0);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError("");
    try {
      const { data: curData, error: ce } = await supabase
        .from("curators")
        .select(
          "user_id, username, grade, status, total_places, total_likes, created_at, last_activity_at"
        )
        .order("created_at", { ascending: false });

      if (ce) throw ce;
      setCurators(Array.isArray(curData) ? curData : []);

      const { data: logData, error: le } = await supabase
        .from("admin_audit_log")
        .select("id, created_at, actor_id, action, target_user_id, meta")
        .order("created_at", { ascending: false })
        .limit(AUDIT_FETCH_LIMIT);

      let auditList = [];
      if (le) {
        const msg = String(le.message || "");
        if (/does not exist|schema cache|42P01|PGRST205/i.test(msg)) {
          auditList = [];
        } else {
          throw le;
        }
      } else {
        auditList = Array.isArray(logData) ? logData : [];
      }
      setAuditRows(auditList);

      const ids = new Set();
      auditList.forEach((r) => {
        if (r.actor_id) ids.add(r.actor_id);
        if (r.target_user_id) ids.add(r.target_user_id);
      });
      const idList = [...ids];
      if (idList.length > 0) {
        const { data: names } = await supabase
          .from("profiles")
          .select("id, username, display_name")
          .in("id", idList);
        const map = {};
        (names || []).forEach((p) => {
          map[p.id] = p.display_name || p.username || p.id.slice(0, 8);
        });
        setNameByUserId(map);
      } else {
        setNameByUserId({});
      }
    } catch (e) {
      console.error(e);
      setError(e?.message || "불러오기 실패");
      setCurators([]);
      setAuditRows([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (authLoading || !user?.id) return;
    load();
  }, [authLoading, user?.id, load]);

  useEffect(() => {
    setCuratorPage(0);
  }, [curatorQuery]);

  useEffect(() => {
    setAuditPage(0);
  }, [auditQuery, auditAction, auditDateFrom, auditDateTo]);

  const enrichedAudit = useMemo(() => {
    return auditRows.map((r) => ({
      ...r,
      actionLabel: ADMIN_AUDIT_ACTION_LABEL_KO[r.action] || r.action,
      actorLabel: nameByUserId[r.actor_id] || r.actor_id?.slice(0, 8) || "—",
      targetLabel: r.target_user_id
        ? nameByUserId[r.target_user_id] || r.target_user_id.slice(0, 8)
        : "—",
      metaStr:
        r.meta && typeof r.meta === "object" && Object.keys(r.meta).length > 0
          ? JSON.stringify(r.meta)
          : "",
    }));
  }, [auditRows, nameByUserId]);

  const filteredCurators = useMemo(() => {
    return curators.filter((c) => curatorMatches(c, curatorQuery));
  }, [curators, curatorQuery]);

  const filteredAudit = useMemo(() => {
    return enrichedAudit.filter((r) =>
      auditRowMatches(r, auditQuery, auditAction, auditDateFrom, auditDateTo)
    );
  }, [enrichedAudit, auditQuery, auditAction, auditDateFrom, auditDateTo]);

  const curatorPageCount = Math.max(
    1,
    Math.ceil(filteredCurators.length / PAGE_SIZE) || 1
  );
  const auditPageCount = Math.max(
    1,
    Math.ceil(filteredAudit.length / PAGE_SIZE) || 1
  );

  const curatorPageClamped = Math.min(curatorPage, curatorPageCount - 1);
  const auditPageClamped = Math.min(auditPage, auditPageCount - 1);

  const curatorSlice = filteredCurators.slice(
    curatorPageClamped * PAGE_SIZE,
    curatorPageClamped * PAGE_SIZE + PAGE_SIZE
  );
  const auditSlice = filteredAudit.slice(
    auditPageClamped * PAGE_SIZE,
    auditPageClamped * PAGE_SIZE + PAGE_SIZE
  );

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button
          type="button"
          onClick={() => navigate("/admin")}
          style={adminTopNavButtonStyle}
          aria-label="관리자 허브로"
          title="관리자 허브로"
        >
          ←
        </button>
        <div style={styles.title}>큐레이터 · 감사 로그</div>
        <button
          type="button"
          onClick={load}
          style={styles.refreshButton}
          aria-label="새로고침"
          title="새로고침"
        >
          <svg
            width={13}
            height={13}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M8 16H3v5" />
          </svg>
        </button>
      </div>

      <div style={styles.content}>
        <div style={styles.tabs}>
          <button
            type="button"
            style={{
              ...styles.tab,
              ...(tab === "curators" ? styles.tabActive : {}),
            }}
            onClick={() => setTab("curators")}
          >
            전체 목록
          </button>
          <button
            type="button"
            style={{
              ...styles.tab,
              ...(tab === "audit" ? styles.tabActive : {}),
            }}
            onClick={() => setTab("audit")}
          >
            감사 로그
          </button>
        </div>

        {error ? <div style={styles.error}>{error}</div> : null}

        {loading ? (
          <div style={styles.empty}>불러오는 중…</div>
        ) : tab === "curators" ? (
          <>
            <div style={styles.filterBlock}>
              <label style={styles.filterLabel}>핸들 · user id · 등급 · 상태 검색</label>
              <input
                type="search"
                value={curatorQuery}
                onChange={(e) => setCuratorQuery(e.target.value)}
                placeholder="예: @닉네임, bronze, active"
                style={styles.input}
                autoComplete="off"
              />
              <div style={styles.pagerInfo}>
                {filteredCurators.length}명 중{" "}
                {filteredCurators.length === 0
                  ? 0
                  : curatorPageClamped * PAGE_SIZE + 1}
                –
                {Math.min(
                  (curatorPageClamped + 1) * PAGE_SIZE,
                  filteredCurators.length
                )}{" "}
                표시 (페이지 {curatorPageClamped + 1}/{curatorPageCount})
              </div>
            </div>
            {curators.length === 0 ? (
              <div style={styles.empty}>등록된 큐레이터가 없습니다.</div>
            ) : filteredCurators.length === 0 ? (
              <div style={styles.empty}>검색 결과가 없습니다.</div>
            ) : (
              <>
                {curatorSlice.map((c) => (
                  <div key={c.user_id} style={styles.row}>
                    <div style={styles.rowTitle}>
                      @{c.username || c.user_id?.slice(0, 8)}
                    </div>
                    <div style={styles.rowMeta}>
                      등급 {GRADE_LABELS_KO[c.grade] || c.grade} · 상태 {c.status}{" "}
                      · 장소 {c.total_places ?? 0}
                    </div>
                    <button
                      type="button"
                      style={styles.openBtn}
                      onClick={() => navigate(`/admin/curator/${c.user_id}`)}
                    >
                      관리 페이지
                    </button>
                  </div>
                ))}
                <div style={styles.pager}>
                  <button
                    type="button"
                    style={styles.pagerBtn}
                    disabled={curatorPageClamped <= 0}
                    onClick={() => setCuratorPage((p) => Math.max(0, p - 1))}
                  >
                    이전
                  </button>
                  <button
                    type="button"
                    style={styles.pagerBtn}
                    disabled={curatorPageClamped >= curatorPageCount - 1}
                    onClick={() =>
                      setCuratorPage((p) =>
                        Math.min(curatorPageCount - 1, p + 1)
                      )
                    }
                  >
                    다음
                  </button>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <div style={styles.filterBlock}>
              <label style={styles.filterLabel}>키워드 (액션·관리자·대상·meta JSON)</label>
              <input
                type="search"
                value={auditQuery}
                onChange={(e) => setAuditQuery(e.target.value)}
                placeholder="공백으로 AND 검색"
                style={styles.input}
                autoComplete="off"
              />
              <label style={styles.filterLabel}>액션 종류</label>
              <select
                value={auditAction}
                onChange={(e) => setAuditAction(e.target.value)}
                style={{ ...styles.select, width: "100%", marginBottom: "8px" }}
              >
                {AUDIT_ACTION_OPTIONS.map((o) => (
                  <option key={o.value || "all"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <label style={styles.filterLabel}>생성일 (로컬 기준)</label>
              <div style={styles.rowFlex}>
                <input
                  type="date"
                  value={auditDateFrom}
                  onChange={(e) => setAuditDateFrom(e.target.value)}
                  style={styles.dateInput}
                  aria-label="시작일"
                />
                <span style={{ color: "rgba(255,255,255,0.35)" }}>~</span>
                <input
                  type="date"
                  value={auditDateTo}
                  onChange={(e) => setAuditDateTo(e.target.value)}
                  style={styles.dateInput}
                  aria-label="종료일"
                />
              </div>
              <div style={{ ...styles.pagerInfo, marginTop: "8px" }}>
                최대 {AUDIT_FETCH_LIMIT}건 로드 · 필터 후 {filteredAudit.length}건 (페이지{" "}
                {auditPageClamped + 1}/{auditPageCount})
              </div>
            </div>
            {enrichedAudit.length === 0 ? (
              <div style={styles.empty}>
                기록이 없거나 `admin_audit_log` 마이그레이션을 아직 적용하지 않았습니다.
              </div>
            ) : filteredAudit.length === 0 ? (
              <div style={styles.empty}>조건에 맞는 감사 로그가 없습니다.</div>
            ) : (
              <>
                {auditSlice.map((r) => (
                  <div key={r.id} style={styles.row}>
                    <div style={styles.logAction}>
                      {r.actionLabel}
                      <span
                        style={{
                          color: "rgba(255,255,255,0.45)",
                          fontWeight: 600,
                        }}
                      >
                        {" "}
                        · {formatWhen(r.created_at)}
                      </span>
                    </div>
                    <div style={styles.logMeta}>
                      관리자: {r.actorLabel}
                      {r.target_user_id ? ` → 대상: ${r.targetLabel}` : ""}
                    </div>
                    {r.metaStr ? (
                      <div
                        style={{
                          ...styles.logMeta,
                          marginTop: "6px",
                          color: "rgba(255,255,255,0.65)",
                        }}
                      >
                        {r.metaStr}
                      </div>
                    ) : null}
                  </div>
                ))}
                <div style={styles.pager}>
                  <button
                    type="button"
                    style={styles.pagerBtn}
                    disabled={auditPageClamped <= 0}
                    onClick={() => setAuditPage((p) => Math.max(0, p - 1))}
                  >
                    이전
                  </button>
                  <button
                    type="button"
                    style={styles.pagerBtn}
                    disabled={auditPageClamped >= auditPageCount - 1}
                    onClick={() =>
                      setAuditPage((p) => Math.min(auditPageCount - 1, p + 1))
                    }
                  >
                    다음
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
