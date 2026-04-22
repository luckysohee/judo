export function SelectedRecommendedPlaceDetailCard({
  selectedRecommendedPlace,
  matchedMapPlace,
  onClose,
  onViewOnMap,
}) {
  if (!selectedRecommendedPlace && !matchedMapPlace) return null;

  const name =
    selectedRecommendedPlace?.name ??
    matchedMapPlace?.name ??
    "";
  const score = selectedRecommendedPlace?.score;
  const address = matchedMapPlace?.address ?? matchedMapPlace?.road_address_name;
  const category =
    matchedMapPlace?.category ?? matchedMapPlace?.category_name;

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
        <div className="flex justify-center pt-2 pb-1">
          <span className="h-1 w-10 rounded-full bg-neutral-300" aria-hidden />
        </div>

        <div className="border-b border-neutral-100 px-4 pb-3 pt-1">
          <h2
            id="selected-rec-place-title"
            className="text-lg font-semibold text-neutral-900"
          >
            {name || "추천 장소"}
          </h2>
        </div>

        <div className="space-y-3 px-4 py-4 text-sm text-neutral-700">
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
