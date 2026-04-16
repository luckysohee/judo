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

function messageForHanjanError(err) {
  const msg = [err?.message, err?.details, err?.hint, err?.code]
    .filter(Boolean)
    .join(" ");
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
}) {
  const { user } = useAuth();
  const { performCheckin, fetchPlaceHanjanStats, placeCheckinCounts } =
    useRealtimeCheckins();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
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
          const loose = window.confirm(
            `${messageForHanjanError(geoErr)}\n\n위치 없이 한잔만 남길까요? (여기서 한잔 수에는 안 잡혀요.)`
          );
          if (loose) {
            await runHanjanRpc({
              plat,
              plng,
              userLat: null,
              userLng: null,
              accuracyM: null,
              skipDistanceCheck: true,
            });
          }
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
            if (!isTooFarRpcError(retryErr)) throw retryErr;
          }
          if (strictRecovered) {
            return;
          }
          const loose = window.confirm(
            "위치를 다시 받아도 거리가 멀리 잡혔습니다.\n\n위치 없이 한잔만 남길까요? (여기서 한잔 수에는 안 잡혀요.)"
          );
          if (loose) {
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
        } else {
          throw rpcErr;
        }
      }
    } catch (error) {
      console.error("한잔 기록 오류:", error);
      showToast(messageForHanjanError(error), "error");
    } finally {
      setLoading(false);
    }
  };

  const fireHint = displayHanjan
    ? formatFireLine(displayHanjan.fireTodayDedup, displayHanjan.fire24hDedup)
    : null;

  const buttonStyles = compact
    ? {
        hanjanButton: {
          padding: "5px 10px",
          border: "1px solid #FF6B6B",
          borderRadius: "999px",
          backgroundColor: "rgba(255,255,255,0.96)",
          color: "#FF6B6B",
          fontSize: "12px",
          fontWeight: "700",
          cursor: loading ? "not-allowed" : "pointer",
          transition: "all 0.2s ease",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          minWidth: "0",
          minHeight: "40px",
          width: "100%",
          boxSizing: "border-box",
          justifyContent: "center",
          whiteSpace: "nowrap",
        },
        hanjanButtonHover: {
          backgroundColor: "#FFF5F5",
          transform: "scale(1.02)",
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
          cursor: loading ? "not-allowed" : "pointer",
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
        style={buttonStyles.hanjanButton}
        onClick={handleHanjan}
        disabled={loading}
        onMouseEnter={(e) => {
          if (!loading) {
            Object.assign(e.target.style, buttonStyles.hanjanButtonHover);
          }
        }}
        onMouseLeave={(e) => {
          if (!loading) {
            Object.assign(e.target.style, buttonStyles.hanjanButton);
          }
        }}
      >
        {loading ? "처리 중…" : "🍶 한잔함"}
      </button>

      {fireHint ? (
        <div style={buttonStyles.hint}>{fireHint}</div>
      ) : (
        <div style={buttonStyles.hint}>
          가까우면 자동으로 「여기서 한잔」에 잡혀요
        </div>
      )}
    </div>
  );
}
