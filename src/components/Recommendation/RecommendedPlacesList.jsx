export function RecommendedPlacesList({ recommendation, onSelectPlace }) {
  if (!recommendation) return null;

  const places = (recommendation.places ?? []).slice(0, 5);

  return (
    <ul className="flex flex-col gap-1">
      {places.map((place, i) => (
        <li key={place?.id ?? place?.name ?? i}>
          <button
            type="button"
            onClick={() => onSelectPlace?.(place)}
            className="w-full rounded-lg border border-neutral-200/90 bg-white px-3 py-2 text-left text-sm text-neutral-800 shadow-sm transition hover:border-amber-300/80 hover:bg-amber-50/60 active:scale-[0.99]"
          >
            {place?.name ?? ""}
          </button>
        </li>
      ))}
    </ul>
  );
}
