import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  COLLECTION_INTERACTION_EVENT,
  COLLECTION_INTERACTION_SOURCE_SECTION,
  logCollectionInteraction,
} from "../../api/collectionInteractionLogs";
import { fetchSimilarCollections } from "../../api/collectionRecommendations";
import CollectionCoverMedia from "./CollectionCoverMedia";
import CollectionVibeCaption from "./CollectionVibeCaption";

const STEP_FLOW_MAX_LABELS = 3;
const PLACE_NAME_PREVIEW_MAX_CHARS = 14;

/**
 * 추천 사유 우선순위(=헤드라인): user > place > step.
 *
 * @param {{
 *   user_overlap_count: number,
 *   overlap_place_names: string[],
 *   overlap_step_labels: string[],
 * }} item
 * @returns {{
 *   tone: 'user'|'place'|'step'|null,
 *   headline: string,
 *   secondary: string[],
 * }}
 */
function buildReasonView(item) {
  const userN = Number(item?.user_overlap_count) || 0;
  const placeNames = Array.isArray(item?.overlap_place_names)
    ? item.overlap_place_names.filter((n) => typeof n === "string" && n.trim())
    : [];
  const stepLabels = Array.isArray(item?.overlap_step_labels)
    ? item.overlap_step_labels.filter((n) => typeof n === "string" && n.trim())
    : [];

  const placeFragment = formatPlaceFragment(placeNames);
  const stepFlowFragment = formatStepFlowFragment(stepLabels);

  if (userN > 0) {
    return {
      tone: "user",
      headline: "취향 비슷한 유저들이 함께 저장했어요",
      secondary: composeSecondary({
        userN,
        placeFragment,
        stepFlowFragment,
        skip: "user",
      }),
    };
  }

  if (placeNames.length > 0) {
    return {
      tone: "place",
      headline: `${placeFragment}이(가) 같은 코스`,
      secondary: composeSecondary({
        userN: 0,
        placeFragment: null,
        stepFlowFragment,
        skip: "place",
      }),
    };
  }

  if (stepLabels.length > 0) {
    return {
      tone: "step",
      headline: stepFlowFragment
        ? `${stepFlowFragment} 흐름이 비슷해요`
        : "코스 흐름이 비슷해요",
      secondary: [],
    };
  }

  return { tone: null, headline: "", secondary: [] };
}

function formatPlaceFragment(names) {
  if (!names || names.length === 0) return null;
  const first = clipName(names[0]);
  if (names.length === 1) return first;
  return `${first} 외 ${names.length - 1}곳`;
}

function clipName(name) {
  const t = String(name ?? "").trim();
  if (!t) return "장소";
  if (t.length <= PLACE_NAME_PREVIEW_MAX_CHARS) return t;
  return `${t.slice(0, PLACE_NAME_PREVIEW_MAX_CHARS - 1)}…`;
}

function formatStepFlowFragment(stepLabels) {
  if (!stepLabels || stepLabels.length === 0) return null;
  const slice = stepLabels.slice(0, STEP_FLOW_MAX_LABELS);
  const tail =
    stepLabels.length > STEP_FLOW_MAX_LABELS
      ? `${slice.join(" → ")} …`
      : slice.join(" → ");
  return tail;
}

function composeSecondary({ userN, placeFragment, stepFlowFragment, skip }) {
  const parts = [];
  if (userN > 0 && skip !== "user") {
    parts.push(`함께 저장 유저 ${userN}명`);
  }
  if (placeFragment && skip !== "place") {
    parts.push(`${placeFragment} 겹침`);
  }
  if (stepFlowFragment && skip !== "step") {
    parts.push(`흐름: ${stepFlowFragment}`);
  }
  return parts;
}

/**
 * 컬렉션 상세 하단 "비슷한 코스" 추천 섹션.
 *
 * - 결과 0건이면 섹션 자체를 렌더하지 않는다.
 * - 추천 fetch 실패해도 상세 페이지 본체에는 영향 없음(catch 후 빈 배열).
 * - 정렬/스코어 로직은 `fetchSimilarCollections` 안에 캡슐화.
 *
 * @param {{ collectionId: string }} props
 */
