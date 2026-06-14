import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

import { createRandomUuid } from '../utils/createRandomUuid';
import { isOwnCheckinRow } from '../utils/checkinDisplayName.js';

function newRealtimeTopicSuffix() {
  return createRandomUuid();
}

/** CheckInToast·CheckinButton 등 훅 인스턴스가 나뉘어도 최근 체크인 목록 공유 */
let recentCheckinsStore = [];
const recentCheckinsListeners = new Set();
let recentCheckinsBootstrapped = false;

/** 홈 좌측 피드 — 초기 목록은 무시, 이후 실시간 타인 체크인만 */
let peerCheckinFeedBootstrapped = false;
const seenPeerCheckinIds = new Set();

/**
 * 타인 실시간 체크인만 반환(팝업 토스트·과거 목록 제외).
 * @param {Array} rows
 * @param {object|null} authUser
 * @param {object|null} [profileRow]
 */
export function consumeNewPeerCheckinRows(rows, authUser, profileRow) {
  const list = Array.isArray(rows) ? rows : [];
  if (!peerCheckinFeedBootstrapped) {
    for (const r of list) {
      if (r?.id) seenPeerCheckinIds.add(String(r.id));
    }
    peerCheckinFeedBootstrapped = true;
    return [];
  }
  const fresh = [];
  for (const r of list) {
    const id = String(r?.id ?? "");
    if (!id || seenPeerCheckinIds.has(id)) continue;
    seenPeerCheckinIds.add(id);
    if (isOwnCheckinRow(r, authUser, profileRow)) continue;
    fresh.push(r);
  }
  return fresh;
}

function publishRecentCheckins(next) {
  recentCheckinsStore = Array.isArray(next) ? next : [];
  recentCheckinsListeners.forEach((fn) => fn(recentCheckinsStore));
}

function prependRecentCheckin(row) {
  if (!row?.id) return;
  const id = String(row.id);
  const rest = recentCheckinsStore.filter((r) => String(r?.id) !== id);
  publishRecentCheckins([row, ...rest].slice(0, 15));
}

async function fetchRecentCheckinsShared() {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('check_ins')
      .select(
        'id, user_id, user_nickname, place_id, place_name, place_address, created_at',
      )
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(15);
    if (error) throw error;
    publishRecentCheckins(Array.isArray(data) ? data : []);
  } catch (error) {
    console.error('최근 체크인 로드 오류:', error);
  }
}

export const useRealtimeCheckins = () => {
  /** 동일 토픽명으로 여러 훅이 구독하면 "after subscribe()" 오류 → 컴포넌트마다 고유 채널 */
  const realtimeTopicRef = useRef(null);
  if (realtimeTopicRef.current == null) {
    realtimeTopicRef.current = newRealtimeTopicSuffix();
  }
  const [hotPlaces, setHotPlaces] = useState([]);
  const [checkinRanking, setCheckinRanking] = useState([]);
  const [recentCheckins, setRecentCheckins] = useState(recentCheckinsStore);
  const [placeCheckinCounts, setPlaceCheckinCounts] = useState({});

  useEffect(() => {
    const onUpdate = (next) => setRecentCheckins(next);
    recentCheckinsListeners.add(onUpdate);
    setRecentCheckins(recentCheckinsStore);
    if (!recentCheckinsBootstrapped) {
      recentCheckinsBootstrapped = true;
      void fetchRecentCheckinsShared();
    }
    return () => {
      recentCheckinsListeners.delete(onUpdate);
    };
  }, []);

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

      prependRecentCheckin(row);

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
        fetchCheckinRanking(),
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

          prependRecentCheckin(payload.new);

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
