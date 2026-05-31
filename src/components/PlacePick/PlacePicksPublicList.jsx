import { pickRowDisplay } from "../../utils/placePickRowDisplay";

/**
 * 공개 `place_picks` 목록 (스튜디오·큐레이터 프로필). `curator_places` 와 무관.
 *
 * @param {object} props
 * @param {object[]} props.rows
 * @param {boolean} [props.loading]
 * @param {string} [props.emptyLabel]
 * @param {(row: object) => void} [props.onRowClick]
 * @param {boolean} [props.showCuratorPickBadge] — false 이면 뱃지 숨김
 */
export default function PlacePicksPublicList({
  rows,
  loading = false,
  emptyLabel = "아직 픽한 가게가 없어요.",
  onRowClick,
  showCuratorPickBadge = true,
}) {
  if (loading) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "16px",
          color: "#888",
          fontSize: "13px",
        }}
      >
        불러오는 중…
      </div>
    );
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "16px",
          color: "#888",
          fontSize: "13px",
        }}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        maxHeight: "min(52vh, 420px)",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {rows.map((row) => {
        const { name, address, isCuratorPick } = pickRowDisplay(row);
        const interactive = typeof onRowClick === "function";
        return (
          <button
            key={row.id}
            type="button"
            disabled={!interactive}
            onClick={() => onRowClick?.(row)}
            style={{
              textAlign: "left",
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.12)",
              backgroundColor: "rgba(0,0,0,0.25)",
              color: "#fff",
              cursor: interactive ? "pointer" : "default",
              display: "block",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {name}
              </span>
              {showCuratorPickBadge && isCuratorPick ? (
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: "10px",
                    fontWeight: 800,
                    color: "#fecdd3",
                    border: "1px solid rgba(251,113,133,0.65)",
                    borderRadius: "999px",
                    padding: "3px 8px",
                  }}
                >
                  큐레이터 픽
                </span>
              ) : null}
            </div>
            {address ? (
              <div
                style={{
                  marginTop: "4px",
                  fontSize: "12px",
                  color: "#999",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {address}
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
