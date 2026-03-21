import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
// import { useAuth } from "../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { createClient } from '@supabase/supabase-js';
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

  // 섹션 변경 시 변경사항 확인
  const handleSectionChange = (newSection) => {
    console.log("섹션 변경 시도:", { 
      currentSection: activeSection, 
      newSection, 
      hasUnsavedChanges 
    });
    
    // 잔 리스트에서 공개/비공개 변경 감지
    if (activeSection === "list" && hasUnsavedChanges) {
      const shouldSave = window.confirm("공개/비공개 상태 변경사항이 있습니다. 저장하시겠습니까?\n\n확인: 저장하기\n취소: 저장하지 않음");
      
      if (shouldSave) {
        console.log("저장 선택");
        setHasUnsavedChanges(false);
        setActiveSection(newSection);
      } else {
        console.log("저장 안 함 선택");
        setHasUnsavedChanges(false);
        setActiveSection(newSection);
      }
    } else if (hasUnsavedChanges) {
      const shouldSave = window.confirm("변경사항이 있습니다. 저장하시겠습니까?\n\n확인: 저장하기\n취소: 저장하지 않음");
      
      if (shouldSave) {
        console.log("저장 선택");
        setHasUnsavedChanges(false);
        setActiveSection(newSection);
      } else {
        console.log("저장 안 함 선택");
        setHasUnsavedChanges(false);
        setActiveSection(newSection);
      }
    } else {
      console.log("변경사항 없음 - 바로 이동");
      setActiveSection(newSection);
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
    console.log("🔍 검색 시작:", query);
    
    const apiKey = import.meta.env.VITE_KAKAO_REST_API_KEY;
    console.log("🔑 API 키 확인:", apiKey ? "있음" : "없음");
    console.log("🔑 API 키 길이:", apiKey?.length || 0);

    if (!apiKey) {
      console.error("❌ 카카오 REST API 키가 없습니다.");
      alert("카카오 API 키가 설정되지 않았습니다.");
      return;
    }

    try {
      console.log("📍 주소 검색 시도...");
      // 주소 검색
      const addressResponse = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}&size=1`, {
        headers: {
          "Authorization": `KakaoAK ${apiKey}`
        }
      });
      
      console.log("📋 주소 검색 응답 상태:", addressResponse.status);
      
      if (!addressResponse.ok) {
        console.error("❌ 주소 검색 실패:", addressResponse.status, addressResponse.statusText);
        throw new Error(`주소 검색 실패: ${addressResponse.status}`);
      }

      const addressData = await addressResponse.json();
      console.log("📋 주소 검색 결과:", addressData);

      if (addressData.documents && addressData.documents.length > 0) {
        const firstResult = addressData.documents[0];
        const lat = parseFloat(firstResult.y);
        const lng = parseFloat(firstResult.x);
        
        console.log("✅ 주소 찾음:", { lat, lng, address: firstResult.address_name });
        
        // 상태 업데이트
        setBasicInfo({
          ...basicInfo,
          latitude: lat,
          longitude: lng,
        });
        
        // 지도 중심 이동
        moveMapToLocation(lat, lng);
      } else {
        // 키워드 검색 (장소명으로 검색)
        console.log("🔍 키워드 검색 시도...");
        const keywordResponse = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=1`, {
          headers: {
            "Authorization": `KakaoAK ${apiKey}`
          }
        });
        
        console.log("📋 키워드 검색 응답 상태:", keywordResponse.status);
        
        if (!keywordResponse.ok) {
          console.error("❌ 키워드 검색 실패:", keywordResponse.status, keywordResponse.statusText);
          throw new Error(`키워드 검색 실패: ${keywordResponse.status}`);
        }

        const keywordData = await keywordResponse.json();
        console.log("📋 키워드 검색 결과:", keywordData);

        if (keywordData.documents && keywordData.documents.length > 0) {
          const firstResult = keywordData.documents[0];
          const lat = parseFloat(firstResult.y);
          const lng = parseFloat(firstResult.x);
          
          console.log("✅ 키워드 찾음:", { lat, lng, place: firstResult.place_name });
          
          // 상태 업데이트
          setBasicInfo({
            ...basicInfo,
            latitude: lat,
            longitude: lng,
          });
          
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
  const navigate = useNavigate();
  // const { user } = useAuth(); // 임시로 제거
  const mapRef = useRef(null); // 지도 ref 다시 추가
  
  // 상태 관리
  const [activeSection, setActiveSection] = useState("archive"); // archive, add, list, drafts
  const [myPlaces, setMyPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 변경사항 감지 상태
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [previousSection, setPreviousSection] = useState("archive");
  const [originalPlaceBeforeChange, setOriginalPlaceBeforeChange] = useState(null); // 변경 전 원본 데이터 저장
  
  // DB 저장 함수
  const saveToDatabase = async (updatedPlace) => {
    try {
      const { error } = await supabase
        .from("places")
        .update({ is_public: updatedPlace.is_public })
        .eq("id", updatedPlace.id);
      
      if (error) {
        console.error("❌ DB 저장 오류:", error);
        alert("저장에 실패했습니다: " + error.message);
      } else {
        console.log("✅ DB 저장 성공:", updatedPlace);
        alert("공개/비공개 상태가 저장되었습니다!");
      }
    } catch (error) {
      console.error("❌ 저장 중 오류:", error);
      alert("저장 중 오류가 발생했습니다: " + error.message);
    }
  };
  
  // 섹션 변경 감지 및 저장 확인
  useEffect(() => {
    if (activeSection !== previousSection && hasUnsavedChanges) {
      const shouldSave = window.confirm("공개/비공개 상태 변경사항이 있습니다. 저장하시겠습니까?\n\n확인: 저장하기\n취소: 저장하지 않음");
      
      if (shouldSave) {
        console.log("✅ 저장 선택 - DB 저장 시작");
        // 실제 DB 저장 로직
        if (originalPlaceBeforeChange) {
          const updatedPlace = myPlaces.find(p => p.id === originalPlaceBeforeChange.id);
          if (updatedPlace) {
            saveToDatabase(updatedPlace);
          }
        }
      } else {
        console.log("❌ 저장 안 함 선택 - 원상복구");
        // 변경사항 취소하고 원래 상태로 복원
        if (originalPlaceBeforeChange) {
          setMyPlaces(prevPlaces => 
            prevPlaces.map(place => 
              place.id === originalPlaceBeforeChange.id 
                ? { ...place, is_public: originalPlaceBeforeChange.is_public }
                : place
            )
          );
          console.log("🔄 원상복구 완료:", originalPlaceBeforeChange);
        }
      }
      
      setHasUnsavedChanges(false);
      setOriginalPlaceBeforeChange(null);
    }
    
    setPreviousSection(activeSection);
  }, [activeSection, hasUnsavedChanges, previousSection, originalPlaceBeforeChange]);
  
  // 지도 크기 새로고침
  useEffect(() => {
    if (mapRef.current && activeSection === "add") {
      const timer = setTimeout(() => {
        if (mapRef.current) {
          // 카카오맵이 로드된 경우 강제로 리사이즈
          if (window.kakao && window.kakao.maps) {
            try {
              window.kakao.maps.event.trigger(mapRef.current, 'resize');
            } catch (error) {
              console.log("지도 리사이즈 실패:", error);
            }
          }
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [activeSection]); // activeSection이 변경될 때만 실행

  // 탭 변경 시 폼 초기화
  useEffect(() => {
    if (activeSection === "add") {
      // 잔 올리기 탭으로 이동 시 폼 초기화
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
      
      // 검색 관련 상태도 초기화
      setSearchSuggestions([]);
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
      setSearchedPlaces([]);
      setMapCenter({ lat: 37.5665, lng: 126.9780 }); // 서울시청으로 리셋
      setEditingPlaceId(null);
    }
  }, [activeSection]); // activeSection이 변경될 때마다 실행

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

  // 수정 모드 상태
  const [editingPlaceId, setEditingPlaceId] = useState(null);
  const [originalEditingPlace, setOriginalEditingPlace] = useState(null); // 원본 데이터 저장

  // 잔 리스트 상태
  const [filterType, setFilterType] = useState("all"); // all, public, private
  const [places, setPlaces] = useState([
    { id: 1, name: "테스트 장소 1", category: "한식", is_public: true, created_at: "2024-01-01" },
    { id: 2, name: "테스트 장소 2", category: "일식", is_public: false, created_at: "2024-01-02" },
    { id: 3, name: "테스트 장소 3", category: "중식", is_public: true, created_at: "2024-01-03" },
  ]);

  // 잔 채우기 (임시저장) 상태 - 실제 장소 데이터 사용
  const [drafts, setDrafts] = useState([]);

  // 검색 결과 상태
  const [searchedPlaces, setSearchedPlaces] = useState([]);

  // 지도 중심 상태
  const [mapCenter, setMapCenter] = useState({ lat: 37.5665, lng: 126.9780 }); // 서울시청

  // 지도 기본 장소 (초기 표시용)
  const [defaultPlaces] = useState([
    {
      id: "default1",
      name: "서울시청",
      address: "서울특별시 중구 태평로1가",
      latitude: 37.5665,
      longitude: 126.9780,
      category: "관공서",
      is_public: true,
      created_at: new Date().toISOString().split('T')[0]
    }
  ]);

  // 자동완성 상태
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [isSearchingSuggestions, setIsSearchingSuggestions] = useState(false);

  // 자동완성 검색 함수
  const fetchSuggestions = async (query) => {
    if (!query.trim() || query.length < 2) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearchingSuggestions(true);
    
    try {
      const apiKey = import.meta.env.VITE_KAKAO_REST_API_KEY;
      
      if (!apiKey) {
        console.error("❌ 카카오 REST API 키가 없습니다.");
        setSearchSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      
      // 카카오 장소 검색 API (자동완성용)
      const response = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=5`, {
        headers: {
          "Authorization": `KakaoAK ${apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`검색 실패: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.documents && data.documents.length > 0) {
        const suggestions = data.documents.map(doc => ({
          place_name: doc.place_name,
          address_name: doc.address_name || doc.road_address_name,
          category_name: doc.category_name,
          lat: parseFloat(doc.y),
          lng: parseFloat(doc.x)
        }));
        
        setSearchSuggestions(suggestions);
        setShowSuggestions(true);
        setSelectedSuggestionIndex(-1);
      } else {
        setSearchSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error("자동완성 검색 오류:", error);
      setSearchSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsSearchingSuggestions(false);
    }
  };
  
  // 해시태그 처리 함수
  const handleTagsChange = (value) => {
    console.log("=== 태그 처리 시작 ==="); // 디버깅용
    console.log("입력된 값:", value);
    console.log("trim() 후:", value.trim());
    console.log("기존 태그:", formData.tags);
    
    // 엔터를 누르면 현재 입력값을 태그로 추가
    if (value.trim()) {
      let newTag = value.trim();
      // #이 없으면 자동으로 추가
      if (!newTag.startsWith('#')) {
        newTag = `#${newTag}`;
      }
      console.log("최종 태그:", newTag);
      console.log("중복 체크:", formData.tags.includes(newTag));
      
      // 중복 태그 방지
      if (!formData.tags.includes(newTag)) {
        setFormData(prev => { 
          console.log("태그 추가 전:", prev.tags);
          const newState = { 
            ...prev, 
            tags: [...prev.tags, newTag]
          };
          console.log("태그 추가 후:", newState.tags);
          return newState;
        });
        console.log("태그 추가됨"); // 디버깅용
        // 지연시켜서 충돌 방지
        setTimeout(() => setTagInputValue(""), 0);
      } else {
        console.log("중복 태그라서 추가 안함"); // 디버깅용
        setTimeout(() => setTagInputValue(""), 0);
      }
    } else {
      console.log("값이 비어있어서 태그 추가 안함"); // 디버깅용
      setTimeout(() => setTagInputValue(""), 0);
    }
    console.log("=== 태그 처리 끝 ==="); // 디버깅용
  };

  // 해시태그 입력 핸들러 - 오직 스페이스/엔터만 사용
  const handleTagKeyDown = (e) => {
    console.log("=== 키 이벤트 ==="); // 디버깅용
    console.log("키 누름:", e.key);
    console.log("keyCode:", e.keyCode);
    console.log("isComposing:", e.isComposing);
    console.log("입력창 값:", e.target.value);
    console.log("==============="); // 디버깅용
    
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      const value = e.target.value;
      console.log("스페이스/엔터 감지, 처리할 값:", value); // 디버깅용
      if (value.trim()) {
        handleTagsChange(value);
      } else {
        console.log("값이 비어있어서 처리 안함"); // 디버깅용
      }
    }
  };

  // 한글 입력 처리를 위한 onInput 이벤트
  const handleTagInput = (e) => {
    const value = e.target.value;
    console.log("입력 중:", value, "isComposing:", e.nativeEvent?.isComposing); // 디버깅용
    setTagInputValue(value);
  };

  // 해시태그 삭제 함수
  const removeTag = (tagToRemove) => {
    setFormData(prev => ({ 
      ...prev, 
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  // 해시태그 입력값 관리
  const [tagInputValue, setTagInputValue] = useState("");

  
  // 자동완성 핸들러
  const handleInputChange = (value) => {
    setFormData(prev => ({ ...prev, name_address: value }));
    
    // API를 통해 자동완성 제안 가져오기
    fetchSuggestions(value);
  };

  // 자동완성 선택
  const handleSuggestionClick = (suggestion) => {
    setFormData(prev => ({ 
      ...prev, 
      name_address: suggestion.place_name || suggestion,
      latitude: suggestion.lat || null,
      longitude: suggestion.lng || null
    }));
    setSearchSuggestions([]);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    
    // 지도 중심 이동 (좌표가 있는 경우)
    if (suggestion.lat && suggestion.lng) {
      setMapCenter({ lat: suggestion.lat, lng: suggestion.lng });
    }
  };

  // 키보드 핸들러
  const handleKeyDown = (e) => {
    if (!showSuggestions) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < searchSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => prev > -1 ? prev - 1 : -1);
        break;
      case 'Enter':
        if (selectedSuggestionIndex >= 0) {
          e.preventDefault();
          handleSuggestionClick(searchSuggestions[selectedSuggestionIndex]);
        } else {
          e.preventDefault();
          handleSearch();
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        break;
    }
  };

  // 잔 아카이브 상태
  const [stats, setStats] = useState({
    followerCount: 0,
    savedByFollowers: 0,
    totalPlaces: 0,
    overlappingPlaces: 0,
    isLive: false,
    notificationSent: false
  });

  // 프로필 수정 상태
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editProfile, setEditProfile] = useState({
    name: "",
    username: "",
    displayName: "",
    bio: "",
    image: ""
  });
  const [usernameError, setUsernameError] = useState("");

  // 큐레이터 프로필 상태
  const [curatorProfile, setCuratorProfile] = useState({
    name: "노포킬러", // 검색용 표시 이름
    username: "nopokiller", // @고유이름 (개인 주소)
    displayName: "노포킬러", // 홈에서 표시될 이름
    image: null, // 실제로는 이미지 URL
    bio: "안녕하세요! 맛집 탐험을 좋아하는 큐레이터입니다. 다양한 술집과 맛집을 소개해드릴게요.",
    instagram: "@curator_example"
  });

  useEffect(() => {
    loadStudioData();
  }, []);

  const loadStudioData = async () => {
    try {
      setLoading(true);
      
      // 현재 인증된 사용자 정보 가져오기
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.log("인증된 사용자 없음, 기본 프로필 사용");
        // 인증되지 않은 경우 기본값 사용
        const defaultUser = {
          username: "nopokiller",
          display_name: "노포킬러",
          bio: "안녕하세요! 맛집 탐험을 좋아하는 큐레이터입니다.",
          image: null
        };
        
        setCuratorProfile(prev => ({
          ...prev,
          username: defaultUser.username,
          displayName: defaultUser.display_name,
          bio: defaultUser.bio,
          image: defaultUser.image
        }));
      } else {
        console.log("✅ 인증된 사용자:", user.id);
        
        // 인증된 사용자의 프로필 가져오기
        const { data: profileData, error: profileError } = await supabase
          .from("curators")
          .select("*")
          .eq("user_id", user.id) // user_id로 연결
          .single();
          
        if (profileError && profileError.code !== 'PGRST116') {
          console.log("프로필 데이터 없음, 기본값 사용:", profileError);
        }
        
        const currentUser = profileData || {
          user_id: user.id, // 인증된 사용자 ID 연결
          username: user.user_metadata?.username || user.email?.split('@')[0],
          display_name: user.user_metadata?.display_name || "큐레이터",
          bio: "안녕하세요! 맛집 탐험을 좋아하는 큐레이터입니다.",
          image: null
        };
        
        console.log("📂 프로필 데이터 로드:", currentUser);
        
        setCuratorProfile(prev => ({
          ...prev,
          username: currentUser.username,
          displayName: currentUser.display_name,
          bio: currentUser.bio,
          image: currentUser.image
        }));
      }
      
      console.log("📂 스튜디오 데이터 로딩 시작...");
      
      // Supabase에서 저장된 장소 불러오기
      const { data: placesData, error: placesError } = await supabase
        .from("places")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000); // 캐시 방지를 위한 limit 추가

      if (placesError) {
        console.error("❌ 장소 로딩 오류:", placesError);
      } else {
        console.log("✅ 불러온 장소 데이터:", placesData);
        
        // DB 데이터를 myPlaces 형식으로 변환
        const formattedPlaces = placesData.map(place => {
          console.log("🔍 DB 장소 데이터:", { id: place.id, name: place.name, is_public: place.is_public });
          
          return {
            id: place.id,
            name: place.name,
            address: place.address || place.name,
            latitude: place.lat,
            longitude: place.lng,
            category: place.category || "미분류",
            alcohol_type: place.alcohol_type || "",
            atmosphere: place.atmosphere || "",
            recommended_menu: place.recommended_menu || "",
            menu_reason: place.menu_reason || "",
            tags: place.tags || [],
            is_public: place.is_public, // DB에서 가져온 is_public 값
            created_at: place.created_at ? new Date(place.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          };
        });
        
        setMyPlaces(formattedPlaces);
        console.log("✅ myPlaces 업데이트 완료:", formattedPlaces);
        
        // myPlaces 업데이트 후 drafts 동기화
        setDrafts(formattedPlaces.map(place => ({
          id: place.id,
          basicInfo: {
            name_address: place.name,
            category: place.category
          },
          createdAt: place.created_at
        })));
        console.log("✅ drafts 동기화 완료:", formattedPlaces.length, "개 장소");
      }
      
      setLoading(false);
    } catch (error) {
      console.error("❌ Studio data loading error:", error);
      setLoading(false);
    }
  };

  const handleAddPlace = async (isDraft = false) => {
    try {
      // 필수 필드 확인
      if (!formData.name_address || !formData.latitude || !formData.longitude) {
        alert("장소 이름과 위치를 선택해주세요.");
        return;
      }

      // 중복 확인 (로컬 상태)
      const duplicateCheck = checkDuplicatePlace(formData.name_address);
      if (duplicateCheck) {
        return;
      }

      console.log("🔍 StudioHome 저장 시작:", { ...formData, isDraft });
      
      if (!isDraft) {
        // 수정 모드인 경우 DB 중복 확인 건너뛰기
        if (!editingPlaceId) {
          // DB에서도 중복 확인
          const { data: existingPlaces, error: checkError } = await supabase
            .from("places")
            .select("id, name")
            .ilike("name", `%${formData.name_address.trim()}%`);

          if (checkError) {
            console.error("❌ 중복 확인 오류:", checkError);
          } else if (existingPlaces && existingPlaces.length > 0) {
            console.log("⚠️ DB에 이미 존재하는 장소:", existingPlaces);
            alert("이미 저장된 장소입니다.");
            return;
          }
        }
        // 실제 저장인 경우 Supabase에 저장
        // 임시 큐레이터 ID (실제로는 인증된 사용자 ID 사용)
        const curatorId = "00000000-0000-0000-0000-000000000000";
        
        if (editingPlaceId) {
          // 수정 모드: UPDATE 사용
          const updateData = {
            name: formData.name_address,
            address: formData.name_address,
            lat: formData.latitude,
            lng: formData.longitude,
            comment: formData.menu_reason || null
          };
          
          console.log("📝 수정할 데이터:", updateData);
          
          const { data, error } = await supabase
            .from("places")
            .update(updateData)
            .eq("id", editingPlaceId)
            .select();

          if (error) {
            console.error("❌ 장소 수정 오류:", error);
            console.error("❌ 에러 상세:", error.message, error.code, error.details);
            alert(`장소 수정에 실패했습니다: ${error.message}`);
            return;
          }

          console.log("✅ 장소 수정 성공:", data);
          
          // 로컬 상태 업데이트
          setMyPlaces(prev => prev.map(place => 
            place.id === editingPlaceId 
              ? { ...place, ...updateData, latitude: updateData.lat, longitude: updateData.lng }
              : place
          ));
          
          alert("장소가 성공적으로 수정되었습니다!");
          
          // 수정 모드 종료
          setEditingPlaceId(null);
          
        } else {
          // 새로 추가 모드: INSERT 사용
          const newPlaceData = {
            name: formData.name_address,
            address: formData.name_address,
            lat: formData.latitude,
            lng: formData.longitude,
            comment: formData.menu_reason || null,
            tags: formData.tags || [],
            region: "지정안됨",
            saved_count: 0
          };
          
          console.log("📝 저장할 데이터:", newPlaceData);
          
          const { data, error } = await supabase
            .from("places")
            .insert([newPlaceData])
            .select();

          if (error) {
            console.error("❌ 장소 저장 오류:", error);
            alert(`장소 저장에 실패했습니다: ${error.message}`);
            return;
          }

          console.log("✅ 장소 저장 성공:", data);
        
        // 성공적으로 저장된 경우 (새로 추가만 해당)
        if (!editingPlaceId && data && data.length > 0) {
          // myPlaces에 새 장소 추가
          const savedPlace = {
            id: data[0].id,
            name: data[0].name,
            address: data[0].address,
            latitude: data[0].lat,
            longitude: data[0].lng,
            category: formData.category,
            alcohol_type: formData.alcohol_type,
            atmosphere: formData.atmosphere,
            recommended_menu: formData.recommended_menu,
            menu_reason: formData.menu_reason,
            tags: formData.tags || [], // 폼의 태그 데이터 사용
            is_public: formData.is_public,
            created_at: data[0].created_at ? new Date(data[0].created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          };
          
          setMyPlaces(prev => [savedPlace, ...prev]);
          console.log("✅ 장소 리스트에 추가 완료:", savedPlace);
          
          // 잔 채우기 목록 동기화
          setDrafts(prev => {
            const newDrafts = [savedPlace, ...myPlaces].map(place => ({
              id: place.id,
              basicInfo: {
                name_address: place.name,
                category: place.category
              },
              createdAt: place.created_at
            }));
            return newDrafts;
          });
          
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
          
          setSearchedPlaces([]);
          setMapCenter({ lat: 37.5665, lng: 126.9780 }); // 서울시청으로 리셋
          setEditingPlaceId(null); // 수정 모드 종료
          
          alert("장소가 성공적으로 저장되었습니다!");
          
          // "잔 리스트" 탭으로 자동 이동
          setActiveSection("list");
        }
        }
      } else {
        // 임시저장인 경우
        const draftData = {
          id: Date.now().toString(),
          basicInfo: {
            name_address: formData.name_address,
            category: formData.category,
            alcohol_type: formData.alcohol_type,
            atmosphere: formData.atmosphere,
            recommended_menu: formData.recommended_menu,
            menu_reason: formData.menu_reason,
            tags: formData.tags,
            latitude: formData.latitude,
            longitude: formData.longitude,
            is_public: formData.is_public
          },
          createdAt: new Date().toLocaleString('ko-KR')
        };
        
        setDrafts(prev => [...prev, draftData]);
        console.log("✅ 임시저장 완료:", draftData);
        alert("초안이 임시저장되었습니다.");
        
        // '잔 채우기' 탭으로 자동 이동
        setActiveSection("drafts");
      }
      
    } catch (error) {
      console.error("❌ 저장 오류:", error);
      alert("저장 중 오류가 발생했습니다: " + error.message);
    }
  };

  const checkDuplicatePlace = (placeName) => {
    // 수정 모드인 경우 중복 확인 건너뛰기
    if (editingPlaceId) {
      console.log("✏️ 수정 모드: 중복 확인 건너뛰기");
      return false;
    }
    
    // myPlaces에서 중복 확인
    const duplicate = myPlaces.find(place => 
      place.name.toLowerCase().trim() === placeName.toLowerCase().trim()
    );
    
    if (duplicate) {
      console.log("⚠️ 중복된 장소:", duplicate.name);
      alert("이미 저장된 장소입니다.");
      return true;
    }
    
    return false;
  };

  const handleTogglePublic = async (placeId) => {
    try {
      console.log("🔄 공개/비공개 토글:", placeId);
      
      // 변경 전 원본 데이터 저장
      const originalPlace = myPlaces.find(p => p.id === placeId);
      if (originalPlace) {
        setOriginalPlaceBeforeChange(JSON.parse(JSON.stringify(originalPlace)));
        console.log("💾 변경 전 원본 데이터 저장:", originalPlace);
      }
      
      // 1. 로컬 상태 업데이트
      setMyPlaces(prevPlaces => 
        prevPlaces.map(place => 
          place.id === placeId 
            ? { ...place, is_public: !place.is_public }
            : place
        )
      );
      
      // 2. 변경사항 상태 설정
      setHasUnsavedChanges(true);
      console.log("⚠️ 공개/비공개 상태 변경 - hasUnsavedChanges 설정");
      
      // 3. DB 업데이트는 임시로 제외 (is_public 필드가 DB에 없음)
      // TODO: 나중에 is_public 필드를 DB에 추가하거나 별도 테이블로 관리
      console.log("✅ 공개/비공개 상태가 로컬에서 변경되었습니다.");
      
    } catch (error) {
      console.error("❌ 토글 오류:", error);
    }
  };

  const handleDeletePlace = async (placeId) => {
    try {
      // 확인 대화상자
      const confirmed = window.confirm("정말로 이 장소를 삭제하시겠습니까?");
      if (!confirmed) return;
      
      console.log("🗑️ 장소 삭제:", placeId);
      
      // 1. DB에서 삭제
      const { error } = await supabase
        .from("places")
        .delete()
        .eq("id", placeId);
        
      if (error) {
        console.error("❌ 장소 삭제 오류:", error);
        alert("장소 삭제에 실패했습니다: " + error.message);
        return;
      }
      
      // 2. 로컬 상태에서 삭제
      setMyPlaces(prevPlaces => prevPlaces.filter(place => place.id !== placeId));
      
      // 잔 채우기 목록에서도 삭제
      setDrafts(prevDrafts => prevDrafts.filter(draft => draft.id !== placeId));
      
      console.log("✅ 장소 삭제 성공");
      alert("장소가 삭제되었습니다.");
      
    } catch (error) {
      console.error("❌ 삭제 오류:", error);
      alert("삭제 중 오류가 발생했습니다: " + error.message);
    }
  };

  const handleEditPlace = (place) => {
    try {
      console.log("✏️ 장소 수정:", place);
      
      // 수정 모드 설정
      setEditingPlaceId(place.id);
      
      // 수정할 장소 데이터를 폼에 로드
      setFormData({
        name_address: place.name,
        category: place.category || "",
        alcohol_type: place.alcohol_type || "",
        atmosphere: place.atmosphere || "",
        recommended_menu: place.recommended_menu || "",
        menu_reason: place.menu_reason || "",
        tags: place.tags || [],
        latitude: place.latitude,
        longitude: place.longitude,
        is_public: place.is_public
      });
      
      // 지도 중심을 해당 장소로 이동
      setMapCenter({ lat: place.latitude, lng: place.longitude });
      
      // '잔 올리기' 탭으로 이동
      setActiveSection("add");
      
      alert("장소 정보를 수정할 수 있습니다. 수정 후 다시 저장해주세요.");
      
    } catch (error) {
      console.error("❌ 수정 로딩 오류:", error);
      alert("수정 로딩에 실패했습니다: " + error.message);
    }
  };

  const handleEditProfile = () => {
    setIsEditingProfile(true);
    setEditProfile({
      name: curatorProfile.name,
      username: curatorProfile.username,
      displayName: curatorProfile.displayName,
      bio: curatorProfile.bio,
      image: curatorProfile.image || ""
    });
    setUsernameError("");
  };

  const handleSaveProfile = async () => {
    try {
      // 현재 인증된 사용자 정보 가져오기
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        alert("로그인이 필요합니다.");
        return;
      }
      
      // username 중복 확인
      if (editProfile.username !== curatorProfile.username) {
        // 실제로는 서버 API 호출로 중복 확인
        console.log("username 중복 확인 필요:", editProfile.username);
      }
      
      // Supabase에 프로필 저장 (인증된 사용자와 연결)
      const profileData = {
        user_id: user.id, // 인증된 사용자 ID 연결
        username: editProfile.username,
        slug: editProfile.username, // slug 필드 추가
        name: editProfile.displayName || editProfile.username, // name 필드 추가 (displayName 우선)
        display_name: editProfile.displayName,
        bio: editProfile.bio,
        image: editProfile.image || null,
        updated_at: new Date().toISOString()
      };
      
      console.log("📝 프로필 DB 저장:", profileData);
      
      const { data, error } = await supabase
        .from("curators")
        .upsert([profileData], { onConflict: 'user_id' }) // user_id 기준으로 upsert
        .select();
        
      if (error) {
        console.error("❌ 프로필 저장 오류:", error);
        alert("프로필 저장에 실패했습니다: " + error.message);
        return;
      }
      
      console.log("✅ 프로필 DB 저장 성공:", data);
      
      // 로컬 상태 업데이트
      setCuratorProfile(prev => ({
        ...prev,
        name: editProfile.name,
        username: editProfile.username,
        displayName: editProfile.displayName,
        bio: editProfile.bio,
        image: editProfile.image
      }));
      
      setIsEditingProfile(false);
      setUsernameError("");
      console.log("프로필 업데이트 완료:", editProfile);
      alert("프로필이 성공적으로 저장되었습니다!");
      
    } catch (error) {
      console.error("❌ 프로필 저장 오류:", error);
      alert("프로필 저장에 실패했습니다: " + error.message);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingProfile(false);
    setEditProfile({
      name: "",
      username: "",
      displayName: "",
      bio: "",
      image: ""
    });
    setUsernameError("");
  };

  const validateUsername = (username) => {
    // 영문 소문자, 숫자, 언더스코어만 허용
    const usernameRegex = /^[a-z0-9_]+$/;
    return usernameRegex.test(username);
  };

  const handleUsernameChange = (value) => {
    const cleanUsername = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setEditProfile(prev => ({ ...prev, username: cleanUsername }));
    
    // 유효성 검사
    if (cleanUsername && !validateUsername(cleanUsername)) {
      setUsernameError("영문 소문자, 숫자, 언더스코어만 사용 가능합니다.");
    } else if (cleanUsername && cleanUsername.length < 3) {
      setUsernameError("최소 3자 이상 입력해주세요.");
    } else if (cleanUsername && cleanUsername.length > 20) {
      setUsernameError("최대 20자까지 가능합니다.");
    } else {
      setUsernameError("");
    }
  };

  const generateUsername = (name) => {
    // 이름에서 username 생성 (한글 제거, 영문만, 소문자, 언더스코어)
    const baseName = name.toLowerCase()
      .replace(/[^a-z0-9가-힣]/g, '') // 특수문자 제거
      .replace(/\s+/g, '_') // 공백을 언더스코어로
      .slice(0, 10); // 최대 10자
    
    // 랜덤 숫자 추가
    const randomNum = Math.floor(Math.random() * 1000);
    return `${baseName}_${randomNum}`;
  };

  const handleUpdateUsername = () => {
    // 자동으로 username 생성
    const newUsername = generateUsername(curatorProfile.name);
    setEditProfile(prev => ({ ...prev, username: newUsername }));
    setUsernameError("");
    console.log("자동 username 생성:", newUsername);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // 파일 크기 확인 (5MB 제한)
      if (file.size > 5 * 1024 * 1024) {
        alert("파일 크기는 5MB 이하여야 합니다.");
        return;
      }

      // 파일 타입 확인
      if (!file.type.startsWith('image/')) {
        alert("이미지 파일만 업로드할 수 있습니다.");
        return;
      }

      // 파일 리더로 이미지 미리보기
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageUrl = event.target.result;
        setEditProfile(prev => ({ ...prev, image: imageUrl }));
        console.log("이미지 업로드 완료:", file.name);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditDraft = (draft) => {
    // 초안 수정 로직
    console.log("Edit draft:", draft);
    // 잔 올리기 섹션으로 이동하면서 초안 데이터 로드
    setActiveSection("add");
    // 초안 데이터를 폼에 로드하는 로직 (추후 구현)
  };

  const handleDeleteDraft = (draftId) => {
    // 초안 삭제 로직
    console.log("Delete draft:", draftId);
    setDrafts(prev => prev.filter(draft => draft.id !== draftId));
  };

  const handleSearch = async () => {
    if (!formData.name_address.trim()) {
      alert("검색어를 입력해주세요.");
      return;
    }
    
    console.log("🔍 StudioHome 검색 시작:", formData.name_address);
    
    const apiKey = import.meta.env.VITE_KAKAO_REST_API_KEY;
    console.log("🔑 API 키 확인:", apiKey ? "있음" : "없음");

    if (!apiKey) {
      console.error("❌ 카카오 REST API 키가 없습니다.");
      alert("카카오 API 키가 설정되지 않았습니다.");
      return;
    }

    try {
      console.log("📍 주소 검색 시도...");
      // 주소 검색
      const addressResponse = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(formData.name_address)}&size=1`, {
        headers: {
          "Authorization": `KakaoAK ${apiKey}`
        }
      });
      
      console.log("📋 주소 검색 응답 상태:", addressResponse.status);
      
      if (!addressResponse.ok) {
        console.error("❌ 주소 검색 실패:", addressResponse.status, addressResponse.statusText);
        throw new Error(`주소 검색 실패: ${addressResponse.status}`);
      }

      const addressData = await addressResponse.json();
      console.log("📋 주소 검색 결과:", addressData);

      if (addressData.documents && addressData.documents.length > 0) {
        const firstResult = addressData.documents[0];
        const lat = parseFloat(firstResult.y);
        const lng = parseFloat(firstResult.x);
        
        console.log("✅ 주소 찾음:", { lat, lng, address: firstResult.address_name });
        
        // 상태 업데이트
        setFormData(prev => ({
          ...prev,
          name_address: firstResult.address_name || formData.name_address,
          latitude: lat,
          longitude: lng
        }));
        
        setMapCenter({ lat, lng });
        
        // 검색 결과를 places에 추가
        setSearchedPlaces([{
          place_name: firstResult.address_name || formData.name_address,
          address_name: firstResult.address_name,
          y: lat.toString(),
          x: lng.toString()
        }]);
        
      } else {
        // 키워드 검색 (장소명으로 검색)
        console.log("🔍 키워드 검색 시도...");
        const keywordResponse = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(formData.name_address)}&size=1`, {
          headers: {
            "Authorization": `KakaoAK ${apiKey}`
          }
        });
        
        console.log("📋 키워드 검색 응답 상태:", keywordResponse.status);
        
        if (!keywordResponse.ok) {
          console.error("❌ 키워드 검색 실패:", keywordResponse.status, keywordResponse.statusText);
          throw new Error(`키워드 검색 실패: ${keywordResponse.status}`);
        }

        const keywordData = await keywordResponse.json();
        console.log("📋 키워드 검색 결과:", keywordData);

        if (keywordData.documents && keywordData.documents.length > 0) {
          const firstResult = keywordData.documents[0];
          const lat = parseFloat(firstResult.y);
          const lng = parseFloat(firstResult.x);
          
          console.log("✅ 키워드 찾음:", { lat, lng, place: firstResult.place_name });
          
          // 상태 업데이트
          setFormData(prev => ({
            ...prev,
            name_address: firstResult.place_name,
            latitude: lat,
            longitude: lng
          }));
          
          setMapCenter({ lat, lng });
          
          // 검색 결과를 places에 추가
          const searchResult = [{
            place_name: firstResult.place_name,
            address_name: firstResult.address_name,
            y: lat.toString(),
            x: lng.toString()
          }];
          
          console.log("🔍 검색 결과 데이터:", searchResult);
          setSearchedPlaces(searchResult);
          
        } else {
          console.warn("⚠️ 검색 결과 없음");
          alert("검색 결과를 찾을 수 없습니다. 지도를 클릭하여 위치를 선택해주세요.");
        }
      }
    } catch (error) {
      console.error("❌ StudioHome 검색 오류:", error);
      alert("검색 중 오류가 발생했습니다: " + error.message);
    }
  };

  const handleSelectPlace = (place) => {
    setFormData(prev => ({
      ...prev,
      name_address: place.place_name,
      latitude: parseFloat(place.y),
      longitude: parseFloat(place.x)
    }));
    setSearchedPlaces([]);
    setMapCenter({ lat: parseFloat(place.y), lng: parseFloat(place.x) });
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
        @{curatorProfile.username}님의 스튜디오
      </h1>
      
      {/* 섹션 선택 버튼 */}
      <div style={{
        ...styles.topBar,
        margin: "20px",
        marginBottom: "40px",
        width: "calc(100% - 40px)",
        boxSizing: "border-box"
      }}>
        <button
          onClick={() => setActiveSection("add")}
          style={{
            ...styles.topBarButton,
            ...(activeSection === "add" ? styles.topBarButtonActive : {}),
            ':hover': styles.topBarButtonHover
          }}
        >
          잔 올리기
        </button>
        <button
          onClick={() => setActiveSection("list")}
          style={{
            ...styles.topBarButton,
            ...(activeSection === "list" ? styles.topBarButtonActive : {}),
            ':hover': styles.topBarButtonHover
          }}
        >
          잔 리스트
        </button>
        <button
          onClick={() => setActiveSection("drafts")}
          style={{
            ...styles.topBarButton,
            ...(activeSection === "drafts" ? styles.topBarButtonActive : {}),
            ':hover': styles.topBarButtonHover
          }}
        >
          잔 채우기
        </button>
        <button
          onClick={() => setActiveSection("archive")}
          style={{
            ...styles.topBarButton,
            ...(activeSection === "archive" ? styles.topBarButtonActive : {}),
            ':hover': styles.topBarButtonHover
          }}
        >
          잔 아카이브
        </button>
      </div>

      {/* 잔 올리기 섹션 */}
      {activeSection === "add" && (
        <div style={{ 
          textAlign: "left", 
          margin: "0 20px",
          width: "calc(100% - 40px)"
        }}>
          {/* 장소/주소 검색 */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "600" }}>장소 또는 주소 검색</label>
            <div style={{ position: "relative", zIndex: 1000 }}>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <input
                    type="text"
                    value={formData.name_address}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                      if (formData.name_address.trim()) {
                        fetchSuggestions(formData.name_address);
                      }
                    }}
                    onBlur={() => {
                      setTimeout(() => {
                        setShowSuggestions(false);
                        setSelectedSuggestionIndex(-1);
                      }, 200);
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 35px 10px 10px",
                      border: "1px solid #333",
                      borderRadius: "6px",
                      backgroundColor: "#222",
                      color: "white",
                      fontSize: "14px",
                      zIndex: 1001,
                      boxSizing: "border-box"
                    }}
                    placeholder="장소 이름 또는 주소를 입력하세요"
                    tabIndex={1}
                  />
                  {formData.name_address && (
                    <button
                      onClick={() => {
                        setFormData(prev => ({ ...prev, name_address: "" }));
                        setSearchSuggestions([]);
                        setShowSuggestions(false);
                        setSelectedSuggestionIndex(-1);
                      }}
                      style={{
                        position: "absolute",
                        right: "6px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        color: "#666",
                        cursor: "pointer",
                        fontSize: "16px",
                        padding: "2px",
                        zIndex: 1002
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
                <button
                  onClick={handleSearch}
                  style={{
                    padding: "10px 16px",
                    backgroundColor: "#2ECC71",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: "600",
                    whiteSpace: "nowrap",
                    zIndex: 1001,
                    flexShrink: 0
                  }}
                  tabIndex={2}
                >
                  🔍 검색
                </button>
              </div>
              
              {/* 자동완성 리스트 */}
              {showSuggestions && (
                <div style={{
                  position: "absolute",
                  top: "100%",
                  left: "0",
                  right: "0",
                  backgroundColor: "#333",
                  border: "1px solid #444",
                  borderTop: "none",
                  borderRadius: "0 0 6px 6px",
                  maxHeight: "180px",
                  overflowY: "auto",
                  zIndex: 1000,
                  marginTop: "1px"
                }}>
                  {searchSuggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      style={{
                        padding: "8px 10px",
                        cursor: "pointer",
                        backgroundColor: index === selectedSuggestionIndex ? "#444" : "transparent",
                        color: index === selectedSuggestionIndex ? "#2ECC71" : "white",
                        fontSize: "13px",
                        transition: "background-color 0.2s ease"
                      }}
                      onMouseEnter={() => setSelectedSuggestionIndex(index)}
                      onMouseLeave={() => setSelectedSuggestionIndex(-1)}
                    >
                      <div style={{ fontWeight: "bold", marginBottom: "2px" }}>
                        🔍 {suggestion.place_name}
                      </div>
                      {suggestion.address_name && (
                        <div style={{ fontSize: "11px", color: "#999" }}>
                          {suggestion.address_name}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 지도 영역 */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "600" }}>위치 선택 (지도를 클릭하세요)</label>
            <div style={{ 
              height: "400px", 
              width: "100%",
              borderRadius: "8px", 
              overflow: "hidden",
              border: "1px solid #333",
              backgroundColor: "#f0f0f0"
            }}>
              <MapView
                key={`map-${activeSection}`}
                ref={mapRef}
                places={searchedPlaces.length > 0 ? searchedPlaces.map(place => ({
                  id: place.place_name,
                  name: place.place_name,
                  address: place.address_name,
                  latitude: parseFloat(place.y),
                  longitude: parseFloat(place.x),
                  category: "",
                  is_public: true,
                  created_at: new Date().toISOString().split('T')[0]
                })) : defaultPlaces}
                center={mapCenter}
                style={{ 
                  width: "100%", 
                  height: "100%",
                  display: "block"
                }}
              />
            </div>
            {formData.latitude && formData.longitude && (
              <div style={{ marginTop: "10px", color: "#666", fontSize: "12px" }}>
                선택된 좌표: {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
              </div>
            )}
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
                fontSize: "16px",
                outline: "none",
                boxSizing: "border-box"
              }}
              tabIndex={3}
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
                fontSize: "16px",
                outline: "none",
                boxSizing: "border-box"
              }}
              tabIndex={4}
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
            <select
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
                outline: "none",
                boxSizing: "border-box"
              }}
              tabIndex={5}
            >
              <option value="">선택하세요</option>
              <option value="조용한">조용한</option>
              <option value="활기찬">활기찬</option>
              <option value="아기자기한">아기자기한</option>
              <option value="세련된">세련된</option>
              <option value="편안한">편안한</option>
              <option value="로맨틱한">로맨틱한</option>
              <option value="빈티지">빈티지</option>
              <option value="모던한">모던한</option>
              <option value="전통적인">전통적인</option>
            </select>
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
                resize: "vertical",
                outline: "none",
                boxSizing: "border-box"
              }}
              placeholder="추천하는 이유를 알려주세요"
              tabIndex={6}
            />
          </div>

          {/* 해시태그 */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "600" }}>해시태그</label>
            <input
              type="text"
              value={tagInputValue}
              onInput={handleTagInput}
              onKeyDown={handleTagKeyDown}
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #333",
                borderRadius: "8px",
                backgroundColor: "#222",
                color: "white",
                fontSize: "16px",
                outline: "none",
                boxSizing: "border-box"
              }}
              placeholder="단어를 입력하고 스페이스나 엔터를 누르세요 (#자동 추가)"
              tabIndex={7}
            />
            {/* 태그 목록 */}
            {formData.tags.length > 0 && (
              <div style={{ 
                marginTop: "10px", 
                display: "flex", 
                flexWrap: "wrap", 
                gap: "8px" 
              }}>
                {formData.tags.map((tag, index) => (
                  <div
                    key={index}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "4px 8px",
                      backgroundColor: "#444",
                      borderRadius: "12px",
                      fontSize: "12px",
                      color: "white",
                      border: "1px solid #555"
                    }}
                  >
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      style={{
                        marginLeft: "4px",
                        background: "none",
                        border: "none",
                        color: "#999",
                        cursor: "pointer",
                        fontSize: "10px",
                        padding: "0",
                        lineHeight: "1"
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
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
              tabIndex={8}
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
              tabIndex={9}
            >
              저장
            </button>
          </div>
        </div>
      )}

      {/* 잔 리스트 섹션 */}
      {activeSection === "list" && (
        <div style={{ 
          textAlign: "left", 
          margin: "0 20px",
          width: "calc(100% - 40px)"
        }}>
          {/* 필터 버튼 */}
          <div style={{ 
            display: "flex", 
            gap: "10px", 
            marginBottom: "20px",
            flexWrap: "wrap"
          }}>
            <button
              onClick={() => setFilterType("all")}
              style={{
                padding: "8px 16px",
                backgroundColor: filterType === "all" ? "#2ECC71" : "#444",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px"
              }}
            >
              전체
            </button>
            <button
              onClick={() => setFilterType("public")}
              style={{
                padding: "8px 16px",
                backgroundColor: filterType === "public" ? "#2ECC71" : "#444",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px"
              }}
            >
              공개
            </button>
            <button
              onClick={() => setFilterType("private")}
              style={{
                padding: "8px 16px",
                backgroundColor: filterType === "private" ? "#2ECC71" : "#444",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px"
              }}
            >
              비공개
            </button>
            
            {/* 큐레이터 필터 */}
            {curatorProfile && curatorProfile.username && (
              <button
                onClick={() => setFilterType("curator")}
                style={{
                  padding: "8px 16px",
                  backgroundColor: filterType === "curator" ? "#F39C12" : "#444",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px"
                }}
              >
                @{curatorProfile.username}
              </button>
            )}
          </div>
          
          {/* 장소 리스트 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            {/* 필터링된 myPlaces 데이터 표시 */}
            {(() => {
              let filteredPlaces = myPlaces;
              
              if (filterType === "public") {
                filteredPlaces = myPlaces.filter(place => place.is_public);
              } else if (filterType === "private") {
                filteredPlaces = myPlaces.filter(place => !place.is_public);
              } else if (filterType === "curator") {
                // 큐레이터 필터 - 현재 큐레이터의 장소만 표시
                filteredPlaces = myPlaces; // 현재는 모든 장소가 큐레이터의 장소라고 가정
              }
              
              return filteredPlaces.length === 0 ? (
                <div style={{
                  backgroundColor: "#222",
                  padding: "40px",
                  borderRadius: "8px",
                  textAlign: "center",
                  color: "#666"
                }}>
                  {filterType === "curator" 
                    ? "큐레이터의 장소가 없습니다."
                    : filterType === "public" 
                    ? "공개 장소가 없습니다."
                    : filterType === "private"
                    ? "비공개 장소가 없습니다."
                    : "저장된 장소가 없습니다."
                  }
                </div>
              ) : (
                filteredPlaces.map(place => (
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
              ))
            )})()}
          </div>
        </div>
      )}

      {/* 잔 채우기 (임시저장) 섹션 */}
      {activeSection === "drafts" && (
        <div style={{ 
          textAlign: "left", 
          margin: "0 20px",
          width: "calc(100% - 40px)"
        }}>
          {/* 초안 리스트 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            {/* 임시로 예시 데이터 */}
            {drafts.map(draft => (
              <div key={draft.id} style={{
                backgroundColor: "#222",
                padding: "20px",
                borderRadius: "8px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: "0 0 5px 0", fontSize: "18px", fontWeight: "bold" }}>
                    {draft.basicInfo.name_address}
                  </h3>
                  <p style={{ margin: "0 0 5px 0", color: "#666", fontSize: "14px" }}>
                    {draft.basicInfo.category} • {draft.createdAt}
                  </p>
                  <span style={{
                    display: "inline-block",
                    padding: "4px 8px",
                    backgroundColor: "#F39C12",
                    color: "white",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: "600"
                  }}>
                    초안
                  </span>
                </div>
                
                <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                  {/* 수정 버튼 */}
                  <button
                    onClick={() => handleEditDraft(draft)}
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
                    onClick={() => handleDeleteDraft(draft.id)}
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
                </div>
              </div>
            ))}
            
            {/* 실제 데이터가 없을 때 */}
            {drafts.length === 0 && (
              <div style={{
                textAlign: "center",
                padding: "40px",
                backgroundColor: "#222",
                borderRadius: "8px",
                color: "#666"
              }}>
                임시저장된 초안이 없습니다.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 잔 아카이브 섹션 */}
      {activeSection === "archive" && (
        <div style={{ 
          textAlign: "left", 
          margin: "0 20px",
          width: "calc(100% - 40px)"
        }}>
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
              flexShrink: 0,
              position: "relative",
              overflow: "hidden",
              border: isEditingProfile ? "2px dashed #3498DB" : "none"
            }}>
              {isEditingProfile && (
                <>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      opacity: 0,
                      cursor: "pointer",
                      zIndex: 2
                    }}
                    title="클릭하여 프로필 이미지 업로드"
                  />
                  <div style={{
                    position: "absolute",
                    top: "0",
                    left: "0",
                    right: "0",
                    bottom: "0",
                    backgroundColor: "rgba(0,0,0,0.5)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: 0.7,
                    zIndex: 1,
                    borderRadius: "50%"
                  }}>
                    <span style={{ color: "white", fontSize: "20px" }}>📷</span>
                  </div>
                </>
              )}
              
              {(isEditingProfile ? editProfile.image : curatorProfile.image) ? (
                <img 
                  src={isEditingProfile ? editProfile.image : curatorProfile.image} 
                  alt={curatorProfile.name}
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    objectFit: "cover",
                    position: "relative",
                    zIndex: 0
                  }}
                />
              ) : (
                <div style={{ textAlign: "center", fontSize: "12px", zIndex: 0, position: "relative" }}>
                  사진
                </div>
              )}
            </div>
            
            {/* 프로필 정보 */}
            <div style={{ flex: 1 }}>
              {isEditingProfile ? (
                // 수정 모드
                <div style={{ display: "flex", flexDirection: "column", gap: "15px", maxWidth: "400px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <label style={{ color: "#ccc", fontSize: "14px", fontWeight: "600" }}>
                      표시 이름 (검색용)
                    </label>
                    <input
                      type="text"
                      value={editProfile.displayName}
                      onChange={(e) => setEditProfile(prev => ({ ...prev, displayName: e.target.value }))}
                      placeholder="다른 사용자들에게 표시될 이름"
                      style={{
                        padding: "8px 12px",
                        backgroundColor: "#333",
                        color: "white",
                        border: "1px solid #444",
                        borderRadius: "4px",
                        fontSize: "16px",
                        fontWeight: "600",
                        width: "100%",
                        boxSizing: "border-box",
                        maxWidth: "100%"
                      }}
                    />
                    <div style={{ color: "#666", fontSize: "12px" }}>
                      💡 홈 화면에서 다른 사용자들이 검색하고 볼 수 있는 이름
                    </div>
                  </div>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <label style={{ color: "#ccc", fontSize: "14px", fontWeight: "600" }}>
                      @고유이름 (개인 주소)
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%" }}>
                      <span style={{ color: "#3498DB", fontSize: "16px", fontWeight: "600" }}>@</span>
                      <input
                        type="text"
                        value={editProfile.username}
                        onChange={(e) => handleUsernameChange(e.target.value)}
                        placeholder="개인 주소용 고유 이름"
                        style={{
                          flex: 1,
                          padding: "8px 12px",
                          backgroundColor: "#333",
                          color: "white",
                          border: usernameError ? "1px solid #E74C3C" : "1px solid #444",
                          borderRadius: "4px",
                          fontSize: "16px",
                          fontWeight: "600",
                          boxSizing: "border-box",
                          maxWidth: "250px"
                        }}
                      />
                      <button
                        onClick={handleUpdateUsername}
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "#95A5A6",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: "600",
                          whiteSpace: "nowrap",
                          flexShrink: 0
                        }}
                      >
                        자동생성
                      </button>
                    </div>
                    {usernameError && (
                      <div style={{ color: "#E74C3C", fontSize: "12px", marginTop: "4px" }}>
                        {usernameError}
                      </div>
                    )}
                    <div style={{ color: "#666", fontSize: "12px" }}>
                      💡 영문 소문자, 숫자, 언더스코어만 가능 (3-20자) • 개인 주소로 사용
                    </div>
                  </div>
                  
                  <textarea
                    value={editProfile.bio}
                    onChange={(e) => setEditProfile(prev => ({ ...prev, bio: e.target.value }))}
                    placeholder="소개글"
                    rows={3}
                    style={{
                      padding: "8px 12px",
                      backgroundColor: "#333",
                      color: "white",
                      border: "1px solid #444",
                      borderRadius: "4px",
                      fontSize: "14px",
                      lineHeight: "1.5",
                      resize: "vertical",
                      width: "100%",
                      boxSizing: "border-box",
                      maxWidth: "100%"
                    }}
                  />
                  <div style={{ 
                    fontSize: "12px", 
                    color: "#666", 
                    marginBottom: "10px" 
                  }}>
                    💡 프로필 이미지는 왼쪽 동그라미를 클릭하여 파일을 업로드하세요 (최대 5MB)
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      onClick={handleSaveProfile}
                      disabled={!!usernameError}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: usernameError ? "#95A5A6" : "#2ECC71",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: usernameError ? "not-allowed" : "pointer",
                        fontSize: "12px",
                        fontWeight: "600"
                      }}
                    >
                      저장
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "#E74C3C",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px",
                        fontWeight: "600"
                      }}
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                // 보기 모드
                <>
                  <h3 style={{ margin: "0 0 5px 0", fontSize: "20px", fontWeight: "bold" }}>
                    {curatorProfile.displayName}
                  </h3>
                  <p style={{ margin: "0 0 5px 0", color: "#3498DB", fontSize: "16px", fontWeight: "600" }}>
                    @{curatorProfile.username}
                  </p>
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
                  
                  {/* 프로필 수정 버튼 */}
                  <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
                    <button
                      onClick={handleEditProfile}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "#3498DB",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px",
                        fontWeight: "600",
                        transition: "background-color 0.2s ease"
                      }}
                      onMouseOver={(e) => e.target.style.backgroundColor = "#2980B9"}
                      onMouseOut={(e) => e.target.style.backgroundColor = "#3498DB"}
                    >
                      📝 프로필 수정
                    </button>
                  </div>
                </>
              )}
              
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
    padding: "16px 24px",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: "8px",
    overflowX: "auto",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
    justifyContent: "center",
    flexWrap: "wrap",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.1)",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.15)",
    minHeight: "60px",
    alignItems: "center",
  },
  topBarButton: {
    border: "1px solid rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.9)",
    borderRadius: "8px",
    padding: "12px 24px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
    position: "relative",
    overflow: "hidden",
    textShadow: "0 1px 2px rgba(0, 0, 0, 0.1)"
  },
  topBarButtonActive: {
    border: "1px solid rgba(46, 204, 113, 0.4)",
    backgroundColor: "rgba(46, 204, 113, 0.15)",
    color: "#ffffff",
    boxShadow: "0 8px 32px rgba(46, 204, 113, 0.25)",
    textShadow: "0 1px 2px rgba(46, 204, 113, 0.3)"
  },
  topBarButtonHover: {
    backgroundColor: "rgba(255,255,255,0.12)",
    transform: "translateY(-2px)",
    boxShadow: "0 12px 40px rgba(0, 0, 0, 0.18)"
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
