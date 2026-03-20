import { useState, useEffect } from "react";
import { createCheckin, deleteCheckin, fetchUserCheckins } from "../../utils/supabaseCheckins";
import { useAuth } from "../../context/AuthContext";

export default function CheckinButton({ placeId, placeName }) {
  const { user } = useAuth();
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [loading, setLoading] = useState(false);

  // 숫자 ID를 UUID로 변환 (실제 places 테이블 기반)
  const getUuidFromId = (id) => {
    const idToUuid = {
      1: "d75385e9-fb76-4421-9cb5-49bca48160d0", // 을지로 골목집
      2: "a1b2c3d4-e5f6-7890-abcd-ef1234567890", // 연남동 맛집
      3: "f1e2d3c4-b5a6-7890-1234-567890abcdef", // 성수동 카페
      4: "b2c3d4e5-f6a7-8901-2345-6789abcdef12", // 합정동 술집
      5: "c3d4e5f6-a7b8-9012-3456-789abcdef123", // 홍대입구 맛집
    };
    return idToUuid[id] || null; // 없는 ID는 null 반환
  };

  const uuidPlaceId = getUuidFromId(placeId);

  // 체크인 상태 확인
  useEffect(() => {
    if (!user?.id || !placeId) return;

    const checkUserCheckin = async () => {
      try {
        const userCheckins = await fetchUserCheckins(user.id, 'public');
        
        // 1시간 이내 체크인만 유효한 것으로 간주
        const recentCheckin = userCheckins.find(checkin => {
          if (checkin.place_id !== uuidPlaceId) return false;
          
          const createdAt = new Date(checkin.created_at);
          const now = new Date();
          const hoursDiff = (now - createdAt) / (1000 * 60 * 60);
          return hoursDiff < 1; // 1시간 이내
        });
        
        setIsCheckedIn(!!recentCheckin);
      } catch (error) {
        console.error("체크인 상태 확인 에러:", error);
      }
    };

    checkUserCheckin();
    
    // 5분마다 체크인 상태 확인 (자동 만료 체크)
    const interval = setInterval(checkUserCheckin, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [user?.id, uuidPlaceId]);

  // 체크인 처리
  const handleCheckin = async () => {
    if (!user?.id) {
      alert("로그인이 필요합니다.");
      return;
    }

    if (!placeId) {
      alert("장소 정보가 없습니다.");
      return;
    }

    // UUID 변환 확인
    if (!uuidPlaceId) {
      console.error('❌ 유효하지 않은 placeId:', placeId);
      alert(`이 장소는 아직 체크인을 지원하지 않습니다: ${placeName}`);
      return;
    }

    // placeId가 유효한 UUID인지 확인
    if (typeof uuidPlaceId !== 'string' || uuidPlaceId.length < 10) {
      console.error('❌ 유효하지 않은 UUID:', uuidPlaceId);
      alert(`장소 ID 오류: ${uuidPlaceId}`);
      return;
    }

    setLoading(true);

    try {
      if (isCheckedIn) {
        // 체크인 취소
        const userCheckins = await fetchUserCheckins(user.id, 'public');
        const existingCheckin = userCheckins.find(checkin => checkin.place_id === uuidPlaceId);
        
        if (existingCheckin) {
          await deleteCheckin({ userId: user.id, checkinId: existingCheckin.id });
          setIsCheckedIn(false);
          console.log(`✅ ${placeName} 체크인 취소 완료`);
        }
      } else {
        // 체크인 생성
        await createCheckin({
          userId: user.id,
          placeId: uuidPlaceId,
          visibility: 'public'
        });
        setIsCheckedIn(true);
        console.log(`✅ ${placeName} 체크인 완료`);
      }
    } catch (error) {
      console.error("체크인 처리 에러:", error);
      alert(error.message || "체크인 처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <button style={styles.button} disabled>
        <span>🎯</span>
        <span>로그인 필요</span>
      </button>
    );
  }

  return (
    <button
      style={{
        ...styles.button,
        backgroundColor: isCheckedIn ? "#34C759" : "#007AFF",
        opacity: loading ? 0.7 : 1
      }}
      onClick={handleCheckin}
      disabled={loading}
    >
      <span>{loading ? "⏳" : isCheckedIn ? "✅" : "🎯"}</span>
      <span>{loading ? "처리 중..." : isCheckedIn ? "체크인 완료" : "체크인"}</span>
    </button>
  );
}

const styles = {
  button: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    padding: "10px 14px",
    borderRadius: "12px",
    border: "none",
    fontSize: "12px",
    fontWeight: "700",
    color: "#fff",
    cursor: "pointer",
    transition: "all 0.2s ease",
    minWidth: "90px",
    flexShrink: 0,
    height: "40px",
  },

  notCheckedIn: {
    background: "#007AFF",
  },

  checkedIn: {
    background: "#34C759",
  },

  loading: {
    opacity: 0.7,
    cursor: "not-allowed",
  },

  icon: {
    fontSize: "12px",
  },

  text: {
    flex: 1,
    textAlign: "center",
  },

  count: {
    background: "rgba(255,255,255,0.2)",
    borderRadius: "999px",
    padding: "2px 5px",
    fontSize: "9px",
    fontWeight: "800",
  },
};
