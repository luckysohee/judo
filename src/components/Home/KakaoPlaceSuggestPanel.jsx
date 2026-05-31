import { normalizeKakaoPlaceId } from "../../utils/mergePickedPlaceWithCuratorCatalog";
import {
  resolveSavedPickBadgeForPlace,
} from "../../pages/Home/homeModule";
import { homeSearchOverlayStyles as s } from "./homeSearchOverlayStyles";
import HomeSearchListLeadingIcon from "./HomeSearchListLeadingIcon";

function pickBadgeForKakaoRow(
  place,
  savedBadgeIndex,
  savedKeySet,
  folders,
  userSavedPlaces
) {
  const kid = normalizeKakaoPlaceId(place);
  if (kid && savedBadgeIndex instanceof Map) {
    for (const k of [kid, `kakao_${kid}`]) {
      const hit = savedBadgeIndex.get(k);
      if (hit?.isSaved) return hit;
    }
  }
  return resolveSavedPickBadgeForPlace(
    {
      id: place?.id,
      kakao_place_id: kid || place?.id,
      place_id: place?.id,
    },
    savedKeySet,
    folders,
    userSavedPlaces
  );
}

/**
 * 홈 검색 오버레이 — 카카오 장소 제안 리스트 (밝은 테마).
 */
export default function KakaoPlaceSuggestPanel({
  results = [],
  isLoading = false,
  onPickPlace,
  savedBadgeIndex = null,
  savedKeySet = null,
  folders = [],
  userSavedPlaces = null,
}) {
  const keySet =
    savedKeySet instanceof Set
      ? savedKeySet
      : new Set(Array.isArray(savedKeySet) ? savedKeySet : []);

  if (isLoading && results.length === 0) {
    return <div style={s.empty}>장소 찾는 중…</div>;
  }

  if (!isLoading && results.length === 0) {
    return (
      <div style={s.empty}>
        비슷한 장소가 없어요.
        <br />
        엔터로 주도 검색을 실행해 보세요.
      </div>
    );
  }

  return (
    <>
      <div style={s.suggestSectionLabel}>장소 제안</div>
      {results.map((place, index) => {
        const pickBadge = pickBadgeForKakaoRow(
          place,
          savedBadgeIndex,
          keySet,
          folders,
          userSavedPlaces
        );

        return (
          <button
            key={place.id != null ? String(place.id) : `k-${index}`}
            type="button"
            style={s.row}
            onClick={() => onPickPlace?.(place)}
          >
            <HomeSearchListLeadingIcon pickBadge={pickBadge} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...s.rowMain, whiteSpace: "normal" }}>
                {place.place_name}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "rgba(255,255,255,0.45)",
                  marginTop: 2,
                }}
              >
                {place.road_address_name || place.address_name}
              </div>
            </span>
            {Number.isFinite(Number(place.distance)) ? (
              <span style={s.rowDate}>
                {Math.round(Number(place.distance))}m
              </span>
            ) : null}
          </button>
        );
      })}
    </>
  );
}
