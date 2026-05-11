import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminFeaturedCollectionsPanel from "../components/Admin/AdminFeaturedCollectionsPanel";
import { isFeaturedActive, setCollectionFeatured } from "../api/collections";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { adminTopNavButtonStyle } from "../styles/adminTopNavButton";
import { dedupeAndNormalizeCollectionTags } from "../utils/collectionTags";
import {
  HOME_LAYOUT_BUCKETS,
  HOME_LAYOUT_EXPERIMENT_KEY,
  HOME_LAYOUT_EXPERIMENT_NAME,
  HOME_LAYOUT_EXPERIMENT_VERSION,
} from "../utils/experiments";

const topRowTagStyles = {
  row: { display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 },
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
  more: {
    fontSize: 10,
    fontWeight: 700,
    color: "rgba(255,255,255,0.6)",
  },
};

const guardrailStyles = {
  warnBadge: {
    display: "inline-flex",
    marginLeft: 8,
    padding: "1px 6px",
    borderRadius: 999,
    border: "1px solid rgba(245,166,35,0.55)",
    background: "rgba(245,166,35,0.12)",
    color: "#f5c16c",
    fontSize: 10,
    fontWeight: 800,
  },
  sampleWarn: {
    color: "#f5c16c",
    fontWeight: 800,
  },
  sampleOk: {
    color: "#9ad3a4",
    fontWeight: 800,
  },
};

const SECTION_DEFS = [
  { key: "home_hot_collections", label: "지금 뜨는 코스 (홈)" },
  { key: "home_curator_activity_feed", label: "큐레이터 활동 피드 (홈)" },
  { key: "home_public_collections_rail", label: "공개 컬렉션 레일 (홈)" },
  { key: "home_tag_rail", label: "상황 태그 레일 (홈)" },
  { key: "public_collections_grid", label: "프로필 공개 컬렉션 그리드" },
];

const SHARE_SECTION_KEY = "collection_detail_share";
const EVENT_OPEN = "collection_open";
const EVENT_SHARE = "collection_share_success";

const RECENT_WINDOW_DAYS = 7;
const FETCH_LIMIT = 5000;
const TOP_LIMIT = 10;
const EXPERIMENT_MIN_IMPRESSIONS = 100;

function isSchemaError(err) {
  if (!err) return false;
  const msg = String(err.message || err).toLowerCase();
  return /column|relation|42p01|42703|does not exist/.test(msg);
}

function aggregateBySection(rows) {
  const byKey = new Map();
  for (const def of SECTION_DEFS) {
    byKey.set(def.key, { key: def.key, label: def.label, clicks: 0 });
  }
  let shareCount = 0;
  for (const r of rows) {
    if (r.event_type === EVENT_SHARE) {
      shareCount += 1;
      continue;
    }
    if (r.event_type !== EVENT_OPEN) continue;
    const cell = byKey.get(r.source_section);
    if (cell) cell.clicks += 1;
  }
  return {
    sectionRows: [...byKey.values()].sort((a, b) => b.clicks - a.clicks),
    shareCount,
  };
}

function aggregateImpressionsBySection(rows) {
  const byKey = new Map();
  for (const def of SECTION_DEFS) {
    byKey.set(def.key, {
      key: def.key,
      label: def.label,
      impressions: 0,
      item_sum: 0,
      logged_in_impressions: 0,
      followed_impressions: 0,
    });
  }
  for (const r of rows) {
    const cell = byKey.get(r.section_name);
    if (!cell) continue;
    cell.impressions += 1;
    cell.item_sum += Math.max(0, Number(r.item_count) || 0);
    if (r.logged_in) cell.logged_in_impressions += 1;
    if (r.followed_only) cell.followed_impressions += 1;
  }
  return {
    sectionRows: [...byKey.values()].sort(
      (a, b) => b.impressions - a.impressions,
    ),
  };
}

function joinClicksAndImpressions(clickAgg, imprAgg) {
  const imprByKey = new Map();
  (imprAgg?.sectionRows || []).forEach((r) => imprByKey.set(r.key, r));
  return (clickAgg?.sectionRows || []).map((c) => {
    const impr = imprByKey.get(c.key);
    const impressions = impr?.impressions || 0;
    const ctr = impressions > 0 ? c.clicks / impressions : 0;
    return {
      key: c.key,
      label: c.label,
      clicks: c.clicks,
      impressions,
      ctr,
    };
  });
}

