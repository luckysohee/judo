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

          return (
            <div
              key={curator.id || curator.name}
              style={{
                ...styles.curatorChip,
                borderWidth: active ? "2px" : "1px",
                borderStyle: "solid",
                borderColor: active
                  ? curator.color || "#2ECC71"
                  : "rgba(255,255,255,0.08)",
                backgroundColor: active
                  ? curator.color || "#2ECC71"
                  : "rgba(18,18,18,0.88)",
              }}
              onClick={(e) => {
                // 클릭된 영역에 따라 다른 기능 실행
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                
                // 프로필 이미지 영역 (오른쪽 26px)
                if (clickX > rect.width - 26) {
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
                  color: active ? "#111111" : "#ffffff",
                  pointerEvents: "none", // 부모의 onClick만 사용
                }}
              >
                {curator.displayName || curator.name}
              </div>
              
              {/* 프로필 이미지 영역 */}
              <div
                style={styles.profileButton}
                title={`@${curator.displayName || curator.name} 프로필 보기`}
                onClick={(e) => {
                  e.stopPropagation(); // 부모 클릭 이벤트 방지
                  onProfileClick?.(curator);
                }}
              >
                {curator.avatar ? (
                  <img
                    src={curator.avatar}
                    alt={curator.displayName || curator.name}
                    style={styles.avatarImage}
                  />
                ) : (
                  <div style={styles.defaultAvatar}>
                    {(curator.displayName || curator.name).charAt(0).toUpperCase()}
                  </div>
                )}
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
    border: "1px solid rgba(255,255,255,0.08)",
    backgroundColor: "rgba(18,18,18,0.88)",
    color: "#ffffff",
    borderRadius: "999px",
    padding: "0 12px",
    fontSize: "12px",
    fontWeight: 700,
    backdropFilter: "blur(10px)",
    boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
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
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
    whiteSpace: "nowrap",
    cursor: "pointer",
  },

  profileButton: {
    width: "22px",
    height: "22px",
    borderRadius: "50%",
    border: "none",
    backgroundColor: "rgba(255,255,255,0.15)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    overflow: "hidden",
    flexShrink: 0,
    boxShadow: "0 2px 6px rgba(0, 0, 0, 0.1)",
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
    backgroundColor: "rgba(255,255,255,0.25)",
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
    fontWeight: 600,
    cursor: "pointer",
    padding: "0 4px",
    borderRadius: "999px",
    whiteSpace: "nowrap",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },

  chipActive: {
    backgroundColor: "#ffffff",
    color: "#111111",
    borderColor: "#ffffff",
  },
};