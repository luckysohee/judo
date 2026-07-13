import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRealtimeCheckins, consumeNewPeerCheckinRows } from '../../hooks/useRealtimeCheckins';
import { useAuth } from '../../context/AuthContext';
import { useToastSettings } from '../../hooks/useToastSettings';
import { supabase } from '../../lib/supabase';
import {
  mergeCheckinProfileLabelRow,
  resolveCheckinRowDisplayName,
} from '../../utils/checkinDisplayName';

/** false — 실제 check_ins만 표시 (테스트용 데모 토스트 끔) */
const SHOW_CHECKIN_TOAST_DEMO = false;

/** 다른 사람 체크인 — 홈 좌측에 잠깐 보였다 사라짐 */
const OTHER_CHECKIN_VISIBLE_MS = 7000;

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

/** 체크인 피드 거리 필터 기본점 — 성수 (비보안 HTTP dev 등 GPS 불가 시) */
const DEFAULT_FEED_LOCATION = { lat: 37.54465, lng: 127.05595 };

const CheckInToast = () => {
  const { recentCheckins } = useRealtimeCheckins();
  const { user } = useAuth();
  const { toastEnabled } = useToastSettings();
  const [displayCheckins, setDisplayCheckins] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [profilesById, setProfilesById] = useState({});
  const hideTimersRef = useRef(new Set());

  const scheduleHide = useCallback((groupId) => {
    const timer = window.setTimeout(() => {
      hideTimersRef.current.delete(timer);
      setDisplayCheckins((prev) => prev.filter((g) => g.id !== groupId));
    }, OTHER_CHECKIN_VISIBLE_MS);
    hideTimersRef.current.add(timer);
  }, []);

  useEffect(
    () => () => {
      hideTimersRef.current.forEach((t) => window.clearTimeout(t));
      hideTimersRef.current.clear();
    },
    []
  );

  // 사용자 위치 가져오기 (HTTPS·localhost만 — http LAN dev는 GPS 생략)
  useEffect(() => {
    const canUseGeolocation =
      typeof window !== "undefined" &&
      window.isSecureContext &&
      typeof navigator !== "undefined" &&
      navigator.geolocation;

    if (!canUseGeolocation) {
      setUserLocation(DEFAULT_FEED_LOCATION);
      return undefined;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        if (import.meta.env.DEV && error?.code !== 1) {
          console.log("위치 가져오기 실패:", error);
        }
        setUserLocation(DEFAULT_FEED_LOCATION);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 60000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
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

  useEffect(() => {
    const ids = [
      ...new Set(
        (Array.isArray(recentCheckins) ? recentCheckins : [])
          .map((r) => String(r?.user_id || "").trim())
          .filter(Boolean)
      ),
    ];
    if (ids.length === 0) {
      setProfilesById({});
      return undefined;
    }
    let cancelled = false;
    void (async () => {
      const [{ data: profs, error: pe }, { data: curs, error: ce }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url")
            .in("id", ids),
          supabase
            .from("curators")
            .select("user_id, name, display_name, slug, username, avatar_url")
            .in("user_id", ids),
        ]);
      if (cancelled) return;
      if (pe) console.warn("checkin toast profiles:", pe.message || pe);
      if (ce) console.warn("checkin toast curators:", ce.message || ce);
      const byProfile = {};
      for (const p of profs || []) {
        if (p?.id) byProfile[String(p.id)] = p;
      }
      const byCurator = {};
      for (const c of curs || []) {
        const uid = c?.user_id != null ? String(c.user_id) : "";
        if (uid) byCurator[uid] = c;
      }
      const next = {};
      for (const id of ids) {
        next[id] = mergeCheckinProfileLabelRow(byProfile[id], byCurator[id]);
      }
      setProfilesById(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [recentCheckins]);

  /** Supabase check_ins 행 → 토스트용 (별명 우선) */
  const enrichCheckinRow = useCallback((c) => {
    const nick = resolveCheckinRowDisplayName(c, profilesById);
    const placeLabel = (c.place_name || c.place || "").trim();
    const disp = getUserDisplay(nick);
    return {
      ...c,
      user: nick,
      place: placeLabel,
      emoji: c.emoji || disp.emoji,
    };
  }, [profilesById]);

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

  // 테스트용 시뮬레이션 (실제 체크인이 없을 때만) — SHOW_CHECKIN_TOAST_DEMO 로 on/off
  useEffect(() => {
    if (!SHOW_CHECKIN_TOAST_DEMO) return;
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

  // 실시간으로 새로 들어온 타인 체크인만 — 홈 좌측 피드(최대 3줄, 잠시 후 사라짐)
  useEffect(() => {
    const freshRows = consumeNewPeerCheckinRows(recentCheckins, user);
    if (freshRows.length === 0) return;

    const nearbyCheckins = filterNearbyCheckins(freshRows);
    if (nearbyCheckins.length === 0) return;

    const groupedCheckins = groupCheckins(nearbyCheckins);
    const formattedCheckins = groupedCheckins.map((group) =>
      createGroupDisplay(group)
    );

    setDisplayCheckins((prev) => {
      const merged = [...formattedCheckins, ...prev];
      const byId = new Map();
      for (const item of merged) byId.set(item.id, item);
      return Array.from(byId.values()).slice(0, 3);
    });

    formattedCheckins.forEach((group) => scheduleHide(group.id));
  }, [recentCheckins, userLocation, user, scheduleHide, enrichCheckinRow]);

  useEffect(() => {
    if (!Object.keys(profilesById).length) return;
    setDisplayCheckins((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        const source = recentCheckins.find(
          (r) => String(r?.id) === String(item.id)
        );
        if (!source) return item;
        if (item.type === "single") {
          const nick = resolveCheckinRowDisplayName(source, profilesById);
          if (nick && nick !== item.user) {
            changed = true;
            return { ...item, user: nick };
          }
          return item;
        }
        if (item.type === "multiple" && Array.isArray(item.allUsers)) {
          const updatedUsers = item.allUsers.map((u) => {
            const src = recentCheckins.find(
              (r) => String(r?.id) === String(u?.id)
            );
            if (!src) return u;
            const n = resolveCheckinRowDisplayName(src, profilesById);
            return n && n !== u.user ? { ...u, user: n } : u;
          });
          const headNick = resolveCheckinRowDisplayName(
            recentCheckins.find(
              (r) => String(r?.id) === String(item.allUsers[0]?.id)
            ) || source,
            profilesById
          );
          if (
            headNick !== item.user ||
            updatedUsers.some((u, i) => u.user !== item.allUsers[i]?.user)
          ) {
            changed = true;
            return {
              ...item,
              user: headNick || item.user,
              allUsers: updatedUsers,
            };
          }
        }
        return item;
      });
      return changed ? next : prev;
    });
  }, [profilesById, recentCheckins]);

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

  if (!toastEnabled) {
    return null;
  }

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
