import { useMemo, useState } from "react";
import OnboardingQuestions from "./OnboardingQuestions";
import { useToast } from "../Toast/ToastProvider";
import { useUserTastePreferences } from "../../hooks/useUserTastePreferences";
import {
  formatTasteProfileSummary,
  tasteProfileHasSignals,
  tasteRowToOnboardingAnswers,
} from "../../utils/userTasteProfile";

const CARD_STYLES = {
  wrapper: {
    padding: "10px 14px 12px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    backgroundColor: "rgba(0, 0, 0, 0.18)",
  },
  title: {
    fontSize: 11,
    fontWeight: 700,
    color: "rgba(255,255,255,0.82)",
    marginBottom: 4,
  },
  hint: {
    margin: "0 0 10px",
    fontSize: 10,
    lineHeight: 1.45,
    color: "rgba(255,255,255,0.42)",
  },
  empty: {
    margin: "0 0 10px",
    fontSize: 12,
    lineHeight: 1.45,
    color: "rgba(255,255,255,0.55)",
  },
  row: {
    display: "flex",
    gap: 8,
    alignItems: "flex-start",
    marginBottom: 6,
    fontSize: 12,
    lineHeight: 1.45,
  },
  label: {
    flexShrink: 0,
    width: 42,
    color: "rgba(255,255,255,0.45)",
    fontWeight: 600,
  },
  value: {
    color: "rgba(255,255,255,0.88)",
    wordBreak: "break-word",
  },
  button: {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(167, 139, 250, 0.35)",
    background: "rgba(124, 58, 237, 0.16)",
    color: "#fff",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  headerBtn: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: 0,
    margin: 0,
    border: "none",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    textAlign: "left",
  },
  summaryEntryBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255, 255, 255, 0.1)",
    background:
      "linear-gradient(160deg, rgba(0, 0, 0, 0.72) 0%, rgba(18, 18, 18, 0.92) 100%)",
    boxShadow:
      "0 2px 12px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
    color: "#fff",
    cursor: "pointer",
    textAlign: "left",
    WebkitTapHighlightColor: "transparent",
  },
  summaryEntryMain: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  summaryEntryTitle: {
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: "-0.02em",
  },
  summaryEntryHint: {
    fontSize: 11,
    fontWeight: 500,
    color: "rgba(255,255,255,0.45)",
    lineHeight: 1.35,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  summaryEntryChevron: {
    flexShrink: 0,
    fontSize: 20,
    fontWeight: 300,
    lineHeight: 1,
    color: "rgba(255,255,255,0.32)",
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: "rgba(255,255,255,0.82)",
    flexShrink: 0,
  },
  headerHint: {
    flex: 1,
    minWidth: 0,
    fontSize: 10,
    lineHeight: 1.35,
    color: "rgba(255,255,255,0.45)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  chevron: {
    flexShrink: 0,
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
  },
  backBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    marginBottom: 10,
    padding: "4px 0",
    border: "none",
    background: "transparent",
    color: "#3498DB",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
};

const STUDIO_STYLES = {
  wrapper: {
    backgroundColor: "#222",
    padding: "14px",
    borderRadius: 10,
    marginBottom: 16,
    border: "1px solid rgba(255,255,255,0.06)",
  },
  title: {
    fontSize: 13,
    fontWeight: 700,
    color: "#fff",
    marginBottom: 4,
  },
  hint: {
    margin: "0 0 12px",
    fontSize: 11,
    lineHeight: 1.45,
    color: "#999",
  },
  empty: {
    margin: "0 0 12px",
    fontSize: 12,
    lineHeight: 1.45,
    color: "#bbb",
  },
  row: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 8,
    fontSize: 12,
    lineHeight: 1.45,
  },
  label: {
    flexShrink: 0,
    width: 48,
    color: "#888",
    fontWeight: 600,
  },
  value: {
    color: "#eee",
    wordBreak: "break-word",
  },
  button: {
    width: "100%",
    maxWidth: 280,
    padding: "9px 12px",
    borderRadius: 8,
    border: "1px solid rgba(167, 139, 250, 0.35)",
    background: "rgba(124, 58, 237, 0.18)",
    color: "#fff",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  headerBtn: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: 0,
    margin: 0,
    border: "none",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    textAlign: "left",
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#fff",
    flexShrink: 0,
  },
  headerHint: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    lineHeight: 1.35,
    color: "#888",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  chevron: {
    flexShrink: 0,
    fontSize: 10,
    color: "#666",
  },
  backBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    marginBottom: 10,
    padding: "4px 0",
    border: "none",
    background: "transparent",
    color: "#3498DB",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
};

/**
 * @param {{
 *   userId?: string|null,
 *   authLoading?: boolean,
 *   variant?: 'card' | 'studio',
 *   onSaved?: (message?: string, kind?: 'success'|'error') => void,
 *   summaryOnly?: boolean,
 *   fullPage?: boolean,
 *   onBack?: () => void,
 *   onNavigateToDetail?: () => void,
 * }} props
 */
