export default function SavedPlaces({
  open,
  folders,
  savedPlacesByFolder,
  onClose,
  onOpenPlaceDetail,
}) {
  if (!open) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.sheet}>
        <div style={styles.headerRow}>
          <div style={styles.title}>내 저장</div>
          <button type="button" onClick={onClose} style={styles.closeButton}>
            닫기
          </button>
        </div>

        {folders.length === 0 ? (
          <div style={styles.emptyText}>아직 폴더가 없습니다.</div>
        ) : (
          <div style={styles.folderList}>
            {folders.map((folder) => {
              const places = savedPlacesByFolder[folder.id] || [];

              return (
                <section key={folder.id} style={styles.folderSection}>
                  <div style={styles.folderHeader}>
                    <div style={styles.folderLeft}>
                      <span
                        style={{
                          ...styles.colorDot,
                          backgroundColor: folder.color,
                        }}
                      />
                      <span style={styles.folderName}>{folder.name}</span>
                    </div>
                    <span style={styles.folderCount}>{places.length}</span>
                  </div>

                  {places.length === 0 ? (
                    <div style={styles.emptyFolderText}>
                      저장된 술집이 없습니다.
                    </div>
                  ) : (
                    <div style={styles.placeList}>
                      {places.map((place) => (
                        <button
                          key={place.id}
                          type="button"
                          onClick={() => onOpenPlaceDetail(place)}
                          style={styles.placeItem}
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
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 70,
    backgroundColor: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  sheet: {
    width: "100%",
    maxWidth: "560px",
    maxHeight: "92vh",
    overflowY: "auto",
    backgroundColor: "#111111",
    borderTopLeftRadius: "22px",
    borderTopRightRadius: "22px",
    border: "1px solid #2a2a2a",
    padding: "16px",
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "12px",
  },
  title: {
    fontSize: "22px",
    fontWeight: 800,
    color: "#ffffff",
  },
  closeButton: {
    border: "1px solid #444444",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    borderRadius: "999px",
    padding: "8px 12px",
    fontSize: "13px",
    fontWeight: 700,
  },
  emptyText: {
    color: "#bdbdbd",
    fontSize: "14px",
    padding: "20px 0",
  },
  folderList: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  folderSection: {
    border: "1px solid #232323",
    borderRadius: "16px",
    padding: "14px",
    backgroundColor: "#171717",
  },
  folderHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "12px",
  },
  folderLeft: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  colorDot: {
    width: "12px",
    height: "12px",
    borderRadius: "999px",
  },
  folderName: {
    fontSize: "16px",
    fontWeight: 700,
    color: "#ffffff",
  },
  folderCount: {
    fontSize: "13px",
    color: "#bdbdbd",
  },
  emptyFolderText: {
    fontSize: "13px",
    color: "#9f9f9f",
  },
  placeList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  placeItem: {
    display: "flex",
    gap: "12px",
    border: "1px solid #2a2a2a",
    backgroundColor: "#111111",
    borderRadius: "14px",
    padding: "10px",
    textAlign: "left",
  },
  placeImage: {
    width: "84px",
    height: "84px",
    objectFit: "cover",
    borderRadius: "10px",
    flexShrink: 0,
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
    color: "#bdbdbd",
    marginBottom: "6px",
  },
  placeComment: {
    fontSize: "13px",
    color: "#f0f0f0",
    lineHeight: 1.5,
  },
};