import {
  recommendPlaceSubtitle,
  siblingPlaceNamesFromBatch,
} from "../../utils/recommendationPlaceCopy";

export function RecommendedPlacesList({ recommendation, onSelectPlace }) {
  if (!recommendation) return null;

  const places = (recommendation.places ?? []).slice(0, 5);
  const batch = recommendation.places ?? [];

  return (
    <ul className="flex flex-col gap-1">
      {places.map((place, i) => {
        const sub = recommendPlaceSubtitle(place, {
          summary: recommendation?.summary,
          query: String(recommendation?.query || "").trim(),
          siblingNames: siblingPlaceNamesFromBatch(batch, place),
        });
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
              {sub ? (
                <span className="mt-0.5 block truncate text-xs font-normal leading-snug text-neutral-500">
                  {sub}
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