function aggregateByCollection(logRows, saveRows) {
  const byCollection = new Map();
  const ensure = (id) => {
    if (!id) return null;
    if (!byCollection.has(id)) {
      byCollection.set(id, {
        collection_id: id,
        clicks: 0,
        shares: 0,
        saves: 0,
      });
    }
    return byCollection.get(id);
  };
  for (const r of logRows) {
    const cell = ensure(r.collection_id);
    if (!cell) continue;
    if (r.event_type === EVENT_OPEN) cell.clicks += 1;
    else if (r.event_type === EVENT_SHARE) cell.shares += 1;
  }
  for (const s of saveRows) {
    const cell = ensure(s.collection_id);
    if (!cell) continue;
    cell.saves += 1;
  }
  return [...byCollection.values()];
}

function bucketLabel(v) {
  const s = String(v || "").trim();
  return s || "unbucketed";
}

function buildCtrByBucket(logRows, impressionRows) {
  const clickBy = new Map(); // key = bucket|section
  const imprBy = new Map();

  for (const r of impressionRows || []) {
    const b = bucketLabel(r?.experiment_bucket);
    const sec = String(r?.section_name || "").trim();
    if (!sec) continue;
    const k = `${b}||${sec}`;
    imprBy.set(k, (imprBy.get(k) || 0) + 1);
  }

  for (const r of logRows || []) {
    if (r?.event_type !== EVENT_OPEN) continue;
    const b = bucketLabel(r?.experiment_bucket);
    const sec = String(r?.source_section || "").trim();
    if (!sec) continue;
    const k = `${b}||${sec}`;
    clickBy.set(k, (clickBy.get(k) || 0) + 1);
  }

  const sections = SECTION_DEFS.map((d) => d.key);
  const buckets = Array.from(
    new Set([
      ...Array.from(imprBy.keys()).map((k) => k.split("||")[0]),
      ...Array.from(clickBy.keys()).map((k) => k.split("||")[0]),
    ]),
  ).sort();

  const rows = [];
  for (const b of buckets) {
    for (const sec of sections) {
      const k = `${b}||${sec}`;
      const impressions = imprBy.get(k) || 0;
      const clicks = clickBy.get(k) || 0;
      rows.push({
        bucket: b,
        section: sec,
        impressions,
        clicks,
        ctr: impressions > 0 ? clicks / impressions : 0,
      });
    }
  }

  const labelBySection = SECTION_DEFS.reduce((acc, d) => {
    acc[d.key] = d.label;
    return acc;
  }, {});

  return {
    buckets,
    rows: rows.map((r) => ({ ...r, label: labelBySection[r.section] || r.section })),
  };
}

