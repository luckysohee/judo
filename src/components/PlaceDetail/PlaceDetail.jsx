import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { filterPlaceTagsForDisplay } from "../../utils/placeUiTags";
// import CheckinButton from "../CheckinButton/CheckinButton";

// 기본 이미지 폴백 시스템
const getPlaceImage = (place) => {
  // 실제 이미지가 있으면 사용
  if (place.image && place.image !== '' && !place.image.includes('placehold.co')) {
    return place.image;
  }
  
  // 이미지가 없으면 태그 기반 기본 이미지 반환
  const tag = filterPlaceTagsForDisplay(place.tags || [])[0] || "default";
  const imageMap = {
    '노포': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=500&fit=crop&crop=entropy',
    '소주': 'https://images.unsplash.com/photo-1572126662658-73807ffb52d5?w=800&h=500&fit=crop&crop=entropy',
    '맥주': 'https://images.unsplash.com/photo-1569529465848-d229c42a7f60?w=800&h=500&fit=crop&crop=entropy',
    '카페': 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&h=500&fit=crop&crop=entropy',
    '안주맛집': 'https://images.unsplash.com/photo-1565299624946-b28f40a0fe38?w=800&h=500&fit=crop&crop=entropy',
    '1차': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=500&fit=crop&crop=entropy',
    '2차': 'https://images.unsplash.com/photo-1572126662658-73807ffb52d5?w=800&h=500&fit=crop&crop=entropy',
    '심야': 'https://images.unsplash.com/photo-1514933651103-005eec79c694?w=800&h=500&fit=crop&crop=entropy',
    'default': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=500&fit=crop&crop=entropy'
  };
  
  return imageMap[tag] || imageMap.default;
};

// 이미지 에러 핸들러
const handleImageError = (e) => {
  e.target.src = 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=500&fit=crop&crop=entropy';
};
// 여러 코멘트를 지원하는 구조 (임시)
const getPlaceComments = (place) => {
  // 실제로는 API를 통해 여러 코멘트를 가져와야 함
  // 지금은 임시로 여러 코멘트를 시뮬레이션
  const comments = [
    {
      id: 1,
      curator: place.primaryCurator || "soju_anju",
      text: place.comment || "코멘트 정보가 없습니다.",
      createdAt: "2026-03-20"
    },
    // 다른 큐레이터들의 코멘트 (예시)
    ...(place.curators || []).slice(0, 2).map((curator, index) => ({
      id: index + 2,
      curator: curator,
      text: `${curator}의 추천 이유: 이 장소는 분위기가 정말 좋아요!`,
      createdAt: "2026-03-19"
    }))
  ];
  
  return comments;
};

