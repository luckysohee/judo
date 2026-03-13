export default function PlacePreviewCard({
  place,
  isSaved,
  savedFolderColor,
  onSave,
  onOpenDetail,
  onOpenCurator,
  onClose,
}) {
  if (!place) return null;

  const extraCuratorCount = Math.max(place.curators.length - 3, 0);
  const visibleExtraCurators = place.curators.slice(1, 3);

  return (
    <div style={styles.overlayWrap}>
      <div style={styles.sheet}>
        <div style={styles.handleWrap}>
          <button
            type="button"
            onClick={onClose}
            style={styles.handleButton}
            aria-label="카드 닫기"
          >
            <span style={styles.handleBar} />
          </button>
        </div>

        <div style={styles.contentRow}>
          <img src={place.image} alt={place.name} style={styles.image} />

          <div style={styles.body}>
            <div style={styles.topRow}>
              <div style={styles.titleWrap}>
                <div style={styles.name}>{place.name}</div>
                <div style={styles.meta}>
                  {place.region} · 저장 {place.savedCount}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onSave(place)}
                style={{
                  ...styles.saveButton,
                  backgroundColor: isSaved ? "#FFD54F" : "#2ECC71",
                  color: "#111111",
                }}
              >
                {isSaved ? "저장됨" : "저장"}
              </button>
            </div>

            {savedFolderColor ? (
              <div style={styles.savedColorRow}>
                <span
                  style={{
                    ...styles.savedColorDot,
                    backgroundColor: savedFolderColor,
                  }}
                />
                <span style={styles.savedColorText}>저장 폴더 색상</span>
              </div>
            ) : null}

            <div style={styles.curatorRow}>
              <span style={styles.label}>대표 큐레이터</span>
              <button
                type="button"
                onClick={() => onOpenCurator(place.primaryCurator)}
                style={styles.primaryCuratorButton}
              >
                {place.primaryCurator}
              </button>
            </div>

            <div style={styles.recommendLine}>
              추천 큐레이터: {visibleExtraCurators.join(" · ")}
              {extraCuratorCount > 0 ? ` +${extraCuratorCount}` : ""}
            </div>

            <div style={styles.comment}>{place.comment}</div>

            <div style={styles.tagRow}>
              {place.tags.map((tag) => (
                <span key={tag} style={styles.tag}>
                  {tag}
                </span>
              ))}
            </div>

            <div style={styles.bottomRow}>
              <button
                type="button"
                onClick={() => onOpenDetail(place)}
                style={styles.detailButton}
              >
                상세보기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlayWrap: {
    position: "absolute",
    left: "10px",
    right: "10px",
    bottom: "10px",
    zIndex: 30,
    pointerEvents: "none",
    animation: "judoSlideUp 0.24s ease-out",
  },
  sheet: {
    pointerEvents: "auto",
    backgroundColor: "rgba(18,18,18,0.98)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "22px",
    boxShadow: "0 16px 32px rgba(0,0,0,0.34)",
    backdropFilter: "blur(12px)",
    overflow: "hidden",
  },
  handleWrap: {
    display: "flex",
    justifyContent: "center",
    paddingTop: "8px",
    paddingBottom: "4px",
  },
  handleButton: {
    width: "100%",
    border: "none",
    backgroundColor: "transparent",
    display: "flex",
    justifyContent: "center",
    padding: "4px 0 6px",
    cursor: "pointer",
  },
  handleBar: {
    width: "46px",
    height: "5px",
    borderRadius: "999px",
    backgroundColor: "#5c5c5c",
  },
  contentRow: {
    display: "flex",
    gap: "12px",
    padding: "12px 14px 14px",
  },
  image: {
    width: "126px",
    height: "152px",
    objectFit: "cover",
    borderRadius: "16px",
    backgroundColor: "#242424",
    flexShrink: 0,
  },
  body: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  },
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    alignItems: "flex-start",
  },
  titleWrap: {
    minWidth: 0,
  },
  name: {
    fontSize: "19px",
    fontWeight: 800,
    color: "#ffffff",
    marginBottom: "4px",
    lineHeight: 1.3,
  },
  meta: {
    fontSize: "12px",
    color: "#cbcbcb",
  },
  saveButton: {
    border: "none",
    borderRadius: "999px",
    padding: "10px 12px",
    fontSize: "12px",
    fontWeight: 800,
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  savedColorRow: {
    marginTop: "8px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  savedColorDot: {
    width: "10px",
    height: "10px",
    borderRadius: "999px",
  },
  savedColorText: {
    fontSize: "12px",
    color: "#d9d9d9",
  },
  curatorRow: {
    marginTop: "8px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  label: {
    fontSize: "12px",
    color: "#9f9f9f",
  },
  primaryCuratorButton: {
    border: "none",
    backgroundColor: "transparent",
    padding: 0,
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: 700,
    textAlign: "left",
  },
  recommendLine: {
    marginTop: "6px",
    fontSize: "12px",
    color: "#d6d6d6",
    lineHeight: 1.5,
  },
  comment: {
    marginTop: "8px",
    fontSize: "13px",
    lineHeight: 1.5,
    color: "#f4f4f4",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  tagRow: {
    marginTop: "10px",
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
  },
  tag: {
    fontSize: "11px",
    color: "#f3f3f3",
    backgroundColor: "#2a2a2a",
    borderRadius: "999px",
    padding: "5px 8px",
  },
  bottomRow: {
    marginTop: "auto",
    paddingTop: "12px",
    display: "flex",
    justifyContent: "flex-end",
  },
  detailButton: {
    border: "1px solid #444444",
    backgroundColor: "#111111",
    color: "#ffffff",
    borderRadius: "10px",
    padding: "10px 13px",
    fontSize: "12px",
    fontWeight: 700,
  },
};