function buildBucketGuardrails(logRows, impressionRows) {
  const homeSectionSet = new Set(SECTION_DEFS.map((d) => d.key));
  const expectedBuckets = HOME_LAYOUT_BUCKETS;
  const impressionByBucket = new Map(expectedBuckets.map((b) => [b, 0]));
  const clickByBucket = new Map(expectedBuckets.map((b) => [b, 0]));
  let totalRelevantLogs = 0;
  let missingBucketLogs = 0;

  const countBucketHealth = (rawBucket) => {
    totalRelevantLogs += 1;
    const bucket = typeof rawBucket === "string" ? rawBucket.trim() : "";
    if (!bucket) missingBucketLogs += 1;
    return bucket || "unbucketed";
  };

  for (const r of impressionRows || []) {
    const sec = String(r?.section_name || "").trim();
    if (!homeSectionSet.has(sec)) continue;
    const bucket = countBucketHealth(r?.experiment_bucket);
    impressionByBucket.set(bucket, (impressionByBucket.get(bucket) || 0) + 1);
  }

  for (const r of logRows || []) {
    if (r?.event_type !== EVENT_OPEN) continue;
    const sec = String(r?.source_section || "").trim();
    if (!homeSectionSet.has(sec)) continue;
    const bucket = countBucketHealth(r?.experiment_bucket);
    clickByBucket.set(bucket, (clickByBucket.get(bucket) || 0) + 1);
  }

  const allBuckets = Array.from(
    new Set([
      ...expectedBuckets,
      ...Array.from(impressionByBucket.keys()),
      ...Array.from(clickByBucket.keys()),
    ]),
  ).sort((a, b) => {
    const ai = expectedBuckets.indexOf(a);
    const bi = expectedBuckets.indexOf(b);
    if (ai !== -1 || bi !== -1) {
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    }
    return a.localeCompare(b);
  });

  const rows = allBuckets.map((bucket) => {
    const impressions = impressionByBucket.get(bucket) || 0;
    const clicks = clickByBucket.get(bucket) || 0;
    return {
      bucket,
      sample_size: impressions,
      impressions,
      clicks,
      ctr: impressions > 0 ? clicks / impressions : 0,
      insufficient: impressions < EXPERIMENT_MIN_IMPRESSIONS,
      expected: expectedBuckets.includes(bucket),
    };
  });

  return {
    rows,
    missingBucketLogs,
    totalRelevantLogs,
    missingBucketRatio:
      totalRelevantLogs > 0 ? missingBucketLogs / totalRelevantLogs : 0,
  };
}

