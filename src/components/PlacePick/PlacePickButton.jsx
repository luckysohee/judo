import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../Toast/ToastProvider";
import {
  fetchPickState,
  pickPlace,
  unpickPlace,
} from "../../api/placePicks";
import {
  ensurePlaceUuidForPick,
  resolvePlaceUuidForPick,
} from "../../utils/resolvePlaceUuidForPick";

/** 픽은 `place_picks` 행만 추가·삭제. 폴더·로컬 저장 맵과 무관(픽 전용 폴더 없음). */

function pickPublicNoticeStorageKey(placeUuid) {
  return `judo_pick_public_shown:${placeUuid}`;
}

function maybeShowPickPublicNotice(placeUuid, showToast) {
  if (!placeUuid || typeof sessionStorage === "undefined") return;
  const k = pickPublicNoticeStorageKey(placeUuid);
  try {
    if (sessionStorage.getItem(k)) return;
    sessionStorage.setItem(k, "1");
    showToast("픽은 다른 사람에게 공개됩니다", "info", 4000);
  } catch {
    // ignore quota / private mode
  }
}

function isUniqueViolation(err) {
  const c = err?.code;
  if (c === "23505") return true;
  const msg = String(err?.message ?? err ?? "");
  return /23505|unique constraint|duplicate key/i.test(msg);
}

/**
 * 픽 = 공개 추천(필·외곽선·살짝 글로우) — 저장(각진·무채)과 역할·형태 모두 구분.
 * 픽함 = 공개 상태 뱃지에 가깝게(채움 강화, 여전히 필).
 */
