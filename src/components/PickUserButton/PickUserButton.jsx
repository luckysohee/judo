import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import {
  followPick,
  unfollowPick,
  isPickingUser,
  getPickCounts,
  mutualPickWith,
} from "../../utils/userProfileFollows";

/** 프로필 기준 카운트 라벨 (받은 픽 / 내 픽) */
export function PickCountsRow({
  /** pick 그래프 기준 auth.users.id (관계·카운트 주체, curator row id 아님) */
  profileUserId,
  receivedCount,
  outgoingCount,
  mutual,
  style,
}) {
  return (
    <div
      data-profile-user-id={profileUserId ?? undefined}
      aria-label={
        profileUserId
          ? `유저 ${profileUserId} 받은 픽과 내 픽 건수`
          : undefined
      }
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 14,
        fontSize: 14,
        color: "#ddd",
        ...style,
      }}
    >
      <div>
        <strong style={{ color: "#fff", fontVariantNumeric: "tabular-nums" }}>
          {receivedCount}
        </strong>{" "}
        받은 픽
      </div>
      <div>
        <strong style={{ color: "#fff", fontVariantNumeric: "tabular-nums" }}>
          {outgoingCount}
        </strong>{" "}
        내 픽
      </div>
      {mutual ? (
        <span
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: "#27ae60",
            padding: "2px 8px",
            borderRadius: 999,
            border: "1px solid rgba(39,174,96,0.5)",
            background: "rgba(39,174,96,0.12)",
          }}
          title="맞픽 — 서로 pick 중"
          aria-hidden
        >
          맞픽
        </span>
      ) : null}
    </div>
  );
}

/**
 * `user_profile_follows` 기준 pick 버튼. 기준 사용자는 모두 auth.users.id.
 * - 상태 조회 RPC는 현재 세션만 지원함 → 로그아웃 상태에서는 버튼만 노출 후 클릭 시 로그인 유도.
 */
export default function PickUserButton({
  /** pick 대상 auth uid */
  profileUserId,
  /** 비로그인 클릭 안내 문구 */
  loginPromptMessage = "로그인 후 픽할 수 있습니다.",
  /** 카운트 갱신(부모 state와 동기화) */
  onPickCountsChange,
  /** 맞픽/픽 상태 — 카운트행 배지·부모 표시 동기화 (세션 사용자 기준 조회 결과) */
  onRelationshipChange,
  /** 상대에게 처음 pick 했을 때 (프로바이더 동기화 등) */
  onBecomePicking,
  buttonStyle,
}) {
  const { user } = useAuth();
  const viewerUserId = user?.id ?? null;
  const isSelf =
    Boolean(viewerUserId && profileUserId) &&
    viewerUserId === profileUserId;

  const [isPicking, setIsPicking] = useState(false);
  const [mutual, setMutual] = useState(false);
  const [loadingRel, setLoadingRel] = useState(false);
  const [processing, setProcessing] = useState(false);

  const refreshCounts = useCallback(async () => {
    if (!profileUserId || !onPickCountsChange) return;
    try {
      const c = await getPickCounts(supabase, profileUserId);
      onPickCountsChange({
        received: c.followers_count,
        outgoing: c.following_count,
      });
    } catch {
      /* ignore */
    }
  }, [profileUserId, onPickCountsChange]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!profileUserId || isSelf || !viewerUserId) {
        setIsPicking(false);
        setMutual(false);
        if (
          profileUserId &&
          !isSelf &&
          !viewerUserId &&
          typeof onRelationshipChange === "function"
        ) {
          onRelationshipChange({ isPicking: false, mutual: false });
        }
        return;
      }
      setLoadingRel(true);
      try {
        const [p, m] = await Promise.all([
          isPickingUser(supabase, profileUserId),
          mutualPickWith(supabase, profileUserId),
        ]);
        if (!cancelled) {
          setIsPicking(p);
          setMutual(m);
          onRelationshipChange?.({ isPicking: p, mutual: Boolean(m) });
        }
      } catch {
        if (!cancelled) {
          setIsPicking(false);
          setMutual(false);
          onRelationshipChange?.({ isPicking: false, mutual: false });
        }
      } finally {
        if (!cancelled) setLoadingRel(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [
    profileUserId,
    viewerUserId,
    isSelf,
    onRelationshipChange,
  ]);

  const onPress = async () => {
    if (!profileUserId) return;

    if (!viewerUserId) {
      window.alert(loginPromptMessage);
      return;
    }
    if (isSelf || processing || loadingRel) return;

    setProcessing(true);
    try {
      if (isPicking) {
        await unfollowPick(supabase, profileUserId);
        setIsPicking(false);
        setMutual(false);
        onRelationshipChange?.({ isPicking: false, mutual: false });
      } else {
        await followPick(supabase, profileUserId);
        setIsPicking(true);
        onBecomePicking?.();
        const mNext = await mutualPickWith(supabase, profileUserId);
        setMutual(Boolean(mNext));
        onRelationshipChange?.({ isPicking: true, mutual: Boolean(mNext) });
      }
      await refreshCounts();
    } catch (e) {
      window.alert(e?.message || "pick 처리 중 오류가 발생했습니다.");
    } finally {
      setProcessing(false);
    }
  };

  const label = mutual
    ? "서로 픽됨"
    : isPicking
      ? "픽됨"
      : "픽하기";

  let btnStyle = {
    marginTop: 12,
    padding: "11px 20px",
    borderRadius: 999,
    border: "none",
    fontWeight: 800,
    fontSize: 15,
    cursor: processing ? "wait" : "pointer",
    opacity: processing ? 0.75 : 1,
    ...(mutual && viewerUserId
      ? {
          backgroundColor: "#1a3325",
          color: "#2ecc71",
          boxShadow:
            "inset 0 0 0 2px rgba(46,204,113,0.55), inset 0 1px 0 rgba(255,255,255,0.08)",
        }
      : isPicking && viewerUserId
        ? {
            backgroundColor: "#2a2a2a",
            color: "#e0e0e0",
            border: "1px solid #444",
          }
        : {
            backgroundColor: "#3498db",
            color: "#fff",
          }),
    ...(buttonStyle && typeof buttonStyle === "object" ? buttonStyle : {}),
  };

  if (!profileUserId) return null;
  /** 본인 프로필에서는 숨김 */
  if (isSelf) return null;

  return (
    <button type="button" onClick={() => void onPress()} style={btnStyle}>
      {!viewerUserId
        ? "픽하기"
        : processing
          ? "처리 중…"
          : label}
    </button>
  );
}
