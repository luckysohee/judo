import { useEffect, useMemo, useRef, useState } from "react";
import {
  COLLECTION_DEFAULT_MOOD,
  pickCollectionMood,
  pickFirstStepLabelForCover,
} from "../../utils/collectionCoverMood";
import { fetchCollectionAutoCoverImageUrl } from "../../api/collections";

const DEFAULT_GRADIENT = COLLECTION_DEFAULT_MOOD.gradient;

/**
 * 컬렉션 커버: URL 이 있으면 이미지를 깔고, 없거나 로드 실패 시 그라데이션 + 글자.
 *
 * 추가로 `tags` / `stepLabels` 가 주어지면 `cover_image_url` 이 비어 있을 때
 * 무드 기반 그라데이션과 mood placeholder(라벨·이모지) 를 자동 생성한다.
 * step overlay 가 활성화되면 카드에 첫 step_label(`1차 야장` 등) 을 작은 칩으로 얹는다.
 *
 * - 이미지가 정상 로드되면 placeholder/overlay 는 모두 숨김.
 * - 이미지가 없거나 로드 실패하면 mood placeholder + 옵션 step overlay 노출.
 * - `gradientBackground` 가 명시적으로 주어지면 mood gradient 보다 우선.
 *
 * 검색·추천·`useCourseSearch` 와 무관한 시각 데코레이션 컴포넌트.
 *
 * @param {{
 *   url?: string | null,
 *   collectionId?: string | null,
 *   letter?: string,
 *   imgLoading?: 'lazy' | 'eager',
 *   gradientBackground?: string,
 *   wrapperStyle?: object,
 *   letterTextStyle?: object,
 *   tags?: string[] | null,
 *   stepLabels?: Array<string | { step_label?: string | null }> | null,
 *   showMoodLabel?: boolean,
 *   showStepOverlay?: boolean,
 * }} props
 */
