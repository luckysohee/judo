import React from "react";

/**
 * 겹친 장소 통계를 펼쳤을 때 나오는 목록 패널.
 *
 * @param {{ show: boolean, overlapSharedPlacesList: Array<{ place_id?: string, place_name?: string, place_address?: string, other_curator_handles?: string }>, overlapSharedPlaceCount: number }} props
 */
export default function StudioArchiveOverlapPlacesPanel({
  show,
  overlapSharedPlacesList,
  overlapSharedPlaceCount,
}) {
  if (!show) return null;

  return (
    <div
      role="region"
      aria-label="겹친 장소 목록"
      style={{
        marginTop: "4px",
        marginBottom: "16px",
        padding: "12px 14px",
        borderRadius: "10px",
        backgroundColor: "#252525",
        border: "1px solid rgba(255,255,255,0.08)",
        maxHeight: "min(52vh, 320px)",
        overflowY: "auto",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          fontWeight: 700,
          color: "#bbb",
          marginBottom: "10px",
        }}
      >
        다른 큐레이터와 같은 곳 ({overlapSharedPlacesList.length}곳)
      </div>
      {overlapSharedPlacesList.length === 0 ? (
        <div style={{ color: "#777", fontSize: "12px", lineHeight: 1.5 }}>
          {(overlapSharedPlaceCount ?? 0) === 0
            ? "겹친 장소가 없습니다."
            : "목록을 불러오지 못했습니다. Supabase에 마이그레이션 studio_curator_overlap_places 적용 후 새로고침해 주세요."}
        </div>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {overlapSharedPlacesList.map((row) => (
            <li
              key={String(row.place_id)}
              style={{
                padding: "8px 10px",
                borderRadius: "8px",
                backgroundColor: "#1e1e1e",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#eee",
                  marginBottom: "4px",
                  wordBreak: "break-word",
                }}
              >
                {row.place_name || "(이름 없음)"}
              </div>
              {row.place_address ? (
                <div
                  style={{
                    fontSize: "11px",
                    color: "#888",
                    lineHeight: 1.4,
                    wordBreak: "break-word",
                  }}
                >
                  {row.place_address}
                </div>
              ) : null}
              {row.other_curator_handles ? (
                <div
                  style={{
                    fontSize: "11px",
                    color: "#7eb6d6",
                    lineHeight: 1.45,
                    marginTop: "6px",
                    wordBreak: "break-word",
                  }}
                >
                  큐레이터: {row.other_curator_handles}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
