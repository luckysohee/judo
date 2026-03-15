export default function PlaceDetail({
  place,
  isSaved,
  onClose,
  onSave,
}) {
  if (!place) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.backdrop} />

      <div style={styles.sheet} onClick={(event) => event.stopPropagation()}>
        <div style={styles.header}>
          <button type="button" onClick={onClose} style={styles.headerButton}>
            닫기
          </button>

          <div style={styles.headerTitle}>상세보기</div>

          <button
            type="button"
            onClick={() => onSave(place)}
            style={styles.headerSaveButton}
          >
            {isSaved ? "저장됨" : "저장"}
          </button>
        </div>

        <div style={styles.content}>
          <img
            src={place.image}
            alt={place.name}
            style={styles.image}
          />

          <div style={styles.body}>
            <div style={styles.titleRow}>
              <div style={styles.title}>{place.name}</div>
              {isSaved ? <div style={styles.savedBadge}>SAVED</div> : null}
            </div>

            <div style={styles.meta}>
              {place.region} · 저장 {place.savedCount}
            </div>

            <section style={styles.section}>
              <div style={styles.sectionTitle}>한줄 코멘트</div>
              <div style={styles.text}>
                {place.comment || "코멘트 정보가 없습니다."}
              </div>
            </section>

            <section style={styles.section}>
              <div style={styles.sectionTitle}>주소</div>
              <div style={styles.text}>
                {place.address || "주소 정보가 없습니다."}
              </div>
            </section>

            <section style={styles.section}>
              <div style={styles.sectionTitle}>추천 큐레이터</div>
              <div style={styles.chipRow}>
                {(place.curators || []).map((curator) => (
                  <span key={curator} style={styles.curatorChip}>
                    {curator}
                  </span>
                ))}
              </div>
            </section>

            <section style={styles.section}>
              <div style={styles.sectionTitle}>태그</div>
              <div style={styles.chipRow}>
                {(place.tags || []).map((tag) => (
                  <span key={tag} style={styles.tagChip}>
                    #{tag}
                  </span>
                ))}
              </div>
            </section>

            <section style={styles.section}>
              <div style={styles.sectionTitle}>위치 정보</div>
              <div style={styles.text}>
                위도 {place.lat} / 경도 {place.lng}
              </div>
            </section>

            <div style={styles.bottomActionRow}>
              <button
                type="button"
                onClick={() => onSave(place)}
                style={styles.secondaryButton}
              >
                {isSaved ? "저장 폴더 열기" : "저장하기"}
              </button>

              <button
                type="button"
                onClick={onClose}
                style={styles.primaryButton}
              >
                지도에서 보기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 400,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  backdrop: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.62)",
  },
  sheet: {
    position: "relative",
    width: "100%",
    height: "92vh",
    backgroundColor: "#111111",
    borderTopLeftRadius: "24px",
    borderTopRightRadius: "24px",
    overflow: "hidden",
    animation: "judoBottomSheetUp 260ms ease-out",
    boxShadow: "0 -12px 30px rgba(0,0,0,0.35)",
  },
  header: {
    height: "56px",
    padding: "0 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    backgroundColor: "rgba(17,17,17,0.96)",
  },
  headerTitle: {
    fontSize: "14px",
    fontWeight: 700,
    color: "#ffffff",
  },
  headerButton: {
    border: "1px solid #3a3a3a",
    backgroundColor: "#171717",
    color: "#ffffff",
    borderRadius: "999px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 700,
  },
  headerSaveButton: {
    border: "none",
    backgroundColor: "#2ECC71",
    color: "#111111",
    borderRadius: "999px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 800,
  },
  content: {
    height: "calc(92vh - 56px)",
    overflowY: "auto",
  },
  image: {
    width: "100%",
    height: "270px",
    objectFit: "cover",
    backgroundColor: "#222222",
  },
  body: {
    padding: "16px",
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "6px",
  },
  title: {
    fontSize: "24px",
    fontWeight: 800,
    color: "#ffffff",
    lineHeight: 1.2,
  },
  savedBadge: {
    fontSize: "10px",
    fontWeight: 800,
    color: "#111111",
    backgroundColor: "#FFD54F",
    borderRadius: "999px",
    padding: "5px 8px",
    flexShrink: 0,
  },
  meta: {
    fontSize: "13px",
    color: "#a9a9a9",
    marginBottom: "18px",
  },
  section: {
    marginBottom: "18px",
  },
  sectionTitle: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#ffffff",
    marginBottom: "8px",
  },
  text: {
    fontSize: "14px",
    color: "#e8e8e8",
    lineHeight: 1.6,
  },
  chipRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  tagChip: {
    border: "1px solid #333333",
    backgroundColor: "#171717",
    color: "#ffffff",
    borderRadius: "999px",
    padding: "6px 10px",
    fontSize: "12px",
  },
  curatorChip: {
    border: "1px solid #333333",
    backgroundColor: "#151515",
    color: "#cfcfcf",
    borderRadius: "999px",
    padding: "6px 10px",
    fontSize: "12px",
  },
  bottomActionRow: {
    display: "flex",
    gap: "10px",
    paddingTop: "8px",
    marginTop: "8px",
  },
  secondaryButton: {
    flex: 1,
    height: "46px",
    borderRadius: "14px",
    border: "1px solid #343434",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: 700,
  },
  primaryButton: {
    flex: 1,
    height: "46px",
    borderRadius: "14px",
    border: "none",
    backgroundColor: "#2ECC71",
    color: "#111111",
    fontSize: "13px",
    fontWeight: 800,
  },
};