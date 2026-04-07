import React from 'react';
import { motion } from 'framer-motion';

const LoginPrompt = ({ onClose, onLogin }) => {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }}>
      <motion.div
        style={{
          backgroundColor: '#1a1a1a',
          borderRadius: '20px',
          padding: '40px',
          maxWidth: '400px',
          width: '90%',
          border: '1px solid rgba(255,255,255,0.1)',
          textAlign: 'center'
        }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
      >
        {/* 아이콘 */}
        <div style={{
          fontSize: '48px',
          marginBottom: '20px'
        }}>
          🎯
        </div>

        {/* 제목 */}
        <h2 style={{
          color: '#ffffff',
          fontSize: '24px',
          fontWeight: '600',
          marginBottom: '16px',
          margin: 0
        }}>
          더 좋은 추천을 받으세요!
        </h2>

        {/* 설명 */}
        <p style={{
          color: 'rgba(255,255,255,0.7)',
          fontSize: '16px',
          lineHeight: '1.5',
          marginBottom: '30px'
        }}>
          로그인하면 개인화된 맞춤 추천과<br />
          특별한 혜택을 받을 수 있어요
        </p>

        {/* 혜택 */}
        <div style={{
          marginBottom: '30px',
          textAlign: 'left'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '12px',
            color: '#ffffff',
            fontSize: '14px'
          }}>
            <span style={{ fontSize: '16px' }}>✨</span>
            <span>개인화된 장소 추천</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '12px',
            color: '#ffffff',
            fontSize: '14px'
          }}>
            <span style={{ fontSize: '16px' }}>📝</span>
            <span>검색 기록 저장</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '12px',
            color: '#ffffff',
            fontSize: '14px'
          }}>
            <span style={{ fontSize: '16px' }}>🔖</span>
            <span>즐겨찾기 폴더 관리</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: '#ffffff',
            fontSize: '14px'
          }}>
            <span style={{ fontSize: '16px' }}>🎁</span>
            <span>큐레이터 전용 기능</span>
          </div>
        </div>

        {/* 버튼 */}
        <div style={{
          display: 'flex',
          gap: '12px'
        }}>
          <motion.button
            type="button"
            onClick={onLogin}
            style={{
              flex: 1,
              padding: '14px 24px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: '#3498db',
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
            whileHover={{ backgroundColor: '#2980b9' }}
            whileTap={{ scale: 0.95 }}
          >
            로그인하기
          </motion.button>

          <motion.button
            type="button"
            onClick={onClose}
            style={{
              padding: '14px 24px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.2)',
              backgroundColor: 'transparent',
              color: 'rgba(255,255,255,0.7)',
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
            whileHover={{ 
              backgroundColor: 'rgba(255,255,255,0.1)',
              color: '#ffffff'
            }}
            whileTap={{ scale: 0.95 }}
          >
            나중에
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPrompt;