export default function CollectionInsightsPage() {
  const navigate = useNavigate();
  const { loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [logRows, setLogRows] = useState([]);
  const [saveRows, setSaveRows] = useState([]);
  const [impressionRows, setImpressionRows] = useState([]);
  const [titleById, setTitleById] = useState({});
  const [logError, setLogError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [impressionError, setImpressionError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [busyTopFeatureId, setBusyTopFeatureId] = useState(null);
  const [topFeatureError, setTopFeatureError] = useState("");

  const triggerReload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const since = new Date(
        Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString();

      let safeLogRows = [];
      let safeSaveRows = [];
      let safeImpressionRows = [];

      try {
        const { data, error } = await supabase
          .from("collection_interaction_logs")
          .select(
            "event_type, source_section, collection_id, experiment_bucket, created_at",
          )
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(FETCH_LIMIT);
        if (error) throw error;
        safeLogRows = Array.isArray(data) ? data : [];
        if (!cancelled) setLogError("");
      } catch (e) {
        console.warn("CollectionInsightsPage logs:", e);
        if (!cancelled) {
          setLogError(
            isSchemaError(e)
              ? "schema"
              : e?.message || "클릭 로그를 불러오지 못했습니다.",
          );
        }
      }

      try {
        const { data, error } = await supabase
          .from("home_section_impression_logs")
          .select(
            "section_name, item_count, logged_in, followed_only, experiment_bucket, created_at",
          )
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(FETCH_LIMIT);
        if (error) throw error;
        safeImpressionRows = Array.isArray(data) ? data : [];
        if (!cancelled) setImpressionError("");
      } catch (e) {
        console.warn("CollectionInsightsPage impressions:", e);
        if (!cancelled) {
          setImpressionError(
            isSchemaError(e)
              ? "schema"
              : e?.message || "노출 로그를 불러오지 못했습니다.",
          );
        }
      }

      try {
        const { data, error } = await supabase
          .from("collection_saves")
          .select("collection_id, created_at")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(FETCH_LIMIT);
        if (error) throw error;
        safeSaveRows = Array.isArray(data) ? data : [];
        if (!cancelled) setSaveError("");
      } catch (e) {
        console.warn("CollectionInsightsPage saves:", e);
        if (!cancelled) {
          setSaveError(
            isSchemaError(e)
              ? "schema"
              : e?.message || "저장 데이터를 불러오지 못했습니다.",
          );
        }
      }

      const idSet = new Set();
      for (const r of safeLogRows) {
        if (r?.collection_id) idSet.add(String(r.collection_id));
      }
      for (const r of safeSaveRows) {
        if (r?.collection_id) idSet.add(String(r.collection_id));
      }
      const ids = [...idSet];

      let titles = {};
      if (ids.length > 0) {
        try {
          const { data, error } = await supabase
            .from("collections")
            .select(
              "id, title, visibility, is_featured, featured_rank, featured_until, tags",
            )
            .in("id", ids);
          if (error) throw error;
          titles = (Array.isArray(data) ? data : []).reduce((acc, row) => {
            acc[row.id] = row;
            return acc;
          }, {});
        } catch (e) {
          console.warn("CollectionInsightsPage titles:", e);
        }
      }

      if (!cancelled) {
        setLogRows(safeLogRows);
        setSaveRows(safeSaveRows);
        setImpressionRows(safeImpressionRows);
        setTitleById(titles);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, reloadKey]);

  const onToggleFeatureFromTop = useCallback(
    async (cid, currentlyOn) => {
      setBusyTopFeatureId(cid);
      setTopFeatureError("");
      try {
        const { data, error } = await setCollectionFeatured(cid, {
          isFeatured: !currentlyOn,
          featuredRank: currentlyOn ? null : 0,
          featuredUntil: currentlyOn ? null : undefined,
        });
        if (error) throw error;
        if (!data) {
          throw new Error("권한이 없거나 컬렉션을 찾을 수 없습니다.");
        }
        triggerReload();
      } catch (e) {
        setTopFeatureError(e?.message || "추천 토글에 실패했습니다.");
      } finally {
        setBusyTopFeatureId(null);
      }
    },
    [triggerReload],
  );

  const sectionAgg = useMemo(() => aggregateBySection(logRows), [logRows]);
  const impressionAgg = useMemo(
    () => aggregateImpressionsBySection(impressionRows),
    [impressionRows],
  );
  const ctrRows = useMemo(
    () => joinClicksAndImpressions(sectionAgg, impressionAgg),
    [impressionAgg, sectionAgg],
  );
  const bucketCtr = useMemo(
    () => buildCtrByBucket(logRows, impressionRows),
    [logRows, impressionRows],
  );
  const bucketGuardrails = useMemo(
    () => buildBucketGuardrails(logRows, impressionRows),
    [logRows, impressionRows],
  );
  const totalOpenClicks = useMemo(
    () => sectionAgg.sectionRows.reduce((s, r) => s + r.clicks, 0),
    [sectionAgg],
  );

  const collectionAgg = useMemo(
    () => aggregateByCollection(logRows, saveRows),
    [logRows, saveRows],
  );

  const topCollections = useMemo(() => {
    return [...collectionAgg]
      .map((row) => {
        const meta = titleById[row.collection_id] || {};
        return {
          ...row,
          title: meta.title || "(제목 없음)",
          visibility: meta.visibility || null,
          is_featured: meta.is_featured === true,
          featured_rank: Number.isFinite(meta.featured_rank)
            ? meta.featured_rank
            : null,
          featured_until: meta.featured_until ?? null,
          tags: Array.isArray(meta.tags) ? meta.tags : [],
        };
      })
      .sort((a, b) => {
        if (b.clicks !== a.clicks) return b.clicks - a.clicks;
        if (b.saves !== a.saves) return b.saves - a.saves;
        return b.shares - a.shares;
      })
      .slice(0, TOP_LIMIT);
  }, [collectionAgg, titleById]);

  const totalShares = sectionAgg.shareCount;
  const totalSaves = saveRows.length;

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
          컬렉션 인사이트
        </h1>
      </div>

      <p style={{ fontSize: 14, opacity: 0.75, marginBottom: 20 }}>
        최근 <strong>{RECENT_WINDOW_DAYS}일</strong> 기준 컬렉션 카드 클릭·공유·저장
        집계.{" "}
        <code style={{ fontSize: 12 }}>collection_interaction_logs</code>
        ·<code style={{ fontSize: 12 }}>collection_saves</code> 사용 (홈/지도/검색
        파이프라인과 분리). 로그가 한쪽만 비어 있어도 다른 카드는 정상 노출됩니다.
      </p>

      {logError === "schema" ? (
        <p style={{ fontSize: 13, color: "#f5a623", marginBottom: 16 }}>
          <code style={{ fontSize: 12 }}>collection_interaction_logs</code>{" "}
          테이블이 없습니다.{" "}
          <code style={{ fontSize: 12 }}>
            supabase/migrations/20260511120000_collection_interaction_logs.sql
          </code>{" "}
          적용 후 새로고침하세요.
        </p>
      ) : logError ? (
        <p style={{ fontSize: 13, color: "#e74c3c", marginBottom: 16 }}>
          클릭 로그 로드 오류: {logError}
        </p>
      ) : null}
      {saveError && saveError !== "schema" ? (
        <p style={{ fontSize: 13, color: "#e74c3c", marginBottom: 16 }}>
          저장 로드 오류: {saveError}
        </p>
      ) : null}
      {impressionError === "schema" ? (
        <p style={{ fontSize: 13, color: "#f5a623", marginBottom: 16 }}>
          <code style={{ fontSize: 12 }}>home_section_impression_logs</code>{" "}
          테이블이 없습니다.{" "}
          <code style={{ fontSize: 12 }}>
            supabase/migrations/20260514130000_home_section_impression_logs.sql
          </code>{" "}
          적용 후 새로고침하세요.
        </p>
      ) : impressionError ? (
        <p style={{ fontSize: 13, color: "#e74c3c", marginBottom: 16 }}>
          노출 로그 로드 오류: {impressionError}
        </p>
      ) : null}

      <AdminFeaturedCollectionsPanel onChanged={triggerReload} />

      {loading ? (
        <p style={{ opacity: 0.7 }}>불러오는 중…</p>
      ) : (
        <>
          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 16, marginBottom: 12 }}>요약</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 12,
              }}
            >
              <SummaryCard
                title="컬렉션 카드 클릭"
                value={totalOpenClicks}
                hint={`섹션 ${SECTION_DEFS.length}개 합계 (${SHARE_SECTION_KEY} 제외)`}
              />
              <SummaryCard
                title="공유 성공"
                value={totalShares}
                hint="상세 공유 버튼 (Web Share + 클립보드)"
              />
              <SummaryCard
                title="저장(라이브러리)"
                value={totalSaves}
                hint="collection_saves 신규 행"
              />
            </div>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>
              섹션별 클릭 수 (최근 {RECENT_WINDOW_DAYS}일)
            </h2>
            <p
              style={{
                fontSize: 13,
                opacity: 0.72,
                marginBottom: 12,
                lineHeight: 1.5,
              }}
            >
              <code style={{ fontSize: 12 }}>event_type = {EVENT_OPEN}</code>{" "}
              기준. 공유는 별도 합계로 표기됩니다.
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
                    <th style={{ padding: 10, fontSize: 12 }}>섹션</th>
                    <th style={{ padding: 10, fontSize: 12, width: 100 }}>
                      클릭 수
                    </th>
                    <th style={{ padding: 10, fontSize: 12, width: 100 }}>
                      비중
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sectionAgg.sectionRows.map((row) => {
                    const pct =
                      totalOpenClicks > 0
                        ? Math.round((1000 * row.clicks) / totalOpenClicks) / 10
                        : 0;
                    return (
                      <tr
                        key={row.key}
                        style={{ borderTop: "1px solid #2a2f38" }}
                      >
                        <td style={{ padding: 10, fontSize: 13 }}>
                          {row.label}
                          <div
                            style={{
                              fontSize: 10,
                              opacity: 0.5,
                              fontFamily: "monospace",
                            }}
                          >
                            {row.key}
                          </div>
                        </td>
                        <td style={{ padding: 10, fontSize: 13 }}>
                          {row.clicks}
                        </td>
                        <td style={{ padding: 10, fontSize: 13 }}>
                          {totalOpenClicks > 0 ? `${pct}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>
              노출 대비 클릭 (CTR) (최근 {RECENT_WINDOW_DAYS}일)
            </h2>
            {impressionError === "schema" ? (
              <p style={{ fontSize: 13, opacity: 0.75, marginBottom: 12 }}>
                <strong>home_section_impression_logs</strong> 테이블이 아직 없어서 CTR을
                계산할 수 없습니다.
              </p>
            ) : (
              <p
                style={{
                  fontSize: 13,
                  opacity: 0.72,
                  marginBottom: 12,
                  lineHeight: 1.5,
                }}
              >
                <code style={{ fontSize: 12 }}>impressions</code> 는 섹션 viewport 진입
                1회 기준. <code style={{ fontSize: 12 }}>clicks</code> 는{" "}
                <code style={{ fontSize: 12 }}>event_type = {EVENT_OPEN}</code>{" "}
                기준입니다.
              </p>
            )}
            {impressionError === "schema" ? null : (
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
                      <th style={{ padding: 10, fontSize: 12 }}>섹션</th>
                      <th style={{ padding: 10, fontSize: 12, width: 110 }}>
                        노출
                      </th>
                      <th style={{ padding: 10, fontSize: 12, width: 110 }}>
                        클릭
                      </th>
                      <th style={{ padding: 10, fontSize: 12, width: 110 }}>
                        CTR
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ctrRows.map((row) => {
                      const pct =
                        row.impressions > 0
                          ? Math.round(row.ctr * 1000) / 10
                          : 0;
                      return (
                        <tr
                          key={`ctr-${row.key}`}
                          style={{ borderTop: "1px solid #2a2f38" }}
                        >
                          <td style={{ padding: 10, fontSize: 13 }}>
                            {row.label}
                            <div
                              style={{
                                fontSize: 10,
                                opacity: 0.5,
                                fontFamily: "monospace",
                              }}
                            >
                              {row.key}
                            </div>
                          </td>
                          <td style={{ padding: 10, fontSize: 13 }}>
                            {row.impressions}
                          </td>
                          <td style={{ padding: 10, fontSize: 13 }}>
                            {row.clicks}
                          </td>
                          <td style={{ padding: 10, fontSize: 13 }}>
                            {row.impressions > 0 ? `${pct}%` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>
              Bucket 별 CTR 비교 (최근 {RECENT_WINDOW_DAYS}일)
            </h2>
            {impressionError === "schema" ? (
              <p style={{ fontSize: 13, opacity: 0.75, marginBottom: 12 }}>
                <strong>home_section_impression_logs</strong> 테이블이 아직 없어서 bucket
                비교를 계산할 수 없습니다.
              </p>
            ) : (
              <p
                style={{
                  fontSize: 13,
                  opacity: 0.72,
                  marginBottom: 12,
                  lineHeight: 1.5,
                }}
              >
                <code style={{ fontSize: 12 }}>experiment_bucket</code> 이 비어 있으면{" "}
                <code style={{ fontSize: 12 }}>unbucketed</code> 로 집계됩니다. 현재 실험:{" "}
                <code style={{ fontSize: 12 }}>{HOME_LAYOUT_EXPERIMENT_NAME}</code>
                {" "}v{HOME_LAYOUT_EXPERIMENT_VERSION} (
                <code style={{ fontSize: 12 }}>{HOME_LAYOUT_EXPERIMENT_KEY}</code>)
              </p>
            )}
            {impressionError === "schema" ? null : (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <SummaryCard
                    title="bucket 누락 로그 비율"
                    value={`${Math.round(bucketGuardrails.missingBucketRatio * 1000) / 10}%`}
                    hint={`${bucketGuardrails.missingBucketLogs}/${bucketGuardrails.totalRelevantLogs} logs`}
                  />
                  <SummaryCard
                    title="최소 표본 기준"
                    value={EXPERIMENT_MIN_IMPRESSIONS}
                    hint="bucket impressions 기준"
                  />
                </div>

                <div
                  style={{
                    border: "1px solid #2a2f38",
                    borderRadius: 12,
                    overflow: "auto",
                    marginBottom: 12,
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
                        <th style={{ padding: 10, fontSize: 12 }}>bucket</th>
                        <th style={{ padding: 10, fontSize: 12, width: 110 }}>
                          sample size
                        </th>
                        <th style={{ padding: 10, fontSize: 12, width: 110 }}>
                          impressions
                        </th>
                        <th style={{ padding: 10, fontSize: 12, width: 110 }}>
                          clicks
                        </th>
                        <th style={{ padding: 10, fontSize: 12, width: 110 }}>
                          CTR
                        </th>
                        <th style={{ padding: 10, fontSize: 12, width: 120 }}>
                          상태
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {bucketGuardrails.rows.map((row) => {
                        const pct =
                          row.impressions > 0
                            ? Math.round(row.ctr * 1000) / 10
                            : 0;
                        return (
                          <tr
                            key={`bguard-${row.bucket}`}
                            style={{ borderTop: "1px solid #2a2f38" }}
                          >
                            <td style={{ padding: 10, fontSize: 13 }}>
                              <code style={{ fontSize: 12 }}>{row.bucket}</code>
                              {!row.expected ? (
                                <span style={guardrailStyles.warnBadge}>unexpected</span>
                              ) : null}
                            </td>
                            <td style={{ padding: 10, fontSize: 13 }}>
                              {row.sample_size}
                            </td>
                            <td style={{ padding: 10, fontSize: 13 }}>
                              {row.impressions}
                            </td>
                            <td style={{ padding: 10, fontSize: 13 }}>
                              {row.clicks}
                            </td>
                            <td style={{ padding: 10, fontSize: 13 }}>
                              {row.impressions > 0 ? `${pct}%` : "—"}
                            </td>
                            <td style={{ padding: 10, fontSize: 13 }}>
                              {row.insufficient ? (
                                <span style={guardrailStyles.sampleWarn}>표본 부족</span>
                              ) : (
                                <span style={guardrailStyles.sampleOk}>OK</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div
                  style={{
                    border: "1px solid #2a2f38",
                    borderRadius: 12,
                    overflow: "auto",
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
                        <th style={{ padding: 10, fontSize: 12, width: 160 }}>
                          bucket
                        </th>
                        <th style={{ padding: 10, fontSize: 12 }}>섹션</th>
                        <th style={{ padding: 10, fontSize: 12, width: 110 }}>
                          노출
                        </th>
                        <th style={{ padding: 10, fontSize: 12, width: 110 }}>
                          클릭
                        </th>
                        <th style={{ padding: 10, fontSize: 12, width: 110 }}>
                          CTR
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {bucketCtr.rows.map((row) => {
                        const pct =
                          row.impressions > 0
                            ? Math.round(row.ctr * 1000) / 10
                            : 0;
                        return (
                          <tr
                            key={`bctr-${row.bucket}-${row.section}`}
                            style={{ borderTop: "1px solid #2a2f38" }}
                          >
                            <td style={{ padding: 10, fontSize: 13 }}>
                              <code style={{ fontSize: 12 }}>{row.bucket}</code>
                            </td>
                            <td style={{ padding: 10, fontSize: 13 }}>
                              {row.label}
                              <div
                                style={{
                                  fontSize: 10,
                                  opacity: 0.5,
                                  fontFamily: "monospace",
                                }}
                              >
                                {row.section}
                              </div>
                            </td>
                            <td style={{ padding: 10, fontSize: 13 }}>
                              {row.impressions}
                            </td>
                            <td style={{ padding: 10, fontSize: 13 }}>
                              {row.clicks}
                            </td>
                            <td style={{ padding: 10, fontSize: 13 }}>
                              {row.impressions > 0 ? `${pct}%` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>
              상위 컬렉션 TOP {TOP_LIMIT}
            </h2>
            <p
              style={{
                fontSize: 13,
                opacity: 0.72,
                marginBottom: 12,
                lineHeight: 1.5,
              }}
            >
              정렬 우선순위:{" "}
              <strong>클릭 수 → 저장 → 공유</strong>. 비공개 컬렉션은 RLS 영향으로
              제목이 비어 있을 수 있습니다.
            </p>
            <div
              style={{
                border: "1px solid #2a2f38",
                borderRadius: 12,
                overflow: "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: 640,
                }}
              >
                <thead>
                  <tr style={{ background: "#1a1d23", textAlign: "left" }}>
                    <th style={{ padding: 10, fontSize: 12, width: 40 }}>#</th>
                    <th style={{ padding: 10, fontSize: 12 }}>컬렉션</th>
                    <th style={{ padding: 10, fontSize: 12, width: 80 }}>
                      클릭
                    </th>
                    <th style={{ padding: 10, fontSize: 12, width: 80 }}>
                      공유
                    </th>
                    <th style={{ padding: 10, fontSize: 12, width: 80 }}>
                      저장
                    </th>
                    <th style={{ padding: 10, fontSize: 12, width: 110 }}>
                      추천
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topCollections.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        style={{ padding: 16, opacity: 0.6, fontSize: 13 }}
                      >
                        최근 {RECENT_WINDOW_DAYS}일 동안 기록된 컬렉션 클릭/저장이
                        없습니다.
                      </td>
                    </tr>
                  ) : (
                    topCollections.map((row, idx) => {
                      const featuredOn = isFeaturedActive(row);
                      const busy = busyTopFeatureId === row.collection_id;
                      return (
                        <tr
                          key={row.collection_id}
                          style={{ borderTop: "1px solid #2a2f38" }}
                        >
                          <td
                            style={{ padding: 10, fontSize: 13, opacity: 0.7 }}
                          >
                            {idx + 1}
                          </td>
                          <td style={{ padding: 10, fontSize: 13 }}>
                            <button
                              type="button"
                              onClick={() =>
                                navigate(`/collection/${row.collection_id}`)
                              }
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "#7cb4ff",
                                padding: 0,
                                cursor: "pointer",
                                fontSize: 13,
                                textAlign: "left",
                              }}
                            >
                              {row.title}
                            </button>
                            <div
                              style={{
                                fontSize: 10,
                                opacity: 0.5,
                                fontFamily: "monospace",
                              }}
                            >
                              {row.collection_id}
                              {row.visibility ? ` · ${row.visibility}` : ""}
                              {featuredOn ? " · ★ featured" : ""}
                            </div>
                            {(() => {
                              const tags = dedupeAndNormalizeCollectionTags(
                                row.tags,
                              );
                              if (tags.length === 0) return null;
                              return (
                                <div style={topRowTagStyles.row}>
                                  {tags.slice(0, 4).map((t) => (
                                    <span
                                      key={t.toLowerCase()}
                                      style={topRowTagStyles.chip}
                                    >
                                      #{t}
                                    </span>
                                  ))}
                                  {tags.length > 4 ? (
                                    <span style={topRowTagStyles.more}>
                                      외 {tags.length - 4}
                                    </span>
                                  ) : null}
                                </div>
                              );
                            })()}
                          </td>
                          <td style={{ padding: 10, fontSize: 13 }}>
                            {row.clicks}
                          </td>
                          <td style={{ padding: 10, fontSize: 13 }}>
                            {row.shares}
                          </td>
                          <td style={{ padding: 10, fontSize: 13 }}>
                            {row.saves}
                          </td>
                          <td style={{ padding: 10, fontSize: 12 }}>
                            <button
                              type="button"
                              onClick={() =>
                                void onToggleFeatureFromTop(
                                  row.collection_id,
                                  featuredOn,
                                )
                              }
                              disabled={busy}
                              style={
                                featuredOn
                                  ? toggleBtnStyles.off
                                  : toggleBtnStyles.on
                              }
                            >
                              {busy
                                ? "…"
                                : featuredOn
                                  ? "추천 해제"
                                  : "추천 ON"}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              {topFeatureError ? (
                <p
                  style={{
                    fontSize: 12,
                    color: "#e74c3c",
                    marginTop: 8,
                  }}
                >
                  {topFeatureError}
                </p>
              ) : null}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

const toggleBtnStyles = {
  on: {
    border: "1px solid rgba(46,204,113,0.5)",
    background: "rgba(46,204,113,0.18)",
    color: "#d4f4dd",
    borderRadius: 8,
    padding: "5px 10px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  off: {
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.78)",
    borderRadius: 8,
    padding: "5px 10px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
};

function SummaryCard({ title, value, hint }) {
  return (
    <div
      style={{
        border: "1px solid #2a2f38",
        borderRadius: 12,
        padding: "12px 14px",
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ fontSize: 24, fontWeight: 800 }}>{value}</div>
      {hint ? (
        <div style={{ fontSize: 11, opacity: 0.55, marginTop: 4 }}>{hint}</div>
      ) : null}
    </div>
  );
}
