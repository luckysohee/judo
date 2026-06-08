import { pickTodayTastePlaces, tasteProfileHasSignals } from "../../utils/userTasteProfile";

/**
 * 홈 유휴 시 — 설문 취향 기반 「오늘 여기 어때요?」(룰만, GPT 없음)
 */
export default function HomeTodayTasteSuggest({
  visible = false,
  profile,
  places = [],
  onPickPlace,
}) {
  if (!visible || !tasteProfileHasSignals(profile)) return null;

  const picks = pickTodayTastePlaces(places, profile, { limit: 3 });
  if (!picks.length) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(720px, calc(100% - 24px))",
        bottom: "calc(168px + env(safe-area-inset-bottom, 0px))",
        zIndex: 82,
        pointerEvents: "auto",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          borderRadius: 16,
          padding: "10px 12px 12px",
          background: "rgba(255,255,255,0.42)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          border: "1px solid rgba(255,255,255,0.82)",
          boxShadow: "0 8px 28px rgba(0,0,0,0.12)",
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: "#5b21b6",
            marginBottom: 8,
            letterSpacing: "-0.02em",
          }}
        >
          오늘 여기 어때요?
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            scrollbarWidth: "thin",
          }}
        >
          {picks.map((place) => {
            const name = String(place?.name || place?.place_name || "장소").trim();
            return (
              <button
                key={String(place?.id ?? name)}
                type="button"
                onClick={() => onPickPlace?.(place)}
                style={{
                  flex: "0 0 auto",
                  maxWidth: 200,
                  padding: "8px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(124, 58, 237, 0.22)",
                  background: "linear-gradient(135deg, #faf5ff 0%, #fff 100%)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#1e1b4b",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {name}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#6b7280",
                    marginTop: 2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {place?.address_name ||
                    place?.address ||
                    place?.category_name ||
                    "내 취향에 맞는 곳"}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
