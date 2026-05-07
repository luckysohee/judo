import { useCallback, useEffect, useMemo, useState } from "react";
import {
  recommendPlaceSubtitle,
  siblingPlaceNamesFromBatch,
} from "../../utils/recommendationPlaceCopy";
import { resolvePlaceWgs84 } from "../../utils/placeCoords";
import { checkinPlaceKeyFromPlace } from "../../utils/checkinPlaceKeyFromPlace";
import { normalizeHanjanStats } from "../../utils/hanjanSocialCopy";
import { supabase } from "../../lib/supabase";
import CheckinButton from "../CheckinButton/CheckinButton";
import { PlacePickButton } from "../PlacePick/PlacePickButton";
import { PlacePickDetailSummary } from "../PlacePick/PlacePickDetailSummary";

export function SelectedRecommendedPlaceDetailCard({
  selectedRecommendedPlace,
  matchedMapPlace,
  /** `/recommend` places — 다른 순위 상호가 이 카드 이유에 섞이지 않게 */
  recommendationBatchPlaces = null,
  /** `/recommend` 요청에 쓴 검색어 — 이유 줄 앞머리 중복 제거 */
  searchQuery = "",
  /** `/recommend` summary — `reason` 비었을 때 content 기반 보강 */
  importSummaryText = "",
  /** Home 등에서 병합한 지도·추천 행 (저장/한잔 키 일치) */
  mergedPlace: mergedPlaceProp = null,
  isSaved = false,
  onRequestSave,
  onClose,
  onViewOnMap,
  canCheckIn = true,
}) {
  if (!selectedRecommendedPlace && !matchedMapPlace) return null;

  const name =
    selectedRecommendedPlace?.name ??
    matchedMapPlace?.name ??
    "";
  const score = selectedRecommendedPlace?.score;
  const reasonLine = recommendPlaceSubtitle(selectedRecommendedPlace, {
    summary: importSummaryText,
    query: String(searchQuery || "").trim(),
    siblingNames: siblingPlaceNamesFromBatch(
      Array.isArray(recommendationBatchPlaces)
        ? recommendationBatchPlaces
        : [],
      selectedRecommendedPlace,
    ),
  });
  const signalTags = Array.isArray(selectedRecommendedPlace?.signals)
    ? selectedRecommendedPlace.signals.filter(Boolean)
    : [];
  const address = matchedMapPlace?.address ?? matchedMapPlace?.road_address_name;
  const category =
    matchedMapPlace?.category ?? matchedMapPlace?.category_name;

  const mergedPlaceForPick = useMemo(() => {
    if (mergedPlaceProp && typeof mergedPlaceProp === "object") {
      return mergedPlaceProp;
    }
    return {
      ...(matchedMapPlace && typeof matchedMapPlace === "object"
        ? matchedMapPlace
        : {}),
      ...(selectedRecommendedPlace &&
      typeof selectedRecommendedPlace === "object"
        ? selectedRecommendedPlace
        : {}),
    };
  }, [mergedPlaceProp, matchedMapPlace, selectedRecommendedPlace]);

  const checkinKey = useMemo(
    () => checkinPlaceKeyFromPlace(mergedPlaceForPick),
    [mergedPlaceForPick],
  );
  const checkinWgs = useMemo(
    () => resolvePlaceWgs84(mergedPlaceForPick),
    [mergedPlaceForPick],
  );
  const [hanjanStatsNorm, setHanjanStatsNorm] = useState(null);

  useEffect(() => {
    if (!checkinKey) {
      setHanjanStatsNorm(null);
      return undefined;
    }
    let cancelled = false;
    void supabase
      .rpc("get_place_hanjan_stats", { p_place_id: String(checkinKey) })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error) setHanjanStatsNorm(normalizeHanjanStats(data));
        else setHanjanStatsNorm(null);
      });
    return () => {
      cancelled = true;
    };
  }, [checkinKey]);

  const refetchHanjanStats = useCallback(() => {
    if (!checkinKey) return;
    void supabase
      .rpc("get_place_hanjan_stats", { p_place_id: String(checkinKey) })
      .then(({ data, error }) => {
        if (!error) setHanjanStatsNorm(normalizeHanjanStats(data));
      });
  }, [checkinKey]);

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col justify-end bg-black/45 p-0 sm:p-3"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-labelledby="selected-rec-place-title"
        className="mx-auto w-full max-w-lg rounded-t-2xl border border-neutral-200/90 bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-1.5 pb-0">
          <span className="h-1 w-10 rounded-full bg-neutral-300" aria-hidden />
        </div>

        <div className="border-b border-neutral-100 px-5 pb-3 pt-1 sm:px-6">
          <h2
            id="selected-rec-place-title"
            className="text-lg font-semibold text-neutral-900"
          >
            {name || "추천 장소"}
          </h2>
          {reasonLine ? (
            <div className="mt-2">
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                한 줄 이유
              </span>
              <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-neutral-900">
                {reasonLine}
              </p>
            </div>
          ) : null}
          <PlacePickDetailSummary
            place={mergedPlaceForPick}
            theme="light"
            compact
            showAvatars={false}
          />

          <div className="mt-3 flex items-stretch gap-1.5">
            <PlacePickButton place={mergedPlaceForPick} variant="lightRowCompact" />
            <button
              type="button"
              onClick={() => onRequestSave?.(mergedPlaceForPick)}
              title="내 저장 폴더에만 넣습니다. 공개 픽과 무관합니다."
              aria-label="내 폴더에 저장"
              className="flex min-h-[30px] min-w-0 flex-1 items-center justify-center rounded-lg border border-neutral-300 bg-neutral-50 px-1.5 text-[11px] font-semibold leading-none text-neutral-800 transition hover:bg-neutral-100 active:scale-[0.99] sm:rounded-xl sm:px-2 sm:text-xs"
            >
              {isSaved ? "저장됨" : "저장"}
            </button>
            <div className="flex min-h-0 min-w-0 flex-1 items-stretch">
              <CheckinButton
                compact
                compactRowShort
                hideHint
                canCheckIn={canCheckIn}
                place={mergedPlaceForPick}
                placeId={checkinKey ?? String(mergedPlaceForPick?.id ?? "")}
                placeName={
                  mergedPlaceForPick?.name ??
                  mergedPlaceForPick?.place_name ??
                  name ??
                  ""
                }
                placeAddress={
                  mergedPlaceForPick?.address ??
                  mergedPlaceForPick?.road_address_name ??
                  mergedPlaceForPick?.address_name ??
                  ""
                }
                placeLat={checkinWgs?.lat}
                placeLng={checkinWgs?.lng}
                kakaoPlaceId={
                  mergedPlaceForPick?.place_id ??
                  mergedPlaceForPick?.kakao_place_id ??
                  mergedPlaceForPick?.kakaoId ??
                  null
                }
                hanjanStats={hanjanStatsNorm}
                onHanjanRecorded={refetchHanjanStats}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3 px-4 py-4 text-sm text-neutral-700">
          {signalTags.length ? (
            <div className="flex flex-wrap gap-1.5">
              {signalTags.slice(0, 6).map((t) => (
                <span
                  key={String(t)}
                  className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-amber-200/80"
                >
                  {t}
                </span>
              ))}
            </div>
          ) : null}
          {score != null && score !== "" && (
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                추천 점수
              </span>
              <p className="mt-0.5 font-medium text-neutral-900">{String(score)}</p>
            </div>
          )}
          {address ? (
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                주소
              </span>
              <p className="mt-0.5">{address}</p>
            </div>
          ) : null}
          {category ? (
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                카테고리
              </span>
              <p className="mt-0.5">{category}</p>
            </div>
          ) : null}
        </div>

        <div className="flex gap-2 border-t border-neutral-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50 active:scale-[0.99]"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={() => onViewOnMap?.()}
            className="flex-1 rounded-xl bg-amber-500 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 active:scale-[0.99]"
          >
            지도에서 보기
          </button>
        </div>
      </div>
    </div>
  );
}
