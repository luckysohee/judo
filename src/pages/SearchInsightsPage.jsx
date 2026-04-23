import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { adminTopNavButtonStyle } from "../styles/adminTopNavButton";

const CTR_PATH_ORDER = ["keyword_pure", "keyword_fallback", "ai_direct"];

const VISIBLE_BUCKET_DEFS = [
  { key: "1", label: "1개" },
  { key: "2-3", label: "2~3개" },
  { key: "4-6", label: "4~6개" },
  { key: "7+", label: "7개 이상" },
];

function bucketSubmitVisibleCount(n) {
  if (!Number.isFinite(n) || n < 1) return null;
  if (n === 1) return "1";
  if (n <= 3) return "2-3";
  if (n <= 6) return "4-6";
  return "7+";
}

function aggregateClickRankBySearchPath(rows) {
  const byPath = new Map();
  for (const row of rows) {
    const path = row.search_click_path;
    if (!path || typeof path !== "string") continue;
    const rank = Number(row.clicked_rank);
    if (!Number.isFinite(rank) || rank <= 0) continue;
    const cur = byPath.get(path) || {
      path,
      withRank: 0,
      r1: 0,
      r2: 0,
      r3: 0,
    };
    cur.withRank += 1;
    if (rank === 1) cur.r1 += 1;
    else if (rank === 2) cur.r2 += 1;
    else if (rank === 3) cur.r3 += 1;
    byPath.set(path, cur);
  }
  return [...byPath.values()].map((o) => {
    const r1to3 = o.r1 + o.r2 + o.r3;
    const pctTop3 = o.withRank
      ? Math.round((1000 * r1to3) / o.withRank) / 10
      : 0;
    return { ...o, r1to3, pctTop3 };
  });
}

function aggregateAvgRankBySearchPath(rows) {
  const byPath = new Map();
  for (const row of rows) {
    const path = row.search_click_path;
    if (!path || typeof path !== "string") continue;
    const rank = Number(row.clicked_rank);
    if (!Number.isFinite(rank) || rank <= 0) continue;
    const cur = byPath.get(path) || { path, sum: 0, n: 0 };
    cur.sum += rank;
    cur.n += 1;
    byPath.set(path, cur);
  }
  return [...byPath.values()].map((o) => ({
    path: o.path,
    n: o.n,
    avgRank: o.n ? Math.round((100 * o.sum) / o.n) / 100 : null,
  }));
}

function submitRowToSearchClickPath(row) {
  const kind = row.submit_initial_search_kind;
  const fb = Boolean(row.submit_keyword_ai_fallback);
  if (kind === "keyword_search") return fb ? "keyword_fallback" : "keyword_pure";
  if (kind === "ai_parse_search") return "ai_direct";
  return null;
}

function computePathByVisibleBucketCtr(searchRows, clickRows) {
  const converted = new Set();
  for (const c of clickRows) {
    if (!c.search_session_id || !c.search_click_path) continue;
    converted.add(`${String(c.search_session_id)}|${c.search_click_path}`);
  }

  const acc = new Map();
  for (const path of CTR_PATH_ORDER) {
    for (const k of ["1", "2-3", "4-6", "7+"]) {
      acc.set(`${path}|${k}`, { sessions: 0, converted: 0 });
    }
  }

  for (const row of searchRows) {
    if (!row.session_id) continue;
    const path = submitRowToSearchClickPath(row);
    if (!path) continue;
    const n = Number(row.submit_user_visible_candidate_count);
    const bucket = bucketSubmitVisibleCount(n);
    if (!bucket) continue;
    const key = `${path}|${bucket}`;
    if (!acc.has(key)) acc.set(key, { sessions: 0, converted: 0 });
    const cell = acc.get(key);
    cell.sessions += 1;
    if (converted.has(`${String(row.session_id)}|${path}`)) {
      cell.converted += 1;
    }
  }

  return CTR_PATH_ORDER.map((path) => ({
    path,
    buckets: VISIBLE_BUCKET_DEFS.map(({ key, label }) => {
      const c = acc.get(`${path}|${key}`) || { sessions: 0, converted: 0 };
      const ctrPct = c.sessions
        ? Math.round((1000 * c.converted) / c.sessions) / 10
        : null;
      return { key, label, sessions: c.sessions, converted: c.converted, ctrPct };
    }),
  }));
}

