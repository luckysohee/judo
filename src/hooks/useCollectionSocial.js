import { useCallback, useEffect, useState } from "react";
import {
  fetchCollectionSocialState,
  likeCollection,
  unlikeCollection,
  saveCollection,
  unsaveCollection,
} from "../api/collectionSocial";
import { useAuth } from "../context/AuthContext";
import { completeActivation, markActivationEvent } from "../utils/activationState";
import {
  ACTIVATION_EVENT,
  logActivationFunnelEvent,
} from "../api/activationFunnelLogs";
import { readActivationState } from "../utils/activationState";

/**
 * 컬렉션 좋아요·저장 토글 로직 — `CollectionSocialRow` 와 검색 카드 등에서 공유.
 *
 * @param {string} collectionId
 * @param {{
 *   initialLikeCount?: number,
 *   initialSaveCount?: number,
 *   saveSuccessToast?: (showToast: Function) => void,
 *   enableCreateCollectionCta?: boolean,
 * }} [opts]
 */
export function useCollectionSocial(
  collectionId,
  {
    initialLikeCount = 0,
    initialSaveCount = 0,
    saveSuccessToast,
    enableCreateCollectionCta = true,
  } = {},
) {
  const { user } = useAuth();

  const [social, setSocial] = useState(() => ({
    collection_id: collectionId,
    like_count: Math.max(0, Number(initialLikeCount) || 0),
    save_count: Math.max(0, Number(initialSaveCount) || 0),
    liked_by_me: false,
    saved_by_me: false,
  }));
  const [loadErr, setLoadErr] = useState("");
  const [busyLike, setBusyLike] = useState(false);
  const [busySave, setBusySave] = useState(false);
  const [showCreateCta, setShowCreateCta] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadErr("");
      try {
        const row = await fetchCollectionSocialState(collectionId);
        if (!cancelled) setSocial(row);
      } catch (e) {
        if (!cancelled) {
          console.warn("useCollectionSocial load:", e);
          setLoadErr(e?.message || "반응 수를 불러오지 못했습니다.");
          setSocial({
            collection_id: collectionId,
            like_count: Math.max(0, Number(initialLikeCount) || 0),
            save_count: Math.max(0, Number(initialSaveCount) || 0),
            liked_by_me: false,
            saved_by_me: false,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [collectionId, user?.id, initialLikeCount, initialSaveCount]);

  const runToggleLike = useCallback(
    async ({ showToast }) => {
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
    },
    [
      social,
      user?.id,
      busyLike,
      busySave,
      collectionId,
    ],
  );

  const runToggleSave = useCallback(
    async ({ showToast }) => {
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
        if (turningOn) {
          // first session activation: 첫 저장 시 activation 완료
          try {
            const before = readActivationState();
            const hadFirst = Boolean(before?.events?.first_collection_save);

            if (!hadFirst) {
              markActivationEvent("first_collection_save");
              completeActivation("save");
              logActivationFunnelEvent({
                eventName: ACTIVATION_EVENT.ACTIVATION_COMPLETED,
                completedBy: "save",
                experimentBucket: null,
                activationCtaBucket: null,
                appEnv: import.meta.env.MODE,
                source: "activation_completed",
              });
            } else {
              logActivationFunnelEvent({
                eventName: ACTIVATION_EVENT.SECOND_SAVE,
                experimentBucket: null,
                activationCtaBucket: null,
                appEnv: import.meta.env.MODE,
                source: "second_save",
              });
            }
            if (!hadFirst) {
              logActivationFunnelEvent({
                eventName: ACTIVATION_EVENT.FIRST_COLLECTION_SAVE,
                experimentBucket: null,
                activationCtaBucket: null,
                appEnv: import.meta.env.MODE,
                source: "collection_save",
              });
            }
          } catch {
            /* ignore */
          }
          if (typeof saveSuccessToast === "function") {
            saveSuccessToast(showToast);
          }
          if (enableCreateCollectionCta) setShowCreateCta(true);
        }
      } catch (e) {
        setSocial(prev);
        showToast(e?.message || "저장 처리에 실패했습니다.", "error", 2800);
      } finally {
        setBusySave(false);
      }
    },
    [
      social,
      user?.id,
      busyLike,
      busySave,
      collectionId,
      saveSuccessToast,
      enableCreateCollectionCta,
    ],
  );

  return {
    social,
    loadErr,
    busyLike,
    busySave,
    showCreateCta,
    runToggleLike,
    runToggleSave,
  };
}
