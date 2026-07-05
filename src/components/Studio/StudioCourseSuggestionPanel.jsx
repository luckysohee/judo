import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../Toast/ToastProvider";
import {
  runStudioCourseSuggestionPipeline,
  runStudioCourseDraftAssistFromPlaces,
} from "../../utils/runStudioCourseSuggestionPipeline";
import { saveStudioCourseSuggestionDraft } from "../../utils/saveStudioCourseSuggestionDraft";
import {
  fetchStudioAiCourseSuggestionQuota,
  formatStudioAiQuotaLine,
  studioAiQuotaExceededMessage,
} from "../../utils/studioAiCourseSuggestionQuota";
import {
  studioCoursesBtnGhost,
  studioCoursesBtnPrimary,
  studioMapSearchField,
  studioMapSearchInput,
  studioMapSearchClearBtn,
} from "../../pages/Studio/studioCoursesSharedStyles";
import StudioCourseDraftBriefing from "./StudioCourseDraftBriefing";

const styles = {
  wrap: {
    marginBottom: "12px",
    padding: "14px 14px",
    borderRadius: "14px",
    background:
      "linear-gradient(145deg, rgba(99,102,241,0.14) 0%, rgba(15,23,42,0.5) 100%)",
    border: "1px solid rgba(129,140,248,0.28)",
  },
  title: {
    margin: "0 0 6px",
    fontSize: "13px",
    fontWeight: 800,
    letterSpacing: "-0.02em",
    color: "rgba(224,231,255,0.95)",
  },
  hint: {
    margin: "0 0 10px",
    fontSize: "11px",
    lineHeight: 1.45,
    color: "rgba(255,255,255,0.52)",
  },
  quotaLine: {
    margin: "0 0 10px",
    fontSize: "11px",
    fontWeight: 700,
    color: "rgba(165,180,252,0.88)",
  },
  quotaPro: {
    color: "rgba(250,204,21,0.95)",
  },
  row: { display: "flex", gap: "8px", flexWrap: "wrap" },
  phase: {
    marginTop: "10px",
    fontSize: "12px",
    color: "rgba(165,180,252,0.9)",
  },
  upsell: {
    marginTop: "8px",
    fontSize: "11px",
    lineHeight: 1.45,
    color: "rgba(255,255,255,0.48)",
  },
  toggles: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px 14px",
    marginTop: "8px",
  },
  toggleLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "11px",
    fontWeight: 600,
    color: "rgba(255,255,255,0.62)",
    cursor: "pointer",
    userSelect: "none",
  },
  toggleHint: {
    margin: "6px 0 0",
    fontSize: "10px",
    lineHeight: 1.45,
    color: "rgba(255,255,255,0.4)",
  },
  previewMeta: {
    margin: "0 0 6px",
    fontSize: "11px",
    color: "rgba(165,180,252,0.78)",
  },
};

/**
 * 잔 코스 목록 — AI 장소·순서 제안 (무료 월 5회 / Studio Pro 무제한).
 * @param {{ onDraftSaved?: () => void }} [props]
 */