function insightPathByVisibleBucket(matrix) {
  const totalCellSessions = matrix.reduce(
    (s, row) => s + row.buckets.reduce((t, b) => t + b.sessions, 0),
    0
  );
  if (totalCellSessions === 0) {
    return "제출 시 분기·실보이 행 수 컬럼이 함께 쌓인 뒤 셀이 채워집니다 (303900·304000 마이그레이션).";
  }
  const fb = matrix.find((r) => r.path === "keyword_fallback");
  const totalFb = fb
    ? fb.buckets.reduce((s, b) => s + b.sessions, 0)
    : 0;
  if (totalFb < 15) {
    return "keyword_fallback 교차 샘이 적으면 참고만 하세요.";
  }
  const getB = (row, k) =>
    row?.buckets.find((b) => b.key === k) || {
      sessions: 0,
      ctrPct: null,
    };
  const b46 = getB(fb, "4-6");
  const b7 = getB(fb, "7+");
  const minN = 5;
  if (
    b46.sessions >= minN &&
    b7.sessions >= minN &&
    b46.ctrPct != null &&
    b7.ctrPct != null &&
    b46.ctrPct >= b7.ctrPct + 5
  ) {
    return "fallback은 4~6개 구간에서만 CTR이 괜찮고 7+에서 급락하는 패턴이면, fallback 결과를 화면에 올리는 개수 상한을 두는 튜닝을 검토할 수 있습니다.";
  }
  const pure = matrix.find((r) => r.path === "keyword_pure");
  const p7 = getB(pure, "7+");
  const f7 = b7;
  if (
    pure &&
    fb &&
    p7.sessions >= minN &&
    f7.sessions >= minN &&
    p7.ctrPct != null &&
    f7.ctrPct != null &&
    f7.ctrPct + 3 < p7.ctrPct
  ) {
    return "같은 7+ 구간에서 pure 대비 fallback CTR이 낮다면, 넓은 노출에서 fallback 후보 품질이 떨어질 수 있습니다.";
  }
  return "경로×구간 셀을 비교해 노출 폭·fallback 캡을 같이 조정할 근거로 쓰면 됩니다.";
}

function computeVisibleBucketSessionCtr(searchRows, clickRows) {
  const convertedSessions = new Set();
  for (const c of clickRows) {
    if (!c.search_session_id) continue;
    if (!c.search_click_path) continue;
    convertedSessions.add(String(c.search_session_id));
  }
  const acc = {
    "1": { sessions: 0, converted: 0 },
    "2-3": { sessions: 0, converted: 0 },
    "4-6": { sessions: 0, converted: 0 },
    "7+": { sessions: 0, converted: 0 },
  };
  for (const row of searchRows) {
    if (!row.session_id) continue;
    const n = Number(row.submit_user_visible_candidate_count);
    const b = bucketSubmitVisibleCount(n);
    if (!b || !acc[b]) continue;
    acc[b].sessions += 1;
    if (convertedSessions.has(String(row.session_id))) {
      acc[b].converted += 1;
    }
  }
  return VISIBLE_BUCKET_DEFS.map(({ key, label }) => {
    const { sessions, converted } = acc[key];
    const ctrPct = sessions
      ? Math.round((1000 * converted) / sessions) / 10
      : 0;
    return { key, label, sessions, converted, ctrPct };
  });
}

