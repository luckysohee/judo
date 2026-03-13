export default function PlaceDetail({
  place,
  isSaved,
  onClose,
  onSave,
}) {
  if (!place) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.sheet}>
        <button type="button" onClick={onClose} style={styles.closeButton}>
          닫기
        </button>

        <img src={place.image} alt={place.name} style={styles.image} />

        <div style={styles.body}>
          <div style={styles.name}>{place.name}</div>
          <div style={styles.meta}>
            저장 {place.savedCount} · 추천 큐레이터 {place.curators.length}
          </div>

          <div style={styles.section}>
            <div style={styles.label}>대표 큐레이터</div>
            <div style={styles.value}>{place.primaryCurator}</div>
          </div>

          <div style={styles.section}>
            <div style={styles.label}>추천 큐레이터</div>
            <div style={styles.value}>{place.curators.join(" · ")}</div>
          </div>

          <div style={styles.section}>
            <div style={styles.label}>한 줄 소개</div>
            <div style={styles.description}>{place.comment}</div>
          </div>

          <div style={styles.section}>
            <div style={styles.label}>주소</div>
            <div style={styles.value}>{place.address}</div>
          </div>

          <div style={styles.tagRow}>
            {place.tags.map((tag) => (
              <span key={tag} style={styles.tag}>
                {tag}
              </span>
            ))}
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
            {isSaved ? "⭐ 저장됨" : "⭐ 저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 50,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  sheet: {
    width: "100%",
    maxWidth: "520px",
    maxHeight: "92vh",
    overflowY: "auto",
    backgroundColor: "#111111",
    borderTopLeftRadius: "22px",
    borderTopRightRadius: "22px",
    border: "1px solid #2a2a2a",
  },
  closeButton: {
    width: "100%",
    border: "none",
    backgroundColor: "transparent",
    color: "#bdbdbd",
    padding: "14px",
    fontSize: "14px",
    fontWeight: 700,
  },
  image: {
    width: "100%",
    height: "240px",
    objectFit: "cover",
    display: "block",
  },
  body: {
    padding: "16px",
  },
  name: {
    fontSize: "24px",
    fontWeight: 800,
    color: "#ffffff",
  },
  meta: {
    marginTop: "6px",
    color: "#bdbdbd",
    fontSize: "13px",
  },
  section: {
    marginTop: "16px",
  },
  label: {
    fontSize: "12px",
    color: "#9f9f9f",
    marginBottom: "6px",
  },
  value: {
    fontSize: "15px",
    color: "#ffffff",
    lineHeight: 1.5,
  },
  description: {
    fontSize: "15px",
    color: "#f4f4f4",
    lineHeight: 1.6,
  },
  tagRow: {
    marginTop: "16px",
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  tag: {
    fontSize: "12px",
    color: "#f3f3f3",
    backgroundColor: "#2a2a2a",
    borderRadius: "999px",
    padding: "6px 10px",
  },
  saveButton: {
    marginTop: "20px",
    width: "100%",
    border: "none",
    borderRadius: "14px",
    padding: "14px",
    fontSize: "15px",
    fontWeight: 800,
  },
};