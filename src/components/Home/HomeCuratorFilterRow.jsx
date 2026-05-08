import CuratorFilterBar from "../CuratorFilterBar/CuratorFilterBar";

/**
 * 헤더 상단 큐레이터 필터 바를 감싸는 가벼운 래퍼.
 * 칩 토글·전체 선택·프로필 클릭 콜백 3개와 데이터만 받아 한 줄에 표시한다.
 */
export default function HomeCuratorFilterRow({
  wrapperStyle,
  curators,
  selectedCurators,
  allActive,
  onToggle,
  onSelectAll,
  onProfileClick,
}) {
  return (
    <div style={wrapperStyle}>
      <CuratorFilterBar
        curators={curators}
        selectedCurators={selectedCurators}
        allActive={allActive}
        onToggle={onToggle}
        onSelectAll={onSelectAll}
        onProfileClick={onProfileClick}
      />
    </div>
  );
}
