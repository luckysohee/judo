import CheckinButton from "../CheckinButton/CheckinButton";

export default function PlacePreviewCard({
  place,
  isSaved,
  savedFolderColor,
  liveCuratorNameSet,
  onSave,
  onOpenCurator,
  onClose,
}) {
  if (!place) return null;

  console.log("🔍 PlacePreviewCard place 데이터:", place);
  console.log("🔍 curatorReasons:", place.curator_reasons);
  console.log("🔍 curatorPlaces:", place.curatorPlaces);

  const visibleCurators = (place.curators || []).slice(0, 3);
  const liveSet = liveCuratorNameSet instanceof Set ? liveCuratorNameSet : new Set();
  const isLive = (place.curators || []).some((name) => liveSet.has(name));

  // 공유하기 함수
  const handleShare = (place) => {
    const shareUrl = `${window.location.origin}/place/${place.id}`;
    const shareText = `${place.name} - ${place.curators?.join(', ')} 추천 장소!`;
    
    if (navigator.share) {
      // 모바일 공유 기능
      navigator.share({
        title: place.name,
        text: shareText,
        url: shareUrl
      }).catch(err => console.log('공유 실패:', err));
    } else {
      // 클립보드 복사
      navigator.clipboard.writeText(`${shareText}\n${shareUrl}`).then(() => {
        alert('링크가 복사되었습니다!');
      }).catch(err => {
        console.error('클립보드 복사 실패:', err);
        // 폴백: 프롬프트로 보여주기
        prompt('링크를 복사하세요:', `${shareText}\n${shareUrl}`);
      });
    }
  };

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

            <div style={styles.titleRight}>
              {isLive ? <div style={styles.liveBadge}>LIVE</div> : null}

              {isSaved ? (
                <div
                  style={{
                    ...styles.savedDot,
                    backgroundColor: savedFolderColor || "#2ECC71",
                  }}
                />
              ) : null}
            </div>
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
            <div style={styles.curatorScrollContainer}>
              {place.curatorPlaces?.map((curatorPlace, index) => {
                // curatorPlaces에서 직접 데이터 가져오기
                const curatorName = curatorPlace.curators?.display_name || curatorPlace.display_name || curatorPlace.curator_id;
                const curatorReason = curatorPlace.one_line_reason || "";
                const isLast = index === place.curatorPlaces.length - 1;
                
                console.log(`🔍 큐레이터 ${curatorName}:`, { 
                curatorReason, 
                curatorPlace,
                curatorPlacesLength: place.curatorPlaces?.length,
                curatorPlaceKeys: Object.keys(curatorPlace || {})
              });
                
                return (
                  <div 
                    key={curatorPlace.id || curatorName} 
                    style={{
                      ...styles.curatorInfo,
                      paddingRight: isLast ? "20px" : "0px" // 마지막 아이템에 padding-right 추가
                    }}
                  >
                    <div style={styles.curatorNameAndReason}>
                      <button
                        type="button"
                        onClick={() => onOpenCurator?.(curatorName)}
                        style={styles.curatorChip}
                      >
                        {curatorName} 추천
                      </button>
                      {curatorReason && (
                        <div style={styles.curatorReason}>
                          "{curatorReason}"
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={styles.actionRow}>
            <CheckinButton 
              placeId={place.id} 
              placeName={place.name}
            />

            <button
              type="button"
              onClick={() => onSave(place)}
              style={styles.saveButton}
            >
              {isSaved ? "저장 폴더" : "저장"}
            </button>

            <button
              type="button"
              onClick={() => handleShare(place)}
              style={styles.shareButton}
            >
              공유하기
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
  titleRight: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexShrink: 0,
  },
  title: {
    fontSize: "18px",
    fontWeight: 800,
    color: "#ffffff",
    lineHeight: 1.25,
  },
  liveBadge: {
    height: "20px",
    padding: "0 10px",
    borderRadius: "999px",
    backgroundColor: "#34D17A",
    color: "#111111",
    fontSize: "11px",
    fontWeight: 900,
    letterSpacing: "0.5px",
    display: "flex",
    alignItems: "center",
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
    overflow: "hidden", // 넘치는 부분 숨기기
  },
  curatorScrollContainer: {
    display: "flex",
    gap: "16px", // 큐레이터 간격
    overflowX: "auto", // 가로 스크롤
    scrollbarWidth: "none", // 스크롤바 숨기기 (Firefox)
    msOverflowStyle: "none", // 스크롤바 숨기기 (IE/Edge)
    "&::-webkit-scrollbar": {
      display: "none" // 스크롤바 숨기기 (Chrome/Safari)
    }
  },
  curatorInfo: {
    flexShrink: 0, // 크기 고정
  },
  curatorNameAndReason: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    alignItems: "flex-start",
  },
  curatorChip: {
    fontSize: "11px",
    borderRadius: "999px",
    border: "1px solid #343434",
    backgroundColor: "#171717",
    color: "#d4d4d4",
    padding: "5px 9px",
    alignSelf: "flex-start",
    whiteSpace: "nowrap", // 텍스트 줄바꿈 방지
  },
  curatorReason: {
    fontSize: "12px",
    color: "#e8e8e8",
    fontStyle: "italic",
    lineHeight: 1.3,
    whiteSpace: "nowrap", // 텍스트 줄바꿈 방지
    maxWidth: "200px", // 최대 너비 제한
    overflow: "hidden",
    textOverflow: "ellipsis", // 넘치는 텍스트 ...으로 표시
  },
  actionRow: {
    marginTop: "14px",
    display: "flex",
    gap: "8px",
    alignItems: "center",
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
  shareButton: {
    flex: 1,
    height: "40px",
    borderRadius: "12px",
    border: "none",
    backgroundColor: "#3498DB",
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: 800,
  },
};