const VARIANT_STYLES = {
  card: {
    base: {
      flex: 1,
      minWidth: 0,
      minHeight: "44px",
      borderRadius: "10px",
      border: "1px solid rgba(255,255,255,0.42)",
      backgroundColor: "rgba(255,255,255,0.08)",
      color: "rgba(255,255,255,0.92)",
      fontSize: "12px",
      fontWeight: 700,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 12px",
      cursor: "pointer",
      boxSizing: "border-box",
      gap: "4px",
      boxShadow: "none",
    },
    picked: {
      backgroundColor: "rgba(255,255,255,0.14)",
      color: "#ffffff",
      border: "1px solid rgba(255,255,255,0.58)",
      boxShadow: "none",
    },
    muted: {
      opacity: 0.48,
      cursor: "not-allowed",
      boxShadow: "none",
    },
    busy: { opacity: 0.78 },
  },
  sheet: {
    base: {
      alignSelf: "center",
      minWidth: "58px",
      minHeight: "36px",
      marginRight: "2px",
      borderRadius: "999px",
      border: "2px solid rgba(225, 29, 72, 0.55)",
      backgroundColor: "rgba(253, 242, 248, 0.95)",
      color: "#9f1239",
      fontSize: "11px",
      fontWeight: 800,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 12px",
      cursor: "pointer",
      boxSizing: "border-box",
      flexShrink: 0,
      boxShadow: "0 0 0 1px rgba(251, 113, 133, 0.2), 0 2px 10px rgba(190, 24, 93, 0.12)",
    },
    picked: {
      backgroundColor: "#fce7f3",
      color: "#831843",
      border: "2px solid #f472b6",
      boxShadow: "0 0 12px rgba(244, 63, 94, 0.2)",
    },
    muted: {
      opacity: 0.45,
      cursor: "not-allowed",
      boxShadow: "none",
    },
    busy: { opacity: 0.75 },
  },
  /** 흰 카드 위 3버튼 줄 (추천 상세 등) */
  lightRow: {
    base: {
      flex: 1,
      minWidth: 0,
      minHeight: "44px",
      borderRadius: "999px",
      border: "2px solid rgba(225, 29, 72, 0.5)",
      backgroundColor: "rgba(255, 255, 255, 0.98)",
      color: "#9f1239",
      fontSize: "13px",
      fontWeight: 800,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 12px",
      cursor: "pointer",
      boxSizing: "border-box",
      boxShadow: "0 0 0 1px rgba(251, 113, 133, 0.15), 0 2px 12px rgba(190, 24, 93, 0.1)",
    },
    picked: {
      backgroundColor: "#fce7f3",
      color: "#831843",
      border: "2px solid #ec4899",
      boxShadow: "0 0 14px rgba(236, 72, 153, 0.18)",
    },
    muted: {
      opacity: 0.45,
      cursor: "not-allowed",
      boxShadow: "none",
    },
    busy: { opacity: 0.78 },
  },
  /** 추천 바텀 시트 등 — 픽만 최소 너비(짧은 라벨 + 얇은 테두리) */
  lightRowCompact: {
    base: {
      flex: "0 0 auto",
      minWidth: 0,
      minHeight: "30px",
      height: "30px",
      borderRadius: "999px",
      border: "1px solid rgba(225, 29, 72, 0.55)",
      backgroundColor: "rgba(255, 255, 255, 0.98)",
      color: "#9f1239",
      fontSize: "11px",
      fontWeight: 700,
      letterSpacing: "-0.02em",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 7px",
      cursor: "pointer",
      boxSizing: "border-box",
      boxShadow: "0 1px 4px rgba(190, 24, 93, 0.07)",
    },
    picked: {
      backgroundColor: "#fce7f3",
      color: "#831843",
      border: "1px solid #ec4899",
      boxShadow: "0 0 8px rgba(236, 72, 153, 0.12)",
    },
    muted: {
      opacity: 0.45,
      cursor: "not-allowed",
      boxShadow: "none",
    },
    busy: { opacity: 0.78 },
  },
  /** 블랙 배경 + 핑크 테두리 (장소 모달 액션줄 — 저장·한잔과 동일 높이·폰트) */
  blackPink: {
    base: {
      flex: 1,
      minWidth: 0,
      height: "44px",
      minHeight: "44px",
      maxHeight: "44px",
      borderRadius: "12px",
      border: "1px solid rgba(236, 72, 153, 0.78)",
      backgroundColor: "rgba(6, 6, 8, 0.94)",
      color: "rgba(253, 242, 248, 0.96)",
      fontSize: "12px",
      fontWeight: 700,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 8px",
      cursor: "pointer",
      boxSizing: "border-box",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
    },
    picked: {
      backgroundColor: "rgba(5, 5, 8, 0.96)",
      color: "#fdf2f8",
      border: "1px solid #f472b6",
      boxShadow:
        "inset 0 1px 0 rgba(255,255,255,0.05), 0 0 12px rgba(236, 72, 153, 0.2)",
    },
    muted: {
      opacity: 0.45,
      cursor: "not-allowed",
      boxShadow: "none",
    },
    busy: { opacity: 0.78 },
  },
  /** 다이얼로그 하단 보조(닫기·지도 옆) */
  dialog: {
    base: {
      flexShrink: 0,
      minWidth: "72px",
      minHeight: "44px",
      borderRadius: "999px",
      border: "2px solid rgba(225, 29, 72, 0.5)",
      backgroundColor: "rgba(255,255,255,0.98)",
      color: "#9f1239",
      fontSize: "13px",
      fontWeight: 800,
      padding: "0 14px",
      cursor: "pointer",
      transition: "background-color 0.15s ease, transform 0.1s ease",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxSizing: "border-box",
      boxShadow: "0 2px 10px rgba(190, 24, 93, 0.1)",
    },
    picked: {
      backgroundColor: "#fce7f3",
      color: "#831843",
      border: "2px solid #ec4899",
    },
    muted: {
      opacity: 0.45,
      cursor: "not-allowed",
      boxShadow: "none",
    },
    busy: { opacity: 0.78 },
  },
  /** 장소 카드 모달 — 무채·글래스 테두리만 */
  mono: {
    base: {
      flex: 1,
      minWidth: 0,
      minHeight: "44px",
      borderRadius: "10px",
      border: "1px solid rgba(255,255,255,0.24)",
      backgroundColor: "rgba(255,255,255,0.06)",
      color: "rgba(255,255,255,0.9)",
      fontSize: "12px",
      fontWeight: 700,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 12px",
      cursor: "pointer",
      boxSizing: "border-box",
      gap: "4px",
      boxShadow: "none",
    },
    picked: {
      backgroundColor: "rgba(255,255,255,0.14)",
      color: "#ffffff",
      border: "1px solid rgba(255,255,255,0.42)",
      boxShadow: "none",
    },
    muted: {
      opacity: 0.48,
      cursor: "not-allowed",
      boxShadow: "none",
    },
    busy: { opacity: 0.78 },
  },
  /** #111 바디 위 액션 줄 */
  darkRow: {
    base: {
      flex: 1,
      minWidth: 0,
      minHeight: "44px",
      borderRadius: "999px",
      border: "2px solid rgba(251, 113, 133, 0.85)",
      backgroundColor: "rgba(251, 113, 133, 0.1)",
      color: "#fecdd3",
      fontSize: "13px",
      fontWeight: 800,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 12px",
      cursor: "pointer",
      boxSizing: "border-box",
      boxShadow: "0 0 18px rgba(244, 63, 94, 0.2)",
    },
    picked: {
      backgroundColor: "rgba(251, 113, 133, 0.4)",
      color: "#fff",
      border: "2px solid #fda4af",
      boxShadow: "0 0 22px rgba(244, 63, 94, 0.32)",
    },
    muted: {
      opacity: 0.45,
      cursor: "not-allowed",
      boxShadow: "none",
    },
    busy: { opacity: 0.78 },
  },
  /** 저장 폴더 리스트 — 공개 픽만(점선) / 픽함(상태 딱지) */
  folderChip: {
    base: {
      alignSelf: "flex-start",
      marginTop: "6px",
      borderRadius: "999px",
      border: "1px dashed rgba(251, 113, 133, 0.65)",
      backgroundColor: "rgba(251, 113, 133, 0.08)",
      color: "#fda4af",
      fontSize: "11px",
      fontWeight: 700,
      padding: "5px 10px",
      cursor: "pointer",
      flexShrink: 0,
    },
    picked: {
      border: "1px solid rgba(251, 113, 133, 0.75)",
      borderStyle: "solid",
      backgroundColor: "rgba(190, 24, 93, 0.45)",
      color: "#fff",
      fontWeight: 800,
    },
    muted: {
      opacity: 0.45,
      cursor: "not-allowed",
    },
    busy: { opacity: 0.78 },
  },
  detailHeader: {
    base: {
      border: "2px solid rgba(251, 113, 133, 0.75)",
      backgroundColor: "rgba(251, 113, 133, 0.12)",
      color: "#fecdd3",
      borderRadius: "999px",
      padding: "6px 12px",
      fontSize: "11px",
      fontWeight: 800,
      cursor: "pointer",
      whiteSpace: "nowrap",
      boxShadow: "0 0 12px rgba(244, 63, 94, 0.2)",
    },
    picked: {
      backgroundColor: "rgba(251, 113, 133, 0.38)",
      color: "#fff",
      border: "2px solid #fda4af",
    },
    muted: {
      opacity: 0.45,
      cursor: "not-allowed",
      boxShadow: "none",
    },
    busy: { opacity: 0.78 },
  },
};

