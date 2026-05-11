import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  COLLECTION_INTERACTION_EVENT,
  COLLECTION_INTERACTION_SOURCE_SECTION,
  logCollectionInteraction,
} from "../../api/collectionInteractionLogs";
import { fetchHomeRevisitSignals } from "../../api/homeRevisitSignals";
import { useAuth } from "../../context/AuthContext";
import {
  readHomeLastSeen,
  writeHomeLastSeenNow,
} from "../../utils/homeLastSeen";
import CollectionCoverMedia from "../Collections/CollectionCoverMedia";

/**
 * 홈 상단 lightweight 리텐션 카드.
 *
 * - `last_seen_at` (localStorage) 이후 새로 올라온 것을 한두 줄로 안내.
 * - 시그널 1) `tag_new` — 최근 저장 태그 / 온보딩 태그 기준 신작
 * - 시그널 2) `follow_new` — 픽한 사람의 새 공개 컬렉션
 * - 시그널 3) `featured_new` — 운영 추천 신작
 * - 결과 0건이면 자체 `null` 렌더 → 빈 카드 noise 방지.
 * - 카드 본 직후 `last_seen_at` 을 갱신하지는 않는다 — 사용자가 카드를 직접 닫거나
 *   카드 안의 코스를 열었을 때만 mark 해서, 한 번 열고 다시 들어왔을 때
 *   다시 안내가 보이는 자연스러운 사이클을 유지.
 */
