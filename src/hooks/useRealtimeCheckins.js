import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const useRealtimeCheckins = () => {
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

  // 특정 장소의 체크인 수 가져오기
  const fetchPlaceCheckinCount = async (placeId) => {
    try {
      const { data, error } = await supabase.rpc('get_place_checkin_count', { 
        p_place_id: placeId 
      });
      if (error) throw error;
      return data || 0;
    } catch (error) {
      console.error('장소 체크인 수 로드 오류:', error);
      return 0;
    }
  };

  // 모든 장소의 체크인 수 업데이트
  const updateAllPlaceCheckinCounts = async () => {
    const hotPlaceIds = hotPlaces.map(place => place.place_id);
    const counts = {};
    
    for (const placeId of hotPlaceIds) {
      const count = await fetchPlaceCheckinCount(placeId);
      counts[placeId] = count;
    }
    
    setPlaceCheckinCounts(counts);
  };

  // 체크인하기
  const performCheckin = async (userNickname, placeId, placeName, placeAddress) => {
    try {
      const { data, error } = await supabase
        .from('check_ins')
        .insert({
          user_nickname: userNickname,
          place_id: placeId,
          place_name: placeName,
          place_address: placeAddress
        })
        .select()
        .single();

      if (error) throw error;
      
      // 체크인 성공 후 데이터 새로고침
      await Promise.all([
        fetchHotPlaces(),
        fetchCheckinRanking(),
        updateAllPlaceCheckinCounts()
      ]);

      return data;
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
      .channel('check_ins_changes')
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
    updateAllPlaceCheckinCounts
  };
};
