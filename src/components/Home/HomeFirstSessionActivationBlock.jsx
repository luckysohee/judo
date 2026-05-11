import { useCallback, useEffect, useMemo, useState } from "react";
import {
  isActivationCompleted,
  markActivationEvent,
  readActivationState,
} from "../../utils/activationState";
import {
  ACTIVATION_EVENT,
  logActivationFunnelEvent,
} from "../../api/activationFunnelLogs";
import {
  ACTIVATION_CTA_BUCKET,
  ACTIVATION_CTA_BUCKETS,
  ACTIVATION_CTA_EXPERIMENT_KEY,
  getOrAssignExperimentBucket,
} from "../../utils/experiments";

const TAGS = [
  { key: "야장", label: "야장" },
  { key: "노포", label: "노포" },
  { key: "분위기", label: "분위기" },
];

const SECTION_ARIA = {
  HOT: "지금 뜨는 코스",
  SITUATION: "오늘 어울리는 컬렉션 코스",
  SIMILAR_USERS: "취향이 비슷한 사람",
};

function scrollIntoAria(label) {
  const q = String(label || "").trim();
  if (!q || typeof document === "undefined") return false;
  const esc =
    typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(q)
      : q.replaceAll('"', '\\"');
  const el = document.querySelector(`[aria-label="${esc}"]`);
  if (!el) return false;
  try {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch {
    try {
      el.scrollIntoView();
    } catch {
      /* ignore */
    }
  }
  return true;
}

/**
 * Home 상단(first-time) lightweight activation block.
 * - 모달 없이 copy + 상황 chip + CTA
 * - activation 완료되면 자동 숨김
 */
export default function HomeFirstSessionActivationBlock({
  experimentBucket = null,
  appEnv = null,
} = {}) {
  const [state, setState] = useState(() => readActivationState());
  const [ctaBucket] = useState(() =>
    getOrAssignExperimentBucket(
      ACTIVATION_CTA_EXPERIMENT_KEY,
      ACTIVATION_CTA_BUCKETS,
      ACTIVATION_CTA_BUCKET.SAVE,
    ),
  );

  const completed = useMemo(() => isActivationCompleted(state), [state]);

  const onPickTag = useCallback((tag) => {
    // score 로직은 건드리지 않고, 상황 rail 섹션으로 이동만 한다.
    scrollIntoAria(SECTION_ARIA.SITUATION);
    // (향후) 선택된 탭까지 강제하려면 HomeSituationCollectionsSection에 제어 prop 추가 고려
    void tag;
  }, []);

  const onCta = useCallback(() => {
    // score 로직은 건드리지 않고, 섹션으로 이동만 한다.
    if (ctaBucket === ACTIVATION_CTA_BUCKET.VIBE) {
      scrollIntoAria(SECTION_ARIA.SITUATION);
      return;
    }
    if (ctaBucket === ACTIVATION_CTA_BUCKET.FOLLOW) {
      scrollIntoAria(SECTION_ARIA.SIMILAR_USERS);
      return;
    }
    scrollIntoAria(SECTION_ARIA.HOT);
  }, [ctaBucket]);

  const ctaCopy = useMemo(() => {
    if (ctaBucket === ACTIVATION_CTA_BUCKET.VIBE) return "오늘 분위기로 코스 찾기 →";
    if (ctaBucket === ACTIVATION_CTA_BUCKET.FOLLOW) return "취향 맞는 큐레이터 픽하기 →";
    return "코스 1개 저장해보기 →";
  }, [ctaBucket]);

  const ctaAria = useMemo(() => {
    if (ctaBucket === ACTIVATION_CTA_BUCKET.VIBE) return "오늘 분위기로 코스 찾기";
    if (ctaBucket === ACTIVATION_CTA_BUCKET.FOLLOW) return "취향 맞는 큐레이터 픽하기";
    return "코스 1개 저장해보기";
  }, [ctaBucket]);

  useEffect(() => {
    // first_home_view: 블록이 실제로 렌더된 순간을 최소 기준으로 기록
    if (completed) return;
    markActivationEvent("first_home_view");
    logActivationFunnelEvent({
      eventName: ACTIVATION_EVENT.ONBOARDING_IMPRESSION,
      experimentBucket,
      activationCtaBucket: ctaBucket,
      appEnv,
      source: "home_activation_block",
    });
  }, [appEnv, completed, ctaBucket, experimentBucket]);

  useEffect(() => {
    const onChange = () => setState(readActivationState());
    window.addEventListener("judo:activation", onChange);
    return () => window.removeEventListener("judo:activation", onChange);
  }, []);

  if (completed) return null;

  return (
    <div style={styles.wrap} role="region" aria-label="첫 방문 안내">
      <div style={styles.headRow}>
        <div style={styles.copyCol}>
          <div style={styles.title}>코스·분위기로 술지도를 시작해요</div>
          <div style={styles.sub}>
            상황을 골라 코스를 둘러보고, 마음에 들면 저장해두세요.
          </div>
        </div>
      </div>

      <div style={styles.chipRow} aria-label="추천 상황">
        {TAGS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              logActivationFunnelEvent({
                eventName: ACTIVATION_EVENT.ONBOARDING_CLICK,
                experimentBucket,
                activationCtaBucket: ctaBucket,
                appEnv,
                source: `home_activation_block_chip:${t.key}`,
              });
              onPickTag(t.key);
            }}
            style={styles.chip}
            aria-label={`${t.label} 코스 보기`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => {
          logActivationFunnelEvent({
            eventName: ACTIVATION_EVENT.ONBOARDING_CLICK,
            experimentBucket,
            activationCtaBucket: ctaBucket,
            appEnv,
            source: `home_activation_block_cta:${ctaBucket}`,
          });
          onCta();
        }}
        style={styles.cta}
        aria-label={ctaAria}
      >
        {ctaCopy}
      </button>
    </div>
  );
}

const styles = {
  wrap: {
    width: "100%",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background:
      "linear-gradient(140deg, rgba(255,255,255,0.08), rgba(22,22,22,0.92) 60%)",
    padding: "10px 12px 12px",
    marginBottom: 6,
    boxShadow: "0 10px 26px rgba(0,0,0,0.35)",
    backdropFilter: "blur(10px)",
  },
  headRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
  },
  copyCol: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 13,
    fontWeight: 900,
    color: "rgba(255,255,255,0.92)",
    letterSpacing: "-0.02em",
  },
  sub: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: 650,
    color: "rgba(255,255,255,0.62)",
    lineHeight: 1.35,
    wordBreak: "keep-all",
  },
  chipRow: {
    display: "flex",
    gap: 8,
    marginTop: 10,
    flexWrap: "wrap",
  },
  chip: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.92)",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  cta: {
    marginTop: 10,
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(46,204,113,0.35)",
    background:
      "linear-gradient(140deg, rgba(46,204,113,0.18), rgba(14,14,14,0.96) 70%)",
    color: "#d4f4dd",
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: "-0.01em",
    cursor: "pointer",
    textAlign: "center",
  },
};

