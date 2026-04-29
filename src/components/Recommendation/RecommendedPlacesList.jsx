import {
  recommendPlaceSubtitle,
  siblingPlaceNamesFromBatch,
} from "../../utils/recommendationPlaceCopy";

export function RecommendedPlacesList({ recommendation, onSelectPlace }) {
  if (!recommendation) return null;

  const pool =
    Array.isArray(recommendation.import_pool) &&
    recommendation.import_pool.length > 0
      ? recommendation.import_pool
      : recommendation.places ?? [];
  const places = pool;
  const batch = pool;

  return (
    <ul className="flex flex-col gap-1">
      {places.map((place, i) => {
        const subtitle = recommendPlaceSubtitle(place, {
          summary: recommendation?.summary,
          query: String(recommendation?.query || "").trim(),
          siblingNames: siblingPlaceNamesFromBatch(batch, place),
        });
        const reasonText =
          String(
            place?.reasonShort ||
              place?.reason ||
              place?.why ||
              place?.description ||
              "",
          ).trim() || subtitle;
        return (
          <li key={place?.id ?? place?.name ?? i}>
            <button
              type="button"
              onClick={() => onSelectPlace?.(place)}
              className="min-w-0 w-full rounded-lg border border-neutral-200/90 bg-white px-3 py-2 text-left text-sm text-neutral-800 shadow-sm transition hover:border-amber-300/80 hover:bg-amber-50/60 active:scale-[0.99]"
            >
              <span className="block font-medium text-neutral-900">
                {place?.name ?? ""}
              </span>
              {reasonText ? (
                <span className="mt-0.5 block text-xs font-normal leading-snug text-neutral-500">
                  {`추천 이유: ${reasonText}`}
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