export default function CollectionCoverMedia({
  url,
  collectionId = null,
  letter = "·",
  imgLoading = "lazy",
  gradientBackground,
  wrapperStyle = {},
  letterTextStyle = {},
  tags = null,
  stepLabels = null,
  showMoodLabel = true,
  showStepOverlay = true,
}) {
  const trimmed = typeof url === "string" ? url.trim() : "";
  const [failedForUrl, setFailedForUrl] = useState("");
  const [autoUrl, setAutoUrl] = useState("");
  const [autoLoadedForId, setAutoLoadedForId] = useState("");

  const cid = typeof collectionId === "string" ? collectionId.trim() : "";
  const mountRef = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      setInView(true);
      return undefined;
    }
    if (!("IntersectionObserver" in window)) {
      setInView(true);
      return undefined;
    }
    const node = mountRef.current;
    if (!node) {
      setInView(true);
      return undefined;
    }
    let alive = true;
    const obs = new window.IntersectionObserver(
      (entries) => {
        if (!alive) return;
        const e = entries && entries[0];
        if (!e) return;
        if (e.isIntersecting || e.intersectionRatio > 0) {
          setInView(true);
          obs.disconnect();
        }
      },
      { root: null, rootMargin: "240px 0px", threshold: 0.01 },
    );
    obs.observe(node);
    return () => {
      alive = false;
      try {
        obs.disconnect();
      } catch {
        /* noop */
      }
    };
  }, []);

  const shouldAutoFetch = !trimmed && Boolean(cid) && inView;

  useEffect(() => {
    let alive = true;
    if (!shouldAutoFetch) return () => {};
    if (autoLoadedForId === cid) return () => {};

    setAutoLoadedForId(cid);
    setAutoUrl("");

    fetchCollectionAutoCoverImageUrl(cid)
      .then((u) => {
        if (!alive) return;
        const next = typeof u === "string" ? u.trim() : "";
        setAutoUrl(next);
      })
      .catch(() => {
        if (!alive) return;
        setAutoUrl("");
      });

    return () => {
      alive = false;
    };
  }, [cid, shouldAutoFetch, autoLoadedForId]);

  const effectiveUrl = trimmed || autoUrl;
  const usingAuto = !trimmed && Boolean(autoUrl);

  useEffect(() => {
    // URL이 바뀌면 이전 실패 상태를 초기화해 새 이미지를 다시 시도한다.
    setFailedForUrl("");
  }, [effectiveUrl]);

  const showImg = Boolean(effectiveUrl && failedForUrl !== effectiveUrl);
  const initial =
    String(letter || "·").trim().charAt(0).toUpperCase() || "·";

  const mood = useMemo(
    () => pickCollectionMood({ tags, stepLabels }),
    [tags, stepLabels],
  );

  const firstStep = useMemo(
    () => (showStepOverlay ? pickFirstStepLabelForCover(stepLabels) : null),
    [stepLabels, showStepOverlay],
  );

  // 명시 gradient 가 있으면 우선, 없으면 mood gradient, 그것도 없으면 default.
  const bg =
    gradientBackground ||
    (mood?.primary?.gradient ?? DEFAULT_GRADIENT);

  const moodLabel =
    showMoodLabel && mood.source !== "default" && mood.primary?.label
      ? mood.primary.label
      : null;
  const moodIcon =
    showMoodLabel && mood.source !== "default" ? mood.primary?.icon ?? null : null;

  return (
    <div
      ref={mountRef}
      style={{
        position: "relative",
        overflow: "hidden",
        background: bg,
        ...wrapperStyle,
      }}
      aria-hidden="true"
    >
      {showImg ? (
        <img
          src={effectiveUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailedForUrl(effectiveUrl)}
          loading={imgLoading}
          decoding="async"
          fetchPriority={imgLoading === "eager" ? "high" : "low"}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : null}
      {showImg && usingAuto ? (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background: bg,
            opacity: 0.38,
            mixBlendMode: "multiply",
            pointerEvents: "none",
          }}
        />
      ) : null}
      {!showImg ? (
        <>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={letterTextStyle}>{initial}</span>
          </div>
          {moodLabel ? (
            <span
              style={{
                ...moodChipStyle,
                color: mood.primary.accentColor,
                borderColor: hexWithAlpha(mood.primary.accentColor, 0.55),
              }}
              data-mood-label={mood.primary.key}
            >
              <span aria-hidden="true" style={moodIconStyle}>
                {moodIcon}
              </span>
              {moodLabel}
            </span>
          ) : null}
          {firstStep ? (
            <span style={stepChipStyle} data-step-overlay>
              {firstStep}
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/**
 * #RRGGBB 또는 rgba(...) 문자열을 받아 alpha 만 바꿔 rgba 로 반환.
 * 실패하면 원본 그대로.
 */
function hexWithAlpha(input, alpha) {
  if (typeof input !== "string") return input;
  const trimmed = input.trim();
  const a = Math.max(0, Math.min(1, Number(alpha)));
  if (!Number.isFinite(a)) return trimmed;
  if (trimmed.startsWith("#") && (trimmed.length === 7 || trimmed.length === 4)) {
    let r;
    let g;
    let b;
    if (trimmed.length === 7) {
      r = parseInt(trimmed.slice(1, 3), 16);
      g = parseInt(trimmed.slice(3, 5), 16);
      b = parseInt(trimmed.slice(5, 7), 16);
    } else {
      r = parseInt(trimmed[1] + trimmed[1], 16);
      g = parseInt(trimmed[2] + trimmed[2], 16);
      b = parseInt(trimmed[3] + trimmed[3], 16);
    }
    if ([r, g, b].every(Number.isFinite)) {
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
  }
  return trimmed;
}

const moodChipStyle = {
  position: "absolute",
  top: 6,
  left: 6,
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "2px 8px",
  borderRadius: 999,
  background: "rgba(0,0,0,0.42)",
  border: "1px solid rgba(255,255,255,0.18)",
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: "-0.01em",
  textShadow: "0 1px 2px rgba(0,0,0,0.45)",
  pointerEvents: "none",
  whiteSpace: "nowrap",
};

const moodIconStyle = {
  fontSize: 10,
  lineHeight: 1,
};

const stepChipStyle = {
  position: "absolute",
  bottom: 6,
  left: 6,
  padding: "2px 8px",
  borderRadius: 6,
  background: "rgba(0,0,0,0.55)",
  border: "1px solid rgba(255,255,255,0.22)",
  color: "#fff",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "-0.01em",
  textShadow: "0 1px 2px rgba(0,0,0,0.45)",
  pointerEvents: "none",
  whiteSpace: "nowrap",
  maxWidth: "calc(100% - 12px)",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
