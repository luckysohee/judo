import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

function newRealtimeTopicSuffix() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export const useRealtimeCheckins = () => {
  /** 동일 토픽명으로 여러 훅이 구독하면 "after subscribe()" 오류 → 컴포넌트마다 고유 채널 */
  const realtimeTopicRef = useRef(null);
  if (realtimeTopicRef.current == null) {
    realtimeTopicRef.current = newRealtimeTopicSuffix();
  }
  const [hotPlaces, setHotPlaces] = useState([]);
  const [checkinRanking, setCheckinRanking] = useState([]);
  const [recentCheckins, setRecentCheckins] = useState([]);
  const [placeCheckinCounts, setPlaceCheckinCounts] = useState({});

  // 핫플레이스 데이터 가져오기
  const fetchHotPlaces = async () => {
    try {
      const { data, error } = await supabase.rpc('get_hot_places');
      if (error) throw error;
      setHotPlaces(data || []);
    } catch (error) {
      console.error('핫플레이스 데이터 로드 오류:', error);
    }
  };

  // 체크인 랭킹 가져오기
  const fetchCheckinRanking = async () => {
    try {
      const { data, error } = await supabase.rpc('get_checkin_ranking');
      if (error) throw error;
      setCheckinRanking(data || []);
    } catch (error) {
      console.error('체크인 랭킹 로드 오류:', error);
    }
  };

  // 지도 마커 배지: 한잔 누적(total_dedup) — 카드 get_place_hanjan_stats·DB와 동일 기준
  const fetchPlaceCheckinCount = async (placeId) => {
    try {
      const { data, error } = await supabase.rpc("get_place_hanjan_stats", {
        p_place_id: String(placeId).trim(),
      });
      if (error) throw error;
      if (data && typeof data === "object") {
        return Math.max(0, Number(data.total_dedup) || 0);
      }
      return 0;
    } catch (error) {
      console.error("장소 한잔 집계 로드 오류:", error);
      return 0;
    }
  };

  /** 장소 카드용 한잔함 집계 (get_place_hanjan_stats) */
  const fetchPlaceHanjanStats = async (placeId) => {
    if (placeId == null || String(placeId).trim() === "") return null;
    try {
      const { data, error } = await supabase.rpc("get_place_hanjan_stats", {
        p_place_id: String(placeId).trim(),
      });
      if (error) throw error;
      return data ?? null;
    } catch (error) {
      console.warn("한잔함 통계 로드(get_place_hanjan_stats 마이그레이션 확인):", error?.message || error);
      return null;
    }
  };

  // 모든 장소의 체크인 수 업데이트
  const updateAllPlaceCheckinCounts = async () => {
    const hotPlaceIds = hotPlaces.map((place) => place.place_id);
    if (hotPlaceIds.length === 0) {
      setPlaceCheckinCounts({});
      return;
    }
    const pairs = await Promise.all(
      hotPlaceIds.map(async (placeId) => {
        const count = await fetchPlaceCheckinCount(placeId);
        return [placeId, count];
      })
    );
    setPlaceCheckinCounts(Object.fromEntries(pairs));
  };

  // 체크인하기 (서버 RPC: 장소 좌표 대비 GPS 거리 검증 후에만 INSERT)
  const performCheckin = async ({
    userNickname,
    placeId,
    placeName,
    placeAddress,
    placeLat,
    placeLng,
    userLat,
    userLng,
    accuracyM,
    skipDistanceCheck = false,
  }) => {
    try {
      const { data, error } = await supabase.rpc("perform_check_in_nearby", {
        p_user_nickname: userNickname,
        p_place_id: String(placeId),
        p_place_name: placeName,
        p_place_address: placeAddress || "",
        p_place_lat: skipDistanceCheck ? null : placeLat,
        p_place_lng: skipDistanceCheck ? null : placeLng,
        p_user_lat: skipDistanceCheck ? null : userLat,
        p_user_lng: skipDistanceCheck ? null : userLng,
        p_accuracy_m: skipDistanceCheck ? null : accuracyM ?? null,
        p_skip_distance_check: skipDistanceCheck,
      });

      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error("checkin_no_row");

      // 랭킹/핫플 새로고침은 N회 RPC를 순차 호출할 수 있어 수십 초 걸림 → UI 블로킹 방지
      void Promise.all([
        fetchHotPlaces(),
        fetchCheckinRanking(),
        updateAllPlaceCheckinCounts(),
      ]).catch((e) => console.warn("체크인 후 목록 갱신:", e));

      return row;
    } catch (error) {
      console.error('체크인 오류:', error);
      throw error;
    }
  };

  // 초기 데이터 로드
  useEffect(() => {
    const loadInitialData = async () => {
      await Promise.all([
        fetchHotPlaces(),
        fetchCheckinRanking()
      ]);
    };

    loadInitialData();
  }, []);

  // 실시간 체크인 구독
  useEffect(() => {
    const channel = supabase
      .channel(`check_ins_changes__${realtimeTopicRef.current}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'check_ins'
        },
        async (payload) => {
          console.log('새로운 체크인:', payload.new);
          
          // 최근 체크인 목록에 추가
          setRecentCheckins(prev => [payload.new, ...prev.slice(0, 9)]);
          
          // 데이터 새로고침
          await Promise.all([
            fetchHotPlaces(),
            fetchCheckinRanking()
          ]);
          
          // 해당 장소의 체크인 수 업데이트
          if (payload.new.place_id) {
            const count = await fetchPlaceCheckinCount(payload.new.place_id);
            setPlaceCheckinCounts(prev => ({
              ...prev,
              [payload.new.place_id]: count
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 주기적으로 체크인 수 업데이트 (5분마다)
  useEffect(() => {
    const interval = setInterval(() => {
      updateAllPlaceCheckinCounts();
    }, 5 * 60 * 1000); // 5분

    return () => clearInterval(interval);
  }, [hotPlaces]);

  return {
    hotPlaces,
    checkinRanking,
    recentCheckins,
    placeCheckinCounts,
    performCheckin,
    fetchPlaceCheckinCount,
    fetchPlaceHanjanStats,
    updateAllPlaceCheckinCounts
  };
};
