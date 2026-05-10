import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../Toast/ToastProvider";
import {
  fetchCollectionSocialState,
  likeCollection,
  unlikeCollection,
  saveCollection,
  unsaveCollection,
} from "../../api/collectionSocial";

/**
 * 컬렉션 상세용 좋아요·저장 소셜 행 (카운트 + 로그인 시 토글).
 *
 * @param {{ collectionId: string }} props
 */
export default function CollectionSocialRow({ collectionId }) {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [social, setSocial] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [busyLike, setBusyLike] = useState(false);
  const [busySave, setBusySave] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadErr("");
      try {
        const row = await fetchCollectionSocialState(collectionId);
        if (!cancelled) setSocial(row);
      } catch (e) {
        if (!cancelled) {
          console.warn("CollectionSocialRow load:", e);
          setLoadErr(e?.message || "반응 수를 불러오지 못했습니다.");
          setSocial({
            collection_id: collectionId,
            like_count: 0,
            save_count: 0,
            liked_by_me: false,
            saved_by_me: false,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [collectionId, user?.id]);

  const onToggleLike = useCallback(async () => {
    if (!social) return;
    if (!user?.id) {
      showToast("좋아요하려면 로그인해 주세요.", "info", 2800);
      return;
    }
    if (busyLike || busySave) return;

    const turningOn = !social.liked_by_me;
    const prev = social;
    const delta = turningOn ? 1 : -1;
    setSocial({
      ...prev,
      liked_by_me: turningOn,
      like_count: Math.max(0, prev.like_count + delta),
    });

    setBusyLike(true);
    try {
      const { error } = turningOn
        ? await likeCollection(collectionId)
        : await unlikeCollection(collectionId);
      if (error) throw error;
      const fresh = await fetchCollectionSocialState(collectionId);
      setSocial(fresh);
    } catch (e) {
      setSocial(prev);
      showToast(e?.message || "좋아요 처리에 실패했습니다.", "error", 2800);
    } finally {
      setBusyLike(false);
    }
  }, [
    social,
    user?.id,
    busyLike,
    busySave,
    collectionId,
    showToast,
  ]);

  const onToggleSave = useCallback(async () => {
    if (!social) return;
    if (!user?.id) {
      showToast("저장하려면 로그인해 주세요.", "info", 2800);
      return;
    }
    if (busyLike || busySave) return;

    const turningOn = !social.saved_by_me;
    const prev = social;
    const delta = turningOn ? 1 : -1;
    setSocial({
      ...prev,
      saved_by_me: turningOn,
      save_count: Math.max(0, prev.save_count + delta),
    });

    setBusySave(true);
    try {
      const { error } = turningOn
        ? await saveCollection(collectionId)
        : await unsaveCollection(collectionId);
      if (error) throw error;
      const fresh = await fetchCollectionSocialState(collectionId);
      setSocial(fresh);
    } catch (e) {
      setSocial(prev);
      showToast(e?.message || "저장 처리에 실패했습니다.", "error", 2800);
    } finally {
      setBusySave(false);
    }
  }, [
    social,
    user?.id,
    busyLike,
    busySave,
    collectionId,
    showToast,
  ]);

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
};
