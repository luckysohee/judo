import React from 'react';

// 카테고리 정제 함수
const cleanCategory = (categoryName) => {
  if (!categoryName) return '';
  const parts = categoryName.split(' > ');
  return parts[parts.length - 1]; // 마지막 업종명만 추출
};

// 특정 키워드가 포함된지 확인 (AI 학습 데이터용)
const isTargetCategory = (categoryName) => {
  if (!categoryName) return false;
  const targetKeywords = ['술집', '호프', '포장마차', '민속주점', '해산물', '주점', '바', '선술집'];
  return targetKeywords.some(keyword => categoryName.includes(keyword));
};

const KakaoPlaceOverlay = ({ place, onClose, onQuickSave, userRole, onSave, savedFolders, userSavedPlaces }) => {
  const cleanCat = cleanCategory(place.category_name);
  const isTarget = isTargetCategory(place.category_name);
  const isCurator = userRole === 'curator' || userRole === 'admin';
  
  const handleKakaoView = () => {
    if (place.place_url) {
      window.open(place.place_url, '_blank');
    }
  };

  const handleQuickSaveClick = () => {
    if (isTarget) {
      onQuickSave(place);
    }
    onClose();
  };

  const handleSaveClick = () => {
    // 일반 사용자용 저장 로직
    if (onSave) {
      onSave(place);
    }
    onClose();
  };

  return (
    <div style={{
      position: 'absolute',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: '#1a1a1a',
      borderRadius: '12px',
      padding: '16px',
      minWidth: '280px',
      maxWidth: '320px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      border: '1px solid #333',
      zIndex: 1000,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* 닫기 버튼 */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          background: 'none',
          border: 'none',
          color: '#999',
          fontSize: '18px',
          cursor: 'pointer',
          padding: '4px',
          borderRadius: '4px',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          e.target.style.backgroundColor = '#333';
          e.target.style.color = '#fff';
        }}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = 'transparent';
          e.target.style.color = '#999';
        }}
      >
        ×
      </button>

      {/* 카카오맵 상세보기 - 우측 상단 작은 링크 */}
      {place.place_url && (
        <button
          onClick={handleKakaoView}
          style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            background: 'none',
            border: 'none',
            color: '#3498db',
            fontSize: '11px',
            cursor: 'pointer',
            padding: '2px 4px',
            borderRadius: '3px',
            textDecoration: 'underline',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.target.style.color = '#2980b9';
            e.target.style.backgroundColor = 'rgba(52, 152, 219, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.target.style.color = '#3498db';
            e.target.style.backgroundColor = 'transparent';
          }}
        >
          카카오맵
        </button>
      )}

      {/* 가게 이름 */}
      <div style={{
        fontSize: '16px',
        fontWeight: '700',
        color: '#fff',
        marginBottom: '8px',
        paddingRight: '20px',
        paddingTop: '8px'
      }}>
        {place.place_name}
        {isTarget && (
          <span style={{
            marginLeft: '8px',
            fontSize: '12px',
            backgroundColor: '#f39c12',
            color: '#fff',
            padding: '2px 6px',
            borderRadius: '4px',
            fontWeight: '500'
          }}>
            ⭐ 노포
          </span>
        )}
      </div>

      {/* 업종 */}
      {cleanCat && (
        <div style={{
          fontSize: '13px',
          color: '#3498db',
          marginBottom: '12px',
          fontWeight: '500'
        }}>
          {cleanCat}
        </div>
      )}

      {/* 주소 */}
      <div style={{
        fontSize: '13px',
        color: '#999',
        marginBottom: '8px',
        lineHeight: '1.4'
      }}>
        📍 {place.road_address_name || place.address_name}
      </div>

      {/* 전화번호 */}
      {place.phone && (
        <div style={{
          fontSize: '13px',
          color: '#999',
          marginBottom: '16px'
        }}>
          📞 {place.phone}
        </div>
      )}

      {/* 버튼 그룹 - 역할에 따라 다르게 표시 */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginTop: '12px'
      }}>
        {isCurator ? (
          /* 큐레이터용 UI */
          <>
            {/* 쾌속 잔 채우기 버튼 - 가장 강조 */}
            <button
              onClick={handleQuickSaveClick}
              style={{
                flex: 1,
                backgroundColor: '#2ecc71',
                color: '#fff',
                border: 'none',
                padding: '12px 16px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(46, 204, 113, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#27ae60';
                e.target.style.transform = 'translateY(-1px)';
                e.target.style.boxShadow = '0 6px 16px rgba(46, 204, 113, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#2ecc71';
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 12px rgba(46, 204, 113, 0.3)';
              }}
            >
              쾌속 잔 채우기
            </button>
          </>
        ) : (
          /* 일반 사용자용 UI */
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            width: '100%'
          }}>
            {/* 고정 폴더 7개 */}
            {['2차', '데이트', '해장', '혼술', '회식', '찐맛집', '야외/뷰'].map(folderName => (
              <button
                key={folderName}
                onClick={() => handleSaveClick()}
                style={{
                  backgroundColor: savedFolders?.[folderName] ? '#3498db' : '#555',
                  color: '#fff',
                  border: 'none',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  minWidth: '60px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = savedFolders?.[folderName] ? '#2980b9' : '#666';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = savedFolders?.[folderName] ? '#3498db' : '#555';
                }}
              >
                {folderName}
              </button>
            ))}
            
            {/* 새 폴더 버튼 */}
            <button
              onClick={() => handleSaveClick()}
              style={{
                backgroundColor: '#e74c3c',
                color: '#fff',
                border: 'none',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#c0392b';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#e74c3c';
              }}
            >
              + 새 폴더
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default KakaoPlaceOverlay;
