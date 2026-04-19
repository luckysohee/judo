import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useRealtimeCheckins } from "../../hooks/useRealtimeCheckins";
import { TOAST_LAYER_Z_INDEX } from "../../constants/toastLayer.js";

const AnimatedToast = ({ position = 'top-right', maxToasts = 5 }) => {
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

      setToasts(prev => [newToast, ...prev.slice(0, maxToasts - 1)]);
    }
  }, [recentCheckins, maxToasts]);

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
      position: "fixed",
      zIndex: TOAST_LAYER_Z_INDEX,
      pointerEvents: "none",
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
      case 'bottom-right':
        return {
          ...baseStyles,
          bottom: '20px',
          right: '20px'
        };
      case 'bottom-center':
        return {
          ...baseStyles,
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)'
        };
      case 'bottom-left':
        return {
          ...baseStyles,
          bottom: '20px',
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

  const toastVariants = {
    initial: {
      opacity: 0,
      y: -50,
      scale: 0.8,
      transition: {
        duration: 0.2,
        ease: [0.4, 0, 0.2, 1]
      }
    },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1],
        staggerChildren: 0.1
      }
    },
    exit: {
      opacity: 0,
      y: -20,
      scale: 0.9,
      transition: {
        duration: 0.2,
        ease: [0.4, 0, 1, 1]
      }
    }
  };

  const childVariants = {
    initial: {
      opacity: 0,
      x: 20
    },
    animate: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.2,
        ease: [0.4, 0, 0.2, 1]
      }
    },
    exit: {
      opacity: 0,
      x: 20,
      transition: {
        duration: 0.2,
        ease: [0.4, 0, 1, 1]
      }
    }
  };

  const toastStyles = {
    container: {
      ...getPositionStyles(),
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      maxWidth: '350px'
    },
    toast: {
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      color: 'white',
      padding: '14px 18px',
      borderRadius: '12px',
      fontSize: '14px',
      fontWeight: '500',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      cursor: 'default',
      pointerEvents: 'auto',
      position: 'relative',
      overflow: 'hidden'
    },
    toastBefore: {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '2px',
      background: 'linear-gradient(90deg, #4FC3F7, #FFD54F, #FF6B6B)',
      transform: 'translateX(-100%)',
      transition: 'transform 3s linear'
    },
    nickname: {
      color: '#4FC3F7',
      fontWeight: 'bold',
      display: 'inline'
    },
    placeName: {
      color: '#FFD54F',
      fontWeight: 'bold',
      display: 'inline'
    },
    actionText: {
      color: 'rgba(255, 255, 255, 0.8)',
      fontSize: '13px'
    },
    closeIcon: {
      position: 'absolute',
      top: '8px',
      right: '8px',
      cursor: 'pointer',
      opacity: 0.6,
      fontSize: '16px',
      transition: 'opacity 0.2s ease',
      pointerEvents: 'auto'
    },
    closeIconHover: {
      opacity: 1
    }
  };

  const tree = (
    <div style={toastStyles.container}>
      <AnimatePresence mode="popLayout">
        {toasts.map((toast, index) => {
          const age = Date.now() - toast.timestamp;
          const isExiting = age > 2500;

          return (
            <motion.div
              key={toast.id}
              variants={toastVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              style={{
                ...toastStyles.toast,
                zIndex: TOAST_LAYER_Z_INDEX + 2 + index,
              }}
              layout
            >
              {/* 진행 바 효과 */}
              <motion.div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: '2px',
                  background: 'linear-gradient(90deg, #4FC3F7, #FFD54F, #FF6B6B)',
                  width: '100%',
                  transformOrigin: 'left'
                }}
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 3, ease: 'linear' }}
              />
              
              {/* 닫기 버튼 */}
              <motion.button
                style={toastStyles.closeIcon}
                whileHover={{ opacity: 1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  setToasts(prev => prev.filter(t => t.id !== toast.id));
                }}
              >
                ×
              </motion.button>

              {/* Toast 내용 */}
              <motion.div
                variants={childVariants}
                style={{ paddingRight: '20px' }}
              >
                <motion.span variants={childVariants}>
                  <span style={toastStyles.nickname}>{toast.userNickname}</span>
                  <span style={toastStyles.actionText}>님이 </span>
                  <span style={toastStyles.placeName}>{toast.placeName}</span>
                  <span style={toastStyles.actionText}>에 체크인하셨습니다!</span>
                </motion.span>
              </motion.div>

              {/* 미세한 배경 애니메이션 */}
              <motion.div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.05) 50%, transparent 70%)',
                  transform: 'translateX(-100%)'
                }}
                animate={{
                  transform: ['translateX(-100%)', 'translateX(100%)']
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'linear'
                }}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(tree, document.body);
};

export default AnimatedToast;