/**
 * 공개 픽 토글 (폴더 저장과 무관).
 *
 * @param {{ place: object, variant?: keyof typeof VARIANT_STYLES, className?: string, style?: object }} props
 */
export function PlacePickButton({ place, variant = "card", className, style }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [placeUuid, setPlaceUuid] = useState(null);
  const [resolving, setResolving] = useState(true);
  const [picked, setPicked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setResolving(true);
      setPlaceUuid(null);
      setPicked(false);
      try {
        const uuid = await resolvePlaceUuidForPick(place);
        if (cancelled) return;
        setPlaceUuid(uuid);
        if (uuid && user?.id) {
          const { picked: isPicked } = await fetchPickState(uuid);
          if (!cancelled) setPicked(Boolean(isPicked));
        }
      } catch {
        if (!cancelled) {
          setPlaceUuid(null);
          setPicked(false);
        }
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    user?.id,
    place?.id,
    place?.kakao_place_id,
    place?.place_id,
    place?.kakaoId,
    place?.name,
  ]);

  const onClick = useCallback(
    async (e) => {
      e?.stopPropagation?.();
      e?.preventDefault?.();
      if (busy) return;
      if (!user?.id) {
        showToast("로그인하고 이 가게를 픽해보세요.\n내 픽이 모여 취향이 만들어져요.", "info", 3800);
        return;
      }
      if (resolving) return;
      setBusy(true);
      try {
        let targetPlaceUuid = placeUuid;
        if (!targetPlaceUuid) {
          targetPlaceUuid = await ensurePlaceUuidForPick(place, {
            createIfMissing: true,
          });
          if (targetPlaceUuid) {
            setPlaceUuid(targetPlaceUuid);
          } else {
            showToast("이 장소는 아직 픽할 수 없어요. 잠시 후 다시 시도해 주세요.", "info", 3200);
            return;
          }
        }
        if (picked) {
          const { error } = await unpickPlace(targetPlaceUuid);
          if (error) {
            showToast(error.message || "픽 취소에 실패했어요", "info", 3200);
            return;
          }
          setPicked(false);
          return;
        }
        const { error } = await pickPlace(targetPlaceUuid);
        if (error) {
          if (isUniqueViolation(error)) {
            setPicked(true);
            maybeShowPickPublicNotice(targetPlaceUuid, showToast);
            return;
          }
          showToast(error.message || "픽하기에 실패했어요", "info", 3200);
          return;
        }
        setPicked(true);
        maybeShowPickPublicNotice(targetPlaceUuid, showToast);
      } finally {
        setBusy(false);
      }
    },
    [busy, resolving, picked, placeUuid, place, user?.id, showToast]
  );

  const v = VARIANT_STYLES[variant] || VARIANT_STYLES.card;
  const muted = false;
  const mergedStyle = {
    ...v.base,
    ...(picked ? v.picked : {}),
    ...(muted ? v.muted : {}),
    ...(busy ? v.busy : {}),
    ...style,
  };

  const isFolderChip = variant === "folderChip";
  const noPickEmoji = variant === "mono" || variant === "lightRowCompact";
  const label = picked
    ? isFolderChip
      ? "픽함"
      : noPickEmoji
        ? "픽함"
        : "👍 픽함"
    : isFolderChip
      ? "공개 픽"
      : noPickEmoji
        ? "픽"
        : "👍 픽";

  const titleText = picked
    ? "공개 추천을 취소합니다. 내 폴더 저장은 그대로입니다."
    : "다른 사람에게 공개 추천만 남깁니다. 내 폴더에 넣지 않습니다.";

  return (
    <button
      type="button"
      className={className}
      style={mergedStyle}
      aria-pressed={picked}
      aria-label={picked ? "공개 추천 취소, 폴더 저장과 무관" : "공개 추천, 폴더 저장과 무관"}
      title={titleText}
      disabled={busy}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export default PlacePickButton;
