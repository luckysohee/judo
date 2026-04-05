import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SimpleAISearchBar({
  onSearch = null,
  placeholder = "동대문 근처 고기 먹고 해산물 포차 갈까? 3명이야..."
}) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = useRef(null);

  // 간단한 AI 검색 시뮬레이션
  const executeSearch = async (searchQuery) => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setShowResults(true);

    try {
      // 시뮬레이션 API 호출
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 가짜 결과
      const mockResults = [
        {
          id: '1',
          name: '동대문 엽기떡볶이',
          category: '분식',
          distance: 150,
          aiScore: 85,
          address: '서울 동대문구',
          description: '맛있는 떡볶이와 엽기떡'
        },
        {
          id: '2', 
          name: '동대문 해산물 포차',
          category: '해산물',
          distance: 300,
          aiScore: 78,
          address: '서울 동대문구',
          description: '신선한 해산물과 술'
        },
        {
          id: '3',
          name: '동대문 고기집',
          category: '고기',
          distance: 450,
          aiScore: 72,
          address: '서울 동대문구',
          description: '맛있는 삼겹살'
        }
      ];

      console.log('🎯 AI 검색 결과:', mockResults);
      setResults(mockResults);

    } catch (error) {
      console.error('AI 검색 오류:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 입력 핸들러
  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      executeSearch(value);
    }, 800);
  };

  // 결과 선택
  const handleResultSelect = (result) => {
    console.log('📍 장소 선택:', result);
    if (onSearch) {
      onSearch(result);
    }
    setShowResults(false);
    setQuery('');
  };

  useEffect(() => {
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
          style={styles.locationButton}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          disabled={isLoading}
        >
          📍
        </motion.button>

        <input
          value={query}
          onChange={handleInputChange}
          placeholder={placeholder}
          style={styles.input}
          disabled={isLoading}
        />

        {query && (
          <motion.button
            onClick={() => {
              setQuery('');
              setResults([]);
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
        {showResults && results.length > 0 && (
          <motion.div
            style={styles.resultsContainer}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div style={styles.resultsHeader}>
              <span style={styles.resultsTitle}>AI 추천 장소</span>
              <span style={styles.resultsCount}>{results.length}개</span>
            </div>
            
            {results.map((result, index) => (
              <motion.div
                key={result.id}
                style={styles.resultItem}
                onClick={() => handleResultSelect(result)}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ backgroundColor: 'rgba(52, 152, 219, 0.1)' }}
              >
                <div style={styles.placeInfo}>
                  <div style={styles.placeName}>{result.name}</div>
                  <div style={styles.placeCategory}>{result.category}</div>
                  <div style={styles.placeDescription}>{result.description}</div>
                  <div style={styles.placeDistance}>
                    📍 {result.distance}m • ⭐ {result.aiScore}점
                  </div>
                </div>
                <div style={styles.placeArrow}>→</div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {showResults && results.length === 0 && !isLoading && (
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

      {isLoading && (
        <motion.div
          style={styles.loading}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div>🤖 AI가 분석 중입니다...</div>
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

  placeDescription: {
    color: '#666',
    fontSize: '11px',
    marginBottom: '4px',
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

  loading: {
    padding: '20px',
    textAlign: 'center',
    color: '#3498db',
    fontSize: '14px',
  },
};
