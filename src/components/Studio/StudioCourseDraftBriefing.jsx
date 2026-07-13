import {
  formatWalkMetersForUi,
  maxWalkingLegMeters,
  walkingMetersBetweenPlaces,
} from "../../utils/courseDraftWalkability.js";

const styles = {
  wrap: {
    marginTop: "8px",
    padding: "12px 12px 14px",
    borderRadius: "12px",
    background: "rgba(15,23,42,0.55)",
    border: "1px solid rgba(129,140,248,0.18)",
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    marginBottom: "6px",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "-0.02em",
    color: "rgba(224,231,255,0.95)",
  },
  disclaimer: {
    fontSize: "10px",
    color: "rgba(255,255,255,0.38)",
    textAlign: "right",
    lineHeight: 1.35,
  },
  courseTitle: {
    margin: "0 0 8px",
    fontSize: "15px",
    fontWeight: 800,
    letterSpacing: "-0.02em",
    color: "rgba(255,255,255,0.95)",
  },
  summary: {
    margin: "0 0 10px",
    fontSize: "12px",
    lineHeight: 1.6,
    color: "rgba(255,255,255,0.78)",
  },
  tagRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    marginBottom: "10px",
  },
  tag: {
    padding: "3px 8px",
    borderRadius: "999px",
    fontSize: "10px",
    fontWeight: 700,
    color: "rgba(199,210,254,0.95)",
    background: "rgba(99,102,241,0.18)",
    border: "1px solid rgba(129,140,248,0.22)",
  },
  tableWrap: {
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
    marginBottom: "12px",
  },
  table: {
    width: "100%",
    minWidth: "520px",
    borderCollapse: "collapse",
    fontSize: "11px",
    lineHeight: 1.45,
  },
  th: {
    padding: "8px 6px",
    textAlign: "left",
    fontWeight: 800,
    color: "rgba(165,180,252,0.92)",
    borderBottom: "1px solid rgba(129,140,248,0.22)",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "9px 6px",
    verticalAlign: "top",
    color: "rgba(255,255,255,0.84)",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  orderCell: {
    width: "34px",
    fontWeight: 800,
    color: "rgba(199,210,254,0.95)",
    textAlign: "center",
  },
  storeName: {
    fontWeight: 700,
    color: "rgba(255,255,255,0.92)",
  },
  storeAddress: {
    marginTop: "3px",
    fontSize: "10px",
    lineHeight: 1.4,
    color: "rgba(255,255,255,0.48)",
  },
  sectionTitle: {
    margin: "0 0 6px",
    fontSize: "12px",
    fontWeight: 800,
    color: "rgba(199,210,254,0.95)",
  },
  walkMeta: {
    margin: "0 0 8px",
    fontSize: "10px",
    fontWeight: 700,
    color: "rgba(165,180,252,0.78)",
  },
  sectionHint: {
    margin: "0 0 6px",
    fontSize: "10px",
    color: "rgba(255,255,255,0.38)",
  },
  bulletList: {
    margin: 0,
    paddingLeft: "16px",
    fontSize: "11px",
    lineHeight: 1.55,
    color: "rgba(255,255,255,0.72)",
  },
  section: {
    marginTop: "10px",
    paddingTop: "10px",
    borderTop: "1px solid rgba(255,255,255,0.06)",
  },
};

function resolvePlaceAddress(place) {
  if (!place || typeof place !== "object") return "";
  return String(
    place.address ||
      place.place_address ||
      place.road_address_name ||
      place.road_address ||
      place.address_name ||
      ""
  ).trim();
}

/**
 * AI 코스 초안 — 네이버 AI 브리핑 스타일 미리보기.
 * @param {{
 *   draft: {
 *     title?: string,
 *     description?: string,
 *     area?: string,
 *     theme_tags?: string[],
 *     route_tips?: string[],
 *     visit_checklist?: string[],
 *     steps?: Array<{ placeKey?: string, memo?: string, visit_tip?: string }>,
 *   },
 *   placeByKey: Map<string, object>,
 *   query?: string,
 * }} props
 */
