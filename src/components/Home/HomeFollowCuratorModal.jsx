import { useEffect, useMemo, useState, useCallback } from "react";
import MapView from "../Map/MapView";
import PlacePreviewCard from "../PlaceCard/PlacePreviewCard";
import { formatCuratorProfilePlacesForMapView } from "../../utils/formatCuratorProfilePlacesForHomeMap";

/**
 * 큐레이터/일반 사용자 카드 클릭 시 띄우는 미니 프로필 + 픽 모달.
 */
export default function HomeFollowCuratorModal({
  open,
  onClose,
  roleLabel,
  bioText,
  gradeMeta,
  curator,
  currentUserUsername,
  onFollow,
  isGeneralUserProfile = false,
  recommendedPlaces = [],
  placesLoading = false,
  getPlacePreviewSaved,
  getUserRole,
  canCheckIn = true,
  onSavedToSupabase,
  onRequireLogin = null,
}) {
  const [previewPlace, setPreviewPlace] = useState(null);

  const placeCount =
    typeof curator?.placeCount === "number"
      ? curator.placeCount
      : recommendedPlaces.length;
  const mapPlaces = useMemo(
    () =>
      formatCuratorProfilePlacesForMapView(
        recommendedPlaces,
        curator?.displayName || curator?.username
      ),
    [recommendedPlaces, curator?.displayName, curator?.username]
  );

  useEffect(() => {
    if (!open) setPreviewPlace(null);
  }, [open]);

  const resolvePreviewPlace = useCallback(
    (mapPlace) => {
      if (!mapPlace) return null;
      const id = String(mapPlace.id ?? "").trim();
      const raw = recommendedPlaces.find((p) => String(p.id) === id);
      if (!raw) return mapPlace;
      return {
        ...mapPlace,
        ...raw,
        name: raw.name ?? mapPlace.name,
        comment: raw.comment ?? mapPlace.comment,
        lat: mapPlace.lat ?? raw.lat,
        lng: mapPlace.lng ?? raw.lng,
      };
    },
    [recommendedPlaces]
  );

  const previewSaved = useMemo(
    () =>
      previewPlace && typeof getPlacePreviewSaved === "function"
        ? getPlacePreviewSaved(previewPlace)
        : { isSaved: false, folderColor: undefined },
    [previewPlace, getPlacePreviewSaved]
  );

  if (!open) return null;
  const isSelf = Boolean(
    curator?.username && currentUserUsername && curator.username === currentUserUsername
  );

  const overlayStyle = {
    position: "fixed",
    inset: 0,
    height: "100dvh",
    maxHeight: "100dvh",
    boxSizing: "border-box",
    padding:
      "max(10px, env(safe-area-inset-top, 0px)) max(10px, env(safe-area-inset-right, 0px)) max(10px, env(safe-area-inset-bottom, 0px)) max(10px, env(safe-area-inset-left, 0px))",
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 30000,
    backdropFilter: "blur(4px)",
    WebkitBackdropFilter: "blur(4px)",
    overflow: "auto",
    overscrollBehavior: "contain",
  };

  const cardStyle = {
    background:
      "linear-gradient(180deg, rgba(18,18,20,0.98) 0%, rgba(8,8,10,0.98) 100%)",
    borderRadius: "clamp(14px, 3.6vw, 18px)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
    padding: "clamp(14px, 3.8vw, 18px)",
    width: "min(100%, 360px)",
    maxWidth: "100%",
    maxHeight: "min(90dvh, 580px)",
    boxSizing: "border-box",
    overflowX: "hidden",
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    overflowWrap: "break-word",
    backdropFilter: "blur(18px) saturate(150%)",
    WebkitBackdropFilter: "blur(18px) saturate(150%)",
    margin: "auto",
    position: "relative",
    zIndex: 1,
  };

  const avatarSize = "clamp(44px, 11vw, 52px)";

  return (
    <div
      style={overlayStyle}
      onClick={() => {
        if (previewPlace) setPreviewPlace(null);
        else onClose?.();
      }}
    >
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 10,
          }}
        >
          <button
            type="button"
            onClick={() => {
              if (previewPlace) setPreviewPlace(null);
              else onClose?.();
            }}
            aria-label="미리보기로 돌아가기"
            style={{
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.9)",
              borderRadius: 999,
              padding: "6px 10px",
              fontSize: 12,
              fontWeight: 900,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            ←
          </button>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "3px 9px",
              borderRadius: 999,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "-0.01em",
              color: "rgba(255,255,255,0.9)",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.2)",
              lineHeight: 1,
            }}
          >
            {roleLabel}
          </span>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "10px",
              minWidth: 0,
            }}
          >
            {curator?.avatar ? (
              <img
                src={curator.avatar}
                alt={curator.displayName}
                style={{
                  width: avatarSize,
                  height: avatarSize,
                  flexShrink: 0,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "2px solid rgba(255,255,255,0.28)",
                }}
              />
            ) : (
              <div
                style={{
                  width: avatarSize,
                  height: avatarSize,
                  flexShrink: 0,
                  borderRadius: "50%",
                  background:
                    "linear-gradient(135deg, rgba(26,26,30,0.94) 0%, rgba(52,52,60,0.96) 100%)",
                  color: "white",
                  fontSize: "clamp(16px, 4.2vw, 18px)",
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "2px solid rgba(255,255,255,0.85)",
                  boxShadow: "0 6px 14px rgba(0,0,0,0.4)",
                }}
              >
                {String(curator?.displayName ?? "?").charAt(0).toUpperCase()}
              </div>
            )}
            <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
              <h3
                style={{
                  margin: "0 0 2px 0",
                  fontSize: "clamp(15px, 4.1vw, 17px)",
                  color: "#ffffff",
                  fontWeight: 900,
                  overflowWrap: "break-word",
                  wordBreak: "break-word",
                  lineHeight: 1.25,
                }}
              >
                @{curator?.username}
              </h3>
              <div
                style={{
                  fontSize: "clamp(12px, 3.2vw, 13px)",
                  color: "rgba(255,255,255,0.82)",
                  fontWeight: 800,
                  marginBottom: 2,
                  lineHeight: 1.3,
                }}
              >
                {curator?.displayName || "아는 사람"}
              </div>
              <div
                style={{
                  fontSize: "clamp(11px, 3vw, 12px)",
                  color: "#ffffff",
                  fontWeight: 800,
                  textShadow: "0 1px 3px rgba(0,0,0,0.38)",
                  lineHeight: 1.3,
                }}
              >
                {`${gradeMeta?.emoji ?? ""} ${gradeMeta?.label ?? ""}`}
              </div>
            </div>
          </div>

          <div
            style={{
              fontSize: "clamp(12px, 3.2vw, 13px)",
              color: "rgba(255,255,255,0.84)",
              lineHeight: 1.5,
              marginBottom: "10px",
              padding: "10px",
              background: "rgba(255,255,255,0.06)",
              borderRadius: "10px",
              border: "1px solid rgba(255,255,255,0.12)",
              textAlign: "left",
              maxHeight: "72px",
              overflowY: "auto",
            }}
          >
            {bioText}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "8px",
              marginBottom: "12px",
            }}
          >
            {[
              { value: curator?.saveCount ?? 0, label: "잔 반응" },
              { value: curator?.placeCount ?? 0, label: "추천 장소" },
              { value: curator?.followerCount ?? 0, label: "팔로워" },
            ].map(({ value, label }) => (
              <div
                key={label}
                style={{
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  padding: "8px 4px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "clamp(15px, 4vw, 17px)",
                    fontWeight: 900,
                    color: "#ffffff",
                    lineHeight: 1.1,
                  }}
                >
                  {value}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.58)",
                    fontWeight: 600,
                    lineHeight: 1.25,
                    marginTop: 2,
                  }}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ width: "100%", minWidth: 0, boxSizing: "border-box" }}>
          {!isGeneralUserProfile ? (
            <div style={{ marginBottom: 12, textAlign: "left" }}>
              <div
                style={{
                  fontSize: "clamp(12px, 3.2vw, 13px)",
                  fontWeight: 800,
                  color: "rgba(255,255,255,0.88)",
                  marginBottom: 6,
                }}
              >
                추천 장소 지도
                {typeof placeCount === "number" ? ` (${placeCount})` : ""}
              </div>
              <p
                style={{
                  margin: "0 0 8px",
                  fontSize: 11,
                  color: "rgba(255,255,255,0.5)",
                  lineHeight: 1.4,
                }}
              >
                마커를 누르면 이 프로필 안에서 장소 카드가 열려요.
              </p>
              {placesLoading && mapPlaces.length === 0 ? (
                <div
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.5)",
                    padding: "48px 0",
                    textAlign: "center",
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.04)",
                  }}
                >
                  지도 불러오는 중…
                </div>
              ) : mapPlaces.length === 0 ? (
                <div
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.5)",
                    padding: "48px 0",
                    textAlign: "center",
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.04)",
                  }}
                >
                  추천 장소가 없습니다
                </div>
              ) : (
                <div
                  style={{
                    height: 220,
                    borderRadius: 14,
                    overflow: "hidden",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  <MapView
                    places={mapPlaces}
                    selectedPlace={previewPlace}
                    setSelectedPlace={(place) => {
                      if (!place) {
                        setPreviewPlace(null);
                        return;
                      }
                      setPreviewPlace(resolvePreviewPlace(place));
                    }}
                    showFloatingLocationButton={false}
                    closePlacePreviewOnMapClick={false}
                    skipKoreaBBoxForCuratorPins
                    placesFitBoundsPadding={48}
                  />
                </div>
              )}
            </div>
          ) : null}

          {isSelf ? (
            <div
              style={{
                width: "100%",
                maxWidth: "100%",
                boxSizing: "border-box",
                padding: "11px 10px",
                background: "rgba(100,116,139,0.14)",
                color: "#64748b",
                border: "1px solid rgba(100,116,139,0.2)",
                borderRadius: "10px",
                fontSize: "clamp(12px, 3.2vw, 13px)",
                fontWeight: 700,
                textAlign: "center",
                cursor: "not-allowed",
                overflowWrap: "break-word",
                wordBreak: "break-word",
                lineHeight: 1.35,
              }}
            >
              자기 자신은 팔로우할 수 없습니다
            </div>
          ) : (
            <button
              type="button"
              style={{
                width: "100%",
                maxWidth: "100%",
                boxSizing: "border-box",
                padding: "11px 14px",
                background: "linear-gradient(135deg, #111111 0%, #2b2b2b 100%)",
                color: "white",
                border: "none",
                borderRadius: "10px",
                fontSize: "clamp(14px, 3.6vw, 15px)",
                fontWeight: 800,
                cursor: "pointer",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                boxShadow: "0 8px 16px rgba(0,0,0,0.38)",
                overflowWrap: "break-word",
                wordBreak: "break-word",
              }}
              onClick={() => onFollow?.(curator?.username)}
            >
              픽하기
            </button>
          )}
        </div>
      </div>

      {previewPlace ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1010,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding:
              "max(8px, env(safe-area-inset-bottom, 0px)) max(8px, env(safe-area-inset-right, 0px)) max(8px, env(safe-area-inset-bottom, 0px)) max(8px, env(safe-area-inset-left, 0px))",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              width: "min(100%, 360px)",
              maxHeight: "min(88dvh, 620px)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              pointerEvents: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <PlacePreviewCard
              place={previewPlace}
              isSaved={previewSaved.isSaved}
              savedFolderColor={previewSaved.folderColor}
              canCheckIn={canCheckIn}
              onClose={() => setPreviewPlace(null)}
              getUserRole={getUserRole}
              onSavedToSupabase={onSavedToSupabase}
              onRequireLogin={onRequireLogin}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
