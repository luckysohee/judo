import React, { useState, useEffect } from "react";
import { FaBookmark, FaRegBookmark, FaGlassWhiskey, FaTimes } from "react-icons/fa";
import CheckinButton from "../CheckinButton/CheckinButton";
import SaveModal from "../SaveModal/SaveModal";
import { useToast } from "../Toast/ToastProvider";
import { useAuth } from "../../context/AuthContext";
import { getKakaoPlaceBasicInfoJSONP } from "../../utils/kakaoAPIJSONP"; // JSONP로 변경

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
  const [kakaoDetails, setKakaoDetails] = useState(null);
  const [isLoadingKakao, setIsLoadingKakao] = useState(false);
  const { showToast } = useToast();

  if (!place) return null;

  console.log("🔍 PlacePreviewCard place 데이터:", place);
  console.log("🔍 isKakaoPlace:", place.isKakaoPlace);
  console.log("🔍 place_id:", place.place_id);
  
  // isKakaoPlace 판별 로직 개선
  const isKakaoPlace = place.isKakaoPlace || 
                        (place.kakao_place_id && place.kakao_place_id.startsWith('kakao_')) ||
                        (place.id && place.id.toString().length > 10) || false;
  const userRole = getUserRole?.() || "user";
  const isCurator = userRole === "curator" || userRole === "admin";

  // place_id가 있으면 카카오 API 호출 (임시 비활성화)
  useEffect(() => {
    // 카카오 API 호출 비활성화 - 지연 로딩으로 변경
    return;
    
    /*
    console.log('🔍 useEffect 실행:', {
      place_id: place.place_id,
      isKakaoPlace: place.isKakaoPlace,
      kakaoDetails: kakaoDetails,
      place_name: place.name,
      place_data: place
    });
    
    // 임시: place_id가 없으면 테스트용 ID 사용
    const testPlaceId = place.place_id || '1720697728'; // 서문객잔 ID로 테스트
    
    if (testPlaceId && !place.isKakaoPlace && !kakaoDetails) {
      console.log("🔍 카카오 장소 상세 정보 조회 시작 (JSONP):", testPlaceId);
      setIsLoadingKakao(true);
      
      getKakaoPlaceBasicInfoJSONP(testPlaceId)
        .then(details => {
          console.log("✅ 카카오 장소 상세 정보 조회 성공 (JSONP):", details);
          setKakaoDetails(details);
        })
        .catch(error => {
          console.error('❌ 카카오 장소 정보 로딩 실패 (JSONP):', error);
          // 에러 발생 시 기본 정보라도 표시
          setKakaoDetails({
            place_name: place.name || '알 수 없는 장소',
            address_name: place.address || '주소 정보 없음',
            phone: place.phone || '전화번호 정보 없음',
            category_name: place.category || '분류 정보 없음'
          });
        })
        .finally(() => {
          setIsLoadingKakao(false);
        });
    }
    */
  }, [place.place_id, place.isKakaoPlace, kakaoDetails, place]);

  // 카카오 장소 카테고리 정제
  const cleanCategory = (categoryName) => {
    if (!categoryName) return '';
    const parts = categoryName.split(' > ');
    return parts[parts.length - 1];
  };

  // 카카오 장소 주소 정보
  const displayAddress = isKakaoPlace 
    ? (place.road_address_name || place.address_name)
    : (kakaoDetails?.address || place.address);

  // 상호명만 추출하는 함수
  const extractDisplayName = (fullName) => {
    if (!fullName) return '';
    
    // 구 이름 제거 (강동구, 성북구, 용산구 등)
    const withoutDistrict = fullName.replace(/^[가-힣]+구\s+/, '');
    
    // "테라스", "야장", "루프탑" 등이 포함된 경우, 그 앞까지를 상호명으로 간주
    const placeTypePatterns = ['테라스', '야장', '루프탑', '펍', '바', '가든', '카페', '집', '골목'];
    for (const pattern of placeTypePatterns) {
      const index = withoutDistrict.indexOf(pattern);
      if (index > -1) {
        return withoutDistrict.substring(0, index + pattern.length).trim();
      }
    }
    
    // 패턴이 없으면 전체 반환
    return withoutDistrict.trim();
  };

  // 카카오 장소 전화번호
  const displayPhone = isKakaoPlace ? place.phone : (kakaoDetails?.phone || place.contact);

  // 카카오맵 상세보기 URL
  const handleKakaoView = () => {
    const placeUrl = isKakaoPlace ? place.place_url : kakaoDetails?.place_url;
    if (placeUrl) {
      window.open(placeUrl, '_blank');
    }
  };
  const liveSet = liveCuratorNameSet instanceof Set ? liveCuratorNameSet : new Set();
  const isLive = (place.curators || []).some((name) => liveSet.has(name));

  // 빠른저장 버튼 핸들러
  const handleQuickSaveClick = async () => {
    const userRole = getUserRole?.() || "user";
    console.log('🔍 빠른저장 클릭 - userRole:', userRole);
    
    // 큐레이터 또는 관리자일 경우 쾌속 잔 채우기
    if (userRole === "curator" || userRole === "admin") {
      console.log('🎯 큐레이터/관리자 - 쾌속 잔 채우기 실행');
      await handleSaveClick();
    } else {
      console.log('👥 일반 사용자 - 저장 모달 열기');
      // 일반 사용자는 저장 모달 열기
      setShowSaveModal(true);
    }
  };
  const handleSaveClick = async () => {
    const userRole = getUserRole?.() || "user"; // 기본값 user
    console.log('🔍 handleSaveClick - userRole:', userRole, 'isKakaoPlace:', place.isKakaoPlace);
    
    // 큐레이터 또는 관리자일 경우 쾌속 잔 채우기
    if (userRole === "curator" || userRole === "admin") {
      // 카카오 장소는 백그라운드로 임시저장
      if (place.isKakaoPlace) {
        console.log('📍 카카오 장소 - 백그라운드 임시저장');
        
        // 백그라운드에서 임시저장 시도 (사용자에게는 토스트만 표시)
        const result = await saveToCuratorDrafts(place);
        
        // 결과에 따른 토스트 메시지 표시
        if (result === 'duplicate') {
          alert('이미 잔 채우기 리스트에 있는 장소입니다');
        } else if (result === 'success') {
          showToast('잔 채우기 리스트에 임시저장되었습니다!', 'success');
        } else {
          alert('❌ 잔 채우기에 실패했습니다.');
        }
        
        return;
      }
      
      try {
        // 일반 장소는 기존 방식으로 저장
        const { supabase } = await import("../../lib/supabase");
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // 잔 채우기 테이블에 저장 (curator_places 테이블)
          // UUID 형식으로 place_id 변환
          let placeId = place.id;
          if (!placeId || placeId.startsWith('local_')) {
            placeId = `uuid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          }
          
          const { error } = await supabase
            .from('curator_places')
            .insert({
              curator_id: user.id,
              place_id: placeId
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
      
      if (!user) {
        console.log('⚠️ 로그인된 사용자 없음');
        return 'error';
      }
      
      console.log('📍 쾌속 잔 채우기 시작:', place.name);
      console.log('📍 카카오 장소 ID:', place.kakao_place_id || place.id);
      console.log('📍 현재 사용자 ID:', user.id);
      
      // 1. localStorage에서 기존 drafts 불러오기
      const existingDrafts = JSON.parse(localStorage.getItem('studio_drafts') || '[]');
      console.log('📍 기존 drafts:', existingDrafts.length, '개');
      
      // 2. 중복 체크 - 같은 kakao_place_id가 있는지 확인
      const isDuplicate = existingDrafts.some(draft => 
        draft.kakao_place_id === (place.kakao_place_id || place.id) && 
        draft.curator_id === user.id
      );
      
      if (isDuplicate) {
        console.log('📍 이미 잔 채우기 리스트에 있는 장소');
        return 'duplicate';
      }
      
      // 3. 새로운 draft 데이터 생성
      const newDraft = {
        id: `draft_${Date.now()}`,
        curator_id: user.id,
        kakao_place_id: place.kakao_place_id || place.id,
        place_name: place.name,
        place_address: place.address,
        place_lat: place.lat,
        place_lng: place.lng,
        category: place.category || '기타',
        phone: place.phone,
        status: 'draft',
        source: 'quick_save',
        created_at: new Date().toISOString(),
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
        draft_status: 'draft',
        tags: ['쾌속 잔 채우기'] // AI 학습을 위한 태그
      };
      
      // 4. localStorage에 저장
      existingDrafts.push(newDraft);
      localStorage.setItem('studio_drafts', JSON.stringify(existingDrafts));
      
      console.log('✅ 잔 채우기 리스트에 임시저장 완료:', newDraft);
      return 'success';
      
    } catch (error) {
      console.error('쾌속 잔 채우기 오류:', error);
      return 'error';
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
          <h3 style={styles.placeName}>{extractDisplayName(place.name)}</h3>
          <div style={styles.headerRight}>
            {/* 카카오맵 상세보기 링크 */}
            {(isKakaoPlace || kakaoDetails) && (
              <button
                onClick={handleKakaoView}
                style={styles.kakaoLink}
              >
                카카오맵
              </button>
            )}
            {/* 로딩 상태 표시 */}
            {isLoadingKakao && (
              <span style={styles.loadingText}>로딩 중...</span>
            )}
            <button type="button" onClick={onClose} style={styles.closeButton}>
              &times;
            </button>
          </div>
        </div>
        <img src={place.image} alt={place.name} style={styles.image} />

        <div style={styles.body}>
          <div style={styles.titleRow}>
            <div style={styles.title}>{extractDisplayName(place.name)}</div>

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
            {(isKakaoPlace || kakaoDetails) ? (
              <>
                {/* 카카오 장소 정보 */}
                {(kakaoDetails?.category_name || place.category_name) && (
                  <span style={styles.category}>
                    {cleanCategory(kakaoDetails?.category_name || place.category_name)}
                  </span>
                )}
                {displayAddress && (
                  <span style={styles.address}>📍 {displayAddress}</span>
                )}
                {displayPhone && (
                  <span style={styles.phone}>📞 {displayPhone}</span>
                )}
                {/* 카카오 장소 평점 정보 */}
                {kakaoDetails?.rating && (
                  <span style={styles.rating}>⭐ {kakaoDetails.rating}</span>
                )}
                {kakaoDetails?.review_count && (
                  <span style={styles.reviewCount}>({kakaoDetails.review_count}리뷰)</span>
                )}
              </>
            ) : (
              <>
                {/* 일반 장소 정보 */}
                {place.region} · 저장 {place.savedCount}
              </>
            )}
          </div>

          {/* 카카오 장소는 comment 대신 카테고리 정보 표시 */}
          {!isKakaoPlace && (
            <div style={styles.comment}>{place.comment}</div>
          )}

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

            {isCurator ? (
              /* 큐레이터용 버튼 */
              <button
                type="button"
                onClick={handleQuickSaveClick}
                style={styles.curatorSaveButton}
              >
                쾌속 잔 채우기
              </button>
            ) : (
              /* 일반 사용자용 버튼 */
              <button
                type="button"
                onClick={() => setShowSaveModal(true)}
                style={styles.quickSaveButton}
              >
                빠른저장
              </button>
            )}

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
    marginTop: "12px",
    overflowX: "auto", // 가로 스크롤 활성화
    overflowY: "hidden", // 세로 스크롤 숨김
    whiteSpace: "nowrap", // 아이템들이 한 줄로 표시
    scrollbarWidth: "none", // Firefox 스크롤바 숨김
    msOverflowStyle: "none", // IE/Edge 스크롤바 숨김
    WebkitOverflowScrolling: "touch", // iOS 스크롤 부드럽게
    "&::-webkit-scrollbar": {
      display: "none" // Chrome/Safari 스크롤바 숨김
    }
  },
  curatorScrollContainer: {
    display: "flex",
    gap: "12px",
    padding: "4px 0px 4px 4px",
    minWidth: "max-content", // 내용물에 맞는 최소 너비
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
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  kakaoLink: {
    background: "none",
    border: "none",
    color: "#3498db",
    fontSize: "11px",
    cursor: "pointer",
    padding: "2px 4px",
    borderRadius: "3px",
    textDecoration: "underline",
    transition: "all 0.2s"
  },
  category: {
    fontSize: "13px",
    color: "#3498db",
    fontWeight: "500",
    marginRight: "8px",
  },
  address: {
    fontSize: "12px",
    color: "#999",
    marginRight: "8px",
  },
  phone: {
    fontSize: "12px",
    color: "#999",
  },
  rating: {
    fontSize: "12px",
    color: "#f39c12",
    marginRight: "4px",
  },
  reviewCount: {
    fontSize: "11px",
    color: "#999",
  },
  loadingText: {
    fontSize: "11px",
    color: "#999",
    fontStyle: "italic",
  },
  curatorSaveButton: {
    flex: 1,
    height: "40px",
    borderRadius: "12px",
    border: "1px solid #343434",
    backgroundColor: "#2ECC71",
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: "700",
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
  quickSaveButton: {
    flex: 1,
    height: "40px",
    borderRadius: "12px",
    border: "1px solid #343434",
    backgroundColor: "#2ECC71",
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