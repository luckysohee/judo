import React from 'react';
import { useRealtimeCheckins } from '../../hooks/useRealtimeCheckins';

const CheckinRanking = ({ position = 'sidebar' }) => {
  const { checkinRanking } = useRealtimeCheckins();

  const getPositionStyles = () => {
    const baseStyles = {
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderRadius: '12px',
      padding: '16px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.2)'
    };

    switch (position) {
      case 'sidebar':
        return {
          ...baseStyles,
          width: '280px',
          position: 'fixed',
          right: '20px',
          top: '76px',
          maxHeight: '400px',
          overflowY: 'auto'
        };
      case 'bottom':
        return {
          ...baseStyles,
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          right: '20px',
          maxWidth: '600px',
          margin: '0 auto'
        };
      default:
        return baseStyles;
    }
  };

  const styles = {
    container: getPositionStyles(),
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '16px',
      paddingBottom: '12px',
      borderBottom: '2px solid #FF6B6B'
    },
    title: {
      fontSize: '18px',
      fontWeight: 'bold',
      color: '#333',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    fireIcon: {
      fontSize: '20px',
      animation: 'flicker 1.5s ease-in-out infinite'
    },
    rankingList: {
      listStyle: 'none',
      padding: 0,
      margin: 0
    },
    rankingItem: (index) => ({
      display: 'flex',
      alignItems: 'center',
      padding: '12px',
      marginBottom: '8px',
      borderRadius: '8px',
      backgroundColor: index === 0 ? '#FFF5F5' : index === 1 ? '#F8F9FA' : '#FAFAFA',
      border: index === 0 ? '2px solid #FF6B6B' : '1px solid #E9ECEF',
      transition: 'all 0.3s ease',
      cursor: 'pointer'
    }),
    rank: (index) => ({
      width: '30px',
      height: '30px',
      borderRadius: '50%',
      backgroundColor: index === 0 ? '#FF6B6B' : index === 1 ? '#FFA500' : index === 2 ? '#FFD700' : '#E9ECEF',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 'bold',
      fontSize: '14px',
      marginRight: '12px'
    }),
    placeInfo: {
      flex: 1,
      minWidth: 0
    },
    placeName: {
      fontSize: '14px',
      fontWeight: '600',
      color: '#333',
      marginBottom: '4px',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    },
    placeAddress: {
      fontSize: '12px',
      color: '#666',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    },
    checkinCount: {
      fontSize: '14px',
      fontWeight: 'bold',
      color: '#FF6B6B',
      marginLeft: '12px',
      minWidth: '40px',
      textAlign: 'center'
    },
    emptyState: {
      textAlign: 'center',
      padding: '40px 20px',
      color: '#666'
    },
    emptyIcon: {
      fontSize: '48px',
      marginBottom: '16px',
      opacity: 0.5
    }
  };

  // CSS 애니메이션
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes flicker {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateX(20px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
      .ranking-item {
        animation: slideIn 0.5s ease-out;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  if (!checkinRanking || checkinRanking.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h3 style={styles.title}>
            <span style={styles.fireIcon}>🔥</span>
            지금 핫한 가게
          </h3>
        </div>
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>📍</div>
          <p>아직 체크인 기록이 없습니다</p>
          <p style={{ fontSize: '12px', marginTop: '8px' }}>
            가장 먼저 체크인해보세요!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>
          <span style={styles.fireIcon}>🔥</span>
          지금 핫한 가게
        </h3>
        <span style={{ fontSize: '12px', color: '#666' }}>
          TOP {checkinRanking.length}
        </span>
      </div>
      
      <ul style={styles.rankingList}>
        {checkinRanking.map((place, index) => {
          const itemStyle = {
            ...styles.rankingItem(index),
            animationDelay: `${index * 0.1}s`
          };
          
          return (
            <li
              key={place.place_id}
              style={itemStyle}
              className="ranking-item"
            >
              <div style={styles.rank(index)}>
                {index + 1}
              </div>
              
              <div style={styles.placeInfo}>
                <div style={styles.placeName} title={place.place_name}>
                  {place.place_name}
                </div>
                {place.place_address && (
                  <div style={styles.placeAddress} title={place.place_address}>
                    {place.place_address}
                  </div>
                )}
              </div>
              
              <div style={styles.checkinCount}>
                {place.total_checkins}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default CheckinRanking;
