import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import CheckinButton from "../CheckinButton/CheckinButton";
import SaveModal from "../SaveModal/SaveModal";

export default function PlacePreviewCard({
  place,
  isSaved,
  savedFolderColor,
  liveCuratorNameSet,
  onSave,
  onOpenCurator,
  onClose,
  getUserRole,
}) {
  const [showSaveModal, setShowSaveModal] = useState(false);

  if (!place) return null;

  console.log("🔍 PlacePreviewCard place 데이터:", place);
  console.log("🔍 curatorReasons:", place.curatorReasons);
  console.log("🔍 curatorPlaces:", place.curatorPlaces);

  const visibleCurators = (place.curators || []).slice(0, 3);
  const liveSet = liveCuratorNameSet instanceof Set ? liveCuratorNameSet : new Set();
  const isLive = (place.curators || []).some((name) => liveSet.has(name));

  // 저장 버튼 핸들러
  const handleSaveClick = async () => {
    const userRole = getUserRole?.() || "user"; // 기본값 user
    
    // 큐레이터 또는 관리자일 경우 쾌속 잔 채우기
    if (userRole === "curator" || userRole === "admin") {
      // 카카오 장소는 백그라운드로 임시저장
      if (place.isKakaoPlace) {
        console.log('📍 카카오 장소 - 백그라운드 임시저장');
        
        // 백그라운드에서 임시저장 시도 (사용자에게는 토스트만 표시)
        saveToCuratorDrafts(place);
        
        // 성공 토스트만 표시
        alert('✅ 잔 채우기 리스트에 임시저장되었습니다!');
        return;
      }
      
      try {
        // 일반 장소는 기존 방식으로 저장
        const { supabase } = await import("../../lib/supabase");
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // 잔 채우기 테이블에 저장 (curator_places 테이블)
          const { error } = await supabase
            .from('curator_places')
            .insert({
              curator_id: user.id,
              place_id: place.id
            });
            
          if (error) {
            console.error('잔 채우기 저장 실패:', error);
            alert('잔 채우기 저장에 실패했습니다.');
            return;
          }
          
          console.log('✅ 잔 채우기 리스트에 저장 완료');
          alert('✅ 잔 채우기 리스트에 저장되었습니다!');
        }
      } catch (error) {
        console.error('쾌속 잔 채우기 오류:', error);
        alert('쾌속 잔 채우기에 실패했습니다.');
      }
      return;
    }
    
    // 일반 사용자일 경우 기존 저장 모달 표시
    setShowSaveModal(true);
  };

  // 백그라운드 임시저장 함수
  const saveToCuratorDrafts = async (place) => {
    try {
      const { supabase } = await import("../../lib/supabase");
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        console.log('📍 카카오 장소 임시저장 시도:', place.name);
        console.log('📍 장소 정보:', place);
        
        // 1. 먼저 간단하게 curator_places에 시도
        const { error: simpleError } = await supabase
          .from('curator_places')
          .insert({
            curator_id: user.id,
            place_id: place.id,
            created_at: new Date().toISOString()
          });
        
        if (simpleError) {
          console.log('⚠️ curator_places 저장 실패:', simpleError.message);
          
          // 2. UUID 오류인 경우, 임시 테이블에 저장 시도
          if (simpleError.message.includes('uuid')) {
            console.log('🔄 UUID 오류 - 임시 테이블에 저장 시도');
            
            // 임시 테이블 생성 및 저장 (임시방법)
            const { error: tempError } = await supabase
              .from('temp_curator_places')
              .insert({
                curator_id: user.id,
                temp_place_id: place.id,
                place_name: place.name,
                place_address: place.address,
                place_lat: place.lat,
                place_lng: place.lng,
                category: place.category,
                phone: place.phone,
                kakao_place_id: place.kakao_place_id,
                is_kakao_place: true,
                status: 'draft',
                created_at: new Date().toISOString()
              });
            
            if (tempError) {
              console.log('⚠️ 임시 테이블 저장도 실패:', tempError.message);
            } else {
              console.log('✅ 임시 테이블에 저장 성공');
            }
          }
        } else {
          console.log('✅ curator_places에 저장 성공');
        }
        
        // 3. 스튜디오에서 읽을 수 있도록 localStorage에도 저장 (임시방법)
        try {
          console.log('🔄 localStorage 저장 시도...');
          
          // 스튜디오가 읽는 키로 저장: studio_drafts
          const existingDrafts = JSON.parse(localStorage.getItem('studio_drafts') || '[]');
          console.log('📍 기존 drafts:', existingDrafts.length, '개');
          
          const newDraft = {
            id: `temp_${Date.now()}`,
            curator_id: user.id,
            place_id: place.id,
            place_name: place.name,
            place_address: place.address,
            place_lat: place.lat,
            place_lng: place.lng,
            category: place.category,
            phone: place.phone,
            kakao_place_id: place.kakao_place_id,
            is_kakao_place: true,
            status: 'draft',
            created_at: new Date().toISOString(),
            source: 'home_search',
            // 스튜디오 형식에 맞게 구조화
            basicInfo: {
              name_address: place.name,
              category: place.category || '기타',
              alcohol_type: '소주',
              price_range: '중간',
              operating_hours: '정보 없음',
              contact_info: place.phone || '정보 없음'
            },
            alcohol_type: '소주',
            draft_status: 'draft'
          };
          
          existingDrafts.push(newDraft);
          localStorage.setItem('studio_drafts', JSON.stringify(existingDrafts));
          
          // 저장 확인
          const savedDrafts = JSON.parse(localStorage.getItem('studio_drafts') || '[]');
          console.log('✅ localStorage에 임시저장 완료:', savedDrafts.length, '개');
          console.log('📍 저장된 데이터:', savedDrafts[savedDrafts.length - 1]);
          
        } catch (localError) {
          console.log('⚠️ localStorage 저장 실패:', localError.message);
          console.log('⚠️ localStorage 에러 상세:', localError);
        }
      }
    } catch (error) {
      console.error('백그라운드 임시저장 오류:', error);
      console.error('백그라운드 임시저장 에러 상세:', error);
    }
  };
  // 버튼 텍스트 결정
  const getSaveButtonText = () => {
    const userRole = getUserRole?.() || "user"; // 기본값 user
    
    // 큐레이터 또는 관리자일 경우
    if (userRole === "curator" || userRole === "admin") {
      return "쾌속 잔 채우기";
    }
    
    // 일반 사용자일 경우
    return isSaved ? "저장 폴더" : "저장";
  };

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
      <div style={{
        ...styles.card,
        border: showSaveModal ? "none" : styles.card.border,
        borderRadius: showSaveModal ? "0" : styles.card.borderRadius,
        boxShadow: showSaveModal ? "none" : styles.card.boxShadow
      }}>
        <div style={styles.header}>
          <h3 style={styles.placeName}>{place.name}</h3>
          <button type="button" onClick={onClose} style={styles.closeButton}>
            &times;
          </button>
        </div>
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
              onClick={handleSaveClick}
              style={styles.saveButton}
            >
              {getSaveButtonText()}
            </button>

            <button
              type="button"
              onClick={() => handleShare(place)}
              style={styles.shareButton}
            >
              공유하기
            </button>
          </div>

          {/* 저장 모달 */}
          <SaveModal
            place={place}
            isOpen={showSaveModal}
            onClose={() => setShowSaveModal(false)}
            onSaveComplete={() => {
              setShowSaveModal(false);
              onSave?.(place);
            }}
            firstSavedFrom="home"
          />
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
    transition: "all 0.3s ease"
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