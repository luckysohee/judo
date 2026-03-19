import MapView from "../Map/MapView";
import { useNavigate } from "react-router-dom";

export default function CuratorPage({
  open,
  curator,
  places,
  curatorColorMap,
  savedColorMap,
  onClose,
  onOpenPlaceDetail,
  onSelectPlace,
  followState,
  liveState,
  canEditLive,
  onToggleFollow,
  onToggleLive,
}) {
  const navigate = useNavigate();
  
  if (!open || !curator) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.sheet}>
        <div style={styles.headerRow}>
          <button 
            type="button" 
            onClick={() => navigate("/")} 
            style={styles.homeButton}
          >
            🏠 홈
          </button>
          
          <div style={styles.headerLeft}>
            <img src={curator.avatar} alt={curator.name} style={styles.avatar} />

            <div>
              <div style={styles.name}>{curator.name}</div>
              <div style={styles.subtitle}>{curator.subtitle}</div>
            </div>
          </div>

          <button type="button" onClick={onClose} style={styles.closeButton}>
            닫기
          </button>
        </div>

        <div style={styles.statsRow}>
          <div style={styles.statBox}>
            <div style={styles.statValue}>{formatFollowerCount(curator.followers)}</div>
            <div style={styles.statLabel}>팔로워</div>
          </div>
          <div style={styles.statBox}>
            <div style={styles.statValue}>{places.length}</div>
            <div style={styles.statLabel}>추천 술집</div>
          </div>
          <div style={styles.statBox}>
            <div style={styles.statValue}>{liveState ? "ON" : "OFF"}</div>
            <div style={styles.statLabel}>LIVE</div>
          </div>
        </div>

        <div style={styles.bioBox}>
          <div style={styles.bio}>{curator.bio}</div>

          <div style={styles.actionRow}>
            <button
              type="button"
              onClick={onToggleFollow}
              style={{
                ...styles.followButton,
                backgroundColor: followState ? "#FFD54F" : "#2ECC71",
                color: "#111111",
              }}
            >
              {followState ? "팔로잉" : "팔로우"}
            </button>

            {canEditLive ? (
              <button
                type="button"
                onClick={onToggleLive}
                style={{
                  ...styles.shareButton,
                  borderColor: liveState ? "#34D17A" : "#444444",
                  color: liveState ? "#34D17A" : "#ffffff",
                }}
              >
                {liveState ? "LIVE 끄기" : "LIVE 켜기"}
              </button>
            ) : (
              <button type="button" style={styles.shareButton}>
                공유 준비중
              </button>
            )}
          </div>
        </div>

        <div style={styles.infoBox}>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>큐레이터 컬러</span>
            <div style={styles.colorRow}>
              <span
                style={{
                  ...styles.colorDot,
                  backgroundColor: curator.color,
                }}
              />
              <span style={styles.infoValue}>{curator.color}</span>
            </div>
          </div>
        </div>

        <div style={styles.sectionTitle}>지도</div>
        <div style={styles.mapWrap}>
          <MapView
            places={places}
            selectedPlace={null}
            setSelectedPlace={onSelectPlace}
            curatorColorMap={curatorColorMap}
            savedColorMap={savedColorMap}
          />
        </div>

        <div style={styles.sectionTitle}>추천 술집</div>
        <div style={styles.placeList}>
          {places.map((place) => (
            <button
              key={place.id}
              type="button"
              onClick={() => onOpenPlaceDetail(place)}
              style={styles.placeItem}
            >
              <img src={place.image} alt={place.name} style={styles.placeImage} />
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
      </div>
    </div>
  );
}

function formatFollowerCount(value) {
  if (value >= 10000) {
    return `${Math.floor(value / 1000) / 10}만`;
  }
  return value.toLocaleString("ko-KR");
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 65,
    backgroundColor: "rgba(0,0,0,0.65)",
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
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
  },
  headerLeft: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
  },
  avatar: {
    width: "60px",
    height: "60px",
    borderRadius: "999px",
    objectFit: "cover",
    border: "2px solid #2a2a2a",
  },
  name: {
    fontSize: "24px",
    fontWeight: 800,
    color: "#ffffff",
  },
  subtitle: {
    marginTop: "4px",
    fontSize: "13px",
    color: "#bdbdbd",
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
  statsRow: {
    marginTop: "14px",
    display: "flex",
    gap: "10px",
  },
  statBox: {
    flex: 1,
    border: "1px solid #232323",
    backgroundColor: "#171717",
    borderRadius: "14px",
    padding: "14px",
  },
  statValue: {
    fontSize: "20px",
    fontWeight: 800,
    color: "#ffffff",
  },
  statLabel: {
    marginTop: "4px",
    fontSize: "12px",
    color: "#bdbdbd",
  },
  bioBox: {
    marginTop: "14px",
    border: "1px solid #232323",
    backgroundColor: "#171717",
    borderRadius: "16px",
    padding: "14px",
  },
  bio: {
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#f0f0f0",
  },
  actionRow: {
    marginTop: "12px",
    display: "flex",
    gap: "10px",
  },
  followButton: {
    flex: 1,
    border: "none",
    borderRadius: "12px",
    padding: "12px",
    fontSize: "14px",
    fontWeight: 800,
  },
  shareButton: {
    flex: 1,
    border: "1px solid #444444",
    backgroundColor: "#111111",
    color: "#ffffff",
    borderRadius: "12px",
    padding: "12px",
    fontSize: "14px",
    fontWeight: 700,
  },
  infoBox: {
    marginTop: "14px",
    border: "1px solid #232323",
    backgroundColor: "#171717",
    borderRadius: "16px",
    padding: "14px",
  },
  infoItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
  },
  infoLabel: {
    fontSize: "13px",
    color: "#9f9f9f",
  },
  infoValue: {
    fontSize: "14px",
    color: "#ffffff",
    fontWeight: 700,
  },
  colorRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  colorDot: {
    width: "12px",
    height: "12px",
    borderRadius: "999px",
  },
  sectionTitle: {
    marginTop: "18px",
    marginBottom: "10px",
    fontSize: "16px",
    fontWeight: 700,
    color: "#ffffff",
  },
  mapWrap: {
    borderRadius: "18px",
    overflow: "hidden",
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
    backgroundColor: "#171717",
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
  homeButton: {
    padding: "8px 16px",
    backgroundColor: "#2ECC71",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s ease",
    marginRight: "12px",
  },
};