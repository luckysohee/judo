import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRealtimeCheckins } from "../../hooks/useRealtimeCheckins";
import { useToast } from "../Toast/ToastProvider";
import { supabase } from "../../lib/supabase";

export default function CheckinButton({ placeId, placeName, placeAddress }) {
  const { user } = useAuth();
  const { performCheckin, fetchPlaceCheckinCount, placeCheckinCounts } = useRealtimeCheckins();
  const { showToast } = useToast();
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentCheckinCount, setCurrentCheckinCount] = useState(0);

  // 사용자 닉네임 가져오기
  const getUserNickname = () => {
    if (!user) return "게스트";
    return user.user_metadata?.nickname || user.email?.split('@')[0] || "사용자";
  };

  // 체크인 상태 확인 (1시간 이내 체크인)
  useEffect(() => {
    if (!user?.id || !placeId) return;

    const checkUserCheckin = async () => {
      try {
        // Supabase에서 사용자의 최근 체크인 확인
        const { data, error } = await supabase
          .from('check_ins')
          .select('*')
          .eq('user_nickname', getUserNickname())
          .eq('place_id', placeId)
          .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) throw error;
        setIsCheckedIn(data && data.length > 0);
      } catch (error) {
        console.error("체크인 상태 확인 에러:", error);
      }
    };

    checkUserCheckin();
    
    // 5분마다 체크인 상태 확인
    const interval = setInterval(checkUserCheckin, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [user?.id, placeId]);

  // 장소 체크인 수 업데이트
  useEffect(() => {
    if (placeId) {
      fetchPlaceCheckinCount(placeId).then(setCurrentCheckinCount);
    }
  }, [placeId, fetchPlaceCheckinCount, placeCheckinCounts]);

  // 체크인 처리
  const handleCheckin = async () => {
    if (!user?.id) {
      showToast("로그인이 필요합니다.", "warning");
      return;
    }

    if (isCheckedIn) {
      showToast("이미 체크인한 장소입니다.", "warning");
      return;
    }

    setLoading(true);
    
    try {
      const nickname = getUserNickname();
      
      await performCheckin(
        nickname,
        placeId,
        placeName,
        placeAddress || ''
      );
      
      setIsCheckedIn(true);
      showToast("체크인이 완료되었습니다!", "success");
      
      // 체크인 생성
      await supabase
        .from('check_ins')
        .insert({
          user_id: user.id,
          place_id: placeId,
          visibility: 'public'
        });
      
      // 체크인 수 업데이트
      const newCount = await fetchPlaceCheckinCount(placeId);
      setCurrentCheckinCount(newCount);
      
    } catch (error) {
      console.error("체크인 에러:", error);
      showToast("체크인에 실패했습니다.", "error");
    } finally {
      setLoading(false);
    }
  };

  const buttonStyles = {
    checkinButton: {
      padding: '8px 16px',
      border: '2px solid #FF6B6B',
      borderRadius: '20px',
      backgroundColor: isCheckedIn ? '#FF6B6B' : 'white',
      color: isCheckedIn ? 'white' : '#FF6B6B',
      fontSize: '14px',
      fontWeight: 'bold',
      cursor: loading ? 'not-allowed' : 'pointer',
      transition: 'all 0.3s ease',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      minWidth: '120px',
      justifyContent: 'center'
    },
    checkinButtonHover: {
      backgroundColor: isCheckedIn ? '#FF5252' : '#FFF5F5',
      transform: 'scale(1.05)'
    },
    checkinCount: {
      fontSize: '12px',
      color: '#666',
      marginTop: '4px',
      textAlign: 'center'
    }
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <button
        style={buttonStyles.checkinButton}
        onClick={handleCheckin}
        disabled={loading}
        onMouseEnter={(e) => {
          if (!loading) {
            Object.assign(e.target.style, buttonStyles.checkinButtonHover);
          }
        }}
        onMouseLeave={(e) => {
          if (!loading) {
            Object.assign(e.target.style, buttonStyles.checkinButton);
          }
        }}
      >
        {loading ? (
          "처리 중..."
        ) : isCheckedIn ? (
          "✓ 체크인 완료"
        ) : (
          "📍 체크인"
        )}
      </button>
      
      {currentCheckinCount > 0 && (
        <div style={buttonStyles.checkinCount}>
          현재 {currentCheckinCount}명이 체크인 중!
        </div>
      )}
    </div>
  );
}
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
