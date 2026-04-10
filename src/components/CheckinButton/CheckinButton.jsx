import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRealtimeCheckins } from "../../hooks/useRealtimeCheckins";
import { useToast } from "../Toast/ToastProvider";
import { supabase } from "../../lib/supabase";
import { fetchKakaoCoordsByPlaceId } from "../../utils/kakaoPlaceCoords";
import { pickCheckinPlaceCoordsNearUser } from "../../utils/placeCoords";
import {
  checkinNicknameAliases,
  resolveCheckinDisplayName,
} from "../../utils/checkinDisplayName";

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

/** 엄격 체크인용: 먼저 빠른 저정확도(실내 성공률↑) → 실패 시 고정확도 */
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

/** 거리 초과 재시도용: 최신·고정확도 한 번 */
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
  return "가게 근처에 있을 때만 체크인할 수 있습니다. 지도에서 위치를 확인해 주세요.";
}

function messageForCheckinError(err) {
  const msg = [err?.message, err?.details, err?.hint, err?.code]
    .filter(Boolean)
    .join(" ");
  if (msg.includes("checkin_too_far_from_place")) {
    return messageForTooFarFromPlace(err);
  }
  if (msg.includes("checkin_place_coordinates_required")) {
    return "이 장소에는 좌표 정보가 없어 체크인할 수 없습니다.";
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
    return "체크인 응답이 비어 있습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (
    msg.includes("perform_check_in_nearby") ||
    msg.includes("42883") ||
    msg.includes("PGRST202")
  ) {
    return "체크인 서버 설정이 필요합니다. (perform_check_in_nearby 마이그레이션 확인)";
  }
  return "체크인에 실패했습니다.";
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
  /** 있으면 y/x vs lat/lng 불일치 시 사용자 GPS에 맞는 좌표로 체크인 */
  place = null,
  /** 장소 카드 등에서 한 줄 액션과 맞출 때 작은 버튼 */
  compact = false,
}) {
  const { user } = useAuth();
  const { performCheckin, fetchPlaceCheckinCount, placeCheckinCounts } = useRealtimeCheckins();
  const { showToast } = useToast();
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentCheckinCount, setCurrentCheckinCount] = useState(0);
  const [profileRow, setProfileRow] = useState(null);

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

  const getUserNickname = () => resolveCheckinDisplayName(user, profileRow);

  // 체크인 상태 확인 (1시간 이내 체크인)
  useEffect(() => {
    if (!user?.id || !placeId) return;

    const checkUserCheckin = async () => {
      try {
        const aliases = checkinNicknameAliases(user, profileRow);
        if (aliases.length === 0) return;

        const { data, error } = await supabase
          .from("check_ins")
          .select("id")
          .in("user_nickname", aliases)
          .eq("place_id", placeId)
          .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
          .order("created_at", { ascending: false })
          .limit(1);

        if (error) throw error;
        setIsCheckedIn(Boolean(data?.length));
      } catch (error) {
        console.error("체크인 상태 확인 에러:", error);
      }
    };

    checkUserCheckin();

    const interval = setInterval(checkUserCheckin, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user?.id, placeId, user, profileRow]);

  // 장소 체크인 수 업데이트
  useEffect(() => {
    if (placeId) {
      fetchPlaceCheckinCount(placeId).then(setCurrentCheckinCount);
    }
  }, [placeId, fetchPlaceCheckinCount, placeCheckinCounts]);

  // 체크인 처리
  const handleCheckin = () => {
    if (!user?.id) {
      showToast("로그인이 필요합니다.", "warning");
      return;
    }

    if (isCheckedIn) {
      showToast("이미 체크인한 장소입니다.", "warning");
      return;
    }

    // alert로 확인
    const nickname = getUserNickname();
    const confirmed = window.confirm(
      `🎯 ${placeName} 체크인\n\n체크인 시 "${nickname}" 닉네임으로 장소 체크인 상황이 공유됩니다.\n\n동의하시겠습니까?`
    );

    if (confirmed) {
      // 클릭 핸들러에서 await하지 않고, 메인 스레드 반환을 먼저 끝내 Violation·멈춤 체감 완화
      queueMicrotask(() => {
        void executeCheckin();
      });
    }
  };

  const runCheckinRpc = async ({
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
    setIsCheckedIn(true);
    showToast(
      skipDistanceCheck
        ? "체크인했습니다. (위치 미검증)"
        : "체크인이 완료되었습니다!",
      "success"
    );
  };

  // 실제 체크인 실행
  const executeCheckin = async () => {
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
        const looseOnly =
          window.confirm(
            "장소 좌표를 찾지 못했습니다.\n\n위치 검증 없이 체크인할까요? (다른 사용자에게는 동일하게 보이며, 거리 검증은 되지 않습니다.)"
          );
        if (looseOnly) {
          await runCheckinRpc({
            plat: null,
            plng: null,
            userLat: null,
            userLng: null,
            accuracyM: null,
            skipDistanceCheck: true,
          });
          const newCount = await fetchPlaceCheckinCount(placeId);
          setCurrentCheckinCount(newCount);
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
            `${messageForCheckinError(geoErr)}\n\n위치 검증 없이 체크인할까요? (현장 여부는 확인되지 않습니다.)`
          );
          if (loose) {
            await runCheckinRpc({
              plat,
              plng,
              userLat: null,
              userLng: null,
              accuracyM: null,
              skipDistanceCheck: true,
            });
            const newCount = await fetchPlaceCheckinCount(placeId);
            setCurrentCheckinCount(newCount);
          }
          return;
        }
        showToast(messageForCheckinError(geoErr), "warning");
        return;
      }

      const picked = pickCheckinPlaceCoordsNearUser(place, userLat, userLng);
      if (picked) {
        plat = picked.lat;
        plng = picked.lng;
      }

      try {
        await runCheckinRpc({
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
            await runCheckinRpc({
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
            const newCount = await fetchPlaceCheckinCount(placeId);
            setCurrentCheckinCount(newCount);
            return;
          }
          const loose = window.confirm(
            "위치를 다시 받아도 거리가 멀리 잡혔습니다.\n\n위치 검증 없이 체크인할까요? (현장 여부는 확인되지 않습니다.)"
          );
          if (loose) {
            await runCheckinRpc({
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

      const newCount = await fetchPlaceCheckinCount(placeId);
      setCurrentCheckinCount(newCount);
    } catch (error) {
      console.error("체크인 에러:", error);
      showToast(messageForCheckinError(error), "error");
    } finally {
      setLoading(false);
    }
  };

  const buttonStyles = compact
    ? {
        checkinButton: {
          padding: "5px 10px",
          border: "1px solid #FF6B6B",
          borderRadius: "999px",
          backgroundColor: isCheckedIn ? "#FF6B6B" : "rgba(255,255,255,0.96)",
          color: isCheckedIn ? "white" : "#FF6B6B",
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
        checkinButtonHover: {
          backgroundColor: isCheckedIn ? "#FF5252" : "#FFF5F5",
          transform: "scale(1.02)",
        },
        checkinCount: {
          fontSize: "10px",
          color: "rgba(255,255,255,0.45)",
          marginTop: "2px",
          textAlign: "center",
          lineHeight: 1.2,
          width: "100%",
        },
      }
    : {
        checkinButton: {
          padding: "8px 16px",
          border: "2px solid #FF6B6B",
          borderRadius: "20px",
          backgroundColor: isCheckedIn ? "#FF6B6B" : "white",
          color: isCheckedIn ? "white" : "#FF6B6B",
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
        checkinButtonHover: {
          backgroundColor: isCheckedIn ? "#FF5252" : "#FFF5F5",
          transform: "scale(1.05)",
        },
        checkinCount: {
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
        style={buttonStyles.checkinButton}
        onClick={handleCheckin}
        disabled={loading}
        onMouseEnter={(e) => {
          if (!loading) {
            Object.assign(e.target.style, buttonStyles.checkinButtonHover);
          }
        }}
        onMouseLeave={(e) => {
          if (!loading) {
            Object.assign(e.target.style, buttonStyles.checkinButton);
          }
        }}
      >
        {loading ? (
          "처리 중..."
        ) : isCheckedIn ? (
          "✓ 체크인 완료"
        ) : (
          "📍 체크인"
        )}
      </button>
      
      {currentCheckinCount > 0 && (
        <div style={buttonStyles.checkinCount}>
          현재 {currentCheckinCount}명이 체크인 중!
        </div>
      )}
    </div>
  );
}
