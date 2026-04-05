import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';

export default function AISearchBar({
  mapRef = null,
  onPlaceSelect = null,
  onAISearch = null,
}) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [aiResults, setAiResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const searchTimeoutRef = useRef(null);

  // 사용자 위치 가져오기
  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation이 지원되지 않습니다.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          resolve({ lat: latitude, lng: longitude });
        },
        (error) => {
          console.error('위치 가져오기 실패:', error);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 300000 // 5분 캐시
        }
      );
    });
  };

  // 자연어 쿼리 파싱
  const parseQuery = (text) => {
    const parsed = {
      location: null,
      foodType: null,
      atmosphere: null,
      peopleCount: null,
      distance: null,
      keywords: []
    };

    // 위치 파싱
    const locations = ['동대문', '강남', '홍대', '명동', '이태원', '신촌', '종로', '마포', '여의도', '잠실'];
    locations.forEach(loc => {
      if (text.includes(loc)) {
        parsed.location = loc;
      }
    });

    // 음식 종류 파싱
    const foodTypes = ['고기', '해산물', '포차', '술집', '바', '레스토랑', '카페', '디저트', '한식', '양식', '일식', '중식'];
    foodTypes.forEach(food => {
      if (text.includes(food)) {
        parsed.foodType = food;
      }
    });

    // 분위기 파싱
    const atmospheres = ['조용한', '시끄러운', '이국적인', '현대적인', '전통적인', '로맨틱한', '친근한'];
    atmospheres.forEach(atm => {
      if (text.includes(atm)) {
        parsed.atmosphere = atm;
      }
    });

    // 인원수 파싱
    const peopleMatch = text.match(/(\d+)명/);
    if (peopleMatch) {
      parsed.peopleCount = parseInt(peopleMatch[1]);
    }

    // 거리 파싱
    const distanceMatch = text.match(/(\d+)m|(\d+)km|걸어서/);
    if (distanceMatch) {
      if (text.includes('걸어서')) {
        parsed.distance = 800; // 기본 800m
      } else {
        const distance = parseInt(distanceMatch[1] || distanceMatch[2]);
        parsed.distance = text.includes('km') ? distance * 1000 : distance;
      }
    }

    return parsed;
  };

  // AI 검색 실행
  const executeAISearch = async (searchQuery) => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setShowResults(true);

    try {
      // 1. 현재 위치 가져오기
      let location = userLocation;
      if (!location) {
        location = await getCurrentLocation();
      }

      // 2. 쿼리 파싱
      const parsed = parseQuery(searchQuery);
      console.log('🔍 파싱된 쿼리:', parsed);

      // 3. Supabase에서 위치 기반 검색
      const { data: places, error } = await supabase
        .from('places')
        .select('*')
        .eq('is_archived', false);

      if (error) {
        console.error('DB 검색 오류:', error);
        setAiResults([]);
        return;
      }

      // 4. 거리 기반 필터링
      const filteredPlaces = places.filter(place => {
        const distance = calculateDistance(
          location.lat, 
          location.lng, 
          place.lat, 
          place.lng
        );
        
        const maxDistance = parsed.distance || 1000; // 기본 1km
        return distance <= maxDistance;
      });

      // 5. AI 점수 계산 및 정렬
      const scoredPlaces = filteredPlaces.map(place => {
        let score = 0;
        
        // 음식 종류 점수
        if (parsed.foodType && place.name?.includes(parsed.foodType)) {
          score += 30;
        }
        
        // 분위기 점수
        if (parsed.atmosphere && place.category?.includes(parsed.atmosphere)) {
          score += 20;
        }
        
        // 거리 점수 (가까울수록 높음)
        const distance = calculateDistance(
          location.lat, 
          location.lng, 
          place.lat, 
          place.lng
        );
        score += Math.max(0, 50 - distance / 20);

        return {
          ...place,
          distance: Math.round(distance),
          aiScore: Math.round(score)
        };
      });

      // 6. 점수순 정렬
      const sortedResults = scoredPlaces
        .sort((a, b) => b.aiScore - a.aiScore)
        .slice(0, 10); // 상위 10개

      console.log('🎯 AI 검색 결과:', sortedResults);
      setAiResults(sortedResults);

      // 7. 콜백 호출
      if (onAISearch) {
        onAISearch(sortedResults, parsed);
      }

    } catch (error) {
      console.error('AI 검색 오류:', error);
      setAiResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 거리 계산 (Haversine formula)
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // 지구 반지름 (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c * 1000; // 미터로 변환
  };

  // 입력 핸들러
  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      executeAISearch(value);
    }, 800); // 800ms 디바운스
  };

  // 장소 선택
  const handlePlaceSelect = (place) => {
    if (onPlaceSelect) {
      onPlaceSelect(place);
    }
    
    // 지도 이동
    if (mapRef?.current?.moveToLocation) {
      mapRef.current.moveToLocation(place.lat, place.lng);
    }

    setShowResults(false);
    setQuery('');
  };

  // 위치 버튼 클릭
  const handleLocationClick = async () => {
    try {
      setIsLoading(true);
      const location = await getCurrentLocation();
      console.log('📍 현재 위치:', location);
      
      // 위치 기반 검색
      executeAISearch(query || '근처 맛집');
    } catch (error) {
      console.error('위치 가져오기 실패:', error);
      alert('위치 정보를 가져올 수 없습니다. 브라우저 설정을 확인해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // 컴포넌트 마운트 시 위치 가져오기
    getCurrentLocation().catch(() => {
      console.log('위치 권한이 없습니다.');
    });

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.searchBar}>
        <motion.button
          onClick={handleLocationClick}
          style={styles.locationButton}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          disabled={isLoading}
        >
          {isLoading ? '🔄' : '📍'}
        </motion.button>

        <input
          value={query}
          onChange={handleInputChange}
          placeholder="동대문 근처 고기 먹고 해산물 포차 갈까? 3명이야..."
          style={styles.input}
          disabled={isLoading}
        />

        {query && (
          <motion.button
            onClick={() => {
              setQuery('');
              setAiResults([]);
              setShowResults(false);
            }}
            style={styles.clearButton}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            ✕
          </motion.button>
        )}
      </div>

      {/* AI 검색 결과 */}
      <AnimatePresence>
        {showResults && aiResults.length > 0 && (
          <motion.div
            style={styles.resultsContainer}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div style={styles.resultsHeader}>
              <span style={styles.resultsTitle}>AI 추천 장소</span>
              <span style={styles.resultsCount}>{aiResults.length}개</span>
            </div>
            
            {aiResults.map((place, index) => (
              <motion.div
                key={place.id}
                style={styles.resultItem}
                onClick={() => handlePlaceSelect(place)}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ backgroundColor: 'rgba(52, 152, 219, 0.1)' }}
              >
                <div style={styles.placeInfo}>
                  <div style={styles.placeName}>{place.name}</div>
                  <div style={styles.placeCategory}>{place.category}</div>
                  <div style={styles.placeDistance}>
                    📍 {place.distance}m • ⭐ {place.aiScore}점
                  </div>
                </div>
                <div style={styles.placeArrow}>→</div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {showResults && aiResults.length === 0 && !isLoading && (
        <motion.div
          style={styles.noResults}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div>😔</div>
          <div>주변에 맞는 장소를 찾지 못했어요</div>
          <div style={styles.noResultsSub}>다른 키워드로 검색해보세요</div>
        </motion.div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'relative',
    width: '100%',
  },
  
  searchBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    backgroundColor: 'rgba(18, 19, 18, 0.94)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '16px',
    backdropFilter: 'blur(10px)',
  },

  locationButton: {
    width: '40px',
    height: '40px',
    border: 'none',
    borderRadius: '12px',
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    color: '#3498db',
    fontSize: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  input: {
    flex: 1,
    border: 'none',
    backgroundColor: 'transparent',
    color: '#ffffff',
    fontSize: '14px',
    outline: 'none',
  },

  clearButton: {
    width: '24px',
    height: '24px',
    border: 'none',
    borderRadius: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#ffffff',
    fontSize: '12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  resultsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: '8px',
    backgroundColor: 'rgba(17, 17, 17, 0.96)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '16px',
    backdropFilter: 'blur(10px)',
    overflow: 'hidden',
    zIndex: 1000,
    maxHeight: '400px',
    overflowY: 'auto',
  },

  resultsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
  },

  resultsTitle: {
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
  },

  resultsCount: {
    color: '#3498db',
    fontSize: '12px',
  },

  resultItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },

  placeInfo: {
    flex: 1,
  },

  placeName: {
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '4px',
  },

  placeCategory: {
    color: '#999',
    fontSize: '12px',
    marginBottom: '2px',
  },

  placeDistance: {
    color: '#666',
    fontSize: '11px',
  },

  placeArrow: {
    color: '#3498db',
    fontSize: '16px',
  },

  noResults: {
    padding: '40px 20px',
    textAlign: 'center',
    color: '#999',
    fontSize: '14px',
  },

  noResultsSub: {
    fontSize: '12px',
    color: '#666',
    marginTop: '8px',
  },
};
