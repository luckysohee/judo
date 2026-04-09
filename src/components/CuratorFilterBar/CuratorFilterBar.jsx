// 등급별 설정 데이터 (색상, 문구, 레벨)
const RANK_CONFIG = {
  diamond:  { level: 5, label: "👑 Top Curator",     bg: "rgba(255, 255, 255, 0.9)", text: "#0d47a1", border: "rgba(144, 202, 249, 0.8)", glow: "rgba(144, 202, 249, 0.3)" },
  platinum: { level: 4, label: "👑 Top Curator",     bg: "rgba(255, 255, 255, 0.9)", text: "#212121", border: "rgba(224, 224, 224, 0.8)", glow: "rgba(224, 224, 224, 0.3)" },
  gold:     { level: 3, label: "🏆 Trusted Curator", bg: "rgba(255, 255, 255, 0.9)", text: "#f57f17", border: "rgba(255, 241, 118, 0.8)", glow: "rgba(255, 241, 118, 0.3)" },
  silver:   { level: 3, label: "🏆 Trusted Curator", bg: "rgba(255, 255, 255, 0.9)", text: "#616161", border: "rgba(189, 189, 189, 0.8)", glow: "rgba(189, 189, 189, 0.3)" },
  bronze:   { level: 2, label: "⭐ Local Curator",   bg: "rgba(255, 255, 255, 0.9)", text: "#5d4037", border: "rgba(215, 204, 200, 0.8)", glow: "rgba(215, 204, 200, 0.3)" },
  default:  { level: 2, label: "⭐ Local Curator",   bg: "rgba(255, 255, 255, 0.9)", text: "#6c757d", border: "rgba(222, 226, 230, 0.8)", glow: "rgba(222, 226, 230, 0.3)" }
};

// 흰색 배경용 진한 텍스트
const WHITE_BG_TEXT_COLORS = {
  diamond: "#0d47a1",    // 진한 파란색
  platinum: "#212121",   // 진한 회색  
  gold: "#f57f17",       // 진한 노란색
  silver: "#616161",     // 진한 회색
  bronze: "#5d4037",     // 진한 갈색
  default: "#343a40"     // 진한 회색
};

export default function CuratorFilterBar({
  curators = [],
  selectedCurators = [],
  allActive = false,
  onToggle,
  onSelectAll,
  onProfileClick,
}) {
  const safeCurators = Array.isArray(curators) ? curators : [];

  return (
    <div style={styles.wrap}>
      <div style={styles.scrollRow}>
        <button
          type="button"
          onClick={onSelectAll}
          style={{
            ...styles.chip,
            ...(allActive ? styles.chipActive : null),
          }}
        >
          전체
        </button>

        {safeCurators.map((curator) => {
          const active = selectedCurators.includes(curator.name);
          // 등급별 설정 가져오기
          const rankConfig = RANK_CONFIG[curator.grade] || RANK_CONFIG.default;

          return (
            <div
              key={curator.id || curator.name}
              style={{
                ...styles.curatorChip,
                ...(active ? styles.curatorChipActive : null),
                // 등급별 스타일 적용 (활성 상태가 아닐 때만)
                ...(active ? {} : {
                  backgroundColor: rankConfig.bg,
                  border: `1px solid ${rankConfig.border}`,
                  boxShadow: curator.grade === 'diamond' ? `0 0 12px ${rankConfig.glow}` : 'none'
                })
              }}
              onClick={(e) => {
                // 클릭된 영역에 따라 다른 기능 실행
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                
                // 등급 뱃지 영역 (오른쪽 30px)
                if (clickX > rect.width - 30) {
                  onProfileClick?.(curator);
                } else {
                  // 이름 영역 (나머지)
                  const curatorName = curator.username || curator.name;
                  onToggle?.(curatorName);
                }
              }}
            >
              {/* 큐레이터 이름 영역 */}
              <div
                style={{
                  ...styles.nameButton,
                  ...(active ? styles.nameButtonActive : null),
                  // 등급별 텍스트 색상 적용 (활성 상태가 아닐 때만)
                  ...(active ? {} : { color: rankConfig.text }),
                  pointerEvents: "none", // 부모의 onClick만 사용
                }}
              >
                {curator.displayName || curator.name}
              </div>
              
              {/* 등급 뱃지 */}
              <div 
                style={{
                  fontSize: "9px",
                  fontWeight: "700",
                  padding: "1px 4px",
                  borderRadius: "8px",
                  backgroundColor: rankConfig.bg,
                  color: rankConfig.text,
                  border: `1px solid ${rankConfig.border}`,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  cursor: "pointer", // 클릭 가능하도록 변경
                }}
                title={`${curator.displayName || curator.name} 프로필 보기 (등급: ${curator.grade || 'default'})`}
                onClick={(e) => {
                  e.stopPropagation(); // 부모 클릭 이벤트 방지
                  onProfileClick?.(curator);
                }}
              >
                {rankConfig.label.split(' ')[0]} {/* 👑, 🏆, ⭐ 만 표시 */}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    width: "100%",
    overflow: "hidden",
  },

  scrollRow: {
    display: "flex",
    gap: "8px",
    overflowX: "auto",
    paddingBottom: "2px",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
  },

  chip: {
    flexShrink: 0,
    height: "34px",
    border: "1px solid rgba(0,0,0,0.08)",
    backgroundColor: "#ffffff",
    color: "#111111",
    borderRadius: "999px",
    padding: "0 12px",
    fontSize: "12px",
    fontWeight: 700,
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
    whiteSpace: "nowrap",
  },

  curatorChip: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    flexShrink: 0,
    height: "26px",
    borderRadius: "999px",
    padding: "2px",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    backgroundColor: "rgba(18, 18, 18, 0.88)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
    whiteSpace: "nowrap",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },

  profileButton: {
    width: "22px",
    height: "22px",
    borderRadius: "50%",
    border: "1px solid rgba(255, 255, 255, 0.16)",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    overflow: "hidden",
    flexShrink: 0,
    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.15)",
    transition: "all 0.2s ease",
  },

  avatarImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },

  defaultAvatar: {
    width: "100%",
    height: "100%",
    borderRadius: "50%",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    color: "#ffffff",
    fontSize: "8px",
    fontWeight: "700",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  nameButton: {
    border: "none",
    background: "none",
    fontSize: "11px",
    fontWeight: "600",
    cursor: "pointer",
    padding: "0 4px",
    borderRadius: "999px",
    whiteSpace: "nowrap",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    color: "#ffffff",
    textShadow: "0 1px 2px rgba(0, 0, 0, 0.3)",
  },

  chipActive: {
    backgroundColor: "rgba(14, 16, 22, 0.8)",
    color: "#f5f5f5",
    border: "1px solid rgba(255,255,255,0.26)",
    backdropFilter: "blur(22px) saturate(165%)",
    WebkitBackdropFilter: "blur(22px) saturate(165%)",
    boxShadow:
      "0 8px 26px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.2)",
    textShadow: "0 1px 2px rgba(0,0,0,0.28)",
  },

  curatorChipActive: {
    backgroundColor: "rgba(46, 204, 113, 0.9)",
    border: "2px solid rgba(46, 204, 113, 1)",
    boxShadow: "0 8px 32px rgba(46, 204, 113, 0.3)",
  },

  profileButtonActive: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    border: "2px solid rgba(255, 255, 255, 0.6)",
    boxShadow: "0 4px 16px rgba(46, 204, 113, 0.2)",
  },

  nameButtonActive: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    color: "#ffffff",
    textShadow: "0 1px 2px rgba(46, 204, 113, 0.5)",
  },
};