export default function StudioCourseDraftBriefing({
  draft,
  placeByKey,
  query = "",
}) {
  if (!draft || !Array.isArray(draft.steps) || draft.steps.length === 0) {
    return null;
  }

  const map =
    placeByKey instanceof Map ? placeByKey : new Map(Object.entries(placeByKey || {}));
  const title =
    String(draft.title || query || "").trim() ||
    `${draft.steps.length}곳 코스`;
  const description = String(draft.description || "").trim();
  const themeTags = (Array.isArray(draft.theme_tags) ? draft.theme_tags : [])
    .map((t) => String(t || "").trim())
    .filter(Boolean)
    .slice(0, 6);
  const routeTips = (Array.isArray(draft.route_tips) ? draft.route_tips : [])
    .map((t) => String(t || "").trim())
    .filter(Boolean);
  const visitChecklist = (
    Array.isArray(draft.visit_checklist) ? draft.visit_checklist : []
  )
    .map((t) => String(t || "").trim())
    .filter(Boolean);

  const maxWalkLeg = maxWalkingLegMeters(draft.steps, map);
  const walkMeta =
    maxWalkLeg > 0
      ? maxWalkLeg <= 1000
        ? `🚶 도보 동선 · 구간 최대 ${formatWalkMetersForUi(maxWalkLeg)} (1km 이내)`
        : maxWalkLeg < 2000
          ? `🚶 도보 동선 · 구간 최대 ${formatWalkMetersForUi(maxWalkLeg)}`
          : `🚶 구간 최대 ${formatWalkMetersForUi(maxWalkLeg)} — 이동이 길면 택시·사유 확인`
      : null;

  const placeNameForKey = (placeKey) => {
    const p = map.get(placeKey);
    return (
      String(p?.name || p?.place_name || placeKey).trim() || String(placeKey)
    );
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.headerRow}>
        <span style={styles.badge}>✨ AI 브리핑</span>
        <span style={styles.disclaimer}>
          실험 단계 · 정확하지 않을 수 있어요
        </span>
      </div>

      <h3 style={styles.courseTitle}>
        {draft.steps.length}곳 · {title}
      </h3>

      {walkMeta ? <p style={styles.walkMeta}>{walkMeta}</p> : null}

      {description ? <p style={styles.summary}>{description}</p> : null}

      {themeTags.length > 0 ? (
        <div style={styles.tagRow}>
          {themeTags.map((tag) => (
            <span key={tag} style={styles.tag}>
              #{tag}
            </span>
          ))}
        </div>
      ) : null}

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, ...styles.orderCell }}>순서</th>
              <th style={styles.th}>매장</th>
              <th style={styles.th}>대표 포인트</th>
            </tr>
          </thead>
          <tbody>
            {draft.steps.map((step, i) => {
              const placeKey = String(step?.placeKey || "").trim();
              const place = map.get(placeKey);
              const prevPlace =
                i > 0
                  ? map.get(
                      String(draft.steps[i - 1]?.placeKey || "").trim()
                    )
                  : null;
              const legM = prevPlace
                ? walkingMetersBetweenPlaces(prevPlace, place)
                : null;
              const address = resolvePlaceAddress(place);
              const memo = String(step?.memo || "").trim() || "—";
              return (
                <tr key={`${placeKey}-${i}`}>
                  <td style={{ ...styles.td, ...styles.orderCell }}>{i + 1}</td>
                  <td style={styles.td}>
                    <div style={styles.storeName}>
                      {placeNameForKey(placeKey)}
                    </div>
                    {address ? (
                      <div style={styles.storeAddress}>({address})</div>
                    ) : null}
                    {legM != null && i > 0 ? (
                      <div style={styles.storeAddress}>
                        ← 도보 {formatWalkMetersForUi(legM)}
                      </div>
                    ) : null}
                  </td>
                  <td style={styles.td}>{memo}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {routeTips.length > 0 ? (
        <section style={styles.section}>
          <h4 style={styles.sectionTitle}>동선 짜는 요령</h4>
          <p style={styles.sectionHint}>추천한 매장·순서 기준</p>
          <ul style={styles.bulletList}>
            {routeTips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {visitChecklist.length > 0 ? (
        <section style={styles.section}>
          <h4 style={styles.sectionTitle}>방문 전 체크</h4>
          <p style={styles.sectionHint}>매장별로 콕 집은 체크</p>
          <ul style={styles.bulletList}>
            {visitChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