/** 패널 3: 구간별 CTR 표 → 운영 해석 한 줄(샘플 부족 시 보류) */
function insightForVisibleBucketCtr(rows) {
  const totalSessions = rows.reduce((s, r) => s + r.sessions, 0);
  if (totalSessions < 15) {
    return "검색 세션 샘이 적어 구간별 CTR 자동 해석은 참고만 하세요.";
  }
  const minSessions = 5;
  const withData = rows.filter((r) => r.sessions >= minSessions);
  if (withData.length === 0) {
    return "각 구간에 검색 세션이 더 쌓이면 해석이 안정됩니다.";
  }

  let best = withData[0];
  for (const r of withData) {
    if (r.ctrPct > best.ctrPct) best = r;
  }

  const sevenRow = rows.find((r) => r.key === "7+");
  const othersWithData = withData.filter((r) => r.key !== "7+");
  const otherMaxCtr =
    othersWithData.length > 0
      ? Math.max(...othersWithData.map((r) => r.ctrPct))
      : 0;
  const sevenClearlyLow =
    sevenRow &&
    sevenRow.sessions >= minSessions &&
    othersWithData.length > 0 &&
    sevenRow.ctrPct + 3 <= otherMaxCtr;

  const lines = [];
  if (best.key === "2-3") {
    lines.push(
      "2~3개 구간 CTR이 가장 높게 보입니다 → 초기 노출 수를 너무 넓히지 않는 편이 유리할 수 있습니다."
    );
  } else if (best.key === "4-6") {
    lines.push(
      "4~6개 구간 CTR이 가장 높습니다 → 현재 노출 폭이 적정에 가깝다고 볼 수 있습니다."
    );
  } else if (best.key === "1") {
    lines.push(
      "1개 구간 CTR이 가장 높습니다 → 첫 화면 후보를 한정했을 때 전환이 잘 나는 패턴일 수 있습니다."
    );
  } else if (best.key === "7+") {
    lines.push(
      "7개 이상 구간에서 CTR이 가장 높게 나옵니다 → 이 트래픽에서는 넓은 후보 제시가 통할 수 있습니다."
    );
  } else {
    lines.push(
      "구간별 CTR 우열이 뚜렷하지 않습니다 — 표본·기간을 늘린 뒤 다시 보세요."
    );
  }

  if (sevenClearlyLow) {
    lines.push(
      "7개 이상 구간 CTR만 유의하게 낮다면 → 넓은 노출이 클릭 효율을 떨어뜨릴 수 있습니다."
    );
  }

  return lines.join(" ");
}

