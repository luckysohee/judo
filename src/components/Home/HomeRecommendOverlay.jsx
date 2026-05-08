import { RecommendedPlacesList } from "../Recommendation/RecommendedPlacesList";
import { SelectedRecommendedPlaceDetailCard } from "../Recommendation/SelectedRecommendedPlaceDetailCard";

/**
 * 큐레이터 import 추천 결과 오버레이 + 선택된 추천 상세 카드.
 * Home에서 코스 모드가 아니고 추천이 살아 있을 때 노출되는 두 패널을 한 컴포넌트로 묶어,
 * 부모는 데이터·콜백만 넘기고 표시 조건은 안에서 해결한다.
 */
export default function HomeRecommendOverlay({
  isCourseMode,
  recommendation,
  onSelectPlace,
  aiSheetUsesDisplayedPlaces,
  selectedRecommendedPlace,
  matchedMapPlace,
  mergedPlace,
  isSaved,
  canCheckIn,
  onRequestSave,
  recommendationBatchPlaces,
  searchQuery,
  importSummaryText,
  onClose,
  onViewOnMap,
}) {
  const showList = Boolean(
    !isCourseMode && recommendation?.ok && !aiSheetUsesDisplayedPlaces,
  );
  return (
    <>
      {showList ? (
        <div className="pointer-events-auto absolute bottom-[calc(156px+env(safe-area-inset-bottom,0px))] left-3 right-3 z-[124] max-h-[40vh] overflow-y-auto rounded-xl border border-neutral-200/90 bg-white/95 p-3 shadow-lg md:left-auto md:right-3 md:w-80">
          <RecommendedPlacesList
            recommendation={recommendation}
            onSelectPlace={onSelectPlace}
          />
        </div>
      ) : null}
      <SelectedRecommendedPlaceDetailCard
        selectedRecommendedPlace={selectedRecommendedPlace}
        matchedMapPlace={matchedMapPlace}
        mergedPlace={mergedPlace}
        isSaved={isSaved}
        canCheckIn={canCheckIn}
        onRequestSave={onRequestSave}
        recommendationBatchPlaces={recommendationBatchPlaces}
        searchQuery={searchQuery}
        importSummaryText={importSummaryText}
        onClose={onClose}
        onViewOnMap={onViewOnMap}
      />
    </>
  );
}
