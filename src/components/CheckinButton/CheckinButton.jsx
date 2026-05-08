import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRealtimeCheckins } from "../../hooks/useRealtimeCheckins";
import { useToast } from "../Toast/ToastProvider";
import { supabase } from "../../lib/supabase";
import { fetchKakaoCoordsByPlaceId } from "../../utils/kakaoPlaceCoords";
import { pickCheckinPlaceCoordsNearUser } from "../../utils/placeCoords";
import { resolveCheckinDisplayName } from "../../utils/checkinDisplayName";
import {
  formatFireLine,
  normalizeHanjanStats,
} from "../../utils/hanjanSocialCopy";
import {
  JUDO_CHECKIN_SCHEDULE_ERROR,
  JUDO_CHECKIN_SCHEDULE_TOAST,
} from "../../utils/judoOperationMode";

function parseCoord(v) {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

function readGeoOnce(options) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("geolocation_not_supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM:
            typeof pos.coords.accuracy === "number" && Number.isFinite(pos.coords.accuracy)
              ? pos.coords.accuracy
              : null,
        }),
      (err) => reject(err),
      options
    );
  });
}

/** 엄격 기록용: 먼저 빠른 저정확도(실내 성공률↑) → 실패 시 고정확도 */
async function getGeoForStrictCheckin() {
  try {
    return await readGeoOnce({
      enableHighAccuracy: false,
      timeout: 12000,
      maximumAge: 10000,
    });
  } catch {
    return await readGeoOnce({
      enableHighAccuracy: true,
      timeout: 22000,
      maximumAge: 0,
    });
  }
}

function getGeoHighAccuracyFresh() {
  return readGeoOnce({
    enableHighAccuracy: true,
    timeout: 22000,
    maximumAge: 0,
  });
}

function messageForTooFarFromPlace(err) {
  const details = err?.details;
  if (typeof details === "string" && details.includes("distance_m=")) {
    const dm = details.match(/distance_m=([\d.]+)/);
    if (dm) {
      const d = parseFloat(dm[1]);
      if (Number.isFinite(d) && d >= 0) {
        const distLabel =
          d >= 1000
            ? `약 ${(d / 1000).toFixed(1)}km`
            : `약 ${Math.round(d)}m`;
        return `서버 기준 이 장소와 ${distLabel} 떨어져 있습니다. 실제로 가게 근처인지, 지도 핀 좌표가 맞는지 확인해 주세요. (집·다른 동네에서 시도하면 이렇게 나올 수 있어요.)`;
      }
    }
  }
  return "가게 근처에 있을 때만 여기서 한잔으로 잡힙니다. 지도에서 위치를 확인해 주세요.";
}

function isScheduleClosedError(err) {
  const msg = [err?.message, err?.code].filter(Boolean).join(" ");
  return msg.includes(JUDO_CHECKIN_SCHEDULE_ERROR);
}

function messageForHanjanError(err) {
  const msg = [err?.message, err?.details, err?.hint, err?.code]
    .filter(Boolean)
    .join(" ");
  if (msg.includes(JUDO_CHECKIN_SCHEDULE_ERROR)) {
    return JUDO_CHECKIN_SCHEDULE_TOAST;
  }
  if (msg.includes("checkin_too_far_from_place")) {
    return messageForTooFarFromPlace(err);
  }
  if (msg.includes("checkin_place_coordinates_required")) {
    return "이 장소에는 좌표 정보가 없어 한잔 기록을 남길 수 없습니다.";
  }
  if (msg.includes("checkin_user_coordinates_required")) {
    return "위치 정보를 가져오지 못했습니다. 위치 권한을 허용해 주세요.";
  }
  if (msg.includes("checkin_place_coordinates_invalid")) {
    return "장소 위치 정보가 올바르지 않습니다.";
  }
  if (msg.includes("checkin_location_accuracy_too_poor")) {
    return "GPS 정확도가 너무 낮습니다. 실외에서 다시 시도해 주세요.";
  }
  if (msg.includes("checkin_not_authenticated")) {
    return "로그인이 필요합니다.";
  }
  if (msg.includes("geolocation_not_supported")) {
    return "이 기기에서는 위치를 사용할 수 없습니다.";
  }
  if (err?.code === 1 || msg.includes("denied") || msg.includes("PERMISSION_DENIED")) {
    return "위치 권한이 필요합니다. 브라우저 설정에서 허용해 주세요.";
  }
  if (err?.code === 3 || msg.includes("TIMEOUT")) {
    return "위치 확인 시간이 초과되었습니다. 다시 시도해 주세요.";
  }
  if (msg.includes("checkin_no_row")) {
    return "응답이 비었습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (
    msg.includes("perform_check_in_nearby") ||
    msg.includes("42883") ||
    msg.includes("PGRST202")
  ) {
    return "서버 설정이 필요합니다. (perform_check_in_nearby 마이그레이션 확인)";
  }
  return "한잔 기록에 실패했습니다.";
}