export default function CollectionRecommendationsSection({ collectionId }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const id = String(collectionId ?? "").trim();
    if (!id) {
      setItems([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    (async () => {
      try {
        const rows = await fetchSimilarCollections(id, { limit: 6 });
        if (!cancelled) setItems(Array.isArray(rows) ? rows : []);
      } catch (e) {
        if (import.meta?.env?.DEV) {
          console.warn("CollectionRecommendationsSection:", e);
        }
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [collectionId]);

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <section style={styles.section} aria-label="비슷한 코스 추천">
      <div style={styles.headRow}>
        <div style={styles.title}>비슷한 코스</div>
        <div style={styles.sub}>
          저장한 사람들이 함께 본 코스 · 같은 장소·흐름 기반
        </div>
      </div>

      <div style={styles.scroller}>
        {items.map((c, idx) => {
          const reasonView = buildReasonView(c);
          const overlapStepNorms = new Set(
            (Array.isArray(c.overlap_step_labels)
              ? c.overlap_step_labels
              : []
            ).map((s) => String(s).trim().toLowerCase()),
          );
          const visibleSteps = Array.isArray(c.step_labels)
            ? c.step_labels.slice(0, 3)
            : [];

          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                navigate(`/collection/${c.id}`);
                logCollectionInteraction({
                  eventType: COLLECTION_INTERACTION_EVENT.COLLECTION_OPEN,
                  sourceSection:
                    COLLECTION_INTERACTION_SOURCE_SECTION.COLLECTION_DETAIL_RECOMMENDATIONS,
                  collectionId: c.id,
                  clickedRank: idx + 1,
                });
              }}
              style={styles.card}
              aria-label={`${c.title || "컬렉션"} 코스 보기`}
            >
              <CollectionCoverMedia
                url={c.cover_image_url}
                collectionId={c.id}
                letter={
                  String(c.title || "").trim().charAt(0) || "·"
                }
                tags={c.tags}
                stepLabels={c.step_labels}
                wrapperStyle={styles.cardCover}
                letterTextStyle={styles.cardCoverLetter}
              />
              <div style={styles.cardBody}>
                <div style={styles.cardTitle}>
                  {c.title || "(제목 없음)"}
                </div>

                <CollectionVibeCaption value={c.vibe_caption} variant="card" />

                {reasonView.headline ? (
                  <div
                    style={{
                      ...styles.headlineReason,
                      ...(reasonView.tone === "user"
                        ? styles.headlineReasonUser
                        : reasonView.tone === "place"
                          ? styles.headlineReasonPlace
                          : styles.headlineReasonStep),
                    }}
                  >
                    {reasonView.headline}
                  </div>
                ) : null}

                {visibleSteps.length > 0 ? (
                  <div style={styles.stepRow}>
                    {visibleSteps.map((label, i) => {
                      const norm = String(label).trim().toLowerCase();
                      const overlapped = overlapStepNorms.has(norm);
                      return (
                        <span
                          key={`${i}-${label}`}
                          style={{
                            ...styles.stepChip,
                            ...(overlapped ? styles.stepChipOverlap : null),
                          }}
                          title={overlapped ? `${label} (이 코스와 겹침)` : label}
                        >
                          {label}
                        </span>
                      );
                    })}
                  </div>
                ) : null}

                <div style={styles.metaRow}>
                  <span style={styles.metaSave}>📁 {c.save_count || 0}</span>
                  {Number(c.place_count) > 0 ? (
                    <span style={styles.metaPlace}>
                      장소 {Number(c.place_count) || 0}
                    </span>
                  ) : null}
                </div>

                {reasonView.secondary.length > 0 ? (
                  <div style={styles.secondaryReason}>
                    {reasonView.secondary.join(" · ")}
                  </div>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

const styles = {
  section: {
    width: "100%",
    margin: "24px 0 8px",
    padding: "12px 14px 14px",
    borderRadius: 16,
    background: "rgba(22,22,22,0.92)",
    border: "1px solid rgba(155,89,182,0.22)",
    boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
  },
  headRow: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: 800,
    color: "#fff",
    letterSpacing: "-0.02em",
  },
  sub: {
    fontSize: 11,
    fontWeight: 600,
    color: "rgba(255,255,255,0.45)",
    textAlign: "right",
  },
  scroller: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 10,
    overflowX: "auto",
    overflowY: "hidden",
    WebkitOverflowScrolling: "touch",
    paddingBottom: 4,
    marginInline: -2,
    scrollbarWidth: "thin",
  },
  card: {
    flex: "0 0 auto",
    width: "min(280px, 84vw)",
    display: "flex",
    flexDirection: "row",
    alignItems: "stretch",
    gap: 0,
    padding: 0,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(14,14,14,0.96)",
    color: "#eee",
    cursor: "pointer",
    textAlign: "left",
    overflow: "hidden",
    transition: "border-color 0.15s ease, transform 0.15s ease",
  },
  cardCover: {
    width: 64,
    flexShrink: 0,
    alignSelf: "stretch",
    minHeight: 110,
  },
  cardCoverLetter: {
    fontSize: 20,
    fontWeight: 900,
    color: "rgba(255,255,255,0.92)",
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
    padding: "8px 12px 10px 10px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "#fff",
    lineHeight: 1.25,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  headlineReason: {
    fontSize: 11,
    fontWeight: 800,
    lineHeight: 1.35,
    padding: "3px 8px",
    borderRadius: 8,
    border: "1px solid transparent",
    alignSelf: "flex-start",
    maxWidth: "100%",
    whiteSpace: "normal",
    wordBreak: "keep-all",
  },
  headlineReasonUser: {
    color: "#ffd2dd",
    background: "rgba(225,29,72,0.16)",
    borderColor: "rgba(225,29,72,0.45)",
  },
  headlineReasonPlace: {
    color: "#c8f7dc",
    background: "rgba(46,204,113,0.14)",
    borderColor: "rgba(46,204,113,0.4)",
  },
  headlineReasonStep: {
    color: "#dcc6ff",
    background: "rgba(155,89,182,0.16)",
    borderColor: "rgba(155,89,182,0.45)",
  },
  stepRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 4,
  },
  stepChip: {
    fontSize: 10,
    fontWeight: 700,
    color: "rgba(255,255,255,0.55)",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 6,
    padding: "1px 6px",
    maxWidth: 96,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  stepChipOverlap: {
    color: "#dcc6ff",
    background: "rgba(155,89,182,0.18)",
    border: "1px solid rgba(155,89,182,0.55)",
    boxShadow: "0 0 0 1px rgba(155,89,182,0.18)",
  },
  metaRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  metaSave: {
    fontSize: 10,
    fontWeight: 800,
    color: "rgba(255,255,255,0.62)",
  },
  metaPlace: {
    fontSize: 10,
    fontWeight: 800,
    color: "#c8f7dc",
    background: "rgba(46,204,113,0.14)",
    border: "1px solid rgba(46,204,113,0.35)",
    borderRadius: 999,
    padding: "1px 8px",
  },
  secondaryReason: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: 700,
    color: "rgba(255,255,255,0.5)",
    lineHeight: 1.35,
    wordBreak: "keep-all",
  },
};
