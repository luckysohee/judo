import { useCallback, useEffect, useState } from "react";
import {
  fetchFeaturedCollections,
  isFeaturedActive,
  setCollectionFeatured,
} from "../../api/collections";
import { dedupeAndNormalizeCollectionTags } from "../../utils/collectionTags";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 관리자 — 현재 활성 추천 컬렉션 목록 + ID 로 신규 추천 등록.
 *
 * RLS: `Admins can update featured fields on collections` 정책이 admin role 한정으로
 * UPDATE 를 허용한다. 비관리자에게는 update 가 0행으로 떨어지고 UI 도 에러를 표시한다.
 *
 * @param {{ onChanged?: () => void }} props
 *   부모(`CollectionInsightsPage`) 에서 TOP10 테이블 reload 트리거에 사용한다.
 */
export default function AdminFeaturedCollectionsPanel({ onChanged }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyById, setBusyById] = useState({});
  const [rankInputById, setRankInputById] = useState({});
  const [untilInputById, setUntilInputById] = useState({});

  const [newCid, setNewCid] = useState("");
  const [newRank, setNewRank] = useState("");
  const [newUntil, setNewUntil] = useState("");
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState("");

  const reload = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const rows = await fetchFeaturedCollections({ limit: 50 });
      setItems(Array.isArray(rows) ? rows : []);
      const nextRanks = {};
      const nextUntils = {};
      for (const r of rows) {
        nextRanks[r.id] =
          r.featured_rank == null ? "" : String(r.featured_rank);
        nextUntils[r.id] = r.featured_until
          ? String(r.featured_until).slice(0, 16)
          : "";
      }
      setRankInputById(nextRanks);
      setUntilInputById(nextUntils);
    } catch (e) {
      setError(e?.message || "Featured 목록을 불러오지 못했습니다.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const setBusy = (id, on) => {
    setBusyById((prev) => ({ ...prev, [id]: on }));
  };

  const onSaveRow = useCallback(
    async (row) => {
      setBusy(row.id, true);
      setError("");
      try {
        const rankRaw = rankInputById[row.id];
        const untilRaw = untilInputById[row.id];
        const rank =
          rankRaw === "" || rankRaw == null
            ? null
            : Number.parseInt(String(rankRaw), 10);
        const featuredUntil =
          untilRaw && String(untilRaw).trim()
            ? new Date(untilRaw).toISOString()
            : null;
        const { data, error: err } = await setCollectionFeatured(row.id, {
          isFeatured: true,
          featuredRank: Number.isFinite(rank) ? rank : null,
          featuredUntil,
        });
        if (err) throw err;
        if (!data) throw new Error("권한이 없거나 컬렉션을 찾을 수 없습니다.");
        await reload();
        onChanged?.();
      } catch (e) {
        setError(e?.message || "저장에 실패했습니다.");
      } finally {
        setBusy(row.id, false);
      }
    },
    [rankInputById, untilInputById, reload, onChanged],
  );

  const onUnfeature = useCallback(
    async (row) => {
      setBusy(row.id, true);
      setError("");
      try {
        const { error: err } = await setCollectionFeatured(row.id, {
          isFeatured: false,
          featuredRank: null,
          featuredUntil: null,
        });
        if (err) throw err;
        await reload();
        onChanged?.();
      } catch (e) {
        setError(e?.message || "추천 해제에 실패했습니다.");
      } finally {
        setBusy(row.id, false);
      }
    },
    [reload, onChanged],
  );

  const onCreateFeatured = useCallback(
    async (e) => {
      e.preventDefault();
      const cid = String(newCid || "").trim();
      if (!UUID_RE.test(cid)) {
        setCreateMsg("UUID 형식의 collection_id 가 필요합니다.");
        return;
      }
      setCreating(true);
      setCreateMsg("");
      setError("");
      try {
        const rank =
          newRank === "" ? null : Number.parseInt(String(newRank), 10);
        const featuredUntil =
          newUntil && String(newUntil).trim()
            ? new Date(newUntil).toISOString()
            : null;
        const { data, error: err } = await setCollectionFeatured(cid, {
          isFeatured: true,
          featuredRank: Number.isFinite(rank) ? rank : null,
          featuredUntil,
        });
        if (err) throw err;
        if (!data) {
          throw new Error(
            "권한이 없거나 해당 ID 의 컬렉션을 찾을 수 없습니다.",
          );
        }
        setCreateMsg("추천으로 등록했습니다.");
        setNewCid("");
        setNewRank("");
        setNewUntil("");
        await reload();
        onChanged?.();
      } catch (err) {
        setCreateMsg(err?.message || "등록에 실패했습니다.");
      } finally {
        setCreating(false);
      }
    },
    [newCid, newRank, newUntil, reload, onChanged],
  );

  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Featured 관리</h2>
      <p
        style={{
          fontSize: 13,
          opacity: 0.72,
          marginBottom: 12,
          lineHeight: 1.5,
        }}
      >
        ★ 표시한 컬렉션은 홈「공개 컬렉션 레일」/「지금 뜨는 코스」 상단에
        우선 노출됩니다. <code style={{ fontSize: 12 }}>featured_rank</code> 가
        낮을수록 먼저, <code style={{ fontSize: 12 }}>featured_until</code> 이
        지나면 자동으로 일반 코스로 처리됩니다.
      </p>

      {error ? (
        <p style={{ fontSize: 13, color: "#e74c3c", marginBottom: 12 }}>
          {error}
        </p>
      ) : null}

      <div
        style={{
          border: "1px solid #2a2f38",
          borderRadius: 12,
          overflow: "auto",
          marginBottom: 14,
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: 720,
          }}
        >
          <thead>
            <tr style={{ background: "#1a1d23", textAlign: "left" }}>
              <th style={{ padding: 10, fontSize: 12 }}>컬렉션</th>
              <th style={{ padding: 10, fontSize: 12, width: 90 }}>rank</th>
              <th style={{ padding: 10, fontSize: 12, width: 200 }}>
                until (local)
              </th>
              <th style={{ padding: 10, fontSize: 12, width: 80 }}>상태</th>
              <th style={{ padding: 10, fontSize: 12, width: 200 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={5}
                  style={{ padding: 16, opacity: 0.6, fontSize: 13 }}
                >
                  불러오는 중…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{ padding: 16, opacity: 0.6, fontSize: 13 }}
                >
                  현재 활성 추천 컬렉션이 없습니다.
                </td>
              </tr>
            ) : (
              items.map((row) => {
                const busy = !!busyById[row.id];
                const active = isFeaturedActive(row);
                return (
                  <tr
                    key={row.id}
                    style={{ borderTop: "1px solid #2a2f38" }}
                  >
                    <td style={{ padding: 10, fontSize: 13 }}>
                      <div>{row.title || "(제목 없음)"}</div>
                      <div
                        style={{
                          fontSize: 10,
                          opacity: 0.5,
                          fontFamily: "monospace",
                        }}
                      >
                        {row.id}
                      </div>
                      {(() => {
                        const tags = dedupeAndNormalizeCollectionTags(row.tags);
                        if (tags.length === 0) {
                          return (
                            <div style={tagStyles.empty}>태그 없음</div>
                          );
                        }
                        return (
                          <div style={tagStyles.row}>
                            {tags.map((t) => (
                              <span
                                key={t.toLowerCase()}
                                style={tagStyles.chip}
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                    </td>
                    <td style={{ padding: 10, fontSize: 13 }}>
                      <input
                        type="number"
                        step={1}
                        value={rankInputById[row.id] ?? ""}
                        onChange={(e) =>
                          setRankInputById((prev) => ({
                            ...prev,
                            [row.id]: e.target.value,
                          }))
                        }
                        style={inputStyle(70)}
                        placeholder="—"
                      />
                    </td>
                    <td style={{ padding: 10, fontSize: 13 }}>
                      <input
                        type="datetime-local"
                        value={untilInputById[row.id] ?? ""}
                        onChange={(e) =>
                          setUntilInputById((prev) => ({
                            ...prev,
                            [row.id]: e.target.value,
                          }))
                        }
                        style={inputStyle(180)}
                      />
                    </td>
                    <td style={{ padding: 10, fontSize: 12 }}>
                      {active ? (
                        <span style={badgeStyles.on}>활성</span>
                      ) : (
                        <span style={badgeStyles.off}>만료</span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: 10,
                        fontSize: 12,
                        display: "flex",
                        gap: 6,
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => void onSaveRow(row)}
                        disabled={busy}
                        style={btnStyles.primary}
                      >
                        {busy ? "저장 중…" : "저장"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void onUnfeature(row)}
                        disabled={busy}
                        style={btnStyles.danger}
                      >
                        해제
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={onCreateFeatured} style={createFormStyles.wrap}>
        <div style={createFormStyles.title}>ID 로 추천 등록</div>
        <div style={createFormStyles.row}>
          <input
            type="text"
            value={newCid}
            onChange={(e) => setNewCid(e.target.value)}
            placeholder="collection uuid"
            style={inputStyle(280)}
            spellCheck={false}
          />
          <input
            type="number"
            step={1}
            value={newRank}
            onChange={(e) => setNewRank(e.target.value)}
            placeholder="rank"
            style={inputStyle(80)}
          />
          <input
            type="datetime-local"
            value={newUntil}
            onChange={(e) => setNewUntil(e.target.value)}
            style={inputStyle(200)}
          />
          <button
            type="submit"
            disabled={creating}
            style={btnStyles.primary}
          >
            {creating ? "등록 중…" : "추천 등록"}
          </button>
        </div>
        {createMsg ? (
          <div style={createFormStyles.msg}>{createMsg}</div>
        ) : null}
      </form>
    </section>
  );
}

function inputStyle(width) {
  return {
    width,
    maxWidth: "100%",
    background: "#0c0e12",
    border: "1px solid #333",
    borderRadius: 8,
    color: "#e8eaed",
    padding: "6px 8px",
    fontSize: 12,
    fontFamily: "system-ui, sans-serif",
  };
}

const btnStyles = {
  primary: {
    border: "1px solid rgba(46,204,113,0.5)",
    background: "rgba(46,204,113,0.18)",
    color: "#d4f4dd",
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  danger: {
    border: "1px solid rgba(231,76,60,0.45)",
    background: "rgba(231,76,60,0.12)",
    color: "#f5b7b1",
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
};

const badgeStyles = {
  on: {
    fontSize: 11,
    fontWeight: 800,
    color: "#0c1410",
    background:
      "linear-gradient(135deg, rgba(253,230,138,0.95), rgba(251,191,36,0.95))",
    border: "1px solid rgba(217,119,6,0.55)",
    borderRadius: 999,
    padding: "2px 8px",
    letterSpacing: "0.04em",
  },
  off: {
    fontSize: 11,
    fontWeight: 700,
    color: "rgba(255,255,255,0.55)",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.16)",
    borderRadius: 999,
    padding: "2px 8px",
  },
};

const tagStyles = {
  row: {
    display: "flex",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
  },
  chip: {
    fontSize: 10,
    fontWeight: 800,
    color: "#d4f4dd",
    background: "rgba(46,204,113,0.14)",
    border: "1px solid rgba(46,204,113,0.42)",
    borderRadius: 999,
    padding: "1px 6px",
    letterSpacing: "-0.01em",
  },
  empty: {
    fontSize: 10,
    fontWeight: 700,
    color: "rgba(255,255,255,0.35)",
    marginTop: 4,
    fontStyle: "italic",
  },
};

const createFormStyles = {
  wrap: {
    border: "1px solid #2a2f38",
    borderRadius: 12,
    padding: 12,
    background: "rgba(255,255,255,0.02)",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  title: { fontSize: 13, fontWeight: 800, color: "#e8eaed" },
  row: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },
  msg: { fontSize: 12, color: "rgba(255,255,255,0.7)" },
};
