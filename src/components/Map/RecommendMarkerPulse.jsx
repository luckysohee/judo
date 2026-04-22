import { useEffect, useRef, useState } from "react";
import { isHighlightedPlace } from "../../utils/isHighlightedPlace.js";

const RUN_CLS = "recommend-marker-pulse-run";

export function RecommendMarkerPulse({
  place,
  highlightedPlaces,
  children,
  className = "",
}) {
  const ref = useRef(null);
  const hi = isHighlightedPlace(place, highlightedPlaces);
  const [pulseKey, setPulseKey] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!hi) {
      if (el) el.classList.remove(RUN_CLS);
      return;
    }
    setPulseKey((k) => k + 1);
  }, [highlightedPlaces, hi]);

  useEffect(() => {
    if (!hi || pulseKey === 0) return;
    const el = ref.current;
    if (!el) return;
    el.classList.remove(RUN_CLS);
    void el.offsetWidth;
    el.classList.add(RUN_CLS);
  }, [hi, pulseKey]);

  return (
    <div ref={ref} className={`origin-center ${className}`.trim()}>
      {children}
    </div>
  );
}