export default function UserTastePreferencesSection({
  userId,
  authLoading = false,
  variant = "card",
  onSaved,
  summaryOnly = false,
  fullPage = false,
  onBack,
  onNavigateToDetail,
}) {
  const styles = variant === "studio" ? STUDIO_STYLES : CARD_STYLES;
  const { showToast } = useToast();
  const { profile, loading, savePreferences } = useUserTastePreferences({
    userId,
    authLoading,
  });
  const [editorOpen, setEditorOpen] = useState(false);
  const [expanded, setExpanded] = useState(fullPage);

  const showExpandedBody = fullPage || (expanded && !summaryOnly);

  const summary = useMemo(
    () => formatTasteProfileSummary(profile),
    [profile]
  );
  const hasSignals = tasteProfileHasSignals(profile);
  const collapsedHint = useMemo(() => {
    if (loading) return "불러오는 중…";
    if (!hasSignals) {
      return summaryOnly ? "탭해서 설정하기" : "미설정 · 탭해서 펼치기";
    }
    const bits = summary
      .slice(0, 3)
      .map((p) => p.value)
      .filter(Boolean);
    return bits.length ? bits.join(" · ") : "설정됨";
  }, [loading, hasSignals, summary, summaryOnly]);
  const initialAnswers = useMemo(
    () => tasteRowToOnboardingAnswers(profile),
    [profile]
  );

  const handleComplete = async (answers) => {
    const res = await savePreferences(answers, { skipped: false });
    if (res?.ok) {
      setEditorOpen(false);
      if (onSaved) onSaved("술 취향을 저장했어요.", "success");
      else showToast("술 취향을 저장했어요.", "success", 2600);
      return;
    }
    if (onSaved) {
      onSaved("취향 저장에 실패했어요. 잠시 후 다시 시도해 주세요.", "error");
    } else {
      showToast("취향 저장에 실패했어요. 잠시 후 다시 시도해 주세요.", "error", 3200);
    }
  };

  if (!userId) return null;

  const handleHeaderClick = () => {
    if (summaryOnly && typeof onNavigateToDetail === "function") {
      onNavigateToDetail();
      return;
    }
    if (!fullPage) setExpanded((v) => !v);
  };

  return (
    <>
      <div
        style={{
          ...styles.wrapper,
          ...(summaryOnly
            ? {
                borderBottom: "none",
                padding: "0 14px 12px",
                backgroundColor: "transparent",
              }
            : {}),
          ...(fullPage
            ? {
                flex: 1,
                borderBottom: "none",
                padding: "12px 14px 16px",
              }
            : {}),
        }}
      >
        {fullPage && typeof onBack === "function" ? (
          <button type="button" style={styles.backBtn} onClick={onBack}>
            ← 프로필
          </button>
        ) : null}

        {!fullPage ? (
          summaryOnly ? (
            <button
              type="button"
              style={styles.summaryEntryBtn}
              onClick={handleHeaderClick}
              aria-label="술 취향 설정 보기"
            >
              <span style={styles.summaryEntryMain}>
                <span style={styles.summaryEntryTitle}>술 취향</span>
                <span style={styles.summaryEntryHint}>{collapsedHint}</span>
              </span>
              <span style={styles.summaryEntryChevron} aria-hidden>
                ›
              </span>
            </button>
          ) : (
            <button
              type="button"
              style={styles.headerBtn}
              onClick={handleHeaderClick}
              aria-expanded={expanded}
              aria-controls="user-taste-prefs-body"
            >
              <span style={styles.chevron} aria-hidden>
                {expanded ? "▾" : "▸"}
              </span>
              <span style={styles.headerTitle}>술 취향</span>
              {!showExpandedBody ? (
                <span style={styles.headerHint}>{collapsedHint}</span>
              ) : null}
            </button>
          )
        ) : (
          <div style={{ marginBottom: 8 }}>
            <span style={styles.headerTitle}>술 취향</span>
          </div>
        )}

        {showExpandedBody ? (
          <div id="user-taste-prefs-body">
            <p style={{ ...styles.hint, marginTop: 8 }}>
              맞춤 추천·코스에 쓰입니다. 언제든 바꿀 수 있어요.
            </p>

            {loading ? (
              <p style={styles.empty}>불러오는 중…</p>
            ) : hasSignals ? (
              <div style={{ marginBottom: 10 }}>
                {summary.map((part) => (
                  <div key={part.label} style={styles.row}>
                    <span style={styles.label}>{part.label}</span>
                    <span style={styles.value}>{part.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={styles.empty}>
                아직 설정하지 않았어요. 설문을 완료하면 추천이 더 잘 맞춰져요.
              </p>
            )}

            <button
              type="button"
              onClick={() => setEditorOpen(true)}
              style={styles.button}
            >
              {hasSignals ? "취향 수정" : "취향 설정하기"}
            </button>
          </div>
        ) : null}
      </div>

      {editorOpen ? (
        <OnboardingQuestions
          initialAnswers={initialAnswers}
          modalTitle={hasSignals ? "술 취향 수정" : "술 취향 설정"}
          completeLabel="저장"
          showSkip={false}
          backLabel="술 취향"
          onComplete={handleComplete}
          onDismiss={() => setEditorOpen(false)}
        />
      ) : null}
    </>
  );
}
