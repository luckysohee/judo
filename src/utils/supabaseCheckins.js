import { supabase } from "../lib/supabase";

// ==========================================
// CHECKINS API - CORE REAL-TIME FEATURE
// ==========================================

// 테스트용 함수 - 개발 중에만 사용
export async function testCheckinsConnection() {
  try {
    const { data, error } = await supabase
      .from('checkins')
      .select('*')
      .limit(5);
    
    console.log('✅ 체크인 연결 성공:', { data, error });
    return { data, error };
  } catch (err) {
    console.error('❌ 체크인 연결 에러:', err);
    return { data: null, error: err };
  }
}

// 실제 체크인 생성 테스트
export async function testCreateCheckin() {
  try {
    // 먼저 장소 찾기
    const { data: places, error: placeError } = await supabase
      .from('places')
      .select('id, name')
      .limit(1);
    
    if (placeError) {
      console.error('❌ 장소 찾기 에러:', placeError);
      return { data: null, error: placeError };
    }
    
    if (!places || places.length === 0) {
      console.log('❌ 장소가 없습니다');
      return { data: null, error: { message: '장소 없음' } };
    }
    
    console.log('📍 찾은 장소:', places[0]);
    
    // 체크인 생성
    const { data, error } = await supabase
      .from('checkins')
      .insert({
        user_id: '2fba03a4-5a6d-43e2-a7d8-7c78fa8df752',
        place_id: places[0].id,
        visibility: 'public'
      })
      .select();
    
    console.log('🎯 체크인 생성 결과:', { data, error });
    
    // 에러 상세 출력
    if (error) {
      console.log('❌ 에러 메시지:', error.message);
      console.log('❌ 에러 코드:', error.code);
      console.log('❌ 에러 상세:', error.details);
    }
    
    return { data, error };
    
  } catch (err) {
    console.error('❌ 체크인 생성 에러:', err);
    return { data: null, error: err };
  }
}

// 에러 상세 테스트 함수
export async function testCreateCheckinWithErrorDetails() {
  const result = await testCreateCheckin();
  console.log('🎯 전체 결과:', result);
  return result;
}

export async function createCheckin({ userId, placeId, visibility = 'public' }) {
  const { data, error } = await supabase
    .from("checkins")
    .insert([
      {
        user_id: userId,
        place_id: placeId,
        visibility: visibility,
      },
    ])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function fetchRecentCheckinsByPlace(placeId, limit = 10) {
  const { data, error } = await supabase
    .from("recent_place_checkins")
    .select("*")
    .eq("place_id", placeId)
    .limit(limit);

  if (error) {
    throw error;
  }

  return data || [];
}

export async function fetchHotPlaces1h(limit = 10) {
  const { data, error } = await supabase
    .from("hot_places_1h")
    .select("*")
    .order("checkin_count", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("핫플레이스(1시간) 조회 에러:", error);
    throw error;
  }

  return data;
}

export async function fetchHotPlaces24h(limit = 20) {
  const { data, error } = await supabase
    .from("hot_places_24h")
    .select("*")
    .order("checkin_count", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("핫플레이스(24시간) 조회 에러:", error);
    throw error;
  }

  return data;
}

export async function fetchUserCheckins(userId, visibility = null) {
  let query = supabase
    .from("checkins")
    .select(`
      *,
      places(id, name, address),
      profiles(id, nickname, avatar_url)
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (visibility) {
    query = query.eq("visibility", visibility);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data || [];
}

export async function deleteCheckin({ userId, checkinId }) {
  const { error } = await supabase
    .from("checkins")
    .delete()
    .eq("id", checkinId)
    .eq("user_id", userId); // Ensure user can only delete their own checkins

  if (error) {
    throw error;
  }
}

export async function updateCheckinVisibility({ userId, checkinId, visibility }) {
  const { data, error } = await supabase
    .from("checkins")
    .update({ 
      visibility: visibility,
      updated_at: new Date().toISOString()
    })
    .eq("id", checkinId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

// Real-time subscriptions
export function subscribeToPlaceCheckins(placeId, onChange) {
  if (!placeId) return () => {};

  const channel = supabase
    .channel(`checkins:place:${placeId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "checkins",
        filter: `place_id=eq.${placeId}`,
      },
      (payload) => {
        if (typeof onChange === "function") {
          onChange(payload);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToHotPlaces(onChange) {
  const channel = supabase
    .channel("hot_places")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "checkins",
      },
      (payload) => {
        // When checkins change, refresh hot places
        if (typeof onChange === "function") {
          onChange(payload);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
