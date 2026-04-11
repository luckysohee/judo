import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { adminTopNavButtonStyle } from "../styles/adminTopNavButton";

export default function SearchInsightsPage() {
  const navigate = useNavigate();
  const { loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [zeroRows, setZeroRows] = useState([]);
  const [recentRows, setRecentRows] = useState([]);

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
        setErrorMessage("");
      } catch (e) {
        console.error("SearchInsightsPage:", e);
        setErrorMessage(e?.message || "데이터를 불러오지 못했습니다.");
        setZeroRows([]);
        setRecentRows([]);
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
          <p style={{ fontSize: 14, opacity: 0.75, marginBottom: 24 }}>
            결과 없는 검색어 집계 · 최근 로그. DB에{" "}
            <code style={{ fontSize: 12 }}>search_logs</code> 확장 마이그레이션을
            적용해야 일부 컬럼이 보입니다. (
            <code style={{ fontSize: 12 }}>
              database/migrations/20260408_search_logs_enrichment_and_admin_read.sql
            </code>
            )
          </p>

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
