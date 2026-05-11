import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  dismissTasteOnboarding,
  fetchProfileTastePreferences,
  saveTasteOnboardingSelection,
} from "../../api/userPreferenceTags";
import { TASTE_ONBOARDING_OPTIONS } from "../../constants/tasteOnboarding";

/**
 * 신규·미설정 유저용 취향 온보딩 — `profiles.taste_onboarding_dismissed_at` 가 NULL 일 때만 노출.
 * 선택값은 `profiles.preference_tags` 에 저장되며, 저장/좋아요 시그널이 없을 때
 * `fetchMyTasteCollectionRecommendations` 의 fallback 으로 사용된다.
 *
 * 검색·지도·`useCourseSearch` 와 무관.
 */
export default function HomeTasteOnboarding() {
  const { user, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const uid = user?.id;

  const refreshGate = useCallback(async () => {
    if (!uid) {
      setNeedsOnboarding(false);
      setChecking(false);
      return;
    }
    setChecking(true);
    try {
      const row = await fetchProfileTastePreferences(uid);
      const dismissed = Boolean(row?.taste_onboarding_dismissed_at);
      setNeedsOnboarding(!dismissed);
    } catch {
      setNeedsOnboarding(false);
    } finally {
      setChecking(false);
    }
  }, [uid]);

  useEffect(() => {
    if (authLoading) return;
    refreshGate();
  }, [authLoading, refreshGate]);

  const toggle = useCallback((label) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);

  const onSkip = useCallback(async () => {
    if (!uid || saving) return;
    setSaving(true);
    setErrorMsg("");
    try {
      await dismissTasteOnboarding(uid);
      setNeedsOnboarding(false);
    } catch (e) {
      setErrorMsg(
        typeof e?.message === "string"
          ? e.message
          : "잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setSaving(false);
    }
  }, [uid, saving]);

  const onSave = useCallback(async () => {
    if (!uid || saving) return;
    const tags = [...selected];
    if (tags.length === 0) {
      setErrorMsg("취향을 하나 이상 골라 주세요.");
      return;
    }
    setSaving(true);
    setErrorMsg("");
    try {
      await saveTasteOnboardingSelection(uid, tags);
      setNeedsOnboarding(false);
    } catch (e) {
      setErrorMsg(
        typeof e?.message === "string"
          ? e.message
          : "저장에 실패했어요. 다시 시도해 주세요.",
      );
    } finally {
      setSaving(false);
    }
  }, [uid, saving, selected]);

  if (authLoading || checking) return null;
  if (!uid || !needsOnboarding) return null;

  return (
    <div style={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="taste-onb-title">
      <div style={styles.panel}>
        <div id="taste-onb-title" style={styles.title}>
          어떤 술자리가 잘 맞나요?
        </div>
        <div style={styles.sub}>
          골라 두면 홈에서 바로 비슷한 코스를 추천해 드려요. 나중에 저장·좋아요가
          쌓이면 그쪽이 더 우선이에요.
        </div>

        <div style={styles.chipWrap} aria-label="취향 선택">
          {TASTE_ONBOARDING_OPTIONS.map((label) => {
            const on = selected.has(label);
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggle(label)}
                style={{
                  ...styles.chip,
                  ...(on ? styles.chipOn : null),
                }}
                aria-pressed={on}
              >
                {label}
              </button>
            );
          })}
        </div>

        {errorMsg ? (
          <div style={styles.err} role="alert">
            {errorMsg}
          </div>
        ) : null}

        <div style={styles.actions}>
          <button
            type="button"
            onClick={onSkip}
            disabled={saving}
            style={styles.btnGhost}
          >
            나중에
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            style={styles.btnPrimary}
          >
            {saving ? "저장 중…" : "이 취향으로 시작"}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: "relative",
    width: "100%",
    marginBottom: 8,
    borderRadius: 16,
    padding: "14px 14px 16px",
    background: "linear-gradient(145deg, rgba(46,204,113,0.16), rgba(52,152,219,0.12))",
    border: "1px solid rgba(46,204,113,0.38)",
    boxShadow: "0 10px 32px rgba(0,0,0,0.38)",
    backdropFilter: "blur(10px)",
  },
  panel: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: 900,
    color: "#fff",
    letterSpacing: "-0.02em",
    lineHeight: 1.25,
  },
  sub: {
    fontSize: 11,
    fontWeight: 600,
    color: "rgba(255,255,255,0.55)",
    lineHeight: 1.45,
    wordBreak: "keep-all",
  },
  chipWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(0,0,0,0.22)",
    color: "rgba(255,255,255,0.82)",
    borderRadius: 999,
    padding: "7px 13px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  chipOn: {
    background: "rgba(46,204,113,0.22)",
    border: "1px solid rgba(46,204,113,0.55)",
    color: "#c8f7dc",
    boxShadow: "0 0 0 1px rgba(46,204,113,0.12)",
  },
  err: {
    fontSize: 11,
    fontWeight: 700,
    color: "#ffb4b4",
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
    justifyContent: "flex-end",
  },
  btnGhost: {
    border: "1px solid rgba(255,255,255,0.22)",
    background: "transparent",
    color: "rgba(255,255,255,0.75)",
    borderRadius: 999,
    padding: "9px 16px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  btnPrimary: {
    border: "none",
    background: "linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)",
    color: "#0c1410",
    borderRadius: 999,
    padding: "9px 18px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(46,204,113,0.35)",
  },
};