export default function PlaceDetail({ place, onClose, onSave, isSaved, isLive: isLiveProp, liveCuratorNameSet }) {
  if (!place) return null;

  const { user } = useAuth();
  const liveSet = liveCuratorNameSet instanceof Set ? liveCuratorNameSet : new Set();
  const isLive = isLiveProp || (place.curators || []).some((name) => liveSet.has(name));
  const displayTags = filterPlaceTagsForDisplay(place.tags || []);

  // 이미지 로딩 상태
  const [imageLoaded, setImageLoaded] = useState(true);
  const [imageError, setImageError] = useState(false);

  // 이미지 에러 핸들러
  const handleImageError = (e) => {
    setImageError(true);
    setImageLoaded(false);
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };
  
  // 여러 코멘트 데이터 가져오기
  const [comments, setComments] = useState([]);
  const [showAllComments, setShowAllComments] = useState(false);
  
  useEffect(() => {
    const placeComments = getPlaceComments(place);
    setComments(placeComments);
  }, [place]);

  // 임시 체크인 버튼
  const handleTempCheckin = () => {
    console.log('🎯 체크인 테스트:', place.id, place.name);
    alert(`체크인: ${place.name}`);
  };

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
          {/* 이미지 영역 */}
          <div style={styles.imageContainer}>
            {imageError ? (
              // 이미지 없을 때의 UI
              <div style={styles.noImageContainer}>
                <div style={styles.noImageIcon}>📷</div>
                <div style={styles.noImageText}>사진 준비 중입니다</div>
              </div>
            ) : (
              // 실제 이미지
              <img
                src={getPlaceImage(place)}
                alt={place.name}
                style={styles.image}
                onLoad={handleImageLoad}
                onError={handleImageError}
              />
            )}
          </div>

          <div style={styles.body}>
            <div style={styles.titleRow}>
              <div style={styles.title}>{place.name}</div>
              <div style={styles.titleRight}>
                {isLive ? <div style={styles.liveBadge}>LIVE</div> : null}
                {isSaved ? <div style={styles.savedBadge}>SAVED</div> : null}
              </div>
            </div>

            <div style={styles.meta}>
              {place.region} · <strong>저장 {place.savedCount}</strong>
            </div>

            <section style={styles.section}>
              <div style={styles.sectionTitle}>큐레이터 코멘트</div>
              <div style={styles.commentList}>
                {(showAllComments ? comments : comments.slice(0, 2)).map((comment) => (
                  <div key={comment.id} style={styles.commentItem}>
                    <div style={styles.commentHeader}>
                      <span style={styles.commentCurator}>{comment.curator}</span>
                      <span style={styles.commentDate}>{comment.createdAt}</span>
                    </div>
                    <div style={styles.commentText}>
                      <strong>{comment.text}</strong>
                    </div>
                  </div>
                ))}
                {comments.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setShowAllComments(!showAllComments)}
                    style={styles.moreButton}
                  >
                    {showAllComments ? '접기' : `더보기 (${comments.length - 2}개)`}
                  </button>
                )}
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
                    <strong>{curator}</strong>
                  </span>
                ))}
              </div>
            </section>

            {displayTags.length > 0 ? (
              <section style={styles.section}>
                <div style={styles.sectionTitle}>태그</div>
                <div style={styles.chipRow}>
                  {displayTags.map((tag) => (
                    <span key={tag} style={styles.tagChip}>
                      #{tag}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            <section style={styles.section}>
              <div style={styles.sectionTitle}>위치 정보</div>
              <div style={styles.text}>
                위도 {place.lat} / 경도 {place.lng}
              </div>
            </section>
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
  imageContainer: {
    width: "100%",
    height: "200px",
    borderRadius: "12px",
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "100%",
    height: "200px",
    objectFit: "cover",
    borderRadius: "12px",
  },
  noImageContainer: {
    width: "100%",
    height: "200px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: "12px",
    border: "2px dashed #333333",
  },
  noImageIcon: {
    fontSize: "48px",
    marginBottom: "8px",
    opacity: 0.5,
  },
  noImageText: {
    fontSize: "14px",
    color: "#888888",
    fontWeight: "500",
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
  titleRight: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexShrink: 0,
  },
  title: {
    fontSize: "24px",
    fontWeight: 800,
    color: "#ffffff",
    lineHeight: 1.2,
  },
  liveBadge: {
    fontSize: "10px",
    fontWeight: 900,
    color: "#111111",
    backgroundColor: "#34D17A",
    borderRadius: "999px",
    padding: "5px 9px",
    flexShrink: 0,
    letterSpacing: "0.5px",
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
  commentList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  commentItem: {
    padding: "12px",
    backgroundColor: "#1a1a1a",
    borderRadius: "8px",
    border: "1px solid #333333",
  },
  commentHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "6px",
  },
  commentDate: {
    fontSize: "11px",
    color: "#888888",
  },
  commentText: {
    fontSize: "14px",
    color: "#e8e8e8",
    lineHeight: 1.5,
  },
  commentCurator: {
    color: "#ffffff", // 큐레이터 이름을 흰색으로
    fontWeight: "700",
  },
  moreButton: {
    background: "none",
    border: "none",
    color: "#007AFF",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    padding: "8px 0",
    textAlign: "left",
    width: "100%",
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