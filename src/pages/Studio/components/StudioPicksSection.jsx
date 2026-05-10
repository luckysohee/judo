import React from "react";
import PlacePicksPublicList from "../../../components/PlacePick/PlacePicksPublicList";

const sectionInnerStyle = {
  textAlign: "left",
  margin: "0 auto",
  width: "min(920px, 100%)",
  maxWidth: "100%",
  minWidth: 0,
  padding: "0 4px",
  boxSizing: "border-box",
};

/**
 * 잔 픽 탭 본문 — `place_picks` 테이블만 (curator_places 와 무관).
 *
 * @param {{ rows: Array, loading: boolean, onRowClick: (row: any) => void }} props
 */
export default function StudioPicksSection({ rows, loading, onRowClick }) {
  return (
    <div style={sectionInnerStyle}>
      <div
        style={{
          fontSize: "13px",
          fontWeight: 700,
          color: "#fff",
          marginBottom: "8px",
        }}
      >
        잔 픽
      </div>
      <p
        style={{
          fontSize: "12px",
          color: "#999",
          margin: "0 0 14px",
          lineHeight: 1.45,
        }}
      >
        공개 픽은 <strong style={{ color: "#fda4af" }}>place_picks</strong>에만
        기록됩니다. 잔 올리기·
        <strong style={{ color: "#bdc3c7" }}>curator_places</strong>와 섞이지
        않습니다.
      </p>
      <PlacePicksPublicList
        rows={rows}
        loading={loading}
        showCuratorPickBadge
        onRowClick={onRowClick}
      />
    </div>
  );
}
