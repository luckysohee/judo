import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import MapView from "../../components/Map/MapView";

// 섹션 컴포넌트들
const NewPlaceSection = ({ curator, setMyPlaces, setActiveSection }) => {
  const [step, setStep] = useState(1);
  const mapRef = useRef(null); // 지도 ref 추가
  const [searchSuggestions, setSearchSuggestions] = useState([]); // 검색 제안
  const [showSuggestions, setShowSuggestions] = useState(false); // 제안 표시 여부
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1); // 선택된 제안 인덱스
  const [basicInfo, setBasicInfo] = useState({
    name_address: "", // 가게 이름과 주소 합치기
    phone: "",
    category: "",
    atmosphere: "",
    recommended_menu: "",
    menu_reason: "",
    tags: [],
    latitude: null,
    longitude: null,
  });
  const [curationInfo, setCurationInfo] = useState({
    one_line_review: "",
    visit_situations: [],
    price_range: "",
    visit_tips: "",
  });
  const [publishInfo, setPublishInfo] = useState({
    is_public: true,
    is_featured: false,
  });
  const [mapPlaces, setMapPlaces] = useState([]); // 지도에 표시할 장소들

  const handleSaveDraft = () => {
    alert("임시저장 기능은 곧 구현됩니다!");
  };

  const handleSubmit = async () => {
    try {
      // 필수 필드 확인
      if (!basicInfo.name_address || !basicInfo.latitude || !basicInfo.longitude) {
        alert("장소 이름과 위치를 선택해주세요.");
        return;
      }

      // curator 확인
      if (!curator || !curator.id) {
        alert("큐레이터 정보가 없습니다. 다시 로그인해주세요.");
        return;
      }

      console.log("curator 정보:", curator); // 디버깅용 로그

      // 새 장소 데이터 생성
      const newPlace = {
        curator: curator.id, // curator_id -> curator로 변경
        name: basicInfo.name_address,
        address: basicInfo.name_address,
        phone: basicInfo.phone || null,
        category: basicInfo.category || null,
        atmosphere: basicInfo.atmosphere || null,
        recommended_menu: basicInfo.recommended_menu || null,
        menu_reason: basicInfo.menu_reason || null,
        tags: basicInfo.tags || [],
        latitude: basicInfo.latitude,
        longitude: basicInfo.longitude,
        one_line_review: curationInfo.one_line_review || null,
        visit_situations: curationInfo.visit_situations || [],
        price_range: curationInfo.price_range || null,
        visit_tips: curationInfo.visit_tips || null,
        is_public: publishInfo.is_public,
        is_featured: publishInfo.is_featured || false,
        created_at: new Date().toISOString(),
      };

      console.log("저장할 데이터:", newPlace); // 디버깅용 로그

      // Supabase에 장소 저장
      const { data, error } = await supabase
        .from("places")
        .insert([newPlace])
        .select();

      if (error) {
        console.error("장소 저장 오류:", error);
        alert(`장소 저장에 실패했습니다.\n오류: ${error.message}\n코드: ${error.code || '알 수 없음'}`);
        return;
      }

      // 성공적으로 저장된 경우
      if (data && data.length > 0) {
        // myPlaces에 새 장소 추가
        setMyPlaces(prev => [data[0], ...prev]);
        
        // 폼 초기화
        setBasicInfo({
          name_address: "",
          phone: "",
          category: "",
          atmosphere: "",
          recommended_menu: "",
          menu_reason: "",
          tags: [],
          latitude: null,
          longitude: null,
        });
        setCurationInfo({
          one_line_review: "",
          visit_situations: [],
          price_range: "",
          visit_tips: "",
        });
        setPublishInfo({
          is_public: true,
          is_featured: false,
        });
        setMapPlaces([]);
        
        // 성공 메시지
        alert("장소가 성공적으로 추가되었습니다!");
        
        // '내 장소 리스트' 섹션으로 이동
        setActiveSection("places");
      }
    } catch (error) {
      console.error("장소 추가 중 오류:", error);
      alert("장소 추가에 실패했습니다.");
    }
  };

  // 지도 클릭 핸들러
  const handleMapClick = (lat, lng) => {
    setBasicInfo({
      ...basicInfo,
      latitude: lat,
      longitude: lng,
    });
    
    // 지도에 마커 추가
    const newPlace = {
      id: "temp",
      name: basicInfo.name_address || "새 장소",
      lat: lat, // lat으로 변경
      lng: lng, // lng으로 변경
      address: basicInfo.name_address || "",
    };
    setMapPlaces([newPlace]);
  };

  // 지도 중심 이동 함수
  const moveMapToLocation = (lat, lng) => {
    // MapView의 ref를 통해 지도 중심 이동
    if (mapRef.current && mapRef.current.moveToLocation) {
      mapRef.current.moveToLocation(lat, lng);
    }
  };

  // 장소명/주소 변경 핸들러
  const handleNameAddressChange = (value) => {
    setBasicInfo({
      ...basicInfo,
      name_address: value,
    });
    
    // 연관 검색 제안 가져오기
    fetchSearchSuggestions(value);
    
    // 선택된 인덱스 초기화
    setSelectedSuggestionIndex(-1);
    
    // 지도에 있는 마커도 업데이트
    if (basicInfo.latitude && basicInfo.longitude) {
      const updatedPlace = {
        id: "temp",
        name: value,
        lat: basicInfo.latitude,
        lng: basicInfo.longitude,
        address: value || "",
      };
      setMapPlaces([updatedPlace]);
    }
  };

  // 주소 검색 함수
  const searchAddress = async (query) => {
    console.log("검색 시작:", query);
    
    const apiKey = import.meta.env.VITE_KAKAO_REST_API_KEY;
    console.log("API 키 확인:", apiKey ? "있음" : "없음");
    
    if (!apiKey) {
      alert("카카오 REST API 키가 설정되지 않았습니다. 지도를 클릭하여 위치를 선택해주세요.");
      return;
    }

    try {
      console.log("주소 검색 시도...");
      // 주소 검색
      const addressResponse = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}&size=1`, {
        headers: {
          "Authorization": `KakaoAK ${apiKey}`
        }
      });
      
      console.log("주소 검색 응답:", addressResponse.status);
      
      if (!addressResponse.ok) {
        throw new Error(`주소 검색 실패: ${addressResponse.status}`);
      }

      const addressData = await addressResponse.json();
      console.log("주소 검색 결과:", addressData);

      if (addressData.documents && addressData.documents.length > 0) {
        const firstResult = addressData.documents[0];
        const lat = parseFloat(firstResult.y);
        const lng = parseFloat(firstResult.x);
        
        console.log("좌표 확보:", lat, lng);
        
        // 상태 업데이트
        setBasicInfo({
          ...basicInfo,
          latitude: lat,
          longitude: lng,
        });
        
        // 지도에 마커 추가
        const newPlace = {
          id: "temp",
          name: query,
          lat: lat, // lat으로 변경
          lng: lng, // lng으로 변경
          address: firstResult.address_name || query,
        };
        setMapPlaces([newPlace]);
        
        // 성공 메시지 제거
        // alert(`"${firstResult.address_name}" 위치를 찾았습니다!`);
        
        // 지도 중심 이동
        moveMapToLocation(lat, lng);
      } else {
        // 키워드 검색 (장소명으로 검색)
        console.log("키워드 검색 시도...");
        const keywordResponse = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=1`, {
          headers: {
            "Authorization": `KakaoAK ${apiKey}`
          }
        });
        
        console.log("키워드 검색 응답:", keywordResponse.status);
        
        if (!keywordResponse.ok) {
          throw new Error(`키워드 검색 실패: ${keywordResponse.status}`);
        }

        const keywordData = await keywordResponse.json();
        console.log("키워드 검색 결과:", keywordData);

        if (keywordData.documents && keywordData.documents.length > 0) {
          const firstResult = keywordData.documents[0];
          const lat = parseFloat(firstResult.y);
          const lng = parseFloat(firstResult.x);
          
          console.log("키워드 좌표 확보:", lat, lng);
          
          // 상태 업데이트
          setBasicInfo({
            ...basicInfo,
            latitude: lat,
            longitude: lng,
          });
          
          // 지도에 마커 추가
          const newPlace = {
            id: "temp",
            name: firstResult.place_name || query,
            lat: lat, // lat으로 변경
            lng: lng, // lng으로 변경
            address: firstResult.address_name || firstResult.road_address_name || query,
          };
          setMapPlaces([newPlace]);
          
          // 성공 메시지 제거
          // alert(`"${firstResult.place_name}" 위치를 찾았습니다!`);
          
          // 지도 중심 이동
          moveMapToLocation(lat, lng);
        } else {
          alert("검색 결과를 찾을 수 없습니다. 지도를 클릭하여 위치를 선택해주세요.");
        }
      }
    } catch (error) {
      console.error("주소 검색 오류:", error);
      alert("검색 중 오류가 발생했습니다. 지도를 클릭하여 위치를 선택해주세요.");
    }
  };

  // 검색 버튼 클릭 핸들러
  const handleSearch = () => {
    const query = basicInfo.name_address.trim();
    if (!query) {
      alert("검색어를 입력해주세요.");
      return;
    }
    searchAddress(query);
  };

  // 화살표키 핸들러
  const handleKeyDown = (e) => {
    if (!showSuggestions || searchSuggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        const nextIndex = selectedSuggestionIndex < searchSuggestions.length - 1 
          ? selectedSuggestionIndex + 1 
          : 0;
        setSelectedSuggestionIndex(nextIndex);
        break;
      case 'ArrowUp':
        e.preventDefault();
        const prevIndex = selectedSuggestionIndex > 0 
          ? selectedSuggestionIndex - 1 
          : searchSuggestions.length - 1;
        setSelectedSuggestionIndex(prevIndex);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedSuggestionIndex >= 0) {
          handleSuggestionClick(searchSuggestions[selectedSuggestionIndex]);
        } else {
          handleSearch();
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        break;
    }
  };

  // 엔터키 검색 핸들러
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  // 연관 검색 제안 함수
  const fetchSearchSuggestions = async (query) => {
    if (!query || query.length < 2) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const apiKey = import.meta.env.VITE_KAKAO_REST_API_KEY;
    if (!apiKey) return;

    try {
      // 키워드 검색으로 연관 장소 찾기
      const response = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=5`, {
        headers: {
          "Authorization": `KakaoAK ${apiKey}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const suggestions = data.documents.map(doc => ({
          place_name: doc.place_name,
          address_name: doc.address_name || doc.road_address_name,
          lat: parseFloat(doc.y),
          lng: parseFloat(doc.x)
        }));
        setSearchSuggestions(suggestions);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error("검색 제안 오류:", error);
    }
  };

  // 검색어 초기화 핸들러
  const handleClearSearch = () => {
    setBasicInfo({
      ...basicInfo,
      name_address: "",
    });
    setSearchSuggestions([]);
    setShowSuggestions(false);
    setMapPlaces([]);
    setBasicInfo(prev => ({
      ...prev,
      latitude: null,
      longitude: null,
    }));
  };
  // 검색 제안 선택 핸들러
  const handleSuggestionClick = (suggestion) => {
    setBasicInfo({
      ...basicInfo,
      name_address: suggestion.place_name,
      latitude: suggestion.lat,
      longitude: suggestion.lng,
    });
    
    const newPlace = {
      id: "temp",
      name: suggestion.place_name,
      lat: suggestion.lat,
      lng: suggestion.lng,
      address: suggestion.address_name,
    };
    setMapPlaces([newPlace]);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    moveMapToLocation(suggestion.lat, suggestion.lng);
  };

  return (
    <div style={sectionStyles.stepContainer}>
      <div style={sectionStyles.stepIndicator}>
        {[1, 2, 3].map((num) => (
          <div key={num} style={sectionStyles.stepDot}>
            <div style={{
              ...sectionStyles.stepDotInner,
              backgroundColor: step >= num ? "#2ECC71" : "#333333"
            }} />
            <span style={sectionStyles.stepDotText}>{num}단계</span>
          </div>
        ))}
      </div>

      {step === 1 && (
        <div style={sectionStyles.step}>
          <h2 style={sectionStyles.stepTitle}>1단계: 기본 정보</h2>
          <div style={sectionStyles.form}>
            <div style={sectionStyles.formGroup}>
              <div style={{position: 'relative', zIndex: 6}}>
                <div style={sectionStyles.searchWrapper}>
                  <input
                    type="text"
                    value={basicInfo.name_address}
                    onChange={(e) => handleNameAddressChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="장소 또는 주소를 입력하세요"
                    style={sectionStyles.searchInput}
                    tabIndex={1}
                  />
                  {basicInfo.name_address && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      style={{
                        position: 'absolute',
                        right: '100px', // 더 많이 이동
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        fontSize: '12px',
                        cursor: 'pointer',
                        color: '#666666',
                        padding: '2px',
                        borderRadius: '50%',
                        width: '18px',
                        height: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                        zIndex: 2
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = '#f0f0f0';
                        e.target.style.color = '#333333';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = 'transparent';
                        e.target.style.color = '#666666';
                      }}
                    >
                      ✕
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSearch}
                    style={sectionStyles.searchButton}
                    tabIndex={2}
                  >
                    🔍 검색
                  </button>
                </div>
                
                {/* 연관 검색 제안 */}
                {showSuggestions && searchSuggestions.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: '#ffffff',
                    border: '1px solid #333333',
                    borderTop: 'none',
                    borderRadius: '0 0 8px 8px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 5, // z-index 낮추기
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                  }}>
                    {searchSuggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion)}
                        style={{
                          padding: '12px 16px',
                          cursor: 'pointer',
                          borderBottom: '1px solid #f0f0f0',
                          transition: 'background-color 0.2s ease',
                          backgroundColor: index === selectedSuggestionIndex ? '#f0f0f0' : '#ffffff',
                          color: index === selectedSuggestionIndex ? '#333333' : 'inherit'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = '#f8f9fa';
                          setSelectedSuggestionIndex(index);
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = index === selectedSuggestionIndex ? '#f0f0f0' : '#ffffff';
                        }}
                      >
                        <div style={{fontWeight: 'bold', color: '#333333', marginBottom: '4px'}}>
                          {suggestion.place_name}
                        </div>
                        <div style={{fontSize: '12px', color: '#666666'}}>
                          {suggestion.address_name}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* 지도 */}
            <div style={{...sectionStyles.mapContainer, marginBottom: showSuggestions ? "300px" : "0"}}>
              <label style={sectionStyles.label}>위치 선택 (지도를 클릭하세요)</label>
              <div style={{...sectionStyles.mapWrapper, marginTop: '20px'}}>
                <MapView
                  ref={mapRef}
                  places={mapPlaces}
                  selectedPlace={mapPlaces[0]}
                  setSelectedPlace={() => {}}
                  curatorColorMap={{}}
                  savedColorMap={{}}
                  livePlaceIds={[]}
                  onMapClick={handleMapClick}
                />
              </div>
              {basicInfo.latitude && basicInfo.longitude && (
                <div style={sectionStyles.coordinates}>
                  <span>좌표: {basicInfo.latitude.toFixed(6)}, {basicInfo.longitude.toFixed(6)}</span>
                </div>
              )}
            </div>
            
            <div style={sectionStyles.formGroup}>
              <label style={sectionStyles.label}>카테고리 *</label>
              <select
                value={basicInfo.category}
                onChange={(e) => setBasicInfo({...basicInfo, category: e.target.value})}
                style={sectionStyles.select}
                tabIndex={3}
              >
                <option value="">선택하세요</option>
                <option value="디저트">디저트</option>
                <option value="양식">양식</option>
                <option value="육류">육류</option>
                <option value="일식">일식</option>
                <option value="중식">중식</option>
                <option value="해산물">해산물</option>
                <option value="한식">한식</option>
              </select>
            </div>
            <div style={sectionStyles.formGroup}>
              <label style={sectionStyles.label}>분위기</label>
              <select
                value={basicInfo.atmosphere}
                onChange={(e) => setBasicInfo({...basicInfo, atmosphere: e.target.value})}
                style={sectionStyles.select}
                tabIndex={4}
              >
                <option value="">선택하세요</option>
                <option value="quiet">조용한</option>
                <option value="lively">활기찬</option>
                <option value="modern">모던한</option>
                <option value="cozy">아늑한</option>
              </select>
            </div>
            <div style={sectionStyles.formGroup}>
              <label style={sectionStyles.label}>추천 메뉴</label>
              <input
                type="text"
                value={basicInfo.recommended_menu}
                onChange={(e) => setBasicInfo({...basicInfo, recommended_menu: e.target.value})}
                placeholder="추천하는 메뉴를 입력하세요"
                style={sectionStyles.input}
                tabIndex={5}
              />
            </div>
            <div style={sectionStyles.formGroup}>
              <label style={sectionStyles.label}>추천 이유</label>
              <textarea
                value={basicInfo.menu_reason}
                onChange={(e) => setBasicInfo({...basicInfo, menu_reason: e.target.value})}
                placeholder="이 가게 추천하는 이유를 설명해주세요"
                style={sectionStyles.textarea}
                rows={3}
                tabIndex={6}
              />
            </div>
            <div style={sectionStyles.formGroup}>
              <label style={sectionStyles.label}>태그</label>
              <input
                type="text"
                value={basicInfo.tags.join(", ")}
                onChange={(e) => setBasicInfo({...basicInfo, tags: e.target.value.split(",").map(tag => tag.trim()).filter(tag => tag)})}
                placeholder="#태그1 #태그2 #태그3 (쉼표로 구분)"
                style={sectionStyles.input}
                tabIndex={7}
              />
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={sectionStyles.step}>
          <h2 style={sectionStyles.stepTitle}>2단계: 큐레이션 정보</h2>
          <div style={sectionStyles.form}>
            <div style={sectionStyles.formGroup}>
              <label style={sectionStyles.label}>한줄평</label>
              <textarea
                value={curationInfo.one_line_review}
                onChange={(e) => setCurationInfo({...curationInfo, one_line_review: e.target.value})}
                placeholder="이 장소를 한마디로 표현해주세요"
                style={sectionStyles.textarea}
                rows={2}
              />
            </div>
            <div style={sectionStyles.formGroup}>
              <label style={sectionStyles.label}>방문 추천 상황</label>
              <div style={sectionStyles.checkboxGroup}>
                {["데이트", "친구와", "회식", "혼자", "가족과"].map((situation) => (
                  <label key={situation} style={sectionStyles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={curationInfo.visit_situations.includes(situation)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setCurationInfo({...curationInfo, visit_situations: [...curationInfo.visit_situations, situation]});
                        } else {
                          setCurationInfo({...curationInfo, visit_situations: curationInfo.visit_situations.filter(s => s !== situation)});
                        }
                      }}
                      style={sectionStyles.checkbox}
                    />
                    {situation}
                  </label>
                ))}
              </div>
            </div>
            <div style={sectionStyles.formGroup}>
              <label style={sectionStyles.label}>가격대</label>
              <select
                value={curationInfo.price_range}
                onChange={(e) => setCurationInfo({...curationInfo, price_range: e.target.value})}
                style={sectionStyles.select}
              >
                <option value="">선택하세요</option>
                <option value="cheap">저렴함 (1~2만원)</option>
                <option value="moderate">보통 (2~4만원)</option>
                <option value="expensive">비쌈 (4만원+)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={sectionStyles.step}>
          <h2 style={sectionStyles.stepTitle}>3단계: 발행 설정</h2>
          <div style={sectionStyles.form}>
            <div style={sectionStyles.formGroup}>
              <label style={sectionStyles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={publishInfo.is_public}
                  onChange={(e) => setPublishInfo({...publishInfo, is_public: e.target.checked})}
                  style={sectionStyles.checkbox}
                />
                공개하기
              </label>
              <p style={sectionStyles.helpText}>
                공개하면 다른 사용자들이 이 장소를 볼 수 있습니다.
              </p>
            </div>
            <div style={sectionStyles.formGroup}>
              <label style={sectionStyles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={publishInfo.is_featured}
                  onChange={(e) => setPublishInfo({...publishInfo, is_featured: e.target.checked})}
                  style={sectionStyles.checkbox}
                />
                대표 추천으로 설정
              </label>
              <p style={sectionStyles.helpText}>
                대표 추천 장소로 설정하면 더 많은 사용자에게 노출됩니다.
              </p>
            </div>
          </div>
        </div>
      )}

      <div style={sectionStyles.actions}>
        {step > 1 && (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            style={sectionStyles.secondaryButton}
          >
            이전
          </button>
        )}
        {step < 3 && (
          <button
            type="button"
            onClick={() => setStep(step + 1)}
            style={sectionStyles.primaryButton}
          >
            다음
          </button>
        )}
        {step === 3 && (
          <>
            <button
              type="button"
              onClick={handleSaveDraft}
              style={sectionStyles.secondaryButton}
            >
              임시저장
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              style={sectionStyles.primaryButton}
            >
              완료
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const PlacesSection = ({ places }) => (
  <div style={sectionStyles.section}>
    <h2 style={sectionStyles.sectionTitle}>내 장소 리스트</h2>
    {places.length === 0 ? (
      <div style={sectionStyles.emptyState}>
        <div style={sectionStyles.emptyIcon}>📍</div>
        <p style={sectionStyles.emptyText}>아직 올린 장소가 없습니다.</p>
      </div>
    ) : (
      <div style={sectionStyles.list}>
        {places.map((place) => (
          <div key={place.id} style={sectionStyles.card}>
            <div style={sectionStyles.cardContent}>
              <div style={sectionStyles.cardTitle}>{place.name}</div>
              <div style={sectionStyles.cardMeta}>
                {place.category && `${place.category} • `}
                {place.address}
              </div>
              {place.one_line_review && (
                <div style={sectionStyles.cardDescription}>
                  {place.one_line_review}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const DraftsSection = ({ drafts }) => (
  <div style={sectionStyles.section}>
    <h2 style={sectionStyles.sectionTitle}>임시 저장소</h2>
    {drafts.length === 0 ? (
      <div style={sectionStyles.emptyState}>
        <div style={sectionStyles.emptyIcon}>📝</div>
        <p style={sectionStyles.emptyText}>작성중인 초안이 없습니다.</p>
      </div>
    ) : (
      <div style={sectionStyles.list}>
        {drafts.map((draft) => (
          <div key={draft.id} style={sectionStyles.card}>
            <div style={sectionStyles.cardContent}>
              <div style={sectionStyles.cardTitle}>
                {draft.name || "제목 없음"}
              </div>
              <div style={sectionStyles.cardMeta}>
                {draft.updated_at && new Date(draft.updated_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const StatsSection = ({ stats }) => (
  <div style={sectionStyles.section}>
    <h2 style={sectionStyles.sectionTitle}>성과 및 반응</h2>
    <div style={sectionStyles.statsGrid}>
      <div style={sectionStyles.statCard}>
        <div style={sectionStyles.statIcon}>📍</div>
        <div style={sectionStyles.statNumber}>{stats.totalPlaces}</div>
        <div style={sectionStyles.statLabel}>올린 장소</div>
      </div>
      <div style={sectionStyles.statCard}>
        <div style={sectionStyles.statIcon}>❤️</div>
        <div style={sectionStyles.statNumber}>{stats.totalSaved}</div>
        <div style={sectionStyles.statLabel}>저장된 수</div>
      </div>
      <div style={sectionStyles.statCard}>
        <div style={sectionStyles.statIcon}>👁️</div>
        <div style={sectionStyles.statNumber}>{stats.totalViews}</div>
        <div style={sectionStyles.statLabel}>조회 수</div>
      </div>
      <div style={sectionStyles.statCard}>
        <div style={sectionStyles.statIcon}>👥</div>
        <div style={sectionStyles.statNumber}>{stats.followerCount}</div>
        <div style={sectionStyles.statLabel}>팔로워</div>
      </div>
    </div>
  </div>
);

const sectionStyles = {
  stepContainer: {
    padding: "20px 0",
  },
  stepIndicator: {
    display: "flex",
    justifyContent: "center",
    gap: "24px",
    marginBottom: "32px",
  },
  stepDot: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
  },
  stepDotInner: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    backgroundColor: "#333333",
    transition: "background-color 0.3s",
  },
  stepDotText: {
    fontSize: "12px",
    color: "#bdbdbd",
  },
  step: {
    marginBottom: "32px",
  },
  stepTitle: {
    fontSize: "20px",
    fontWeight: 700,
    margin: "0 0 24px 0",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#ffffff",
  },
  input: {
    border: "1px solid #333333",
    borderRadius: "8px",
    padding: "12px 16px",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    fontSize: "16px",
    outline: "none",
  },
  select: {
    border: "1px solid #333333",
    borderRadius: "8px",
    padding: "12px 16px",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    fontSize: "16px",
    outline: "none",
  },
  textarea: {
    border: "1px solid #333333",
    borderRadius: "8px",
    padding: "12px 16px",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    fontSize: "16px",
    outline: "none",
    resize: "vertical",
  },
  checkboxGroup: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    cursor: "pointer",
  },
  checkbox: {
    width: "16px",
    height: "16px",
    accentColor: "#2ECC71",
  },
  helpText: {
    fontSize: "12px",
    color: "#bdbdbd",
    margin: "4px 0 0 0",
  },
  actions: {
    display: "flex",
    gap: "12px",
    justifyContent: "flex-end",
    marginTop: "32px",
  },
  primaryButton: {
    border: "none",
    backgroundColor: "#2ECC71",
    color: "#111111",
    borderRadius: "8px",
    padding: "12px 24px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #444444",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    borderRadius: "8px",
    padding: "12px 24px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  section: {
    marginBottom: "32px",
  },
  sectionTitle: {
    fontSize: "18px",
    fontWeight: 700,
    margin: "0 0 16px 0",
  },
  emptyState: {
    textAlign: "center",
    padding: "40px 20px",
    color: "#bdbdbd",
  },
  emptyIcon: {
    fontSize: "48px",
    marginBottom: "16px",
  },
  emptyText: {
    fontSize: "16px",
    marginBottom: "20px",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  card: {
    border: "1px solid #222222",
    borderRadius: "12px",
    padding: "16px",
    backgroundColor: "#1a1a1a",
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: "16px",
    fontWeight: 700,
    marginBottom: "4px",
  },
  cardMeta: {
    fontSize: "12px",
    color: "#bdbdbd",
    marginBottom: "8px",
  },
  cardDescription: {
    fontSize: "14px",
    color: "#ffffff",
    lineHeight: 1.4,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "16px",
  },
  statCard: {
    border: "1px solid #222222",
    borderRadius: "12px",
    padding: "20px",
    backgroundColor: "#1a1a1a",
    textAlign: "center",
  },
  statIcon: {
    fontSize: "24px",
    marginBottom: "8px",
  },
  statNumber: {
    fontSize: "28px",
    fontWeight: 800,
    marginBottom: "4px",
    color: "#2ECC71",
  },
  statLabel: {
    fontSize: "12px",
    color: "#bdbdbd",
  },
  mapContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "16px", // 간격 증가
    marginTop: "16px", // 위쪽 마진 증가
  },
  mapWrapper: {
    width: "100%",
    height: "300px",
    borderRadius: "12px",
    overflow: "hidden",
    border: "1px solid #333333",
    backgroundColor: "#f0f0f0", // 연한 회색 배경으로 변경
    position: "relative",
    zIndex: 1,
  },
  coordinates: {
    fontSize: "12px",
    color: "#2ECC71",
    backgroundColor: "rgba(46, 204, 113, 0.1)",
    padding: "8px 12px",
    borderRadius: "6px",
    textAlign: "center",
  },
  searchWrapper: {
    display: "flex",
    gap: "8px",
    position: "relative",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    padding: "12px 45px 12px 16px", // 오른쪽 패딩 45px로 증가
    border: "1px solid #333333",
    borderRadius: "8px",
    fontSize: "14px",
    backgroundColor: "#ffffff",
    color: "#333333",
    outline: "none",
    transition: "all 0.2s ease",
  },
  searchButton: {
    border: "1px solid #2ECC71",
    backgroundColor: "#2ECC71",
    color: "#111111",
    borderRadius: "8px",
    padding: "12px 20px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
};

export default function StudioHome() {
  console.log("StudioHome component rendering"); // 디버깅용
  
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // 상태 관리
  const [activeSection, setActiveSection] = useState("list"); // list, add, archive
  const [myPlaces, setMyPlaces] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);

  // 잔 올리기 폼 상태
  const [formData, setFormData] = useState({
    name_address: "",
    category: "",
    alcohol_type: "",
    atmosphere: "",
    recommended_menu: "",
    menu_reason: "",
    tags: [],
    latitude: null,
    longitude: null,
    is_public: true
  });

  // 잔 리스트 상태
  const [filterType, setFilterType] = useState("all"); // all, public, private
  const [places, setPlaces] = useState([
    { id: 1, name: "테스트 장소 1", category: "한식", is_public: true, created_at: "2024-01-01" },
    { id: 2, name: "테스트 장소 2", category: "일식", is_public: false, created_at: "2024-01-02" },
    { id: 3, name: "테스트 장소 3", category: "중식", is_public: true, created_at: "2024-01-03" },
  ]);

  // 잔 아카이브 상태
  const [stats, setStats] = useState({
    followerCount: 0,
    savedByFollowers: 0,
    totalPlaces: 0,
    overlappingPlaces: 0,
    isLive: false,
    notificationSent: false
  });

  // 큐레이터 프로필 상태
  const [curatorProfile, setCuratorProfile] = useState({
    name: "테스트 큐레이터",
    image: null, // 실제로는 이미지 URL
    bio: "안녕하세요! 맛집 탐험을 좋아하는 큐레이터입니다. 다양한 술집과 맛집을 소개해드릴게요.",
    instagram: "@curator_example"
  });

  useEffect(() => {
    loadStudioData();
  }, []);

  const loadStudioData = async () => {
    try {
      // 실제 데이터 로딩 로직은 나중에 구현
      setLoading(false);
    } catch (error) {
      console.error("Studio data loading error:", error);
      setLoading(false);
    }
  };

  const handleAddPlace = async (isDraft = false) => {
    try {
      // 중복 확인
      const duplicateCheck = checkDuplicatePlace(formData.name_address);
      if (duplicateCheck) {
        alert("이미 저장된 장소입니다.");
        return;
      }

      // 장소 저장 로직
      console.log("Saving place:", { ...formData, isDraft });
      alert(isDraft ? "임시저장되었습니다." : "저장되었습니다.");
      
      // 폼 초기화
      setFormData({
        name_address: "",
        category: "",
        alcohol_type: "",
        atmosphere: "",
        recommended_menu: "",
        menu_reason: "",
        tags: [],
        latitude: null,
        longitude: null,
        is_public: true
      });
      
    } catch (error) {
      console.error("Place saving error:", error);
      alert("저장에 실패했습니다.");
    }
  };

  const checkDuplicatePlace = (placeName) => {
    // 중복 확인 로직
    return false; // 임시로 false 반환
  };

  const handleTogglePublic = (placeId) => {
    // 실제 상태 변경 로직
    console.log("Toggle public:", placeId);
    setPlaces(prevPlaces => 
      prevPlaces.map(place => 
        place.id === placeId 
          ? { ...place, is_public: !place.is_public }
          : place
      )
    );
  };

  const handleDeletePlace = (placeId) => {
    // 삭제 로직
    console.log("Delete place:", placeId);
  };

  const handleEditPlace = (place) => {
    // 수정 로직
    console.log("Edit place:", place);
  };

  const handleInstagramConnect = () => {
    // 인스타그램 연동 로직 (추후 구현)
    console.log("인스타그램 연동 시도");
    alert("인스타그램 연동 기능은 추후 구현될 예정입니다.");
  };

  const toggleLiveStatus = () => {
    setStats(prev => ({ ...prev, isLive: !prev.isLive, notificationSent: false }));
    if (!stats.isLive) {
      // 팔로워들에게 알림 발송 선택 옵션
      const choice = confirm("알림 발송하기: 확인(OK)\n알림 없이 라이브 시작: 취소(Cancel)");
      if (choice) {
        // 알림 발송 로직 (추후 구현)
        console.log("알림 발송됨");
        setStats(prev => ({ ...prev, notificationSent: true }));
      }
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        로딩 중...
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", textAlign: "center", minHeight: "100vh", backgroundColor: "#111111", color: "#ffffff" }}>
      {/* 좌측 상단 홈 버튼 */}
      <div style={{ position: "absolute", top: "20px", left: "20px" }}>
        <button 
          onClick={() => navigate("/")}
          style={{ 
            padding: "8px 16px", 
            backgroundColor: "#2ECC71", 
            color: "white", 
            border: "none", 
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "600"
          }}
        >
          홈
        </button>
      </div>
      
      <h1 style={{ fontSize: "32px", fontWeight: "bold", marginBottom: "20px" }}>
        {user?.user_metadata?.display_name || user?.email?.split("@")[0] || "사용자"}님의 스튜디오
      </h1>
      
      {/* 섹션 선택 버튼 */}
      <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginBottom: "30px" }}>
        <button
          onClick={() => setActiveSection("add")}
          style={{
            padding: "10px 20px",
            backgroundColor: activeSection === "add" ? "#2ECC71" : "#333",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer"
          }}
        >
          잔 올리기
        </button>
        <button
          onClick={() => setActiveSection("list")}
          style={{
            padding: "10px 20px",
            backgroundColor: activeSection === "list" ? "#2ECC71" : "#333",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer"
          }}
        >
          잔 리스트
        </button>
        <button
          onClick={() => setActiveSection("archive")}
          style={{
            padding: "10px 20px",
            backgroundColor: activeSection === "archive" ? "#2ECC71" : "#333",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer"
          }}
        >
          잔 아카이브
        </button>
      </div>

      {/* 잔 올리기 섹션 */}
      {activeSection === "add" && (
        <div style={{ textAlign: "left", maxWidth: "600px", margin: "0 auto" }}>
          {/* 장소/주소 검색 */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "600" }}>장소 또는 주소 검색</label>
            <input
              type="text"
              value={formData.name_address}
              onChange={(e) => setFormData(prev => ({ ...prev, name_address: e.target.value }))}
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #333",
                borderRadius: "8px",
                backgroundColor: "#222",
                color: "white",
                fontSize: "16px"
              }}
              placeholder="장소 이름 또는 주소를 입력하세요"
            />
          </div>

          {/* 지도 (임시로 간단한 표시) */}
          <div style={{
            height: "200px",
            backgroundColor: "#333",
            borderRadius: "8px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#666"
          }}>
            지도 영역 (마커 표시)
          </div>

          {/* 카테고리 */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "600" }}>카테고리</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #333",
                borderRadius: "8px",
                backgroundColor: "#222",
                color: "white",
                fontSize: "16px"
              }}
            >
              <option value="">선택하세요</option>
              <option value="한식">한식</option>
              <option value="중식">중식</option>
              <option value="일식">일식</option>
              <option value="양식">양식</option>
              <option value="육류">육류</option>
              <option value="해산물">해산물</option>
              <option value="디저트">디저트</option>
            </select>
          </div>

          {/* 술종류 */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "600" }}>술종류</label>
            <select
              value={formData.alcohol_type}
              onChange={(e) => setFormData(prev => ({ ...prev, alcohol_type: e.target.value }))}
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #333",
                borderRadius: "8px",
                backgroundColor: "#222",
                color: "white",
                fontSize: "16px"
              }}
            >
              <option value="">선택하세요</option>
              <option value="소주">소주</option>
              <option value="맥주">맥주</option>
              <option value="막걸리">막걸리</option>
              <option value="하이볼">하이볼</option>
              <option value="위스키">위스키</option>
              <option value="칵테일">칵테일</option>
            </select>
          </div>

          {/* 분위기 */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "600" }}>분위기</label>
            <textarea
              value={formData.atmosphere}
              onChange={(e) => setFormData(prev => ({ ...prev, atmosphere: e.target.value }))}
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #333",
                borderRadius: "8px",
                backgroundColor: "#222",
                color: "white",
                fontSize: "16px",
                minHeight: "80px",
                resize: "vertical"
              }}
              placeholder="분위기를 설명해주세요"
            />
          </div>

          {/* 추천이유 */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "600" }}>추천이유</label>
            <textarea
              value={formData.menu_reason}
              onChange={(e) => setFormData(prev => ({ ...prev, menu_reason: e.target.value }))}
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #333",
                borderRadius: "8px",
                backgroundColor: "#222",
                color: "white",
                fontSize: "16px",
                minHeight: "80px",
                resize: "vertical"
              }}
              placeholder="추천하는 이유를 알려주세요"
            />
          </div>

          {/* 해시태그 */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "600" }}>해시태그</label>
            <input
              type="text"
              value={formData.tags.join(", ")}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                tags: e.target.value.split(",").map(tag => tag.trim()).filter(tag => tag)
              }))}
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #333",
                borderRadius: "8px",
                backgroundColor: "#222",
                color: "white",
                fontSize: "16px"
              }}
              placeholder="해시태그를 쉼표로 구분하여 입력하세요"
            />
          </div>

          {/* 버튼들 */}
          <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
            <button
              onClick={() => handleAddPlace(true)}
              style={{
                padding: "12px 24px",
                backgroundColor: "#666",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "16px"
              }}
            >
              임시저장
            </button>
            <button
              onClick={() => handleAddPlace(false)}
              style={{
                padding: "12px 24px",
                backgroundColor: "#2ECC71",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "16px"
              }}
            >
              저장
            </button>
          </div>
        </div>
      )}

      {/* 잔 리스트 섹션 */}
      {activeSection === "list" && (
        <div style={{ textAlign: "left", maxWidth: "800px", margin: "0 auto" }}>
          {/* 장소 리스트 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            {/* 임시로 예시 데이터 */}
            {places.map(place => (
                <div key={place.id} style={{
                  backgroundColor: "#222",
                  padding: "20px",
                  borderRadius: "8px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: "0 0 5px 0", fontSize: "18px", fontWeight: "bold" }}>
                      {place.name}
                    </h3>
                    <p style={{ margin: "0 0 5px 0", color: "#666", fontSize: "14px" }}>
                      {place.category} • {place.created_at}
                    </p>
                  </div>
                  
                  <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                    {/* 수정 버튼 */}
                    <button
                      onClick={() => handleEditPlace(place)}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "#3498DB",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px"
                      }}
                    >
                      수정
                    </button>
                    
                    {/* 삭제 버튼 */}
                    <button
                      onClick={() => handleDeletePlace(place.id)}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "#E74C3C",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px"
                      }}
                    >
                      삭제
                    </button>
                    
                    {/* 공개/비공개 토글 버튼 - 맨 오른쪽 */}
                    <button
                      onClick={() => handleTogglePublic(place.id)}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: place.is_public ? "#2ECC71" : "#E74C3C",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px",
                        fontWeight: "600",
                        minWidth: "50px"
                      }}
                    >
                      {place.is_public ? "공개" : "비공개"}
                    </button>
                  </div>
                </div>
              ))}
            
            {/* 실제 데이터가 없을 때 */}
            {false && (
              <div style={{
                textAlign: "center",
                padding: "40px",
                backgroundColor: "#222",
                borderRadius: "8px",
                color: "#666"
              }}>
                저장된 장소가 없습니다.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 잔 아카이브 섹션 */}
      {activeSection === "archive" && (
        <div style={{ textAlign: "left", maxWidth: "800px", margin: "0 auto" }}>
          {/* 큐레이터 프로필 */}
          <div style={{
            backgroundColor: "#222",
            padding: "30px",
            borderRadius: "12px",
            marginBottom: "30px",
            display: "flex",
            gap: "20px",
            alignItems: "flex-start"
          }}>
            {/* 큐레이터 사진 */}
            <div style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              backgroundColor: "#333",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#666",
              fontSize: "14px",
              flexShrink: 0
            }}>
              {curatorProfile.image ? (
                <img 
                  src={curatorProfile.image} 
                  alt={curatorProfile.name}
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    objectFit: "cover"
                  }}
                />
              ) : (
                "사진"
              )}
            </div>
            
            {/* 프로필 정보 */}
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: "0 0 10px 0", fontSize: "20px", fontWeight: "bold" }}>
                {curatorProfile.name}
              </h3>
              <p style={{ margin: "0 0 15px 0", color: "#ccc", lineHeight: "1.5" }}>
                {curatorProfile.bio}
              </p>
              
              {/* 인스타그램 연동 */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ color: "#E4405F", fontSize: "18px" }}>📷</span>
                <span style={{ color: "#ccc", fontSize: "14px" }}>
                  {curatorProfile.instagram}
                </span>
                <button
                  onClick={handleInstagramConnect}
                  style={{
                    padding: "4px 12px",
                    backgroundColor: "#E4405F",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: "600"
                  }}
                >
                  연동하기
                </button>
                
                {/* 라이브 시작 버튼 */}
                <button
                  onClick={toggleLiveStatus}
                  style={{
                    padding: "4px 12px",
                    backgroundColor: stats.isLive ? "#E74C3C" : "#2ECC71",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: "600"
                  }}
                >
                  {stats.isLive ? "라이브 중지" : "라이브 시작"}
                </button>
              </div>
              
              {/* 라이브 상태 메시지 */}
              {stats.isLive && (
                <div style={{ marginTop: "10px", padding: "8px 12px", backgroundColor: "#2ECC71", borderRadius: "4px" }}>
                  <p style={{ margin: 0, color: "white", fontSize: "12px" }}>
                    🔴 라이브 중
                    {stats.notificationSent ? " • 팔로워들에게 알림 발송됨" : " • 알림 미발송"}
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {/* 활동지표 */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "15px",
            marginBottom: "30px"
          }}>
            <div style={{
              backgroundColor: "#222",
              padding: "20px",
              borderRadius: "8px",
              textAlign: "center"
            }}>
              <div style={{ fontSize: "24px", fontWeight: "bold", color: "#2ECC71" }}>
                {stats.followerCount}
              </div>
              <div style={{ fontSize: "14px", color: "#666" }}>팔로워 수</div>
            </div>
            <div style={{
              backgroundColor: "#222",
              padding: "20px",
              borderRadius: "8px",
              textAlign: "center"
            }}>
              <div style={{ fontSize: "24px", fontWeight: "bold", color: "#2ECC71" }}>
                {stats.savedByFollowers}
              </div>
              <div style={{ fontSize: "14px", color: "#666" }}>팔로워가 저장한 장소</div>
            </div>
            <div style={{
              backgroundColor: "#222",
              padding: "20px",
              borderRadius: "8px",
              textAlign: "center"
            }}>
              <div style={{ fontSize: "24px", fontWeight: "bold", color: "#2ECC71" }}>
                {stats.totalPlaces}
              </div>
              <div style={{ fontSize: "14px", color: "#666" }}>올린 장소 수</div>
            </div>
            <div style={{
              backgroundColor: "#222",
              padding: "20px",
              borderRadius: "8px",
              textAlign: "center"
            }}>
              <div style={{ fontSize: "24px", fontWeight: "bold", color: "#2ECC71" }}>
                {stats.overlappingPlaces}
              </div>
              <div style={{ fontSize: "14px", color: "#666" }}>겹친 장소 수</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#111111",
    color: "#ffffff",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  topBar: {
    display: "flex",
    gap: "8px",
    padding: "12px 20px",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: "16px",
    marginTop: "20px",
    overflowX: "auto",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
    justifyContent: "center",
    flexWrap: "wrap",
  },
  topBarButton: {
    border: "1px solid rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    borderRadius: "12px",
    padding: "10px 20px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
    transition: "all 0.3s ease",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
  },
  header: {
    padding: "24px 20px",
    borderBottom: "1px solid #222222",
    textAlign: "center",
  },
  title: {
    fontSize: "24px",
    fontWeight: 800,
    margin: "0 0 8px 0",
  },
  subtitle: {
    fontSize: "14px",
    color: "#bdbdbd",
    margin: 0,
  },
  content: {
    padding: "20px",
    maxWidth: "900px",
    margin: "0 auto",
  },
  section: {
    marginBottom: "32px",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  sectionTitle: {
    fontSize: "18px",
    fontWeight: 700,
    margin: 0,
  },
  sectionActions: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  sortSelect: {
    border: "1px solid #333333",
    borderRadius: "8px",
    padding: "6px 12px",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    fontSize: "12px",
  },
  viewAllButton: {
    border: "1px solid #444444",
    backgroundColor: "transparent",
    color: "#ffffff",
    borderRadius: "8px",
    padding: "6px 12px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  quickActions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    marginBottom: "16px",
  },
  quickActionsHorizontal: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    marginBottom: "16px",
    flexWrap: "wrap",
  },
  primaryButton: {
    border: "none",
    backgroundColor: "#2ECC71",
    color: "#111111",
    borderRadius: "12px",
    padding: "12px 24px",
    fontSize: "14px",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #444444",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    borderRadius: "12px",
    padding: "12px 24px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  tertiaryButton: {
    border: "1px solid #666666",
    backgroundColor: "transparent",
    color: "#ffffff",
    borderRadius: "12px",
    padding: "12px 24px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  quickStats: {
    display: "flex",
    gap: "24px",
  },
  quickStat: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  quickStatNumber: {
    fontSize: "24px",
    fontWeight: 800,
    color: "#2ECC71",
  },
  quickStatLabel: {
    fontSize: "12px",
    color: "#bdbdbd",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  card: {
    border: "1px solid #222222",
    borderRadius: "12px",
    padding: "16px",
    backgroundColor: "#1a1a1a",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: "16px",
    fontWeight: 700,
    marginBottom: "4px",
  },
  cardMeta: {
    fontSize: "12px",
    color: "#bdbdbd",
    marginBottom: "8px",
  },
  cardDescription: {
    fontSize: "14px",
    color: "#ffffff",
    lineHeight: 1.4,
    marginBottom: "8px",
  },
  cardTags: {
    display: "flex",
    gap: "6px",
    marginBottom: "8px",
    flexWrap: "wrap",
  },
  tag: {
    backgroundColor: "#333333",
    color: "#ffffff",
    borderRadius: "12px",
    padding: "4px 8px",
    fontSize: "11px",
    fontWeight: 600,
  },
  cardStats: {
    display: "flex",
    gap: "16px",
    marginBottom: "8px",
  },
  cardStat: {
    fontSize: "12px",
    color: "#bdbdbd",
  },
  cardActions: {
    display: "flex",
    gap: "8px",
    flexShrink: 0,
  },
  editButton: {
    border: "1px solid #444444",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  deleteButton: {
    border: "1px solid #FF6B6B",
    backgroundColor: "transparent",
    color: "#FF6B6B",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  viewButton: {
    border: "1px solid #2ECC71",
    backgroundColor: "transparent",
    color: "#2ECC71",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  emptyState: {
    textAlign: "center",
    padding: "40px 20px",
    color: "#bdbdbd",
  },
  emptyIcon: {
    fontSize: "48px",
    marginBottom: "16px",
  },
  emptyText: {
    fontSize: "16px",
    marginBottom: "20px",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "16px",
    marginBottom: "32px",
  },
  statCard: {
    border: "1px solid #222222",
    borderRadius: "12px",
    padding: "20px",
    backgroundColor: "#1a1a1a",
    textAlign: "center",
  },
  statIcon: {
    fontSize: "24px",
    marginBottom: "8px",
  },
  statNumber: {
    fontSize: "28px",
    fontWeight: 800,
    marginBottom: "4px",
    color: "#2ECC71",
  },
  statLabel: {
    fontSize: "12px",
    color: "#bdbdbd",
  },
  recentActivity: {
    border: "1px solid #222222",
    borderRadius: "12px",
    padding: "20px",
    backgroundColor: "#1a1a1a",
  },
  activityTitle: {
    fontSize: "16px",
    fontWeight: 700,
    margin: "0 0 16px 0",
  },
  activityList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  activityItem: {
    display: "flex",
    gap: "12px",
    alignItems: "flex-start",
  },
  activityIcon: {
    fontSize: "16px",
    flexShrink: 0,
  },
  activityText: {
    flex: 1,
    fontSize: "14px",
    lineHeight: 1.4,
  },
  activityTime: {
    fontSize: "12px",
    color: "#bdbdbd",
    flexShrink: 0,
  },
  stepGuide: {
    border: "1px solid #222222",
    borderRadius: "12px",
    padding: "20px",
    backgroundColor: "#1a1a1a",
    marginTop: "16px",
  },
  stepGuideTitle: {
    fontSize: "16px",
    fontWeight: 700,
    margin: "0 0 16px 0",
  },
  stepGuideSteps: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  stepGuideStep: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "16px",
    border: "1px solid #333333",
    borderRadius: "12px",
    backgroundColor: "#222222",
  },
  stepNumber: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    backgroundColor: "#2ECC71",
    fontSize: "16px",
    fontWeight: 700,
    marginBottom: "4px",
  },
  stepDescription: {
    fontSize: "14px",
    color: "#bdbdbd",
  },
  stepButton: {
    border: "1px solid #444444",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    borderRadius: "8px",
    padding: "8px 16px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    flexShrink: 0,
  },
  "stepButton:disabled": {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  welcomeSection: {
    textAlign: "center",
    padding: "60px 20px",
  },
  welcomeIcon: {
    fontSize: "64px",
    marginBottom: "16px",
  },
  welcomeTitle: {
    fontSize: "24px",
    fontWeight: 700,
    margin: "0 0 8px 0",
  },
  welcomeText: {
    fontSize: "16px",
    color: "#bdbdbd",
    margin: 0,
  },
};
