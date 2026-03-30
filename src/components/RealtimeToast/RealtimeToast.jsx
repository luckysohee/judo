import React, { useState, useEffect } from 'react';
import { useRealtimeCheckins } from '../hooks/useRealtimeCheckins';

const RealtimeToast = ({ position = 'top-right' }) => {
  const [toasts, setToasts] = useState([]);
  const { recentCheckins } = useRealtimeCheckins();

  // 새로운 체크인이 들어오면 Toast 생성
  useEffect(() => {
    if (recentCheckins.length > 0) {
      const latestCheckin = recentCheckins[0];
      
      const newToast = {
        id: `${latestCheckin.id}-${Date.now()}`,
        message: `${latestCheckin.user_nickname}님이 ${latestCheckin.place_name}에 체크인하셨습니다!`,
        timestamp: Date.now(),
        userNickname: latestCheckin.user_nickname,
        placeName: latestCheckin.place_name
      };

      setToasts(prev => [newToast, ...prev.slice(0, 4)]); // 최대 5개까지 표시
    }
  }, [recentCheckins]);

  // 3초 후 Toast 자동 제거
  useEffect(() => {
    const interval = setInterval(() => {
      setToasts(prev => prev.filter(toast => 
        Date.now() - toast.timestamp < 3000
      ));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const getPositionStyles = () => {
    const baseStyles = {
      position: 'fixed',
      zIndex: 9999,
      pointerEvents: 'none'
    };

    switch (position) {
      case 'top-right':
        return {
          ...baseStyles,
          top: '20px',
          right: '20px'
        };
      case 'top-center':
        return {
          ...baseStyles,
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)'
        };
      case 'top-left':
        return {
          ...baseStyles,
          top: '20px',
          left: '20px'
        };
      default:
        return {
          ...baseStyles,
          top: '20px',
          right: '20px'
        };
    }
  };

  const toastStyles = {
    container: {
      ...getPositionStyles(),
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      maxWidth: '350px'
    },
    toast: {
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '12px 16px',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '500',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      animation: 'slideInRight 0.3s ease-out',
      transition: 'all 0.3s ease-out',
      opacity: 1,
      transform: 'translateX(0)'
    },
    toastExiting: {
      opacity: 0,
      transform: 'translateX(100%)'
    },
    nickname: {
      color: '#4FC3F7',
      fontWeight: 'bold'
    },
    placeName: {
      color: '#FFD54F',
      fontWeight: 'bold'
    }
  };

  // CSS 애니메이션 추가
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideInRight {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes fadeOut {
        from {
          opacity: 1;
          transform: translateX(0);
        }
        to {
          opacity: 0;
          transform: translateX(100%);
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div style={toastStyles.container}>
      {toasts.map((toast) => {
        const age = Date.now() - toast.timestamp;
        const isExiting = age > 2500; // 2.5초 후 퇴장 애니메이션 시작

        return (
          <div
            key={toast.id}
            style={{
              ...toastStyles.toast,
              ...(isExiting && toastStyles.toastExiting)
            }}
          >
            <span style={toastStyles.nickname}>{toast.userNickname}</span>
            님이{' '}
            <span style={toastStyles.placeName}>{toast.placeName}</span>
            에 체크인하셨습니다!
          </div>
        );
      })}
    </div>
  );
};

export default RealtimeToast;