export default function SearchInsightsPage() {
  const navigate = useNavigate();
  const { loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [zeroRows, setZeroRows] = useState([]);
  const [recentRows, setRecentRows] = useState([]);
  const [clickPathRows, setClickPathRows] = useState([]);
  const [clickPathLoadError, setClickPathLoadError] = useState("");
  const [searchCtrRows, setSearchCtrRows] = useState([]);
  const [searchCtrLoadError, setSearchCtrLoadError] = useState("");

  useEffect(() => {
    if (authLoading) return;
    (async () => {
      try {
        setLoading(true);
        const { data: z, error: ze } = await supabase
          .from("search_logs")
          .select("*")
          .eq("has_results", false)
          .order("timestamp", { ascending: false })
          .limit(400);

        if (ze) throw ze;
        setZeroRows(Array.isArray(z) ? z : []);

        const { data: r, error: re } = await supabase
          .from("search_logs")
          .select("*")
          .order("timestamp", { ascending: false })
          .limit(80);

        if (re) throw re;
        setRecentRows(Array.isArray(r) ? r : []);

        const { data: c, error: ce } = await supabase
          .from("place_click_logs")
          .select(
            "search_click_path, clicked_rank, timestamp, search_session_id"
          )
          .not("search_click_path", "is", null)
          .order("timestamp", { ascending: false })
          .limit(4000);

        if (ce) {
          setClickPathRows([]);
          setClickPathLoadError(
            /column|42703|does not exist/i.test(String(ce.message || ce))
              ? "schema"
              : ce.message || String(ce)
          );
        } else {
          setClickPathRows(Array.isArray(c) ? c : []);
          setClickPathLoadError("");
        }

        const { data: sctr, error: se } = await supabase
          .from("search_logs")
          .select(
            "session_id, submit_user_visible_candidate_count, submit_initial_search_kind, submit_keyword_ai_fallback, timestamp"
          )
          .not("session_id", "is", null)
          .order("timestamp", { ascending: false })
          .limit(4000);

        if (se) {
          setSearchCtrRows([]);
          setSearchCtrLoadError(
            /column|42703|does not exist/i.test(String(se.message || se))
              ? "schema"
              : se.message || String(se)
          );
        } else {
          setSearchCtrRows(Array.isArray(sctr) ? sctr : []);
          setSearchCtrLoadError("");
        }
        setErrorMessage("");
      } catch (e) {
        console.error("SearchInsightsPage:", e);
        setErrorMessage(e?.message || "데이터를 불러오지 못했습니다.");
        setZeroRows([]);
        setRecentRows([]);
        setClickPathRows([]);
        setClickPathLoadError("");
        setSearchCtrRows([]);
        setSearchCtrLoadError("");
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading]);

  const zeroAggregates = useMemo(() => {
    const m = new Map();
    for (const row of zeroRows) {
      const q = String(row.user_query || "").trim();
      if (!q) continue;
      const prev = m.get(q) || { count: 0, last: 0 };
      prev.count += 1;
      const t = row.timestamp ? new Date(row.timestamp).getTime() : 0;
      if (t > prev.last) prev.last = t;
      m.set(q, prev);
    }
    return [...m.entries()]
      .map(([query, v]) => ({ query, count: v.count, last: v.last }))
      .sort((a, b) => b.count - a.count || b.last - a.last)
      .slice(0, 50);
  }, [zeroRows]);

  const clickRankByPath = useMemo(() => {
    const list = aggregateClickRankBySearchPath(clickPathRows);
    return [...list].sort((a, b) => {
      const ia = CTR_PATH_ORDER.indexOf(a.path);
      const ib = CTR_PATH_ORDER.indexOf(b.path);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return b.withRank - a.withRank;
    });
  }, [clickPathRows]);

  const avgRankByPath = useMemo(() => {
    const list = aggregateAvgRankBySearchPath(clickPathRows);
    return [...list].sort((a, b) => {
      const ia = CTR_PATH_ORDER.indexOf(a.path);
      const ib = CTR_PATH_ORDER.indexOf(b.path);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return b.n - a.n;
    });
  }, [clickPathRows]);

  const visibleBucketCtr = useMemo(
    () => computeVisibleBucketSessionCtr(searchCtrRows, clickPathRows),
    [searchCtrRows, clickPathRows]
  );

  const visibleBucketInsight = useMemo(
    () => insightForVisibleBucketCtr(visibleBucketCtr),
    [visibleBucketCtr]
  );

  const pathByVisibleBucket = useMemo(
    () => computePathByVisibleBucketCtr(searchCtrRows, clickPathRows),
    [searchCtrRows, clickPathRows]
  );

  const pathByVisibleInsight = useMemo(
    () => insightPathByVisibleBucket(pathByVisibleBucket),
    [pathByVisibleBucket]
  );

  const fallbackVsPureNote = useMemo(() => {
    const pure = clickRankByPath.find((x) => x.path === "keyword_pure");
    const fb = clickRankByPath.find((x) => x.path === "keyword_fallback");
    if (!pure && !fb) {
      return "keyword_pure / keyword_fallback 샘플이 아직 없습니다.";
    }
    if (!pure || !fb) {
      return "pure·fallback 둘 다 쌓이면 자동 비교합니다. (지금은 한쪽만 있음)";
    }
    const diff = fb.pctTop3 - pure.pctTop3;
    if (diff >= -1.5) {
      return "fallback의 1~3위 비율이 pure와 비슷하거나 더 높습니다 → fallback이 상단을 크게 해치지 않는 편으로 볼 수 있습니다.";
    }
    return "fallback의 1~3위 비율이 pure보다 확실히 낮습니다 → fallback이 상단 품질·랭킹을 해칠 가능성이 큽니다.";
  }, [clickRankByPath]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f1114",
        color: "#e8eaed",
        padding: "20px 18px 48px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <button
          type="button"
          onClick={() => navigate("/admin")}
          style={adminTopNavButtonStyle}
          aria-label="관리자 허브로"
          title="관리자 허브로"
        >
          ←
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
          검색 인사이트
        </h1>
      </div>

      {loading ? (
        <p style={{ opacity: 0.7 }}>불러오는 중…</p>
      ) : errorMessage ? (
        <p style={{ color: "#e74c3c" }}>{errorMessage}</p>
      ) : (
        <>
          <div
            style={{
              marginBottom: 20,
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid rgba(124, 180, 255, 0.35)",
              background: "rgba(124, 180, 255, 0.08)",
              fontSize: 13,
              lineHeight: 1.55,
            }}
          >
            <strong style={{ opacity: 0.95 }}>다음 할 일</strong>
            <span style={{ opacity: 0.88 }}>
              {" "}
              <code style={{ fontSize: 12 }}>KEYWORD_FALLBACK_UI_MAX_ROWS</code>:{" "}
              먼저 <strong>5</strong>로 2~3일 기준 로그를 쌓고, 그다음{" "}
              <strong>4 또는 6 중 하나만</strong> 바꿔 같은 지표로 비교하면 됩니다.
              <code style={{ fontSize: 12 }}>AI_PARSE_SEARCH_UI_MAX_ROWS</code>는
              그대로 두세요. 상세는{" "}
              <code style={{ fontSize: 12 }}>src/utils/searchBranchTelemetry.js</code>{" "}
              상단 주석.
            </span>
          </div>
          <p style={{ fontSize: 14, opacity: 0.75, marginBottom: 24 }}>
            결과 없는 검색어 집계 · 최근 로그.{" "}
            <code style={{ fontSize: 12 }}>search_logs</code>는{" "}
            <code style={{ fontSize: 12 }}>
              database/migrations/20260408_search_logs_enrichment_and_admin_read.sql
            </code>
            , 클릭 경로·순번은{" "}
            <code style={{ fontSize: 12 }}>
              supabase/migrations/20260430380000_place_click_logs_ctr_columns.sql
            </code>
            , 검색 제출 시 실보이 행 수는{" "}
            <code style={{ fontSize: 12 }}>
              supabase/migrations/20260430390000_search_logs_submit_visible_count.sql
            </code>
            , 경로×구간 교차는{" "}
            <code style={{ fontSize: 12 }}>
              supabase/migrations/20260430400000_search_logs_submit_path_for_ctr_cross.sql
            </code>
            .
          </p>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>
              검색 경로별 상단 클릭 (1~3위 비율)
            </h2>
            <p style={{ fontSize: 13, opacity: 0.72, marginBottom: 12, lineHeight: 1.5 }}>
              <code style={{ fontSize: 12 }}>searchClickPath</code>가 붙은 클릭만
              집계합니다. 최근 4,000건 샘플 기준 — Metabase 등에서는{" "}
              <code style={{ fontSize: 12 }}>
                database/dashboard_click_rank_by_search_click_path.sql
              </code>
              를 그대로 쓰면 됩니다.
            </p>
            <p
              style={{
                fontSize: 13,
                lineHeight: 1.55,
                marginBottom: 12,
                padding: "10px 12px",
                background: "rgba(255,255,255,0.04)",
                borderRadius: 10,
                border: "1px solid #2a2f38",
              }}
            >
              <strong style={{ opacity: 0.9 }}>pure vs fallback</strong>
              <span style={{ opacity: 0.75 }}> — {fallbackVsPureNote}</span>
            </p>
            {clickPathLoadError === "schema" ? (
              <p style={{ fontSize: 13, color: "#f5a623", marginBottom: 12 }}>
                <code style={{ fontSize: 12 }}>place_click_logs</code>에{" "}
                <code style={{ fontSize: 12 }}>search_click_path</code> /{" "}
                <code style={{ fontSize: 12 }}>clicked_rank</code> 컬럼이 없습니다.
                위 CTR 마이그레이션을 적용한 뒤 새로고침하세요.
              </p>
            ) : clickPathLoadError ? (
              <p style={{ fontSize: 13, color: "#e74c3c", marginBottom: 12 }}>
                클릭 경로 로드 오류: {clickPathLoadError}
              </p>
            ) : null}
            <div
              style={{
                border: "1px solid #2a2f38",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#1a1d23", textAlign: "left" }}>
                    <th style={{ padding: 10, fontSize: 12 }}>searchClickPath</th>
                    <th style={{ padding: 10, fontSize: 12, width: 88 }}>
                      순위입력 클릭
                    </th>
                    <th style={{ padding: 10, fontSize: 12, width: 52 }}>1위</th>
                    <th style={{ padding: 10, fontSize: 12, width: 52 }}>2위</th>
                    <th style={{ padding: 10, fontSize: 12, width: 52 }}>3위</th>
                    <th style={{ padding: 10, fontSize: 12, width: 96 }}>
                      1~3위 비율
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {clickRankByPath.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        style={{ padding: 16, opacity: 0.6, fontSize: 13 }}
                      >
                        {clickPathLoadError === "schema"
                          ? "마이그레이션 적용 후 데이터가 쌓이면 표시됩니다."
                          : "아직 경로·순번이 붙은 클릭 로그가 없습니다."}
                      </td>
                    </tr>
                  ) : (
                    clickRankByPath.map((row) => (
                      <tr
                        key={row.path}
                        style={{ borderTop: "1px solid #2a2f38" }}
                      >
                        <td style={{ padding: 10, fontSize: 13 }}>{row.path}</td>
                        <td style={{ padding: 10, fontSize: 13 }}>
                          {row.withRank}
                        </td>
                        <td style={{ padding: 10, fontSize: 13 }}>{row.r1}</td>
                        <td style={{ padding: 10, fontSize: 13 }}>{row.r2}</td>
                        <td style={{ padding: 10, fontSize: 13 }}>{row.r3}</td>
                        <td style={{ padding: 10, fontSize: 13 }}>
                          {row.pctTop3}%
                          <span style={{ opacity: 0.55, fontSize: 11 }}>
                            {" "}
                            ({row.r1to3}/{row.withRank})
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>
              검색 경로별 평균 클릭 순위 (avg clicked_rank)
            </h2>
            <p style={{ fontSize: 13, opacity: 0.72, marginBottom: 12, lineHeight: 1.5 }}>
              같은 <code style={{ fontSize: 12 }}>searchClickPath</code>·순위입력
              클릭만 평균합니다.{" "}
              <strong style={{ opacity: 0.88 }}>숫자가 낮을수록</strong> 리스트
              상단을 더 자주 누릅니다. SQL:{" "}
              <code style={{ fontSize: 12 }}>
                database/dashboard_avg_clicked_rank_by_search_click_path.sql
              </code>
            </p>
            <div
              style={{
                border: "1px solid #2a2f38",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#1a1d23", textAlign: "left" }}>
                    <th style={{ padding: 10, fontSize: 12 }}>searchClickPath</th>
                    <th style={{ padding: 10, fontSize: 12, width: 100 }}>
                      클릭 수
                    </th>
                    <th style={{ padding: 10, fontSize: 12, width: 120 }}>
                      평균 순위
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {avgRankByPath.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        style={{ padding: 16, opacity: 0.6, fontSize: 13 }}
                      >
                        {clickPathLoadError === "schema"
                          ? "마이그레이션 적용 후 데이터가 쌓이면 표시됩니다."
                          : "순위가 붙은 클릭이 없습니다."}
                      </td>
                    </tr>
                  ) : (
                    avgRankByPath.map((row) => (
                      <tr
                        key={`avg-${row.path}`}
                        style={{ borderTop: "1px solid #2a2f38" }}
                      >
                        <td style={{ padding: 10, fontSize: 13 }}>{row.path}</td>
                        <td style={{ padding: 10, fontSize: 13 }}>{row.n}</td>
                        <td style={{ padding: 10, fontSize: 13 }}>
                          {row.avgRank != null ? row.avgRank : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>
              제출 시점 실보이 행 수 구간별 세션 CTR
            </h2>
            <p style={{ fontSize: 13, opacity: 0.72, marginBottom: 12, lineHeight: 1.5 }}>
              분모:{" "}
              <code style={{ fontSize: 12 }}>
                search_logs.submit_user_visible_candidate_count
              </code>
              가 해당 구간인 검색 세션(최근 검색 4,000건 샘플). 분자: 그{" "}
              <code style={{ fontSize: 12 }}>session_id</code>로{" "}
              <code style={{ fontSize: 12 }}>searchClickPath</code>가 붙은 장소
              클릭이 1회 이상 있는 세션. → «많이 보여줄수록 / 좁혀야 잘 눌리는지»
              를 같은 정의로 비교. SQL:{" "}
              <code style={{ fontSize: 12 }}>
                database/dashboard_ctr_by_submit_visible_bucket.sql
              </code>
            </p>
            {searchCtrLoadError === "schema" ? (
              <p style={{ fontSize: 13, color: "#f5a623", marginBottom: 12 }}>
                <code style={{ fontSize: 12 }}>search_logs</code>에{" "}
                <code style={{ fontSize: 12 }}>
                  submit_user_visible_candidate_count
                </code>
                가 없습니다. 20260430390000 마이그레이션 적용 후 새로고침하세요.
              </p>
            ) : searchCtrLoadError ? (
              <p style={{ fontSize: 13, color: "#e74c3c", marginBottom: 12 }}>
                구간 CTR 검색 로드 오류: {searchCtrLoadError}
              </p>
            ) : null}
            <div
              style={{
                border: "1px solid #2a2f38",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#1a1d23", textAlign: "left" }}>
                    <th style={{ padding: 10, fontSize: 12 }}>실보이 행 수 구간</th>
                    <th style={{ padding: 10, fontSize: 12, width: 100 }}>
                      검색 세션
                    </th>
                    <th style={{ padding: 10, fontSize: 12, width: 120 }}>
                      클릭 세션
                    </th>
                    <th style={{ padding: 10, fontSize: 12, width: 88 }}>
                      CTR
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleBucketCtr.map((row) => (
                    <tr
                      key={row.key}
                      style={{ borderTop: "1px solid #2a2f38" }}
                    >
                      <td style={{ padding: 10, fontSize: 13 }}>{row.label}</td>
                      <td style={{ padding: 10, fontSize: 13 }}>{row.sessions}</td>
                      <td style={{ padding: 10, fontSize: 13 }}>{row.converted}</td>
                      <td style={{ padding: 10, fontSize: 13 }}>
                        {row.sessions ? `${row.ctrPct}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p
              style={{
                fontSize: 13,
                lineHeight: 1.55,
                marginTop: 12,
                padding: "10px 12px",
                background: "rgba(255,255,255,0.04)",
                borderRadius: 10,
                border: "1px solid #2a2f38",
              }}
            >
              <strong style={{ opacity: 0.9 }}>구간 CTR 해석</strong>
              <span style={{ opacity: 0.75 }}> — {visibleBucketInsight}</span>
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>
              searchClickPath × 노출 구간 세션 CTR
            </h2>
            <p style={{ fontSize: 13, opacity: 0.72, marginBottom: 12, lineHeight: 1.5 }}>
              행: <code style={{ fontSize: 12 }}>keyword_pure</code> /{" "}
              <code style={{ fontSize: 12 }}>keyword_fallback</code> /{" "}
              <code style={{ fontSize: 12 }}>ai_direct</code> (제출 시점{" "}
              <code style={{ fontSize: 12 }}>submit_initial_search_kind</code>·
              <code style={{ fontSize: 12 }}>submit_keyword_ai_fallback</code>
              로 유도). 열: 실보이 행 수 구간. 셀: 세션 CTR + (클릭 세션/검색 세션).
              SQL:{" "}
              <code style={{ fontSize: 12 }}>
                database/dashboard_ctr_path_by_visible_bucket.sql
              </code>
            </p>
            <div
              style={{
                border: "1px solid #2a2f38",
                borderRadius: 12,
                overflow: "auto",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
                <thead>
                  <tr style={{ background: "#1a1d23", textAlign: "left" }}>
                    <th style={{ padding: 10, fontSize: 12 }}>searchClickPath</th>
                    {VISIBLE_BUCKET_DEFS.map((b) => (
                      <th
                        key={b.key}
                        style={{ padding: 10, fontSize: 11, whiteSpace: "nowrap" }}
                      >
                        {b.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pathByVisibleBucket.map((row) => (
                    <tr
                      key={row.path}
                      style={{ borderTop: "1px solid #2a2f38" }}
                    >
                      <td style={{ padding: 10, fontSize: 12, fontWeight: 600 }}>
                        {row.path}
                      </td>
                      {row.buckets.map((cell) => (
                        <td
                          key={cell.key}
                          style={{ padding: 10, fontSize: 12, verticalAlign: "top" }}
                        >
                          {cell.sessions ? (
                            <>
                              <div>{cell.ctrPct}%</div>
                              <div style={{ fontSize: 10, opacity: 0.55 }}>
                                {cell.converted}/{cell.sessions}
                              </div>
                            </>
                          ) : (
                            <span style={{ opacity: 0.45 }}>—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p
              style={{
                fontSize: 13,
                lineHeight: 1.55,
                marginTop: 12,
                padding: "10px 12px",
                background: "rgba(255,255,255,0.04)",
                borderRadius: 10,
                border: "1px solid #2a2f38",
              }}
            >
              <strong style={{ opacity: 0.9 }}>교차표 해석</strong>
              <span style={{ opacity: 0.75 }}> — {pathByVisibleInsight}</span>
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, marginBottom: 12 }}>
              무결과 검색어 TOP (최근 400건 기준)
            </h2>
            <div
              style={{
                border: "1px solid #2a2f38",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#1a1d23", textAlign: "left" }}>
                    <th style={{ padding: 10, fontSize: 12 }}>검색어</th>
                    <th style={{ padding: 10, fontSize: 12, width: 72 }}>건수</th>
                  </tr>
                </thead>
                <tbody>
                  {zeroAggregates.length === 0 ? (
                    <tr>
                      <td
                        colSpan={2}
                        style={{ padding: 16, opacity: 0.6, fontSize: 13 }}
                      >
                        무결과 로그가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    zeroAggregates.map((row) => (
                      <tr
                        key={row.query}
                        style={{ borderTop: "1px solid #2a2f38" }}
                      >
                        <td style={{ padding: 10, fontSize: 13 }}>{row.query}</td>
                        <td style={{ padding: 10, fontSize: 13 }}>{row.count}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 style={{ fontSize: 16, marginBottom: 12 }}>최근 검색 로그</h2>
            <div
              style={{
                border: "1px solid #2a2f38",
                borderRadius: 12,
                overflow: "auto",
                maxHeight: 420,
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#1a1d23", textAlign: "left" }}>
                    <th style={{ padding: 8, fontSize: 11 }}>시간</th>
                    <th style={{ padding: 8, fontSize: 11 }}>검색어</th>
                    <th style={{ padding: 8, fontSize: 11 }}>결과</th>
                    <th style={{ padding: 8, fontSize: 11 }}>모드</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRows.map((row, i) => (
                    <tr
                      key={`${row.timestamp}-${i}`}
                      style={{ borderTop: "1px solid #2a2f38" }}
                    >
                      <td style={{ padding: 8, fontSize: 11, whiteSpace: "nowrap" }}>
                        {row.timestamp
                          ? new Date(row.timestamp).toLocaleString("ko-KR")
                          : "-"}
                      </td>
                      <td style={{ padding: 8, fontSize: 12 }}>
                        {row.user_query}
                      </td>
                      <td style={{ padding: 8, fontSize: 11 }}>
                        {row.has_results
                          ? `${row.results_count ?? "?"}건`
                          : "없음"}
                      </td>
                      <td style={{ padding: 8, fontSize: 11 }}>
                        {row.search_mode || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
