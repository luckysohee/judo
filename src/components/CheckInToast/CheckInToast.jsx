import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRealtimeCheckins } from '../../hooks/useRealtimeCheckins';
import { useAuth } from '../../context/AuthContext';
import { useToastSettings } from '../../hooks/useToastSettings';

// 닉네임과 이모지콘 매핑
const getUserDisplay = (userNickname) => {
  const nicknameMap = {
    '술고래': { emoji: '🐋', display: '술고래' },
    '맥주왕': { emoji: '👑', display: '맥주왕' },
    '와인여왕': { emoji: '👸', display: '와인여왕' },
    '소주신': { emoji: '🍶', display: '소주신' },
    '막걸리공주': { emoji: '🥛', display: '막걸리공주' },
    '고기마스터': { emoji: '🍖', display: '고기마스터' },
    '해장요정': { emoji: '🧚', display: '해장요정' },
    '바텐더': { emoji: '🍸', display: '바텐더' },
    '술꾼': { emoji: '🍻', display: '술꾼' },
    '와인러버': { emoji: '🍷', display: '와인러버' },
    '포차사장': { emoji: '�', display: '포차사장' },
    '술잔박사': { emoji: '🥃', display: '술잔박사' }
  };
  
  // 기본 닉네임이나 이모지콘 할당 (동일 닉네임은 항상 같은 이모지)
  if (!nicknameMap[userNickname]) {
    const emojis = ['🍻', '🍷', '🍶', '🍸', '🥃'];
    const key = String(userNickname || '');
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    const emoji = emojis[h % emojis.length];
    return { emoji, display: userNickname || '음악가' };
  }
  
  return nicknameMap[userNickname];
};

