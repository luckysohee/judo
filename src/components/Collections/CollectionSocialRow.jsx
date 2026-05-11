import { useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../Toast/ToastProvider";
import { useCollectionSocial } from "../../hooks/useCollectionSocial";

/**
 * 컬렉션 상세용 좋아요·저장 소셜 행 (카운트 + 로그인 시 토글).
 *
 * @param {{ collectionId: string }} props
 */
export default function CollectionSocialRow({ collectionId }) {
  const { user } = useAuth();
  const { showToast } = useToast();

  const {
    social,
    loadErr,
    busyLike,
    busySave,
    showCreateCta,
    runToggleLike,
    runToggleSave,
  } = useCollectionSocial(collectionId);

  const onToggleLike = useCallback(() => {
    runToggleLike({ showToast });
  }, [runToggleLike, showToast]);

  const onToggleSave = useCallback(() => {
    runToggleSave({ showToast });
  }, [runToggleSave, showToast]);

  if (!social) {
    return (
      <div style={styles.row}>
        <span style={styles.muted}>반응 불러오는 중…</span>
      </div>
    );
  }

  const likeActive = Boolean(user?.id && social.liked_by_me);
  const saveActive = Boolean(user?.id && social.saved_by_me);
  const interactionLocked = busyLike || busySave;

  return (
    <div style={styles.wrap}>
      {loadErr ? (
        <div style={styles.warn} role="status">
          {loadErr}
        </div>
      ) : null}
      <div style={styles.row}>
        <button
          type="button"
          onClick={onToggleLike}
          disabled={interactionLocked}
          style={{
            ...styles.btn,
            ...(likeActive ? styles.btnLikeOn : null),
            ...(interactionLocked ? styles.btnBusy : null),
          }}
          aria-pressed={likeActive}
          aria-label={`좋아요 ${social.like_count}개`}
        >
          <span style={styles.emoji} aria-hidden="true">
            {likeActive ? "❤️" : "🤍"}
          </span>
          좋아요 {social.like_count}
        </button>
        <button
          type="button"
          onClick={onToggleSave}
          disabled={interactionLocked}
          style={{
            ...styles.btn,
            ...(saveActive ? styles.btnSaveOn : null),
            ...(interactionLocked ? styles.btnBusy : null),
          }}
          aria-pressed={saveActive}
          aria-label={`저장 ${social.save_count}명`}
        >
          <span style={styles.emoji} aria-hidden="true">
            {saveActive ? "📁" : "📂"}
          </span>
          저장 {social.save_count}
        </button>
      </div>

      {showCreateCta && saveActive && user?.id ? (
        <div style={styles.cta} role="status">
          <div style={styles.ctaText}>
            나만의 코스도 만들어볼까요? 1차 → 2차 루트로 묶어보세요.
          </div>
          <Link to="/my-collections" style={styles.ctaLink}>
            내 컬렉션 만들기 →
          </Link>
        </div>
      ) : null}
    </div>
  );
}

const styles = {
  wrap: {
    marginBottom: 14,
  },
  warn: {
    fontSize: 11,
    color: "#f1c40f",
    marginBottom: 8,
  },
  row: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  muted: {
    fontSize: 13,
    color: "#888",
  },
  btn: {
    flex: 1,
    minWidth: 120,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "#eee",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    transition: "border-color 0.15s ease, background 0.15s ease",
  },
  btnLikeOn: {
    border: "1px solid rgba(255,107,129,0.55)",
    background: "rgba(255,107,129,0.12)",
    color: "#ffc9d4",
  },
  btnSaveOn: {
    border: "1px solid rgba(46,204,113,0.45)",
    background: "rgba(46,204,113,0.12)",
    color: "#9ad3a4",
  },
  btnBusy: {
    opacity: 0.55,
    cursor: "default",
  },
  emoji: {
    fontSize: 15,
    lineHeight: 1,
  },
  cta: {
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 12,
    background: "rgba(46,204,113,0.1)",
    border: "1px solid rgba(46,204,113,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  ctaText: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: 700,
    color: "#d4f4dd",
    lineHeight: 1.4,
    wordBreak: "keep-all",
  },
  ctaLink: {
    fontSize: 12,
    fontWeight: 800,
    color: "#fff",
    textDecoration: "none",
    background: "rgba(46,204,113,0.25)",
    border: "1px solid rgba(46,204,113,0.55)",
    borderRadius: 999,
    padding: "6px 12px",
    flexShrink: 0,
  },
};
