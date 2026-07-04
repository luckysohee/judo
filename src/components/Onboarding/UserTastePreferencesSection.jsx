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
};

/**
 * @param {{
 *   userId?: string|null,
 *   authLoading?: boolean,
 *   variant?: 'card' | 'studio',
 *   onSaved?: (message?: string, kind?: 'success'|'error') => void,
 * }} props
 */
export default function UserTastePreferencesSection({
  userId,
  authLoading = false,
  variant = "card",
  onSaved,
}) {
  const styles = variant === "studio" ? STUDIO_STYLES : CARD_STYLES;
  const { showToast } = useToast();
  const { profile, loading, savePreferences } = useUserTastePreferences({
    userId,
    authLoading,
  });
  const [editorOpen, setEditorOpen] = useState(false);

  const summary = useMemo(
    () => formatTasteProfileSummary(profile),
    [profile]
  );
  const hasSignals = tasteProfileHasSignals(profile);
  const initialAnswers = useMemo(
    () => tasteRowToOnboardingAnswers(profile),
    [profile]
  );

  const handleComplete = async (answers) => {
    const res = await savePreferences(answers, { skipped: false });
    if (res?.ok) {
      setEditorOpen(false);
      if (onSaved) onSaved("술·나가기 취향을 저장했어요.", "success");
      else showToast("술·나가기 취향을 저장했어요.", "success", 2600);
      return;
    }
    if (onSaved) {
      onSaved("취향 저장에 실패했어요. 잠시 후 다시 시도해 주세요.", "error");
    } else {
      showToast("취향 저장에 실패했어요. 잠시 후 다시 시도해 주세요.", "error", 3200);
    }
  };

  if (!userId) return null;

  return (
    <>
      <div style={styles.wrapper}>
        <div style={styles.title}>술·나가기 취향</div>
        <p style={styles.hint}>
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

      {editorOpen ? (
        <OnboardingQuestions
          initialAnswers={initialAnswers}
          modalTitle={hasSignals ? "취향 수정" : "취향 설정"}
          completeLabel="저장"
          showSkip={false}
          onComplete={handleComplete}
          onDismiss={() => setEditorOpen(false)}
        />
      ) : null}
    </>
  );
}