function isGeoTimeoutOrDenied(err) {
  const msg = [err?.message, err?.details, String(err?.code ?? "")]
    .filter(Boolean)
    .join(" ");
  return (
    err?.code === 1 ||
    err?.code === 3 ||
    msg.includes("TIMEOUT") ||
    msg.includes("denied") ||
    msg.includes("PERMISSION_DENIED")
  );
}

function isTooFarRpcError(err) {
  const msg = [err?.message, err?.details, err?.hint]
    .filter(Boolean)
    .join(" ");
  return msg.includes("checkin_too_far_from_place");
}

export default function CheckinButton({
  placeId,
  placeName,
  placeAddress,
  placeLat,
  placeLng,
  kakaoPlaceId,
  place = null,
  compact = false,
  /** 부모가 이미 불러온 한잔함 통계 (있으면 내부 fetch 생략) */
  hanjanStats: hanjanStatsProp = null,
  /** 기록 성공 후 부모가 통계 다시 불러오기 */
  onHanjanRecorded = null,
  /** `compact` 일 때 한 줄 힌트(불꽃 수 등) 숨김 — 액션 줄 전용 */
  hideHint = false,
  /** `compact` 전용 — 주황/그라데이션 없이 무채 글래스 버튼 */
  neutralCompact = false,
  /** `compact`일 때 줄 높이만 살짝 낮춤 (추천 시트 등 3열 액션) */
  compactRowShort = false,
  /** 운영 시간 외(`false`)에는 한잔 RPC 미실행·토스트만 — 버튼은 숨기지 않음 */
  canCheckIn = true,
}) {
  const { user } = useAuth();
  const { performCheckin, fetchPlaceHanjanStats, placeCheckinCounts } =
    useRealtimeCheckins();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [hanjanPicked, setHanjanPicked] = useState(false);
  const [profileRow, setProfileRow] = useState(null);
  const [internalHanjan, setInternalHanjan] = useState(null);

  const displayHanjan =
    hanjanStatsProp != null ? hanjanStatsProp : internalHanjan;

  const loadInternalHanjan = useCallback(async () => {
    if (!placeId || hanjanStatsProp != null) return;
    const raw = await fetchPlaceHanjanStats(placeId);
    setInternalHanjan(normalizeHanjanStats(raw));
  }, [placeId, fetchPlaceHanjanStats, hanjanStatsProp]);

  const refreshAfterRecord = useCallback(async () => {
    if (!placeId) return null;
    const raw = await fetchPlaceHanjanStats(placeId);
    const norm = normalizeHanjanStats(raw);
    if (hanjanStatsProp == null) {
      setInternalHanjan(norm);
    }
    onHanjanRecorded?.();
    return norm;
  }, [placeId, fetchPlaceHanjanStats, hanjanStatsProp, onHanjanRecorded]);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setProfileRow(null);
      return undefined;
    }
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (!error && data) setProfileRow(data);
      else setProfileRow(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!placeId || hanjanStatsProp != null) return;
    void loadInternalHanjan();
  }, [placeId, hanjanStatsProp, loadInternalHanjan, placeCheckinCounts]);

  useEffect(() => {
    setHanjanPicked(false);
  }, [placeId]);

  const getUserNickname = () => resolveCheckinDisplayName(user, profileRow);

  /** 오늘 KST 기준 이 장소에 이미 한잔 기록이 있는지 (토스트용, 버튼은 막지 않음) */
  const userAlreadyHanjanToday = async () => {
    if (!user?.id) return false;
    try {
      const { data, error } = await supabase
        .from("check_ins")
        .select("id")
        .eq("place_id", String(placeId))
        .eq("user_id", user.id)
        .gte(
          "created_at",
          new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString()
        )
        .limit(1);
      if (error) return false;
      return Boolean(data?.length);
    } catch {
      return false;
    }
  };

  const handleHanjan = () => {
    if (loading) return;
    if (!canCheckIn) {
      showToast(JUDO_CHECKIN_SCHEDULE_TOAST, "info", 3200);
      return;
    }
    if (!user?.id) {
      showToast("로그인이 필요합니다.", "warning");
      return;
    }

    const nickname = getUserNickname();
    const confirmed = window.confirm(
      `🍶 ${placeName}\n\n「한잔함」은 "${nickname}" 닉네임으로 이 장소에 남는 기록이에요. 다른 사람에게도 비슷하게 보일 수 있어요.\n\n기록할까요?`
    );

    if (confirmed) {
      queueMicrotask(() => {
        void executeHanjan();
      });
    }
  };

  const toastAfterSuccess = async (skipDistanceCheck) => {
    const s = await refreshAfterRecord();
    const total = s?.totalDedup ?? 0;
    if (skipDistanceCheck) {
      const again = await userAlreadyHanjanToday();
      showToast(
        again ? "🍶 또 한잔 추가됨 😏" : "🍶 한잔 기록했어요",
        "success"
      );
      return;
    }
    if (total >= 5) {
      showToast(`🔥 이 집 벌써 ${total}명이 한잔했어요`, "success");
    } else {
      showToast("📍 여기서 한잔 반영됐어요", "success");
    }
  };

  const runHanjanRpc = async ({
    plat,
    plng,
    userLat,
    userLng,
    accuracyM,
    skipDistanceCheck,
  }) => {
    const nickname = getUserNickname();
    await performCheckin({
      userNickname: nickname,
      placeId,
      placeName,
      placeAddress: placeAddress || "",
      placeLat: plat,
      placeLng: plng,
      userLat,
      userLng,
      accuracyM,
      skipDistanceCheck,
    });
    setHanjanPicked(true);
    await toastAfterSuccess(skipDistanceCheck);
  };

  const executeHanjan = async () => {
    setLoading(true);

    try {
      let plat = parseCoord(placeLat);
      let plng = parseCoord(placeLng);
      if (plat == null || plng == null) {
        const fromKakao = await fetchKakaoCoordsByPlaceId({
          kakaoPlaceId,
          name: placeName,
          address: placeAddress,
        });
        if (fromKakao) {
          plat = fromKakao.lat;
          plng = fromKakao.lng;
        }
      }
      if (plat == null || plng == null) {
        const looseOnly = window.confirm(
          "장소 좌표를 찾지 못했습니다.\n\n위치 없이 한잔만 남길까요? (숫자에는 오늘 1번만 반영돼요.)"
        );
        if (looseOnly) {
          await runHanjanRpc({
            plat: null,
            plng: null,
            userLat: null,
            userLng: null,
            accuracyM: null,
            skipDistanceCheck: true,
          });
        }
        return;
      }

      let userLat;
      let userLng;
      let accuracyM = null;
      try {
        const g = await getGeoForStrictCheckin();
        userLat = g.lat;
        userLng = g.lng;
        accuracyM = g.accuracyM;
      } catch (geoErr) {
        if (isGeoTimeoutOrDenied(geoErr)) {
          // GPS 타임아웃/거부 시에는 자동으로 느슨한 저장으로 폴백 (실패 체감 최소화)
          await runHanjanRpc({
            plat,
            plng,
            userLat: null,
            userLng: null,
            accuracyM: null,
            skipDistanceCheck: true,
          });
          return;
        }
        showToast(messageForHanjanError(geoErr), "warning");
        return;
      }

      const picked = pickCheckinPlaceCoordsNearUser(place, userLat, userLng);
      if (picked) {
        plat = picked.lat;
        plng = picked.lng;
      }

      try {
        await runHanjanRpc({
          plat,
          plng,
          userLat,
          userLng,
          accuracyM,
          skipDistanceCheck: false,
        });
      } catch (rpcErr) {
        if (isTooFarRpcError(rpcErr)) {
          let strictRecovered = false;
          try {
            const gRetry = await getGeoHighAccuracyFresh();
            let platR = plat;
            let plngR = plng;
            const pickedR = pickCheckinPlaceCoordsNearUser(
              place,
              gRetry.lat,
              gRetry.lng
            );
            if (pickedR) {
              platR = pickedR.lat;
              plngR = pickedR.lng;
            }
            await runHanjanRpc({
              plat: platR,
              plng: plngR,
              userLat: gRetry.lat,
              userLng: gRetry.lng,
              accuracyM: gRetry.accuracyM,
              skipDistanceCheck: false,
            });
            strictRecovered = true;
          } catch (retryErr) {
            if (!isTooFarRpcError(retryErr)) {
              // 재시도 GPS가 타임아웃/권한거부여도 느슨한 저장으로 폴백
              if (isGeoTimeoutOrDenied(retryErr)) {
                await runHanjanRpc({
                  plat,
                  plng,
                  userLat: null,
                  userLng: null,
                  accuracyM: null,
                  skipDistanceCheck: true,
                });
                strictRecovered = true;
                return;
              }
              throw retryErr;
            }
          }
          if (strictRecovered) {
            return;
          }
          await runHanjanRpc({
            plat,
            plng,
            userLat: null,
            userLng: null,
            accuracyM: null,
            skipDistanceCheck: true,
          });
        } else {
          throw rpcErr;
        }
      }
    } catch (error) {
      console.error("한잔 기록 오류:", error);
      if (isScheduleClosedError(error)) {
        showToast(JUDO_CHECKIN_SCHEDULE_TOAST, "info", 3200);
      } else {
        showToast(messageForHanjanError(error), "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const fireHint = displayHanjan
    ? formatFireLine(displayHanjan.fireTodayDedup, displayHanjan.fire24hDedup)
    : null;

  const compactMinH = compactRowShort ? "30px" : "44px";
  const compactFs = compactRowShort ? "10px" : "12px";
  const compactPadX = compactRowShort ? "6px" : "10px";

  const checkInLocked = !canCheckIn;
  const showPickedVisual = hanjanPicked && !checkInLocked;

  const buttonStyles = compact
    ? neutralCompact
      ? {
          hanjanButton: {
            padding: compactRowShort ? `0 ${compactPadX}` : "0 10px",
            border: compactRowShort ? "1px solid #fb923c" : "2px solid #fb923c",
            borderRadius: compactRowShort ? "8px" : "12px",
            backgroundColor: "#1a1a1a",
            color: "#fdba74",
            fontSize: compactFs,
            fontWeight: "800",
            cursor:
              loading || checkInLocked ? "not-allowed" : "pointer",
            transition: "background-color 0.15s ease, border-color 0.15s ease",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            minWidth: "0",
            minHeight: compactMinH,
            width: "100%",
            boxSizing: "border-box",
            justifyContent: "center",
            whiteSpace: "nowrap",
            boxShadow: "none",
          },
          hanjanButtonHover: {
            backgroundColor: "#222222",
            borderColor: "#fdba74",
          },
          hint: {
            fontSize: "10px",
            color: "rgba(253, 186, 116, 0.75)",
            marginTop: "2px",
            textAlign: "center",
            lineHeight: 1.25,
            width: "100%",
          },
        }
      : {
          hanjanButton: {
            padding: compactRowShort ? `0 ${compactPadX}` : "0 10px",
            border: "1px solid rgba(217, 119, 6, 0.65)",
            borderRadius: compactRowShort ? "8px" : "10px",
            background: "linear-gradient(180deg, #fde68a 0%, #f59e0b 48%, #d97706 100%)",
            color: "#422006",
            fontSize: compactFs,
            fontWeight: "800",
            cursor:
              loading || checkInLocked ? "not-allowed" : "pointer",
            transition: "all 0.2s ease",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            minWidth: "0",
            minHeight: compactMinH,
            width: "100%",
            boxSizing: "border-box",
            justifyContent: "center",
            whiteSpace: "nowrap",
            boxShadow: "0 1px 0 rgba(255,255,255,0.35) inset, 0 2px 6px rgba(180, 83, 9, 0.35)",
          },
          hanjanButtonHover: {
            filter: "brightness(1.06)",
            transform: compactRowShort ? "none" : "scale(1.02)",
          },
          hint: {
            fontSize: "10px",
            color: "rgba(255,255,255,0.45)",
            marginTop: "2px",
            textAlign: "center",
            lineHeight: 1.25,
            width: "100%",
          },
        }
    : {
        hanjanButton: {
          padding: "8px 16px",
          border: "2px solid #FF6B6B",
          borderRadius: "20px",
          backgroundColor: "white",
          color: "#FF6B6B",
          fontSize: "14px",
          fontWeight: "bold",
          cursor:
            loading || checkInLocked ? "not-allowed" : "pointer",
          transition: "all 0.3s ease",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          minWidth: "120px",
          justifyContent: "center",
        },
        hanjanButtonHover: {
          backgroundColor: "#FFF5F5",
          transform: "scale(1.05)",
        },
        hint: {
          fontSize: "12px",
          color: "#666",
          marginTop: "4px",
          textAlign: "center",
        },
      };

  const hanjanButtonVisual = {
    ...buttonStyles.hanjanButton,
    ...(showPickedVisual
      ? {
          backgroundColor: "#fb923c",
          background: "linear-gradient(180deg, #fdba74 0%, #fb923c 100%)",
          color: "#2b1603",
          borderColor: "#fdba74",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.3), 0 0 0 1px rgba(251,146,60,0.25)",
        }
      : {}),
    ...(checkInLocked
      ? { opacity: 0.5, filter: "grayscale(0.35)", cursor: "not-allowed" }
      : {}),
  };

  return (
    <div
      style={
        compact
          ? {
              textAlign: "left",
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: "2px",
            }
          : { textAlign: "center", flexShrink: 0 }
      }
    >
      <button
        type="button"
        style={hanjanButtonVisual}
        onClick={handleHanjan}
        aria-disabled={checkInLocked || loading}
        onMouseEnter={(e) => {
          if (!loading && !checkInLocked) {
            Object.assign(e.target.style, buttonStyles.hanjanButtonHover);
          }
        }}
        onMouseLeave={(e) => {
          if (!loading) {
            e.target.style.filter = "";
            Object.assign(e.target.style, hanjanButtonVisual);
          }
        }}
      >
        {loading
          ? compactRowShort
            ? "중…"
            : "처리 중…"
          : showPickedVisual
            ? "🍺"
          : compactRowShort
            ? "한잔함"
            : "🍺 한잔함"}
      </button>

      {compact && hideHint && !checkInLocked ? null : checkInLocked ? (
        <div style={{ ...buttonStyles.hint, opacity: 0.72 }}>
          {JUDO_CHECKIN_SCHEDULE_TOAST}
        </div>
      ) : fireHint ? (
        <div style={buttonStyles.hint}>{fireHint}</div>
      ) : (
        <div style={buttonStyles.hint}>
          가까우면 자동으로 「여기서 한잔」에 잡혀요
        </div>
      )}
    </div>
  );
}