export default function StudioCourseSuggestionPanel({ onDraftSaved } = {}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState("idle");
  const [phaseMsg, setPhaseMsg] = useState("");
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const [quota, setQuota] = useState(null);
  const [preferHiddenGems, setPreferHiddenGems] = useState(false);
  const [preferCuratorPicks, setPreferCuratorPicks] = useState(true);
  const runGenRef = useRef(0);

  const trimmed = query.replace(/\s+/g, " ").trim();
  const showRecommendButton = phase === "idle";
  const canRecommend = quota?.canUse !== false;

  const refreshQuota = useCallback(async () => {
    if (!user?.id) {
      setQuota(null);
      return;
    }
    const q = await fetchStudioAiCourseSuggestionQuota(user.id);
    setQuota(q);
  }, [user?.id]);

  useEffect(() => {
    void refreshQuota();
  }, [refreshQuota]);

  const handleGenerate = useCallback(async () => {
    if (!user?.id) {
      showToast("로그인이 필요해요.", "warning", 2600);
      return;
    }
    if (!canRecommend) {
      showToast(studioAiQuotaExceededMessage(quota), "warning", 3600);
      return;
    }
    if (trimmed.length < 2) {
      showToast("검색어를 2글자 이상 입력해 주세요.", "warning", 2600);
      return;
    }
    const gen = runGenRef.current + 1;
    runGenRef.current = gen;
    setErr("");
    setResult(null);
    setPhase("loading");
    setPhaseMsg("시작…");
    try {
      const pipelineResult = await runStudioCourseSuggestionPipeline(trimmed, {
        onPhase: (msg) => {
          if (runGenRef.current !== gen) return;
          setPhaseMsg(msg);
        },
        curatorUserId: user.id,
        preferHiddenGems,
        preferCuratorPicks,
      });
      if (runGenRef.current !== gen) return;
      setResult(pipelineResult);
      setPhase("preview");
      void refreshQuota();
    } catch (e) {
      if (runGenRef.current !== gen) return;
      setPhase("idle");
      const msg = e?.message || "초안 생성에 실패했어요.";
      setErr(msg);
      showToast(msg, "warning", 3200);
      if (e?.code === "QUOTA_EXCEEDED") {
        void refreshQuota();
      }
    }
  }, [
    canRecommend,
    preferCuratorPicks,
    preferHiddenGems,
    quota,
    refreshQuota,
    showToast,
    trimmed,
    user?.id,
  ]);

  const handleRegenerate = useCallback(async () => {
    if (!result?.places?.length || !user?.id) return;
    if (!canRecommend) {
      showToast(studioAiQuotaExceededMessage(quota), "warning", 3600);
      return;
    }
    const gen = runGenRef.current + 1;
    runGenRef.current = gen;
    const nextVariant = (Number(result.variantSeed) || 0) + 1;
    setPhase("loading");
    setPhaseMsg("다른 조합 찾는 중…");
    setErr("");
    try {
      const pipelineResult = await runStudioCourseDraftAssistFromPlaces({
        query: result.query,
        parsed: result.parsed,
        places: result.places,
        variantSeed: nextVariant,
        preferHiddenGems: result.preferHiddenGems ?? preferHiddenGems,
        preferCuratorPicks: result.preferCuratorPicks ?? preferCuratorPicks,
        onPhase: (msg) => {
          if (runGenRef.current !== gen) return;
          setPhaseMsg(msg);
        },
      });
      if (runGenRef.current !== gen) return;
      setResult({
        ...pipelineResult,
        curatorPickCount: result.curatorPickCount ?? 0,
      });
      setPhase("preview");
      void refreshQuota();
    } catch (e) {
      if (runGenRef.current !== gen) return;
      setPhase("preview");
      const msg = e?.message || "다른 조합을 만들지 못했어요.";
      setErr(msg);
      showToast(msg, "warning", 3200);
      if (e?.code === "QUOTA_EXCEEDED") {
        void refreshQuota();
      }
    }
  }, [
    canRecommend,
    preferCuratorPicks,
    preferHiddenGems,
    quota,
    refreshQuota,
    result,
    showToast,
    user?.id,
  ]);

  const handleOpenInEditor = useCallback(async () => {
    if (!result?.draft || !user?.id) return;
    setPhase("saving");
    setPhaseMsg("장소 등록 · 드래프트 저장 중…");
    setErr("");
    try {
      const { courseId, savedStepCount } = await saveStudioCourseSuggestionDraft(
        {
          curatorUserId: user.id,
          draft: result.draft,
          placeByKey: result.placeByKey,
          rawSearchQuery: result.query,
          includeAiText: false,
        }
      );
      showToast(
        `${savedStepCount}곳 드래프트 저장. 글·메모는 에디터에서 써 주세요.`,
        "success",
        3200
      );
      onDraftSaved?.();
      navigate(`/studio/courses/${encodeURIComponent(courseId)}/edit`);
    } catch (e) {
      setPhase("preview");
      const msg = e?.message || "에디터로 열지 못했어요.";
      setErr(msg);
      showToast(msg, "warning", 3200);
    }
  }, [navigate, onDraftSaved, result, showToast, user?.id]);

  const handleClosePreview = useCallback(() => {
    runGenRef.current += 1;
    setResult(null);
    setPhase("idle");
    setErr("");
    setPhaseMsg("");
  }, []);

  const handleClearSearch = useCallback(() => {
    runGenRef.current += 1;
    setQuery("");
    setResult(null);
    setPhase("idle");
    setErr("");
    setPhaseMsg("");
  }, []);

  const showSearchClear =
    trimmed.length > 0 || phase === "preview" || phase === "loading";

  const quotaLine = formatStudioAiQuotaLine(quota);

  return (
    <div style={styles.wrap}>
      <p style={styles.title}>✨ AI 코스 초안</p>
      <p style={styles.hint}>
        검색어로 장소·순서만 제안해요. 글·메모는 에디터에서 직접 씁니다.
        {quota?.isPro ? null : " (무료 월 5회 · Pro 무제한)"}
      </p>
      {quotaLine ? (
        <p
          style={{
            ...styles.quotaLine,
            ...(quota?.isPro ? styles.quotaPro : {}),
          }}
        >
          {quotaLine}
        </p>
      ) : null}
      <div style={studioMapSearchField}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              phase !== "loading" &&
              phase !== "saving" &&
              phase !== "preview" &&
              canRecommend
            ) {
              e.preventDefault();
              void handleGenerate();
            }
          }}
          placeholder="성수동 빵지순례, 합정 데이트 바…"
          style={studioMapSearchInput}
          disabled={
            phase === "loading" ||
            phase === "saving" ||
            !canRecommend
          }
        />
        {showSearchClear ? (
          <button
            type="button"
            aria-label="검색 닫기"
            onClick={handleClearSearch}
            style={studioMapSearchClearBtn}
            disabled={phase === "saving"}
          >
            ✕
          </button>
        ) : null}
      </div>
      {phase === "idle" || phase === "preview" ? (
        <div style={styles.toggles}>
          <label style={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={preferHiddenGems}
              onChange={(e) => setPreferHiddenGems(e.target.checked)}
              disabled={phase === "preview"}
            />
            유명점 덜 쓰기
          </label>
          <label
            style={styles.toggleLabel}
            title="잔 올리기로 올린 장소(잔 리스트)를 AI 후보 풀에 섞습니다"
          >
            <input
              type="checkbox"
              checked={preferCuratorPicks}
              onChange={(e) => setPreferCuratorPicks(e.target.checked)}
              disabled={phase === "preview"}
            />
            내 잔 리스트 포함
          </label>
        </div>
      ) : null}
      {phase === "idle" ? (
        <p style={styles.toggleHint}>
          옵션은 결과 화면 정렬이 아니라 AI에 넘기는 후보 풀을 바꿉니다.
          내 잔 리스트(잔 올리기로 올린 장소) 중 검색 지역·주소가 맞는 것만 후보에
          섞습니다.
        </p>
      ) : null}
      {!canRecommend && quota && !quota.isPro ? (
        <p style={styles.upsell}>{studioAiQuotaExceededMessage(quota)}</p>
      ) : null}
      <div style={{ ...styles.row, marginTop: "10px" }}>
        {showRecommendButton && canRecommend ? (
          <button
            type="button"
            style={studioCoursesBtnPrimary}
            disabled={trimmed.length < 2}
            onClick={() => void handleGenerate()}
          >
            장소 추천
          </button>
        ) : null}
        {result && phase === "preview" ? (
          <>
            <button
              type="button"
              style={studioCoursesBtnPrimary}
              onClick={() => void handleOpenInEditor()}
            >
              에디터에서 편집
            </button>
            <button
              type="button"
              style={studioCoursesBtnGhost}
              onClick={() => void handleRegenerate()}
            >
              다른 조합
            </button>
            <button
              type="button"
              style={studioCoursesBtnGhost}
              onClick={handleClosePreview}
            >
              닫기
            </button>
          </>
        ) : null}
      </div>

      {phase === "loading" || phase === "saving" ? (
        <p style={styles.phase}>{phaseMsg || "처리 중…"}</p>
      ) : null}

      {err ? (
        <p style={{ ...styles.phase, color: "rgba(248,113,113,0.95)" }}>
          {err}
        </p>
      ) : null}

      {result?.draft && phase === "preview" ? (
        <div style={{ marginTop: "4px" }}>
          {result.preferCuratorPicks !== false ? (
            <p style={styles.previewMeta}>
              {(result.curatorPickCount ?? 0) > 0
                ? `잔 리스트 ${result.curatorPickCount}곳을 AI 후보에 포함했어요.`
                : "이 검색·지역과 맞는 잔 리스트 장소가 없어요. 잔 올리기로 해당 지역 장소를 올려 보세요."}
            </p>
          ) : null}
          <StudioCourseDraftBriefing
            draft={result.draft}
            placeByKey={result.placeByKey}
            query={result.query}
          />
        </div>
      ) : null}
    </div>
  );
}
