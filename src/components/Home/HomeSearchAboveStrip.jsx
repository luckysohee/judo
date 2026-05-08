import CuratorPicksStrip from "./CuratorPicksStrip";

/**
 * 검색바 바로 위쪽의 두 가지 가벼운 헤더:
 * 1. `searchIdleHintText`가 있을 때 떠오르는 힌트(role=status)
 * 2. 쿼리가 비어있고 AI 검색·상호 검색 패널이 닫혀 있을 때만 보이는 큐레이터 픽 스트립
 *
 * 표시/감추기 조건은 그대로 부모에서 계산해 props로 내려준다.
 */
export default function HomeSearchAboveStrip({
  idleHintVisible,
  idleHintText,
  idleHintStyle,
  showSpotlight,
  spotlightPlaces,
  onPickSpotlightPlace,
}) {
  return (
    <>
      {idleHintVisible && idleHintText ? (
        <div role="status" style={idleHintStyle}>
          {idleHintText}
        </div>
      ) : null}

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