export default function HomeRevisitCard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [signals, setSignals] = useState([]);
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(true);

  const uid = user?.id ?? null;

  const lastSeen = useMemo(() => {
    if (authLoading) return null;
    return readHomeLastSeen(uid);
  }, [authLoading, uid]);

  useEffect(() => {
    if (authLoading || !lastSeen) return undefined;
    let cancelled = false;
    setLoading(true);
    setHidden(false);
    (async () => {
      try {
        const result = await fetchHomeRevisitSignals(uid, {
          lastSeenAt: lastSeen.iso,
        });
        if (cancelled) return;
        setSignals(Array.isArray(result?.signals) ? result.signals : []);
      } catch (e) {
        if (import.meta?.env?.DEV) {
          console.warn("HomeRevisitCard:", e?.message || e);
        }
        if (!cancelled) setSignals([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, lastSeen, uid]);

  const onOpenSample = useCallback(
    (signal, idx) => {
      const sample = signal?.sample;
      if (!sample?.id) return;
      logCollectionInteraction({
        eventType: COLLECTION_INTERACTION_EVENT.COLLECTION_OPEN,
        sourceSection: COLLECTION_INTERACTION_SOURCE_SECTION.HOME_REVISIT_CARD,
        collectionId: sample.id,
        clickedRank: idx + 1,
      });
      writeHomeLastSeenNow(uid);
      navigate(`/collection/${sample.id}`);
    },
    [navigate, uid],
  );

  const onDismiss = useCallback(() => {
    writeHomeLastSeenNow(uid);
    setHidden(true);
  }, [uid]);

  if (authLoading) return null;
  if (loading) return null;
  if (hidden) return null;
  if (!signals || signals.length === 0) return null;

  return (
    <section style={styles.section} aria-label="다시 들어올 만한 새 소식">
      <div style={styles.headRow}>
        <div style={styles.titleRow}>
          <span aria-hidden="true" style={styles.headEmoji}>
            🔔
          </span>
          <span style={styles.title}>
            마지막으로 본 이후 새로 올라왔어요
          </span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          style={styles.dismissBtn}
          aria-label="이번엔 닫기"
        >
          닫기
        </button>
      </div>
      <ul style={styles.list}>
        {signals.map((s, idx) => {
          const cover = s.sample?.cover_image_url ?? null;
          const letter =
            (s.sample?.title || s.tag || "")
              .toString()
              .trim()
              .charAt(0) || "·";
          const kindStyle = kindBadgeStyle(s.kind);
          const sampleId = s.sample?.id ?? null;
          return (
            <li key={`${s.kind}-${idx}`} style={styles.item}>
              <button
                type="button"
                onClick={() => sampleId && onOpenSample(s, idx)}
                style={{
                  ...styles.itemBtn,
                  cursor: sampleId ? "pointer" : "default",
                }}
                disabled={!sampleId}
                aria-label={s.message}
              >
                <CollectionCoverMedia
                  url={cover}
                  collectionId={sampleId}
                  letter={letter}
                  gradientBackground={kindStyle.coverBg}
                  wrapperStyle={styles.cover}
                  letterTextStyle={styles.coverLetter}
                />
                <div style={styles.body}>
                  <div style={styles.kindRow}>
                    <span
                      style={{ ...styles.kindBadge, ...kindStyle.badge }}
                      title={kindStyle.label}
                    >
                      {kindStyle.label}
                    </span>
                    {s.count > 1 ? (
                      <span style={styles.countChip}>+{s.count - 1}</span>
                    ) : null}
                  </div>
                  <div style={styles.message}>{s.message}</div>
                  {s.sample?.title ? (
                    <div style={styles.sampleTitle}>{s.sample.title}</div>
                  ) : null}
                </div>
                {sampleId ? (
                  <span aria-hidden="true" style={styles.chev}>
                    ›
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function kindBadgeStyle(kind) {
  if (kind === "follow_new") {
    return {
      label: "픽한 사람",
      badge: {
        background: "rgba(52,152,219,0.18)",
        border: "1px solid rgba(52,152,219,0.55)",
        color: "#cfe6f7",
      },
      coverBg:
        "linear-gradient(135deg, rgba(52,152,219,0.5), rgba(46,204,113,0.32))",
    };
  }
  if (kind === "featured_new") {
    return {
      label: "에디터 추천",
      badge: {
        background: "linear-gradient(135deg, #fde68a 0%, #fbbf24 100%)",
        border: "1px solid rgba(217,119,6,0.55)",
        color: "#0c1410",
      },
      coverBg:
        "linear-gradient(135deg, rgba(251,191,36,0.55), rgba(217,119,6,0.32))",
    };
  }
  return {
    label: "취향 신작",
    badge: {
      background: "rgba(155,89,182,0.18)",
      border: "1px solid rgba(155,89,182,0.55)",
      color: "#ead9ff",
    },
    coverBg:
      "linear-gradient(135deg, rgba(155,89,182,0.55), rgba(52,152,219,0.32))",
  };
}

const styles = {
  section: {
    width: "100%",
    marginBottom: 8,
    padding: "10px 12px 12px",
    borderRadius: 16,
    background: "rgba(22,22,22,0.94)",
    border: "1px solid rgba(255,255,255,0.1)",
    boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
    backdropFilter: "blur(10px)",
  },
  headRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 10,
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  headEmoji: {
    fontSize: 14,
    lineHeight: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: 800,
    color: "#fff",
    letterSpacing: "-0.02em",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  dismissBtn: {
    flexShrink: 0,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.65)",
    borderRadius: 999,
    padding: "4px 10px",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  item: {
    margin: 0,
    padding: 0,
  },
  itemBtn: {
    width: "100%",
    display: "flex",
    alignItems: "stretch",
    gap: 10,
    padding: 8,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(14,14,14,0.96)",
    color: "#eee",
    textAlign: "left",
    WebkitTapHighlightColor: "transparent",
  },
  cover: {
    width: 52,
    flexShrink: 0,
    minHeight: 52,
    borderRadius: 10,
  },
  coverLetter: {
    fontSize: 18,
    fontWeight: 900,
    color: "rgba(255,255,255,0.92)",
  },
  body: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 3,
    justifyContent: "center",
  },
  kindRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  kindBadge: {
    fontSize: 10,
    fontWeight: 900,
    borderRadius: 999,
    padding: "1px 8px",
    letterSpacing: "-0.01em",
    whiteSpace: "nowrap",
  },
  countChip: {
    fontSize: 10,
    fontWeight: 800,
    color: "rgba(255,255,255,0.55)",
  },
  message: {
    fontSize: 12,
    fontWeight: 700,
    color: "#fff",
    lineHeight: 1.35,
    letterSpacing: "-0.01em",
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    wordBreak: "keep-all",
  },
  sampleTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: "rgba(255,255,255,0.55)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  chev: {
    flexShrink: 0,
    alignSelf: "center",
    fontSize: 18,
    fontWeight: 700,
    color: "rgba(255,255,255,0.45)",
    marginRight: 4,
  },
};
