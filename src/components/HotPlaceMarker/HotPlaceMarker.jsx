import React from 'react';
import { useRealtimeCheckins } from '../../hooks/useRealtimeCheckins';

const HotPlaceMarker = ({ placeId, placeName, children }) => {
  const { hotPlaces, placeCheckinCounts } = useRealtimeCheckins();

  // 이 장소가 핫플레이스인지 확인
  const isHotPlace = hotPlaces.some(place => place.place_id === placeId);
  const checkinCount = placeCheckinCounts[placeId] || 0;

  const markerStyles = {
    container: {
      position: 'relative',
      display: 'inline-block'
    },
    fireIcon: {
      position: 'absolute',
      top: '-8px',
      right: '-8px',
      fontSize: '20px',
      animation: 'flicker 1.5s ease-in-out infinite',
      zIndex: 10,
      filter: 'drop-shadow(0 0 8px rgba(255, 107, 107, 0.8))'
    },
    glowEffect: {
      position: 'absolute',
      top: '-4px',
      left: '-4px',
      right: '-4px',
      bottom: '-4px',
      borderRadius: '50%',
      background: isHotPlace ? 
        'radial-gradient(circle, rgba(255, 107, 107, 0.4) 0%, rgba(255, 107, 107, 0.2) 40%, transparent 70%)' :
        'none',
      animation: isHotPlace ? 'pulse 2s ease-in-out infinite' : 'none',
      zIndex: 1
    },
    tooltip: {
      position: 'absolute',
      bottom: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      color: 'white',
      padding: '8px 12px',
      borderRadius: '6px',
      fontSize: '12px',
      fontWeight: 'bold',
      whiteSpace: 'nowrap',
      marginBottom: '8px',
      opacity: 0,
      visibility: 'hidden',
      transition: 'all 0.3s ease',
      zIndex: 1000,
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
    },
    tooltipVisible: {
      opacity: 1,
      visibility: 'visible',
      transform: 'translateX(-50%) translateY(-4px)'
    },
    tooltipArrow: {
      position: 'absolute',
      top: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      borderLeft: '6px solid transparent',
      borderRight: '6px solid transparent',
      borderTop: '6px solid rgba(0, 0, 0, 0.9)'
    }
  };

  // CSS 애니메이션
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes flicker {
        0%, 100% { 
          opacity: 1; 
          transform: scale(1);
        }
        25% { 
          opacity: 0.8; 
          transform: scale(1.1);
        }
        50% { 
          opacity: 0.9; 
          transform: scale(0.95);
        }
        75% { 
          opacity: 0.7; 
          transform: scale(1.05);
        }
      }
      
      @keyframes pulse {
        0% {
          transform: scale(1);
          opacity: 0.6;
        }
        50% {
          transform: scale(1.2);
          opacity: 0.3;
        }
        100% {
          transform: scale(1);
          opacity: 0.6;
        }
      }
      
      @keyframes glow {
        0% {
          box-shadow: 0 0 5px rgba(255, 107, 107, 0.8);
        }
        50% {
          box-shadow: 0 0 20px rgba(255, 107, 107, 0.6), 0 0 30px rgba(255, 107, 107, 0.4);
        }
        100% {
          box-shadow: 0 0 5px rgba(255, 107, 107, 0.8);
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const [showTooltip, setShowTooltip] = React.useState(false);

  return (
    <div 
      style={markerStyles.container}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Glow 효과 */}
      {isHotPlace && (
        <div style={markerStyles.glowEffect} />
      )}
      
      {/* 불꽃 아이콘 */}
      {isHotPlace && (
        <div style={markerStyles.fireIcon}>
          🔥
        </div>
      )}
      
      {/* 원래 마커 */}
      {children}
      
      {/* 툴팁 */}
      <div 
        style={{
          ...markerStyles.tooltip,
          ...(showTooltip && markerStyles.tooltipVisible)
        }}
      >
        {isHotPlace ? (
          <>
            🔥 핫플레이스!
            <br />
            <span style={{ fontSize: '11px', fontWeight: 'normal' }}>
              현재 {checkinCount}명이 체크인 중
            </span>
          </>
        ) : (
          <>
            📍 {placeName}
            <br />
            <span style={{ fontSize: '11px', fontWeight: 'normal' }}>
              {checkinCount > 0 ? `${checkinCount}명이 체크인 중` : '첫 체크인을 기다려요'}
            </span>
          </>
        )}
        <div style={markerStyles.tooltipArrow} />
      </div>
    </div>
  );
};

export default HotPlaceMarker;
