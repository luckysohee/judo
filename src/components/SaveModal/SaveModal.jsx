import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { markSearchSessionBookmarked } from "../../utils/searchAnalytics";

// 시스템 폴더 설정
const SYSTEM_FOLDERS = [
  { key: 'after_party', name: '2차', color: '#FF8C42', icon: '🍺' },
  { key: 'date', name: '데이트', color: '#FF69B4', icon: '💘' },
  { key: 'hangover', name: '해장', color: '#87CEEB', icon: '🥣' },
  { key: 'solo', name: '혼술', color: '#9B59B6', icon: '👤' },
  { key: 'group', name: '회식', color: '#F1C40F', icon: '👥' },
  { key: 'must_go', name: '찐맛집', color: '#27AE60', icon: '🌟' },
  { key: 'terrace', name: '야외/뷰', color: '#2C3E50', icon: '🌅' }
];

export default function SaveModal({ 
  place, 
  isOpen, 
  onClose, 
  onSaveComplete,
  firstSavedFrom = 'home',
  searchSessionIdRef,
}) {
  const [selectedFolders, setSelectedFolders] = useState([]);
  const [recommendedFolders, setRecommendedFolders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // 폴더 추천 로직
  useEffect(() => {
    if (!place) return;
    
    const recommendations = calculateFolderRecommendations(place);
    setRecommendedFolders(recommendations.slice(0, 3)); // 상위 3개만
    
    // 추천 폴더 중 첫 번째를 기본 선택
    if (recommendations.length > 0) {
      setSelectedFolders([recommendations[0].key]);
    }
  }, [place]);

  const calculateFolderRecommendations = (place) => {
    const scores = {};
    
    // after_party (2차)
    if (place.tags?.includes('야간') || place.tags?.includes('늦게까지')) scores.after_party = 3;
    if (place.tags?.includes('해산물') || place.tags?.includes('안주')) scores.after_party = (scores.after_party || 0) + 2;
    if (place.tags?.includes('배 덜부른') || place.tags?.includes('가볍게')) scores.after_party = (scores.after_party || 0) + 2;
    if (place.tags?.includes('술집') || place.tags?.includes('바')) scores.after_party = (scores.after_party || 0) + 1;
    
    // date
    if (place.tags?.includes('조용') || place.tags?.includes('깔끔')) scores.date = 3;
    if (place.tags?.includes('와인') || place.tags?.includes('하이볼')) scores.date = (scores.date || 0) + 2;
    if (place.tags?.includes('아늑') || place.tags?.includes('로맨틱')) scores.date = (scores.date || 0) + 2;
    if (place.tags?.includes('분위기 좋은') || place.tags?.includes('인테리어')) scores.date = (scores.date || 0) + 1;
    
    // hangover
    if (place.tags?.includes('국물') || place.tags?.includes('국밥')) scores.hangover = 3;
    if (place.tags?.includes('칼국수') || place.tags?.includes('순대국')) scores.hangover = (scores.hangover || 0) + 2;
    if (place.tags?.includes('해장') || place.tags?.includes('아침')) scores.hangover = (scores.hangover || 0) + 2;
    if (place.tags?.includes('뜨끈한') || place.tags?.includes('시원한국')) scores.hangover = (scores.hangover || 0) + 1;
    
    // solo
    if (place.tags?.includes('조용') || place.tags?.includes('혼자가기좋은')) scores.solo = 3;
    if (place.tags?.includes('카운터석') || place.tags?.includes('1인석')) scores.solo = (scores.solo || 0) + 2;
    if (place.tags?.includes('깔끔') || place.tags?.includes('혼술')) scores.solo = (scores.solo || 0) + 1;
    if (place.tags?.includes('책상') || place.tags?.includes('작업')) scores.solo = (scores.solo || 0) + 1;
    
    // group
    if (place.tags?.includes('단체') || place.tags?.includes('큰테이블')) scores.group = 3;
    if (place.tags?.includes('시끌벅적') || place.tags?.includes('활기찬')) scores.group = (scores.group || 0) + 2;
    if (place.tags?.includes('회식') || place.tags?.includes('모임')) scores.group = (scores.group || 0) + 2;
    if (place.tags?.includes('넓은') || place.tags?.includes('자리편한')) scores.group = (scores.group || 0) + 1;
    
    // must_go
    if (place.curatorCount >= 2) scores.must_go = 3;
    if (place.tags?.includes('인기') || place.tags?.includes('맛집')) scores.must_go = (scores.must_go || 0) + 2;
    if (place.tags?.includes('방송') || place.tags?.includes('유명')) scores.must_go = (scores.must_go || 0) + 2;
    if (place.tags?.includes('줄서는') || place.tags?.includes('필수')) scores.must_go = (scores.must_go || 0) + 1;
    
    // terrace
    if (place.tags?.includes('야외') || place.tags?.includes('야장')) scores.terrace = 4;
    if (place.tags?.includes('노상') || place.tags?.includes('노포')) scores.terrace = (scores.terrace || 0) + 4;
    if (place.tags?.includes('뷰') || place.tags?.includes('조망')) scores.terrace = (scores.terrace || 0) + 3;
    if (place.tags?.includes('개방형') || place.tags?.includes('창문')) scores.terrace = (scores.terrace || 0) + 2;
    if (place.tags?.includes('옥상') || place.tags?.includes('루프탑')) scores.terrace = (scores.terrace || 0) + 3;
    if (place.tags?.includes('날씨 좋은날') || place.tags?.includes('가을')) scores.terrace = (scores.terrace || 0) + 2;
    
    // 점수순 정렬 후 반환
    return Object.entries(scores)
      .map(([key, score]) => ({ key, score }))
      .sort((a, b) => b.score - a.score)
      .map(item => SYSTEM_FOLDERS.find(f => f.key === item.key))
      .filter(Boolean); // undefined 필터링
  };

  const handleFolderToggle = (folderKey) => {
    setSelectedFolders(prev => {
      if (prev.includes(folderKey)) {
        return prev.filter(key => key !== folderKey);
      } else {
        return [...prev, folderKey];
      }
    });
  };

  const handleSave = async () => {
    if (selectedFolders.length === 0) {
      alert('최소 1개 폴더를 선택해주세요.');
      return;
    }

    setIsLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        alert('로그인이 필요합니다.');
        return;
      }

      // 임시: RPC 함수 없이 직접 저장
      // 1. 장소 저장 (UPSERT)
      const sessionId = searchSessionIdRef?.current ?? null;
      const upsertPayload = {
        user_id: user.id,
        place_id: place.id,
        first_saved_from: firstSavedFrom,
      };
      if (sessionId) {
        upsertPayload.search_session_id = sessionId;
      }

      const { data: savedPlace, error: saveError } = await supabase
        .from('user_saved_places')
        .upsert(upsertPayload)
        .select()
        .single();

      if (saveError) {
        console.error('저장 실패:', saveError);
        alert('저장에 실패했습니다.');
        return;
      }

      // 2. 기존 폴더 연결 삭제
      await supabase
        .from('user_saved_place_folders')
        .delete()
        .eq('user_saved_place_id', savedPlace.id);

      // 3. 새 폴더 연결 추가
      const folderInserts = selectedFolders.map(folderKey => ({
        user_saved_place_id: savedPlace.id,
        folder_key: folderKey
      }));

      const { error: folderError } = await supabase
        .from('user_saved_place_folders')
        .insert(folderInserts);

      if (folderError) {
        console.error('폴더 연결 실패:', folderError);
        alert('폴더 연결에 실패했습니다.');
        return;
      }

      if (sessionId) {
        await markSearchSessionBookmarked({
          sessionId,
          placeId: place.id,
          user,
        });
      }

      onSaveComplete?.();
      onClose();
    } catch (error) {
      console.error('저장 중 오류:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNewFolder = () => {
    if (newFolderName.trim()) {
      // 새로운 폴더 추가 로직 (임시: 선택된 폴더에 추가)
      const folderKey = `custom_${Date.now()}`;
      setSelectedFolders(prev => [...prev, folderKey]);
      setNewFolderName('');
      setShowNewFolderInput(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* X 버튼을 header 밖으로 이동 */}
        <button 
          onClick={onClose} 
          style={{
            ...styles.closeButton,
            position: 'absolute',
            top: '15px',
            right: '15px',
            zIndex: 1002
          }}
        >
          ×
        </button>
        
        <div style={styles.header}>
          {/* [폴더 선택] 글씨 삭제 */}
          {/* header 안의 X 버튼 제거 */}
        </div>

        <div style={styles.content}>
          {/* 가게 제목 제거 */}

          {/* 추천 폴더 */}
          {recommendedFolders.length > 0 && (
            <div style={styles.section}>
              {/* [추천 폴더] 글씨 삭제 */}
              <div style={styles.folderGrid}>
                {recommendedFolders.map(folder => (
                  <button
                    key={folder.key}
                    onClick={() => handleFolderToggle(folder.key)}
                    style={{
                      ...styles.folderButton,
                      ...(selectedFolders.includes(folder.key) ? styles.folderButtonSelected : {}),
                      borderColor: folder.color,
                      backgroundColor: selectedFolders.includes(folder.key) ? folder.color : 'transparent'
                    }}
                  >
                    <span style={styles.folderIcon}>{folder.icon}</span>
                    <span style={{
                      ...styles.folderName,
                      color: selectedFolders.includes(folder.key) ? 'white' : folder.color
                    }}>
                      {folder.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 전체 폴더 */}
          <div style={styles.section}>
            {/* [전체폴더] 글씨 삭제 */}
            <div style={styles.folderGrid}>
              {SYSTEM_FOLDERS.filter(folder => !recommendedFolders.find(r => r.key === folder.key)).map(folder => (
                <button
                  key={folder.key}
                  onClick={() => handleFolderToggle(folder.key)}
                  style={{
                    ...styles.folderButton,
                    ...(selectedFolders.includes(folder.key) ? styles.folderButtonSelected : {}),
                    borderColor: folder.color,
                    backgroundColor: selectedFolders.includes(folder.key) ? folder.color : 'transparent'
                  }}
                >
                  <span style={styles.folderIcon}>{folder.icon}</span>
                  <span style={{
                    ...styles.folderName,
                    color: selectedFolders.includes(folder.key) ? 'white' : folder.color
                  }}>
                    {folder.name}
                  </span>
                </button>
              ))}
              
              {/* 새 폴더 추가 버튼 */}
              {showNewFolderInput ? (
                <div style={styles.newFolderInput}>
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="폴더 이름"
                    style={styles.input}
                    autoFocus
                    onKeyPress={(e) => e.key === 'Enter' && handleAddNewFolder()}
                  />
                  <button onClick={handleAddNewFolder} style={styles.addButton}>
                    ✓
                  </button>
                  <button onClick={() => setShowNewFolderInput(false)} style={styles.cancelButton}>
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewFolderInput(true)}
                  style={styles.addFolderButton}
                >
                  <span style={styles.addFolderIcon}>+</span>
                  <span style={styles.addFolderText}>새 폴더</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div style={styles.footer}>
          <div style={styles.selectionInfo}>
            {selectedFolders.length > 0 && (
              <span style={styles.selectionText}>
                {selectedFolders.length}개 폴더 선택됨
              </span>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={selectedFolders.length === 0 || isLoading}
            style={styles.saveButton(selectedFolders, isLoading)}
          >
            {isLoading ? '⏳' : '💾'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'absolute', // fixed 대신 absolute로 변경
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modal: {
    backgroundColor: 'rgba(18, 18, 18, 0.96)', // 마커 모달과 동일한 배경색
    backdropFilter: 'blur(12px)', // 마커 모달과 동일한 블러
    WebkitBackdropFilter: 'blur(12px)',
    borderRadius: '20px', // 마커 모달과 동일한 둥근 모서리
    width: '92%', // 마커 모달과 동일한 너비
    height: 'auto', // 높이는 자동
    maxHeight: '80vh', // 최대 높이만 제한
    overflow: 'visible', // 플로팅을 위해 visible
    border: '1px solid rgba(255, 255, 255, 0.08)', // 마커 모달과 동일한 경계
    boxShadow: '0 14px 30px rgba(0, 0, 0, 0.32)', // 마커 모달과 동일한 그림자
    position: 'relative',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px',
    borderBottom: 'none',
    borderRadius: '20px 20px 0 0', // 마커 모달과 동일
    position: 'relative'
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#ffffff',
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
  },
  closeButton: {
    background: 'rgba(231, 76, 60, 0.2)',
    border: '1px solid rgba(231, 76, 60, 0.4)',
    fontSize: '18px',
    color: '#e74c3c',
    cursor: 'pointer',
    padding: '0',
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    fontWeight: 'bold',
    boxShadow: '0 2px 8px rgba(231, 76, 60, 0.3)',
    position: 'absolute',
    top: '15px',
    right: '15px',
    zIndex: 1002,
    lineHeight: '1'
  },
  content: {
    padding: '20px',
    flex: 1,
    overflow: 'visible',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px' // 섹션 간 간격
  },
  placeInfo: {
    marginBottom: '20px',
    padding: '15px',
    backgroundColor: '#252525',
    borderRadius: '8px'
  },
  placeName: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: '5px'
  },
  placeAddress: {
    fontSize: '14px',
    color: '#999'
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px' // 폴더들 간 간격
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: '12px',
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
  },
  folderGrid: {
    display: 'grid', // 그리드로 다시 변경
    gridTemplateColumns: 'repeat(4, 1fr)', // 4개씩 2층으로
    gap: '12px',
    justifyContent: 'center'
  },
  folderButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '10px 6px',
    border: '2px solid',
    borderRadius: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    minHeight: '55px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
    position: 'relative', // 플로팅을 위한 상대 위치
    zIndex: 10 // 플로팅 효과를 위한 z-index
  },
  folderButtonSelected: {
    transform: 'scale(0.95)'
  },
  folderIcon: {
    fontSize: '16px',
    marginBottom: '3px'
  },
  folderName: {
    fontSize: '11px',
    fontWeight: 'bold',
    textAlign: 'center'
  },
  newFolderInput: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '8px',
    border: '2px solid #3498DB',
    borderRadius: '6px',
    backgroundColor: '#1a1a1a'
  },
  input: {
    padding: '6px 8px',
    border: '1px solid #333',
    borderRadius: '4px',
    backgroundColor: '#252525',
    color: '#ffffff',
    fontSize: '12px',
    outline: 'none'
  },
  addButton: {
    backgroundColor: '#3498DB',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '4px 8px',
    fontSize: '10px',
    cursor: 'pointer'
  },
  cancelButton: {
    backgroundColor: '#e74c3c',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '4px 8px',
    fontSize: '10px',
    cursor: 'pointer'
  },
  addFolderButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '10px 6px',
    border: '2px dashed rgba(255, 255, 255, 0.3)',
    borderRadius: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    minHeight: '55px',
    color: 'rgba(255, 255, 255, 0.6)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    position: 'relative', // 플로팅을 위한 상대 위치
    zIndex: 10 // 플로팅 효과를 위한 z-index
  },
  addFolderIcon: {
    fontSize: '16px',
    marginBottom: '3px'
  },
  addFolderText: {
    fontSize: '11px',
    fontWeight: 'bold',
    textAlign: 'center'
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '15px 20px',
    borderTop: 'none',
    borderRadius: '0 0 20px 20px', // 마커 모달과 동일
    flexShrink: 0
  },
  selectionInfo: {
    flex: 1
  },
  selectionText: {
    fontSize: '14px',
    color: '#999'
  },
  saveButton: (selectedFolders, isLoading) => ({
    backgroundColor: 'rgba(52, 152, 219, 0.2)', 
    border: '1px solid rgba(52, 152, 219, 0.4)',
    color: '#3498DB',
    borderRadius: '8px', 
    padding: '0',
    width: '32px', 
    height: '32px', 
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(10px)', 
    WebkitBackdropFilter: 'blur(10px)',
    boxShadow: '0 2px 8px rgba(52, 152, 219, 0.3)', 
    opacity: selectedFolders.length === 0 || isLoading ? 0.5 : 1,
    cursor: selectedFolders.length === 0 || isLoading ? 'not-allowed' : 'pointer'
  }),
};
