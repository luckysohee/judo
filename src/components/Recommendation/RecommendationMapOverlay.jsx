export function RecommendationMapOverlay({
  recommendation,
  loading,
  error,
  onOpenDetail,
}) {
  if (!loading && !error && !recommendation) return null;

  const canOpen = !loading && !error && !!recommendation;

  let body;
  if (error) {
    body = (
      <p className="text-sm leading-snug text-red-600">{error}</p>
    );
  } else if (loading) {
    body = (
      <p className="text-sm text-neutral-600">추천 불러오는 중...</p>
    );
  } else {
    const names = (recommendation.places ?? [])
      .slice(0, 3)
      .map((p) => p?.name)
      .filter(Boolean);
    const placesLine = names.join(" · ");
    body = (
      <>
        <p className="text-xs font-medium text-neutral-500">
          {recommendation.query}
        </p>
        <p className="mt-2 line-clamp-3 text-sm leading-snug text-neutral-800">
          {recommendation.summary}
        </p>
        {placesLine ? (
          <p className="mt-2 truncate text-xs text-neutral-600">{placesLine}</p>
        ) : null}
      </>
    );
  }

  return (
    <div className="pointer-events-none absolute left-1/2 top-4 z-20 w-full max-w-[18rem] -translate-x-1/2 px-3">
      <div
        role={canOpen ? "button" : undefined}
        tabIndex={canOpen ? 0 : undefined}
        onClick={canOpen ? () => onOpenDetail?.() : undefined}
        onKeyDown={
          canOpen
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpenDetail?.();
                }
              }
            : undefined
        }
        className={`rounded-xl border border-neutral-200/80 bg-white px-4 py-3 shadow-lg shadow-black/10 ${
          canOpen
            ? "pointer-events-auto cursor-pointer select-none"
            : "pointer-events-none cursor-default"
        }`}
      >
        {body}
      </div>
    </div>
  );
}
