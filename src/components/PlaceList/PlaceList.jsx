import { buildKakaoStaticMapUrl } from "../../utils/kakaoStaticMapUrl";

export default function PlaceList({
  places,
  onSelectPlace,
  onOpenDetail,
  onSave,
  onOpenCurator,
  isPlaceSaved,
  getSavedFolderColor,
}) {
  if (!places || places.length === 0) {
    return (
      <section style={styles.emptyWrap}>
        <div style={styles.emptyText}>조건에 맞는 술집이 아직 없습니다.</div>
      </section>
    );
  }

  return (
    <section style={styles.section}>
      <div style={styles.headerRow}>
        <div style={styles.title}>검색 결과</div>
        <div style={styles.count}>{places.length}개</div>
      </div>

      <div style={styles.list}>
        {places.map((place) => {
          const savedFolderColor = getSavedFolderColor(place.id);
          const lat = Number(place.lat ?? place.y);
          const lng = Number(place.lng ?? place.x);
          const listThumb =
            typeof place.image === "string" && place.image.trim()
              ? place.image.trim()
              : buildKakaoStaticMapUrl(lat, lng, { w: 192, h: 192, level: 4 });

          return (
            <button
              key={place.id}
              type="button"
              onClick={() => onSelectPlace(place)}
              style={styles.item}
            >
              {listThumb ? (
                <img
                  src={listThumb}
                  alt=""
                  style={styles.image}
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src =
                      "data:image/svg+xml," +
                      encodeURIComponent(
                        '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect fill="#2a2a2a" width="100%" height="100%"/></svg>'
                      );
                  }}
                />
              ) : (
                <div style={styles.imagePlaceholder} aria-hidden />
              )}

              <div style={styles.body}>
                <div style={styles.topRow}>
                  <div>
                    <div style={styles.name}>{place.name}</div>
                    <div style={styles.meta}>
                      {place.region} · 저장 {place.savedCount}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSave(place);
                    }}
                    style={{
                      ...styles.saveButton,
                      backgroundColor: isPlaceSaved(place.id) ? "#FFD54F" : "#2ECC71",
                      color: "#111111",
                    }}
                  >
                    {isPlaceSaved(place.id) ? "저장됨" : "저장"}
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

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenCurator(place.primaryCurator);
                  }}
                  style={styles.primaryCuratorButton}
                >
                  대표 큐레이터 · {place.primaryCurator}
                </button>

                <div style={styles.comment}>{place.comment}</div>

                <div style={styles.tagRow}>
                  {place.tags.map((tag) => (
                    <span key={tag} style={styles.tag}>
                      {tag}
                    </span>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenDetail(place);
                  }}
                  style={styles.detailButton}
                >
                  상세보기 →
                </button>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

const styles = {
  section: {
    marginTop: "18px",
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "10px",
  },
  title: {
    fontSize: "16px",
    fontWeight: 800,
    color: "#ffffff",
  },
  count: {
    fontSize: "13px",
    color: "#bdbdbd",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  item: {
    display: "flex",
    gap: "12px",
    border: "1px solid #2a2a2a",
    backgroundColor: "#171717",
    borderRadius: "16px",
    padding: "10px",
    textAlign: "left",
  },
  image: {
    width: "96px",
    height: "96px",
    objectFit: "cover",
    borderRadius: "12px",
    flexShrink: 0,
  },
  imagePlaceholder: {
    width: "96px",
    height: "96px",
    borderRadius: "12px",
    flexShrink: 0,
    backgroundColor: "#2a2a2a",
  },
  body: {
    minWidth: 0,
    flex: 1,
  },
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    alignItems: "flex-start",
  },
  name: {
    fontSize: "16px",
    fontWeight: 800,
    color: "#ffffff",
    marginBottom: "4px",
  },
  meta: {
    fontSize: "12px",
    color: "#bdbdbd",
  },
  saveButton: {
    border: "none",
    borderRadius: "999px",
    padding: "8px 10px",
    fontSize: "12px",
    fontWeight: 700,
    whiteSpace: "nowrap",
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
    color: "#cfcfcf",
  },
  primaryCuratorButton: {
    marginTop: "8px",
    border: "none",
    backgroundColor: "transparent",
    padding: 0,
    color: "#d0d0d0",
    fontSize: "12px",
    textAlign: "left",
  },
  comment: {
    marginTop: "8px",
    fontSize: "13px",
    lineHeight: 1.5,
    color: "#f0f0f0",
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
  detailButton: {
    marginTop: "10px",
    border: "1px solid #444444",
    backgroundColor: "#111111",
    color: "#ffffff",
    borderRadius: "10px",
    padding: "8px 10px",
    fontSize: "12px",
    fontWeight: 700,
  },
  emptyWrap: {
    marginTop: "18px",
    border: "1px solid #2a2a2a",
    backgroundColor: "#171717",
    borderRadius: "16px",
    padding: "18px",
  },
  emptyText: {
    color: "#bdbdbd",
    fontSize: "14px",
  },
};