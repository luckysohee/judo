import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { markSearchSessionBookmarked } from "../../utils/searchAnalytics";
import { upsertUserSavedPlaceFolders } from "../../utils/upsertUserSavedPlaceFolders";
import {
  selectSystemFoldersOrdered,
  insertSystemFolderRow,
} from "../../utils/systemFoldersSupabase";

// DB 실패 시 기본 7개 (sort_order 포함 — 새 폴더 sort_order 계산용)
const DEFAULT_FOLDER_DEFS = [
  { key: 'after_party', name: '2차', color: '#FF8C42', icon: '🍺', sort_order: 1 },
  { key: 'date', name: '데이트', color: '#FF69B4', icon: '💘', sort_order: 2 },
  { key: 'hangover', name: '해장', color: '#87CEEB', icon: '🥣', sort_order: 3 },
  { key: 'solo', name: '혼술', color: '#9B59B6', icon: '👤', sort_order: 4 },
  { key: 'group', name: '회식', color: '#F1C40F', icon: '👥', sort_order: 5 },
  { key: 'must_go', name: '찐맛집', color: '#27AE60', icon: '🌟', sort_order: 6 },
  { key: 'terrace', name: '야외/뷰', color: '#5DADE2', icon: '🌅', sort_order: 7 },
];

