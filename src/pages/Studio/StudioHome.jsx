import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import MapView from "../../components/Map/MapView";

// 섹션 컴포넌트들
const NewPlaceSection = () => {
  const [step, setStep] = useState(1);
  const mapRef = useRef(null); // 지도 ref 추가
  const [basicInfo, setBasicInfo] = useState({
    name_address: "", // 가게 이름과 주소 합치기
    phone: "",
    category: "",
    alcohol_type: "",
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

  const handleSubmit = () => {
    alert("완료 기능은 곧 구현됩니다!");
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
      latitude: lat,
      longitude: lng,
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
    
    // 지도에 있는 마커도 업데이트
    if (basicInfo.latitude && basicInfo.longitude) {
      const updatedPlace = {
        id: "temp",
        name: value || "새 장소",
        latitude: basicInfo.latitude,
        longitude: basicInfo.longitude,
        address: value || "",
      };
      setMapPlaces([updatedPlace]);
    }
  };

  // 주소 검색 함수
  const searchAddress = async (query) => {
    if (!query.trim()) return;
    
    try {
      // 카카오 REST API 키 확인
      const apiKey = import.meta.env.VITE_KAKAO_REST_API_KEY;
      if (!apiKey) {
        alert("카카오 API 키가 설정되지 않았습니다. 지도를 클릭하여 위치를 선택해주세요.");
        return;
      }
      
      // 카카오 주소 검색 API 사용
      const response = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}`, {
        headers: {
          "Authorization": `KakaoAK ${apiKey}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`API 요청 실패: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.documents && data.documents.length > 0) {
        const firstResult = data.documents[0];
        const lat = parseFloat(firstResult.y);
        const lng = parseFloat(firstResult.x);
        
        // 좌표 업데이트
        setBasicInfo({
          ...basicInfo,
          latitude: lat,
          longitude: lng,
        });
        
        // 지도에 마커 추가
        const newPlace = {
          id: "temp",
          name: query,
          latitude: lat,
          longitude: lng,
          address: firstResult.address_name || query,
        };
        setMapPlaces([newPlace]);
        
        // 성공 메시지
        alert(`"${firstResult.address_name}" 위치를 찾았습니다!`);
        
        // 지도 중심 이동
        moveMapToLocation(lat, lng);
      } else {
        // 키워드 검색 (장소명으로 검색)
        const keywordResponse = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=1`, {
          headers: {
            "Authorization": `KakaoAK ${apiKey}`
          }
        });
        
        if (!keywordResponse.ok) {
          throw new Error(`키워드 검색 실패: ${keywordResponse.status}`);
        }
        
        const keywordData = await keywordResponse.json();
        
        if (keywordData.documents && keywordData.documents.length > 0) {
          const firstResult = keywordData.documents[0];
          const lat = parseFloat(firstResult.y);
          const lng = parseFloat(firstResult.x);
          
          setBasicInfo({
            ...basicInfo,
            latitude: lat,
            longitude: lng,
          });
          
          const newPlace = {
            id: "temp",
            name: firstResult.place_name || query,
            latitude: lat,
            longitude: lng,
            address: firstResult.address_name || firstResult.road_address_name || query,
          };
          setMapPlaces([newPlace]);
          
          alert(`"${firstResult.place_name}" 위치를 찾았습니다!`);
          
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
    searchAddress(basicInfo.name_address);
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
              <div style={sectionStyles.searchWrapper}>
                <input
                  type="text"
                  value={basicInfo.name_address}
                  onChange={(e) => handleNameAddressChange(e.target.value)}
                  placeholder="장소 또는 주소를 입력하세요"
                  style={sectionStyles.searchInput}
                />
                <button
                  type="button"
                  onClick={handleSearch}
                  style={sectionStyles.searchButton}
                >
                  🔍 검색
                </button>
              </div>
            </div>
            
            {/* 지도 */}
            <div style={sectionStyles.mapContainer}>
              <label style={sectionStyles.label}>위치 선택 (지도를 클릭하세요)</label>
              <div style={sectionStyles.mapWrapper}>
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
              <label style={sectionStyles.label}>연락처</label>
              <input
                type="tel"
                value={basicInfo.phone}
                onChange={(e) => setBasicInfo({...basicInfo, phone: e.target.value})}
                placeholder="전화번호를 입력하세요"
                style={sectionStyles.input}
              />
            </div>
            <div style={sectionStyles.formGroup}>
              <label style={sectionStyles.label}>카테고리 *</label>
              <select
                value={basicInfo.category}
                onChange={(e) => setBasicInfo({...basicInfo, category: e.target.value})}
                style={sectionStyles.select}
              >
                <option value="">선택하세요</option>
                <option value="bar">바</option>
                <option value="pub">펍</option>
                <option value="restaurant">레스토랑</option>
                <option value="cafe">카페</option>
              </select>
            </div>
            <div style={sectionStyles.formGroup}>
              <label style={sectionStyles.label}>술 종류</label>
              <select
                value={basicInfo.alcohol_type}
                onChange={(e) => setBasicInfo({...basicInfo, alcohol_type: e.target.value})}
                style={sectionStyles.select}
              >
                <option value="">선택하세요</option>
                <option value="soju">소주</option>
                <option value="beer">맥주</option>
                <option value="wine">와인</option>
                <option value="cocktail">칵테일</option>
              </select>
            </div>
            <div style={sectionStyles.formGroup}>
              <label style={sectionStyles.label}>분위기</label>
              <select
                value={basicInfo.atmosphere}
                onChange={(e) => setBasicInfo({...basicInfo, atmosphere: e.target.value})}
                style={sectionStyles.select}
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
              />
            </div>
            <div style={sectionStyles.formGroup}>
              <label style={sectionStyles.label}>추천 이유</label>
              <textarea
                value={basicInfo.menu_reason}
                onChange={(e) => setBasicInfo({...basicInfo, menu_reason: e.target.value})}
                placeholder="이 메뉴를 추천하는 이유를 설명해주세요"
                style={sectionStyles.textarea}
                rows={3}
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
    gap: "8px",
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
  },
  searchInput: {
    flex: 1,
    border: "1px solid #333333",
    borderRadius: "8px",
    padding: "12px 16px",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    fontSize: "16px",
    outline: "none",
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
  const { user } = useAuth();
  const [curator, setCurator] = useState(null);
  const [myPlaces, setMyPlaces] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [stats, setStats] = useState({
    totalPlaces: 0,
    totalDrafts: 0,
    totalSaved: 0,
    totalViews: 0,
    followerCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState(null); // 현재 활성화된 섹션

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }
    checkCuratorAndLoadData();
  }, [user]);

  const checkCuratorAndLoadData = async () => {
    try {
      // 큐레이터 정보 확인
      const { data: curatorData, error: curatorError } = await supabase
        .from("curators")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (curatorError) {
        navigate("/");
        return;
      }

      setCurator(curatorData);

      // 내 장소 리스트
      const { data: placesData } = await supabase
        .from("places")
        .select("*")
        .eq("curator_id", curatorData.id)
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(10);

      setMyPlaces(placesData || []);

      // 임시저장된 초안
      const { data: draftsData } = await supabase
        .from("places")
        .select("*")
        .eq("curator_id", curatorData.id)
        .eq("is_public", false)
        .order("updated_at", { ascending: false })
        .limit(5);

      setDrafts(draftsData || []);

      // 성과/반응 데이터
      const { data: statsData } = await supabase
        .from("places")
        .select("saved_count, view_count")
        .eq("curator_id", curatorData.id);

      // 팔로워 수
      const { count: followerCount } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("curator_id", curatorData.id);

      // 통계 계산
      const totalSaved = (statsData || []).reduce((sum, place) => sum + (place.saved_count || 0), 0);
      const totalViews = (statsData || []).reduce((sum, place) => sum + (place.view_count || 0), 0);
      
      setStats({
        totalPlaces: (placesData || []).length,
        totalDrafts: (draftsData || []).length,
        totalSaved,
        totalViews,
        followerCount: followerCount || 0,
      });
    } catch (error) {
      console.error("Studio data loading error:", error);
    } finally {
      setLoading(false);
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
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>큐레이터 스튜디오</h1>
        <p style={styles.subtitle}>{curator?.display_name}님의 작업 공간</p>
        
        {/* 맨 위 버튼 */}
        <div style={styles.topBar}>
          <button
            type="button"
            onClick={() => setActiveSection("new-place")}
            style={{
              ...styles.topBarButton,
              backgroundColor: activeSection === "new-place" ? "#2ECC71" : "rgba(255,255,255,0.08)",
              color: activeSection === "new-place" ? "#111111" : "#ffffff",
              borderColor: activeSection === "new-place" ? "#2ECC71" : "rgba(255,255,255,0.1)",
              transform: activeSection === "new-place" ? "translateY(-2px)" : "translateY(0)",
              boxShadow: activeSection === "new-place" ? "0 8px 25px rgba(46, 204, 113, 0.3)" : "none",
            }}
          >
            ⚡ 빠른 추가
          </button>
          <button
            type="button"
            onClick={() => setActiveSection("places")}
            style={{
              ...styles.topBarButton,
              backgroundColor: activeSection === "places" ? "#2ECC71" : "rgba(255,255,255,0.08)",
              color: activeSection === "places" ? "#111111" : "#ffffff",
              borderColor: activeSection === "places" ? "#2ECC71" : "rgba(255,255,255,0.1)",
              transform: activeSection === "places" ? "translateY(-2px)" : "translateY(0)",
              boxShadow: activeSection === "places" ? "0 8px 25px rgba(46, 204, 113, 0.3)" : "none",
            }}
          >
            📍 내 장소 리스트
          </button>
          <button
            type="button"
            onClick={() => setActiveSection("drafts")}
            style={{
              ...styles.topBarButton,
              backgroundColor: activeSection === "drafts" ? "#2ECC71" : "rgba(255,255,255,0.08)",
              color: activeSection === "drafts" ? "#111111" : "#ffffff",
              borderColor: activeSection === "drafts" ? "#2ECC71" : "rgba(255,255,255,0.1)",
              transform: activeSection === "drafts" ? "translateY(-2px)" : "translateY(0)",
              boxShadow: activeSection === "drafts" ? "0 8px 25px rgba(46, 204, 113, 0.3)" : "none",
            }}
          >
            📝 임시저장
          </button>
          <button
            type="button"
            onClick={() => setActiveSection("stats")}
            style={{
              ...styles.topBarButton,
              backgroundColor: activeSection === "stats" ? "#2ECC71" : "rgba(255,255,255,0.08)",
              color: activeSection === "stats" ? "#111111" : "#ffffff",
              borderColor: activeSection === "stats" ? "#2ECC71" : "rgba(255,255,255,0.1)",
              transform: activeSection === "stats" ? "translateY(-2px)" : "translateY(0)",
              boxShadow: activeSection === "stats" ? "0 8px 25px rgba(46, 204, 113, 0.3)" : "none",
            }}
          >
            📊 성과 및 반응
          </button>
        </div>
      </div>

      <div style={styles.content}>
        {/* 활성화된 섹션에 따라 내용 표시 */}
        {activeSection === "new-place" && <NewPlaceSection />}
        {activeSection === "places" && <PlacesSection places={myPlaces} />}
        {activeSection === "drafts" && <DraftsSection drafts={drafts} />}
        {activeSection === "stats" && <StatsSection stats={stats} />}
        
        {/* 아무것도 선택되지 않았을 때 기본 화면 */}
        {!activeSection && (
          <div style={styles.welcomeSection}>
            <div style={styles.welcomeIcon}>👋</div>
            <h2 style={styles.welcomeTitle}>어떤 작업을 하시겠어요?</h2>
            <p style={styles.welcomeText}>위 버튼을 클릭하여 작업을 시작하세요</p>
          </div>
        )}
      </div>
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
