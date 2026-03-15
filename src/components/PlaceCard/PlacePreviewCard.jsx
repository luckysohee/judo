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

  const visibleCurators = (place.curators || []).slice(0, 3);

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <button type="button" onClick={onClose} style={styles.closeButton}>
          ✕
        </button>

        <img src={place.image} alt={place.name} style={styles.image} />

        <div style={styles.body}>
          <div style={styles.titleRow}>
            <div style={styles.title}>{place.name}</div>

            {isSaved ? (
              <div
                style={{
                  ...styles.savedDot,
                  backgroundColor: savedFolderColor || "#2ECC71",
                }}
              />
            ) : null}
          </div>

          <div style={styles.meta}>
            {place.region} · 저장 {place.savedCount}
          </div>

          <div style={styles.comment}>{place.comment}</div>

          <div style={styles.tagRow}>
            {(place.tags || []).slice(0, 4).map((tag) => (
              <span key={tag} style={styles.tag}>
                #{tag}
              </span>
            ))}
          </div>

          <div style={styles.curatorRow}>
            {visibleCurators.map((curator) => (
              <button
                key={curator}
                type="button"
                onClick={() => onOpenCurator?.(curator)}
                style={styles.curatorChip}
              >
                {curator}
              </button>
            ))}
          </div>

          <div style={styles.actionRow}>
            <button
              type="button"
              onClick={() => onSave(place)}
              style={styles.saveButton}
            >
              {isSaved ? "저장 폴더" : "저장"}
            </button>

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
  );
}

const styles = {
  wrap: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    pointerEvents: "auto",
  },
  card: {
    width: "92%",
    backgroundColor: "rgba(18,18,18,0.96)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "20px",
    overflow: "hidden",
    boxShadow: "0 14px 30px rgba(0,0,0,0.32)",
    backdropFilter: "blur(12px)",
    animation: "judoCardUp 220ms ease-out",
    position: "relative",
  },
  closeButton: {
    position: "absolute",
    right: "10px",
    top: "10px",
    border: "none",
    backgroundColor: "rgba(0,0,0,0.58)",
    color: "#fff",
    borderRadius: "999px",
    width: "30px",
    height: "30px",
    fontSize: "13px",
    zIndex: 2,
  },
  image: {
    width: "100%",
    height: "170px",
    objectFit: "cover",
    backgroundColor: "#242424",
  },
  body: {
    padding: "14px 14px 16px",
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
  },
  title: {
    fontSize: "18px",
    fontWeight: 800,
    color: "#ffffff",
    lineHeight: 1.25,
  },
  savedDot: {
    width: "10px",
    height: "10px",
    borderRadius: "999px",
    flexShrink: 0,
  },
  meta: {
    marginTop: "4px",
    fontSize: "12px",
    color: "#a9a9a9",
  },
  comment: {
    marginTop: "8px",
    fontSize: "13px",
    color: "#e8e8e8",
    lineHeight: 1.5,
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
    backgroundColor: "#202020",
    border: "1px solid #343434",
    borderRadius: "999px",
    padding: "5px 8px",
  },
  curatorRow: {
    marginTop: "10px",
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
  },
  curatorChip: {
    fontSize: "11px",
    borderRadius: "999px",
    border: "1px solid #343434",
    backgroundColor: "#171717",
    color: "#d4d4d4",
    padding: "5px 9px",
  },
  actionRow: {
    marginTop: "14px",
    display: "flex",
    gap: "8px",
  },
  saveButton: {
    flex: 1,
    height: "40px",
    borderRadius: "12px",
    border: "1px solid #343434",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: 700,
  },
  detailButton: {
    flex: 1,
    height: "40px",
    borderRadius: "12px",
    border: "none",
    backgroundColor: "#2ECC71",
    color: "#111111",
    fontSize: "13px",
    fontWeight: 800,
  },
};