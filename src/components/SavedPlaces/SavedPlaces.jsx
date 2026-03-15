export default function SavedPlaces({
  open,
  folders,
  savedPlacesByFolder = {},
  onClose,
  onOpenPlaceDetail,
}) {
  if (!open) return null;

  const safeFolders = Array.isArray(folders) ? folders : [];

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.backdrop} />

      <div style={styles.sheet} onClick={(event) => event.stopPropagation()}>
        <div style={styles.handleWrap}>
          <button
            type="button"
            onClick={onClose}
            style={styles.handleButton}
            aria-label="내 저장 닫기"
          >
            <span style={styles.handleBar} />
          </button>
        </div>

        <div style={styles.header}>
          <div style={styles.title}>내 저장</div>
          <button type="button" onClick={onClose} style={styles.closeButton}>
            닫기
          </button>
        </div>

        <div style={styles.content}>
          {safeFolders.length === 0 ? (
            <div style={styles.emptyText}>아직 만든 저장 폴더가 없습니다.</div>
          ) : (
            safeFolders.map((folder) => {
              const items = savedPlacesByFolder[folder.id] || [];

              return (
                <section key={folder.id} style={styles.folderSection}>
                  <div style={styles.folderHeader}>
                    <div style={styles.folderLeft}>
                      <span
                        style={{
                          ...styles.folderDot,
                          backgroundColor: folder.color || "#2ECC71",
                        }}
                      />
                      <span style={styles.folderName}>{folder.name}</span>
                    </div>
                    <span style={styles.folderCount}>{items.length}곳</span>
                  </div>

                  {items.length === 0 ? (
                    <div style={styles.emptyFolderText}>
                      이 폴더엔 아직 저장한 술집이 없습니다.
                    </div>
                  ) : (
                    <div style={styles.placeList}>
                      {items.map((place) => (
                        <button
                          key={place.id}
                          type="button"
                          onClick={() => onOpenPlaceDetail?.(place)}
                          style={styles.placeCard}
                        >
                          <img
                            src={place.image}
                            alt={place.name}
                            style={styles.placeImage}
                          />

                          <div style={styles.placeBody}>
                            <div style={styles.placeName}>{place.name}</div>
                            <div style={styles.placeMeta}>
                              {place.region} · 저장 {place.savedCount}
                            </div>
                            <div style={styles.placeComment}>{place.comment}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 300,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  backdrop: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    position: "relative",
    width: "100%",
    maxHeight: "80vh",
    backgroundColor: "rgba(18,18,18,0.98)",
    borderTopLeftRadius: "24px",
    borderTopRightRadius: "24px",
    boxShadow: "0 -10px 30px rgba(0,0,0,0.35)",
    overflow: "hidden",
    animation: "judoBottomSheetUp 260ms ease-out",
    backdropFilter: "blur(12px)",
  },
  handleWrap: {
    display: "flex",
    justifyContent: "center",
    paddingTop: "8px",
    paddingBottom: "2px",
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
    width: "48px",
    height: "5px",
    borderRadius: "999px",
    backgroundColor: "#5e5e5e",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 16px 12px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  title: {
    fontSize: "18px",
    fontWeight: 800,
    color: "#ffffff",
  },
  closeButton: {
    border: "1px solid #3a3a3a",
    backgroundColor: "#171717",
    color: "#ffffff",
    borderRadius: "999px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 700,
  },
  content: {
    padding: "14px 16px 24px",
    overflowY: "auto",
    maxHeight: "calc(80vh - 64px)",
  },
  emptyText: {
    color: "#bdbdbd",
    fontSize: "14px",
    padding: "12px 0",
  },
  folderSection: {
    marginBottom: "18px",
  },
  folderHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "10px",
  },
  folderLeft: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  folderDot: {
    width: "10px",
    height: "10px",
    borderRadius: "999px",
  },
  folderName: {
    fontSize: "15px",
    fontWeight: 700,
    color: "#ffffff",
  },
  folderCount: {
    fontSize: "12px",
    color: "#a9a9a9",
  },
  emptyFolderText: {
    fontSize: "13px",
    color: "#8f8f8f",
    padding: "6px 0 2px",
  },
  placeList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  placeCard: {
    width: "100%",
    border: "1px solid rgba(255,255,255,0.06)",
    backgroundColor: "#151515",
    borderRadius: "16px",
    padding: "10px",
    display: "flex",
    gap: "10px",
    textAlign: "left",
  },
  placeImage: {
    width: "76px",
    height: "76px",
    borderRadius: "12px",
    objectFit: "cover",
    flexShrink: 0,
    backgroundColor: "#242424",
  },
  placeBody: {
    minWidth: 0,
    flex: 1,
  },
  placeName: {
    fontSize: "15px",
    fontWeight: 700,
    color: "#ffffff",
    marginBottom: "4px",
  },
  placeMeta: {
    fontSize: "12px",
    color: "#b8b8b8",
    marginBottom: "6px",
  },
  placeComment: {
    fontSize: "12px",
    color: "#e5e5e5",
    lineHeight: 1.45,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
};