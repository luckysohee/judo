import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

const SAVED_THRESHOLD = 3;
const DISMISS_KEY = "judo_home_create_collection_prompt_dismissed_v1";

/**
 * 홈 상단 lightweight prompt — 장소 N개 이상 저장한 로그인 유저에게 컬렉션 생성을 유도.
 *
 * - 비로그인·저장 < 3개·dismiss 이력 있음 → 렌더 안 함.
 * - 자체 카운트 fetch (`user_saved_places` head=true count). 실패해도 조용히 숨김.
 * - 검색·지도·추천·체크인 파이프라인과 무관한 single-purpose 카드.
 */
function readDismissedFromStorage() {
  try {
    if (typeof window === "undefined") return false;
    return window.localStorage?.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export default function HomeCreateCollectionPrompt() {
  const { user, loading: authLoading } = useAuth();
  const [savedCount, setSavedCount] = useState(null);
  const [dismissed, setDismissed] = useState(readDismissedFromStorage);

  useEffect(() => {
    if (authLoading) return undefined;
    const uid = user?.id;
    if (!uid) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { count, error } = await supabase
          .from("user_saved_places")
          .select("place_id", { head: true, count: "exact" })
          .eq("user_id", uid);
        if (cancelled) return;
        if (error) {
          if (import.meta?.env?.DEV) {
            console.warn("HomeCreateCollectionPrompt count:", error.message);
          }
          setSavedCount(null);
          return;
        }
        setSavedCount(typeof count === "number" ? count : null);
      } catch (e) {
        if (import.meta?.env?.DEV) {
          console.warn("HomeCreateCollectionPrompt count:", e?.message || e);
        }
        if (!cancelled) setSavedCount(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id]);

  if (authLoading) return null;
  if (!user?.id) return null;
  if (dismissed) return null;
  if (savedCount === null || savedCount < SAVED_THRESHOLD) return null;

  const onDismiss = () => {
    try {
      window?.localStorage?.setItem(DISMISS_KEY, "1");
    } catch {
      /* storage 불가 환경 무시 */
    }
    setDismissed(true);
  };

  return (
    <section style={styles.section} aria-label="내 컬렉션 만들기 추천">
      <div style={styles.headRow}>
        <div style={styles.emoji} aria-hidden="true">
          🛠️
        </div>
        <div style={styles.body}>
          <div style={styles.title}>
            저장한 장소 {savedCount}곳 — 1차 → 2차 루트로 묶어볼까요?
          </div>
          <div style={styles.sub}>
            나만의 데이트 코스·동선 컬렉션으로 정리하면 다른 사람도 따라갈 수
            있어요.
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          style={styles.dismissBtn}
          aria-label="이 안내 닫기"
          title="다음에 다시 안내받지 않기"
        >
          ×
        </button>
      </div>
      <div style={styles.actions}>
        <Link to="/my-collections" style={styles.primaryLink}>
          내 컬렉션 만들기 →
        </Link>
        <Link to="/saved" style={styles.secondaryLink}>
          저장한 장소 보기
        </Link>
      </div>
    </section>
  );
}

const styles = {
  section: {
    width: "100%",
    margin: "0 0 6px",
    padding: "12px 14px 14px",
    borderRadius: 16,
    background:
      "linear-gradient(160deg, rgba(46,204,113,0.18), rgba(52,152,219,0.14))",
    border: "1px solid rgba(46,204,113,0.42)",
    boxShadow: "0 8px 24px rgba(0,0,0,0.32)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  headRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
  },
  emoji: {
    fontSize: 22,
    lineHeight: 1,
    flexShrink: 0,
    marginTop: 2,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: 800,
    color: "#fff",
    lineHeight: 1.35,
    letterSpacing: "-0.02em",
    wordBreak: "keep-all",
  },
  sub: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: 600,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 1.4,
    wordBreak: "keep-all",
  },
  dismissBtn: {
    flexShrink: 0,
    width: 24,
    height: 24,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.18)",
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    lineHeight: 1,
    padding: 0,
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  primaryLink: {
    fontSize: 12,
    fontWeight: 800,
    color: "#0c1410",
    textDecoration: "none",
    background:
      "linear-gradient(145deg, rgba(46,204,113,0.95), rgba(39,174,96,0.95))",
    border: "1px solid rgba(46,204,113,0.7)",
    borderRadius: 999,
    padding: "7px 14px",
  },
  secondaryLink: {
    fontSize: 12,
    fontWeight: 700,
    color: "rgba(255,255,255,0.85)",
    textDecoration: "none",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 999,
    padding: "7px 14px",
  },
};
