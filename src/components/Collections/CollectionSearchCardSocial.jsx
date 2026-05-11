import { useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../Toast/ToastProvider";
import { useCollectionSocial } from "../../hooks/useCollectionSocial";

/** @param {(msg: string, type?: string, durationMs?: number) => void} showToast */
function onSearchSaveSuccess(showToast) {
  showToast("이 코스를 저장했어요.", "success", 2200);
}

/**
 * 컬렉션 검색 카드용 인라인 좋아요·저장 — 모바일에서 바로 탭 가능한 크기.
 *
 * `useCollectionSocial` 로 상세 페이지 `CollectionSocialRow` 와 동일한 API·토스트 규칙을 공유한다.
 *
 * @param {{
 *   collectionId: string,
 *   initialLikeCount?: number,
 *   initialSaveCount?: number,
 * }} props
 */
export default function CollectionSearchCardSocial({
  collectionId,
  initialLikeCount = 0,
  initialSaveCount = 0,
}) {
  const { user } = useAuth();
  const { showToast } = useToast();

  const {
    social,
    loadErr,
    busyLike,
    busySave,
    runToggleLike,
    runToggleSave,
  } = useCollectionSocial(collectionId, {
    initialLikeCount,
    initialSaveCount,
    saveSuccessToast: onSearchSaveSuccess,
    enableCreateCollectionCta: false,
  });

  const onLike = useCallback(() => {
    runToggleLike({ showToast });
  }, [runToggleLike, showToast]);

  const onSave = useCallback(() => {
    runToggleSave({ showToast });
  }, [runToggleSave, showToast]);

  if (!social) {
    return (
      <div style={styles.row}>
        <span style={styles.muted}>…</span>
      </div>
    );
  }

  const likeActive = Boolean(user?.id && social.liked_by_me);
  const saveActive = Boolean(user?.id && social.saved_by_me);
  const locked = busyLike || busySave;

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
          onClick={onLike}
          disabled={locked}
          style={{
            ...styles.btn,
            ...(likeActive ? styles.btnLikeOn : null),
            ...(locked ? styles.btnBusy : null),
          }}
          aria-pressed={likeActive}
          aria-label={`좋아요 ${social.like_count}개`}
        >
          <span aria-hidden="true">{likeActive ? "❤️" : "🤍"}</span>
          <span style={styles.btnLabel}>{social.like_count}</span>
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={locked}
          style={{
            ...styles.btn,
            ...(saveActive ? styles.btnSaveOn : null),
            ...(locked ? styles.btnBusy : null),
          }}
          aria-pressed={saveActive}
          aria-label={`저장 ${social.save_count}`}
        >
          <span aria-hidden="true">{saveActive ? "📁" : "📂"}</span>
          <span style={styles.btnLabel}>{social.save_count}</span>
        </button>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    flexShrink: 0,
    alignSelf: "stretch",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    padding: "8px 10px",
    borderLeft: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(0,0,0,0.22)",
    gap: 4,
    minWidth: 96,
  },
  warn: {
    fontSize: 9,
    color: "#f1c40f",
    lineHeight: 1.2,
  },
  row: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    alignItems: "stretch",
  },
  muted: {
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
    textAlign: "center",
  },
  btn: {
    minHeight: 40,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "0 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
    color: "#eee",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  btnLabel: {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "-0.02em",
  },
  btnLikeOn: {
    border: "1px solid rgba(255,107,129,0.45)",
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
};
