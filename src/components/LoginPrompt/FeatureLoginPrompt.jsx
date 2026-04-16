import React from 'react';
import { motion } from 'framer-motion';

const FeatureLoginPrompt = ({ feature, onClose, onLogin }) => {
  const getFeatureInfo = (featureType) => {
    const features = {
      follow: {
        title: '큐레이터 팔로우',
        description: '마음에 드는 큐레이터를 팔로우하고\n새로운 추천 장소를 받아보세요!',
        icon: '👥',
        benefits: [
          '좋아하는 큐레이터의 새로운 추천',
          '개인화된 장소 추천',
          '팔로워 전용 콘텐츠'
        ]
      },
      save: {
        title: '장소 저장',
        description: '마음에 드는 장소를 저장하고\n언제든지 다시 찾아보세요!',
        icon: '🔖',
        benefits: [
          '내 장소 폴더 관리',
          '저장한 장소 지도 표시',
          '다른 기기와 동기화'
        ]
      },
      location: {
        title: '내 위치 기능',
        description: '현재 위치에서 가까운 맛집을\n찾아보세요!',
        icon: '📍',
        benefits: [
          '실시간 내 주변 맛집',
          '도보 거리 순 정렬',
          '위치 기반 추천'
        ]
      },
      ai: {
        title: '주도 검색',
        description: '검색어와 거리로 후보를 골라\n주변에 맞는 장소를 찾아보세요!',
        icon: '🔎',
        benefits: [
          '자연어 한 줄 검색',
          '거리·키워드 기반 순위',
          '결과가 적을 때 확장 제안'
        ]
      },
      checkin: {
        title: '한잔함',
        description: '가본 술집에 한잔 흔적을 남기고\n분위기를 같이 나눠 보세요.',
        icon: '📸',
        benefits: [
          '방문 기록 저장',
          '친구들과 공유',
          '랭킹 시스템'
        ]
      },
      curator: {
        title: '큐레이터 신청',
        description: '큐레이터가 되어\n멋진 장소를 공유하세요!',
        icon: '🎨',
        benefits: [
          '장소 등록 및 공유',
          '팔로워 관리',
          '스튜디오 기능'
        ]
      }
    };

    return features[featureType] || features.save;
  };

  const featureInfo = getFeatureInfo(feature);

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
          {featureInfo.icon}
        </div>

        {/* 제목 */}
        <h2 style={{
          color: '#ffffff',
          fontSize: '24px',
          fontWeight: '600',
          marginBottom: '16px',
          margin: 0
        }}>
          {featureInfo.title}
        </h2>

        {/* 설명 */}
        <p style={{
          color: 'rgba(255,255,255,0.7)',
          fontSize: '16px',
          lineHeight: '1.5',
          marginBottom: '30px',
          whiteSpace: 'pre-line'
        }}>
          {featureInfo.description}
        </p>

        {/* 혜택 */}
        <div style={{
          marginBottom: '30px',
          textAlign: 'left'
        }}>
          <h3 style={{
            color: '#ffffff',
            fontSize: '14px',
            fontWeight: '600',
            marginBottom: '16px',
            textAlign: 'center'
          }}>
            로그인하면 이용 가능
          </h3>
          {featureInfo.benefits.map((benefit, index) => (
            <div key={index} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '12px',
              color: '#ffffff',
              fontSize: '14px'
            }}>
              <span style={{ fontSize: '16px' }}>✨</span>
              <span>{benefit}</span>
            </div>
          ))}
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
            로그인하고 이용하기
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
            닫기
          </motion.button>
        </div>

        {/* 안내 메시지 */}
        <div style={{
          marginTop: '20px',
          padding: '12px',
          backgroundColor: 'rgba(52, 152, 219, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(52, 152, 219, 0.3)'
        }}>
          <p style={{
            color: 'rgba(255,255,255,0.8)',
            fontSize: '12px',
            margin: 0,
            lineHeight: '1.4'
          }}>
            💡 Google, Kakao 계정으로 간편하게 로그인 가능합니다
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default FeatureLoginPrompt;
