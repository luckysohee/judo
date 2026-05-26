import CuratorPicksStrip from "./CuratorPicksStrip";

/** 검색바 바로 위 — 쿼리가 비어 있을 때 큐레이터 픽 스트립 */
export default function HomeSearchAboveStrip({
  showSpotlight,
  spotlightPlaces,
  onPickSpotlightPlace,
}) {
  return (
    <>
      {showSpotlight && spotlightPlaces.length > 0 ? (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            width: "100%",
            marginBottom: 4,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <CuratorPicksStrip
              places={spotlightPlaces}
              visible
              onPick={onPickSpotlightPlace}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