export default function SaveModal({ 
  place, 
  isOpen, 
  onClose, 
  onSaveComplete,
  firstSavedFrom = 'home',
  searchSessionIdRef,
  /** true: 장소 미리보기 카드 안에만 채움(전체 화면 X) */
  embeddedInPlaceCard = false,
}) {
  const [selectedFolders, setSelectedFolders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderSaving, setNewFolderSaving] = useState(false);
  const [folderDefs, setFolderDefs] = useState(DEFAULT_FOLDER_DEFS);

  useEffect(() => {
    if (!isOpen) {
      setShowNewFolderInput(false);
      setNewFolderName('');
      setNewFolderSaving(false);
      return;
    }
    (async () => {
      const { data, error } = await selectSystemFoldersOrdered(supabase);
      if (!error && data?.length) {
        setFolderDefs(data);
      }
    })();
  }, [isOpen]);

  // 폴더 추천: 장소가 바뀔 때만 (DB에서 폴더 목록이 늦게 와도 추천 키는 시스템 7개 안에서만 나옴)
  useEffect(() => {
    if (!place) return;

    const recommendations = calculateFolderRecommendations(
      place,
      DEFAULT_FOLDER_DEFS
    );
    if (recommendations.length > 0) {
      setSelectedFolders([recommendations[0].key]);
    }
  }, [place]);

  const calculateFolderRecommendations = (place, defs) => {
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
      .map(item => defs.find(f => f.key === item.key))
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

      const sessionId = searchSessionIdRef?.current ?? null;
      const folderRes = await upsertUserSavedPlaceFolders(supabase, {
        placeId: place.id,
        folderKeys: selectedFolders,
        firstSavedFrom,
        extraSavedPlaceFields: sessionId
          ? { search_session_id: sessionId }
          : undefined,
      });

      if (!folderRes.ok) {
        console.error('저장 실패:', folderRes.message);
        alert(folderRes.message || '저장에 실패했습니다.');
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

  const handleAddNewFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;

    setNewFolderSaving(true);
    try {
      const {
        data: { user: authUser },
        error: authErr,
      } = await supabase.auth.getUser();
      if (authErr || !authUser?.id) {
        alert('로그인이 필요합니다.');
        return;
      }
      const key = `custom_${Date.now()}`;
      const maxSo = Math.max(
        0,
        ...folderDefs.map((f) => Number(f.sort_order) || 0)
      );
      const { error } = await insertSystemFolderRow(supabase, {
        key,
        name,
        color: '#3498DB',
        icon: '📁',
        description: '',
        sort_order: maxSo + 1,
        is_active: true,
        created_by: authUser.id,
      });
      if (error) {
        alert(
          error.message ||
            '폴더를 만들지 못했습니다. Supabase에 system_folders INSERT 정책이 있는지 확인하세요.'
        );
        return;
      }
      const row = {
        key,
        name,
        color: '#3498DB',
        icon: '📁',
        sort_order: maxSo + 1,
      };
      setFolderDefs((prev) =>
        [...prev, row].sort(
          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
        )
      );
      setSelectedFolders((prev) =>
        prev.includes(key) ? prev : [...prev, key]
      );
      setNewFolderName('');
      setShowNewFolderInput(false);
    } finally {
      setNewFolderSaving(false);
    }
  };

  if (!isOpen) return null;

  const shellStyle = embeddedInPlaceCard
    ? styles.placeCardShell
    : styles.overlay;
  const modalStyle = embeddedInPlaceCard
    ? styles.placeCardModal
    : styles.modal;

  return (
    <div style={shellStyle}>
      <div
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
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
        
        <div
          style={
            embeddedInPlaceCard ? styles.placeCardHeaderSpacer : styles.header
          }
        />

        <div
          style={
            embeddedInPlaceCard
              ? { ...styles.content, ...styles.placeCardContent }
              : styles.content
          }
        >
          {/* system_folders 전체 + 새 폴더 (4열 그리드) */}
          <div style={styles.section}>
            <div style={styles.folderGrid2x4}>
              {folderDefs.map((folder) => {
                const selected = selectedFolders.includes(folder.key);
                return (
                  <button
                    key={folder.key}
                    type="button"
                    onClick={() => handleFolderToggle(folder.key)}
                    style={{
                      ...styles.folderButton,
                      ...(selected ? styles.folderButtonSelected : {}),
                      borderColor: folder.color,
                      backgroundColor: selected ? folder.color : "transparent",
                    }}
                  >
                    <span style={styles.folderIcon}>{folder.icon}</span>
                    <span
                      style={{
                        ...styles.folderName,
                        color: selected ? "white" : folder.color,
                      }}
                    >
                      {folder.name}
                    </span>
                  </button>
                );
              })}
              {!showNewFolderInput ? (
                <button
                  type="button"
                  onClick={() => setShowNewFolderInput(true)}
                  style={styles.addFolderButton}
                >
                  <span style={styles.addFolderIcon}>+</span>
                  <span style={styles.addFolderText}>새 폴더</span>
                </button>
              ) : null}
            </div>
            {showNewFolderInput ? (
              <div style={styles.newFolderInputBelow}>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="폴더 이름"
                  style={styles.input}
                  autoFocus
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    !newFolderSaving &&
                    handleAddNewFolder()
                  }
                />
                <div style={styles.newFolderInputActions}>
                  <button
                    type="button"
                    disabled={newFolderSaving}
                    onClick={handleAddNewFolder}
                    style={styles.addButton}
                  >
                    {newFolderSaving ? '…' : '✓'}
                  </button>
                  <button
                    type="button"
                    disabled={newFolderSaving}
                    onClick={() => setShowNewFolderInput(false)}
                    style={styles.cancelButton}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div
          style={
            embeddedInPlaceCard
              ? { ...styles.footer, ...styles.placeCardFooter }
              : styles.footer
          }
        >
          <div style={styles.selectionInfo}>
            {selectedFolders.length > 0 && (
              <span style={styles.selectionText}>
                {selectedFolders.length}개 폴더 선택됨
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={selectedFolders.length === 0 || isLoading}
            style={styles.saveButton(selectedFolders, isLoading)}
            aria-label={isLoading ? "저장 중" : "저장"}
          >
            {isLoading ? "⏳" : "💾"}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  /** 장소 카드 내부 전용: 부모가 flex column + minHeight 0 일 것 */
  placeCardShell: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxSizing: 'border-box',
  },
  placeCardModal: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    backgroundColor: 'transparent',
    border: 'none',
    boxShadow: 'none',
    borderRadius: 0,
    overflow: 'hidden',
  },
  placeCardHeaderSpacer: {
    flexShrink: 0,
    height: '36px',
  },
  placeCardContent: {
    padding: '4px 12px 10px',
    gap: '12px',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeCardFooter: {
    padding: '10px 12px',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingLeft: '12px',
    paddingRight: '12px',
    paddingTop: 'max(12px, env(safe-area-inset-top, 0px))',
    paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
    zIndex: 12000,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    overscrollBehavior: 'contain',
    boxSizing: 'border-box',
  },
  modal: {
    backgroundColor: 'rgba(18, 18, 18, 0.96)', // 마커 모달과 동일한 배경색
    backdropFilter: 'blur(12px)', // 마커 모달과 동일한 블러
    WebkitBackdropFilter: 'blur(12px)',
    borderRadius: '20px', // 마커 모달과 동일한 둥근 모서리
    width: 'min(92vw, 400px)', // 마커 모달과 동일한 너비
    height: 'auto', // 높이는 자동
    maxHeight: 'min(78vh, 640px)', // 최대 높이만 제한
    marginTop: 'min(6vh, 40px)', // 폰에서 열자마자 상단 영역에 보이도록
    overflow: 'hidden',
    flexShrink: 0,
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
    minHeight: 0,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
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
    alignItems: 'center',
    width: '100%',
    gap: '10px' // 폴더들 간 간격
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: '12px',
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
  },
  /** 시스템 7 + 새 폴더 1 = 4열 × 2행, 카드·모달 안에서 가운데 */
  folderGrid2x4: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gridTemplateRows: 'repeat(2, auto)',
    gap: '10px',
    alignItems: 'stretch',
    width: '100%',
    maxWidth: '320px',
    marginLeft: 'auto',
    marginRight: 'auto',
    justifyItems: 'stretch',
  },
  folderButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
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
    position: 'relative',
    zIndex: 10,
    boxSizing: 'border-box',
    minWidth: 0,
    width: '100%',
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
  newFolderInputBelow: {
    marginTop: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '10px',
    border: '2px solid #3498DB',
    borderRadius: '8px',
    backgroundColor: '#1a1a1a',
    boxSizing: 'border-box',
    width: '100%',
    maxWidth: '320px',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  newFolderInputActions: {
    display: 'flex',
    gap: '6px',
    justifyContent: 'flex-end',
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
    justifyContent: 'center',
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
    position: 'relative',
    zIndex: 10,
    boxSizing: 'border-box',
    minWidth: 0,
    width: '100%',
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
    padding: 0,
    width: '32px',
    height: '32px',
    fontSize: '14px',
    fontWeight: 'bold',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    boxShadow: '0 2px 8px rgba(52, 152, 219, 0.3)',
    opacity: selectedFolders.length === 0 || isLoading ? 0.5 : 1,
    cursor: selectedFolders.length === 0 || isLoading ? 'not-allowed' : 'pointer',
  }),
};