const CheckInToast = () => {
  const { recentCheckins } = useRealtimeCheckins();
  const { user } = useAuth();
  const { toastEnabled } = useToastSettings();
  const [displayCheckins, setDisplayCheckins] = useState([]);
  const [userLocation, setUserLocation] = useState(null);

  // 토스트 꺼져있으면 아예 렌더링 안 함
  if (!toastEnabled) {
    return null;
  }

  // 사용자 위치 가져오기
  useEffect(() => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.log('위치 가져오기 실패:', error);
          // 기본 위치 (서울 시청)
          setUserLocation({ lat: 37.5665, lng: 126.9780 });
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 60000 // 1분 캐시
        }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    } else {
      // 기본 위치
      setUserLocation({ lat: 37.5665, lng: 126.9780 });
    }
  }, []);

  // 거리 계산 함수 (Haversine 공식)
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // 지구 반경 (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // km
  };

  // 3km 내 체크인 필터링
  const filterNearbyCheckins = (checkins) => {
    if (!userLocation) return checkins; // 위치 정보 없으면 전체 표시
    
    return checkins.filter(checkin => {
      // 체크인 위치 정보가 있는 경우에만 필터링
      if (checkin.latitude && checkin.longitude) {
        const distance = calculateDistance(
          userLocation.lat, 
          userLocation.lng,
          checkin.latitude, 
          checkin.longitude
        );
        return distance <= 3; // 3km 이내
      }
      // 위치 정보 없는 체크인은 표시 (테스트용)
      return true;
    });
  };

  /** Supabase check_ins 행 → 토스트용 (user_nickname / place_name) */
  const enrichCheckinRow = (c) => {
    const nick =
      (c.user_nickname || c.user || "").trim() || "사용자";
    const placeLabel = (c.place_name || c.place || "").trim();
    const disp = getUserDisplay(nick);
    return {
      ...c,
      user: nick,
      place: placeLabel,
      emoji: c.emoji || disp.emoji,
    };
  };

  // 체크인 그룹화 함수 (같은 시간대에 체크인한 사용자 묶기)
  const groupCheckins = (checkins) => {
    const groups = [];

    checkins.forEach((raw) => {
      const checkin = enrichCheckinRow(raw);
      const checkinTime = new Date(checkin.timestamp || checkin.created_at);

      // 10초 이내의 체크인은 같은 그룹으로 묶기
      const existingGroup = groups.find((group) => {
        const groupTime = new Date(group.timestamp);
        const timeDiffG = Math.abs(groupTime - checkinTime);
        return timeDiffG < 10000; // 10초
      });

      if (existingGroup) {
        existingGroup.users.push(checkin);
      } else {
        groups.push({
          id: checkin.id,
          users: [checkin],
          timestamp: checkin.timestamp || checkin.created_at,
          place: checkin.place,
        });
      }
    });

    return groups;
  };

  // 그룹화된 체크인 표시 생성
  const createGroupDisplay = (group) => {
    const users = group.users;
    const timeAgo = getTimeAgo(group.timestamp);
    
    if (users.length === 1) {
      // 단일 체크인
      const user = users[0];
      return {
        id: group.id,
        type: 'single',
        emoji: user.emoji,
        user: user.user,
        place: user.place,
        time: timeAgo,
        timestamp: group.timestamp
      };
    } else {
      // 다중 체크인
      const firstUser = users[0];
      const otherCount = users.length - 1;
      return {
        id: group.id,
        type: 'multiple',
        emoji: firstUser.emoji,
        user: firstUser.user,
        place: group.place,
        otherCount: otherCount,
        time: timeAgo,
        timestamp: group.timestamp,
        allUsers: users
      };
    }
  };

  // 테스트용 시뮬레이션 (실제 체크인이 없을 때만)
  useEffect(() => {
    // 실제 체크인이 없으면 테스트 데이터 표시
    if (recentCheckins.length === 0) {
      // 가끔 여러 명이 동시에 체크인하는 시나리오 추가
      const createTestScenario = () => {
        const now = Date.now();
        const randomId = Math.random().toString(36).substr(2, 9); // 고유 ID 생성
        const scenarios = [
          // 단일 체크인 시나리오 (사용자 위치 근처) - 방금 전
          [
            { 
              id: `test-single-${randomId}`, 
              user: '술고래', 
              place: '주진당', 
              emoji: '🐋', 
              timestamp: new Date(now - 30000), // 30초 전
              latitude: userLocation ? userLocation.lat + 0.01 : 37.5765,
              longitude: userLocation ? userLocation.lng + 0.01 : 126.9880
            }
          ],
          // 다중 체크인 시나리오 - 5분 전
          [
            { 
              id: `test-multi-1-${randomId}`, 
              user: '맥주왕', 
              place: '신전떡볶이', 
              emoji: '👑', 
              timestamp: new Date(now - 300000), // 5분 전
              latitude: userLocation ? userLocation.lat - 0.01 : 37.5665,
              longitude: userLocation ? userLocation.lng - 0.01 : 126.9780
            },
            { 
              id: `test-multi-2-${randomId}`, 
              user: '와인여왕', 
              place: '신전떡볶이', 
              emoji: '👸', 
              timestamp: new Date(now - 300000), // 5분 전
              latitude: userLocation ? userLocation.lat - 0.01 : 37.5665,
              longitude: userLocation ? userLocation.lng - 0.01 : 126.9780
            },
            { 
              id: `test-multi-3-${randomId}`, 
              user: '소주신', 
              place: '신전떡볶이', 
              emoji: '🍶', 
              timestamp: new Date(now - 300000), // 5분 전
              latitude: userLocation ? userLocation.lat - 0.01 : 37.5665,
              longitude: userLocation ? userLocation.lng - 0.01 : 126.9780
            }
          ],
          // 단일 체크인 시나리오 - 23분 전
          [
            { 
              id: `test-single-2-${randomId}`, 
              user: '해장요정', 
              place: '건대 고깃집', 
              emoji: '🧚', 
              timestamp: new Date(now - 1380000), // 23분 전
              latitude: userLocation ? userLocation.lat + 0.02 : 37.5865,
              longitude: userLocation ? userLocation.lng + 0.02 : 126.9980
            }
          ],
          // 다중 체크인 시나리오 - 1시간 전
          [
            { 
              id: `test-multi-4-${randomId}`, 
              user: '칵테일마스터', 
              place: '홍대 포차', 
              emoji: '🍸', 
              timestamp: new Date(now - 3600000), // 1시간 전
              latitude: userLocation ? userLocation.lat - 0.02 : 37.5465,
              longitude: userLocation ? userLocation.lng - 0.02 : 126.9680
            },
            { 
              id: `test-multi-5-${randomId}`, 
              user: '위스키전문가', 
              place: '홍대 포차', 
              emoji: '🥃', 
              timestamp: new Date(now - 3600000), // 1시간 전
              latitude: userLocation ? userLocation.lat - 0.02 : 37.5465,
              longitude: userLocation ? userLocation.lng - 0.02 : 126.9680
            }
          ]
        ];
        
        return scenarios[Math.floor(Math.random() * scenarios.length)];
      };
      
      const initialScenario = createTestScenario();
      // 3km 내 체크인만 필터링
      const filteredScenario = filterNearbyCheckins(initialScenario);
      // 그룹화하고 포맷팅
      const groupedScenario = groupCheckins(filteredScenario);
      const formattedScenario = groupedScenario.map(group => createGroupDisplay(group));
      setDisplayCheckins(formattedScenario);
      
      // 4초마다 새로운 시나리오
      const interval = setInterval(() => {
        const newScenario = createTestScenario();
        // 3km 내 체크인만 필터링
        const filteredScenario = filterNearbyCheckins(newScenario);
        // 그룹화하고 포맷팅
        const groupedScenario = groupCheckins(filteredScenario);
        const formattedScenario = groupedScenario.map(group => createGroupDisplay(group));
        setDisplayCheckins(prev => [...prev.slice(-3), ...formattedScenario]);
        
        // 8초 후 오래된 것들 제거
        setTimeout(() => {
          setDisplayCheckins(prev => prev.filter(c => formattedScenario.some(fs => fs.id === c.id)));
        }, 8000);
      }, 4000);
      
      return () => clearInterval(interval);
    }
  }, [recentCheckins]);

  // 실제 체크인 데이터 처리
  useEffect(() => {
    if (recentCheckins.length > 0) {
      // 3km 내 체크인 필터링
      const nearbyCheckins = filterNearbyCheckins(recentCheckins.slice(0, 10));
      
      // 체크인 데이터 그룹화
      const groupedCheckins = groupCheckins(nearbyCheckins);
      const displayCheckins = groupedCheckins.slice(0, 3);
      const formattedCheckins = displayCheckins.map(group => createGroupDisplay(group));
      
      setDisplayCheckins(formattedCheckins);
      
      // 8초 후 오래된 그룹 제거
      formattedCheckins.forEach((group) => {
        setTimeout(() => {
          setDisplayCheckins(prev => prev.filter(g => g.id !== group.id));
        }, 8000);
      });
    }
  }, [recentCheckins, userLocation]);

  // 시간 포맷 함수
  const getTimeAgo = (timestamp) => {
    const now = new Date();
    const checkinTime = new Date(timestamp);
    const diffMs = now - checkinTime;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}시간 전`;
    return `${Math.floor(diffMins / 1440)}일 전`;
  };

  const rowBase = {
    fontSize: "12px",
    lineHeight: 1.35,
    color: "#4b5563",
    backgroundColor: "rgba(255,255,255,0.72)",
    WebkitBackdropFilter: "blur(8px)",
    backdropFilter: "blur(8px)",
    padding: "3px 8px",
    borderRadius: "999px",
    border: "1px solid rgba(255,255,255,0.45)",
    whiteSpace: "nowrap",
    textAlign: "left",
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    flexShrink: 0,
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: "6px",
        maxHeight: "min(168px, 36vh)",
        overflowY: "auto",
        overflowX: "hidden",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <AnimatePresence>
        {displayCheckins.map((checkIn, index) => (
          <motion.div
            key={checkIn.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{
              opacity: Math.max(0.55, 1 - index * 0.12),
              y: 0,
            }}
            exit={{ opacity: 0, y: -10, transition: { duration: 0.3 } }}
            style={{
              ...rowBase,
            }}
          >
            {checkIn.type === "single" ? (
              <>
                <span style={{ marginRight: "4px" }}>{checkIn.emoji}</span>
                <span style={{ fontWeight: 600, color: "#1f2937" }}>
                  {checkIn.user}
                </span>
                <span>님이 </span>
                <span style={{ fontWeight: 600, color: "#2563eb" }}>
                  {checkIn.place}
                </span>
                <span>에 체크인 ({checkIn.time})</span>
              </>
            ) : (
              <>
                <span style={{ marginRight: "4px" }}>{checkIn.emoji}</span>
                <span style={{ fontWeight: 600, color: "#1f2937" }}>
                  {checkIn.user}
                </span>
                <span>님 외 </span>
                <span style={{ fontWeight: 600, color: "#ea580c" }}>
                  {checkIn.otherCount}명
                </span>
                <span>이 </span>
                <span style={{ fontWeight: 600, color: "#2563eb" }}>
                  {checkIn.place}
                </span>
                <span>에 체크인 ({checkIn.time})</span>
              </>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default CheckInToast;
