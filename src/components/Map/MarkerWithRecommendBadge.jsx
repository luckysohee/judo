import { isHighlightedPlace } from "../../utils/isHighlightedPlace.js";

export function MarkerWithRecommendBadge({
  place,
  highlightedPlaces,
  children,
  className = "",
}) {
  const show = isHighlightedPlace(place, highlightedPlaces);
  return (
    <div className={`relative ${className}`.trim()}>
      {children}
      {show ? (
        <span className="pointer-events-none absolute -right-0.5 -top-0.5 z-10 select-none rounded-full bg-amber-400 px-1 py-0.5 text-[9px] font-semibold leading-none text-neutral-900 shadow ring-1 ring-amber-600/30">
          추천
        </span>
      ) : null}
    </div>
  );
}
