/**
 * 「지금 뜨는 곳」— `get_hot_places` 등에서 온 행 목록 (place_id, name 등)
 */
export default function HotNowSection({
  places = [],
  onPickPlace,
}) {
  const list = Array.isArray(places) ? places : [];

  return (
    <section
      aria-label="지금 뜨는 곳"
      style={{
        width: "100%",
        marginBottom: 8,
        padding: "10px 12px",
        borderRadius: 14,
        border: "1px solid rgba(225, 29, 72, 0.28)",
        background: "rgba(255, 241, 242, 0.88)",
        boxShadow: "0 4px 18px rgba(0,0,0,0.06)",
        boxSizing: "border-box",
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 13,
          fontWeight: 900,
          letterSpacing: "-0.02em",
          color: "#9f1239",
          lineHeight: 1.25,
        }}
      >
        지금 뜨는 곳
      </h2>
      {list.length === 0 ? (
        <p
          style={{
            margin: "8px 0 0",
            fontSize: 11,
            fontWeight: 600,
            color: "#9ca3af",
            lineHeight: 1.4,
          }}
        >
          실시간으로 잡힌 곳이 아직 없어요.
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: "8px 0 0",
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {list.slice(0, 5).map((row, i) => {
            const label =
              String(row?.name ?? row?.place_name ?? "").trim() ||
              `장소 ${i + 1}`;
            const pid = row?.place_id ?? row?.id;
            const recent =
              row?.checkin_count != null
                ? `${row.checkin_count}명 한잔`
                : row?.total_checkins != null
                  ? `${row.total_checkins}명 한잔`
                  : null;
            return (
              <li key={String(pid ?? label ?? i)}>
                <button
                  type="button"
                  onClick={() => onPickPlace?.(row)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "6px 8px",
                    borderRadius: 10,
                    border: "1px solid rgba(225, 29, 72, 0.2)",
                    background: "rgba(255,255,255,0.65)",
                    cursor: onPickPlace ? "pointer" : "default",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#881337",
                  }}
                >
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      minWidth: 0,
                    }}
                  >
                    <span aria-hidden style={{ marginRight: 6 }}>
                      🔥
                    </span>
                    {label}
                  </span>
                  {recent ? (
                    <span
                      style={{
                        flexShrink: 0,
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#be123c",
                      }}
                    >
                      {recent}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
