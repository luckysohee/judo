import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

const KakaoPlaceSearch = ({ onPlaceSelect, mapRef }) => {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = useRef(null);

  // 카카오 장소 검색
  const searchPlaces = (searchKeyword) => {
    if (!searchKeyword.trim()) {
      setResults([]);
      return;
    }

    if (!window.kakao?.maps?.services) {
      console.error('Kakao Maps services not loaded');
      return;
    }

    setIsLoading(true);

    // 장소 검색 객체 생성
    const ps = new window.kakao.maps.services.Places();

    // 키워드로 장소검색 요청 (음식점 카테고리 필터링)
    ps.keywordSearch(
      searchKeyword, 
      (data, status) => {
        if (status === window.kakao.maps.services.Status.OK) {
          // 검색 결과 상태 업데이트
          setResults(data);
          setShowResults(true);
        } else if (status === window.kakao.maps.services.Status.ZERO_RESULT) {
          setResults([]);
          setShowResults(true);
        } else {
          console.error('검색 중 오류 발생:', status);
          setResults([]);
        }
        setIsLoading(false);
      },
      {
        category_group_code: 'FD6', // 음식점 카테고리
        location: mapRef.current?.getCenter(), // 현재 지도 중심 기준
        radius: 5000 // 5km 반경
      }
    );
  };

  // 디바운스 검색
  const handleInputChange = (e) => {
    const value = e.target.value;
    setKeyword(value);

    // 이전 타이머 클리어
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // 300ms 후 검색 실행
    searchTimeoutRef.current = setTimeout(() => {
      searchPlaces(value);
    }, 300);
  };

  // 장소 선택 처리
  const handlePlaceSelect = (place) => {
    // Supabase에 장소 정보 저장
    savePlaceToDatabase(place);
    
    // 지도 이동
    if (onPlaceSelect && mapRef.current) {
      const moveLatLon = new window.kakao.maps.LatLng(place.y, place.x);
      mapRef.current.panTo(moveLatLon);
    }

    // 검색 결과 닫기
    setShowResults(false);
    setKeyword('');
  };

  // Supabase에 장소 정보 저장
  const savePlaceToDatabase = async (place) => {
    try {
      // 이미 있는지 확인
      const { data: existingPlace } = await supabase
        .from('places')
        .select('id')
        .eq('kakao_place_id', place.id)
        .single();

      if (!existingPlace) {
        // 새 장소 저장
        await supabase
          .from('places')
          .upsert({
            kakao_place_id: place.id,
            name: place.place_name,
            address: place.road_address_name || place.address_name,
            category: place.category_name,
            x: parseFloat(place.x),
            y: parseFloat(place.y),
            phone: place.phone,
            created_at: new Date().toISOString()
          });
        
        console.log('새 장소 저장 완료:', place.place_name);
      }
    } catch (error) {
      console.error('장소 저장 중 오류:', error);
    }
  };

  // 컴포넌트 언마운트 시 타이머 클리어
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* 검색 입력창 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '12px',
        padding: '8px 16px',
        gap: '8px'
      }}>
        <span style={{ color: '#999', fontSize: '16px' }}>🔍</span>
        <input
          type="text"
          value={keyword}
          onChange={handleInputChange}
          onFocus={() => setShowResults(true)}
          placeholder="어디로 마시러 갈까요?"
          style={{
            flex: 1,
            backgroundColor: 'transparent',
            border: 'none',
            color: 'white',
            fontSize: '14px',
            outline: 'none',
            placeholder: {
              color: 'rgba(255, 255, 255, 0.5)'
            }
          }}
        />
        {keyword && (
          <button
            onClick={() => {
              setKeyword('');
              setResults([]);
              setShowResults(false);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#999',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '0'
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* 검색 결과 오버레이 */}
      {showResults && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: 0,
          right: 0,
          maxHeight: '300px',
          backgroundColor: 'rgba(18, 18, 18, 0.95)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px 12px 0 0',
          overflow: 'hidden',
          marginBottom: '8px',
          zIndex: 1000
        }}>
          {/* 검색 결과 헤더 */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            fontSize: '12px',
            color: '#999',
            fontWeight: '600'
          }}>
            {isLoading ? '검색 중...' : 
             results.length > 0 ? `검색 결과 ${results.length}개` : 
             keyword ? '검색 결과가 없습니다' : '장소 검색'}
          </div>

          {/* 검색 결과 목록 */}
          <div style={{
            maxHeight: '250px',
            overflowY: 'auto'
          }}>
            {isLoading ? (
              <div style={{
                padding: '20px',
                textAlign: 'center',
                color: '#999'
              }}>
                검색 중...
              </div>
            ) : results.length === 0 && keyword ? (
              <div style={{
                padding: '20px',
                textAlign: 'center',
                color: '#999'
              }}>
                검색 결과가 없습니다
              </div>
            ) : results.length === 0 && !keyword ? (
              <div style={{
                padding: '20px',
                textAlign: 'center',
                color: '#999'
              }}>
                검색어를 입력해보세요
              </div>
            ) : (
              results.map((place) => (
                <div
                  key={place.id}
                  onClick={() => handlePlaceSelect(place)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.05)'
                    }
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#fff',
                    marginBottom: '4px'
                  }}>
                    {place.place_name}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#999',
                    marginBottom: '2px'
                  }}>
                    {place.road_address_name || place.address_name}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: '#666',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span>{place.category_name}</span>
                    {place.distance && <span>• {Math.round(place.distance)}m</span>}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 바깥 클릭 시 닫기 */}
          <div
            onClick={() => setShowResults(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999
            }}
          />
        </div>
      )}
    </div>
  );
};

export default KakaoPlaceSearch;
