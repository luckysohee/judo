import { useState } from "react";
import { createCheckin, deleteCheckin, fetchUserCheckins, fetchHotPlaces24h } from "../utils/supabaseCheckins";
import { useAuth } from "../context/AuthContext";

export default function CheckinTest() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [hotPlaces, setHotPlaces] = useState([]);

  // 테스트용 장소 ID (실제 DB에 있는 UUID)
  const testPlaceId = "d75385e9-fb76-4421-9cb5-49bca48160d0";
  const testPlaceName = "테스트 카페";

  const handleTestCheckin = async () => {
    if (!user?.id) {
      setMessage("❌ 로그인이 필요합니다.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      // 체크인 상태 확인
      const userCheckins = await fetchUserCheckins(user.id, 'public');
      const hasCheckin = userCheckins.some(checkin => checkin.place_id === testPlaceId);

      if (hasCheckin) {
        // 체크인 취소
        const existingCheckin = userCheckins.find(checkin => checkin.place_id === testPlaceId);
        if (existingCheckin) {
          await deleteCheckin({ userId: user.id, checkinId: existingCheckin.id });
          setMessage(`✅ ${testPlaceName} 체크인 취소 완료`);
        }
      } else {
        // 체크인 생성
        await createCheckin({
          userId: user.id,
          placeId: testPlaceId,
          visibility: 'public'
        });
        setMessage(`✅ ${testPlaceName} 체크인 완료`);
      }
    } catch (error) {
      console.error("체크인 테스트 에러:", error);
      setMessage(`❌ 에러: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadHotPlaces = async () => {
    try {
      const data = await fetchHotPlaces24h(5);
      setHotPlaces(data || []);
    } catch (error) {
      console.error("핫플레이스 로딩 에러:", error);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>🎯 체크인 기능 테스트</h1>
      
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>사용자 정보</h2>
        <div style={styles.info}>
          <p>로그인 상태: {user ? "✅ 로그인됨" : "❌ 로그인 안됨"}</p>
          {user && <p>사용자 ID: {user.id}</p>}
        </div>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>체크인 테스트</h2>
        <div style={styles.info}>
          <p>테스트 장소: {testPlaceName}</p>
          <p>장소 ID: {testPlaceId}</p>
        </div>
        
        <button
          onClick={handleTestCheckin}
          disabled={loading || !user}
          style={styles.button}
        >
          {loading ? "처리 중..." : "🎯 체크인 테스트"}
        </button>
        
        {message && <div style={styles.message}>{message}</div>}
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>핫플레이스</h2>
        <button onClick={loadHotPlaces} style={styles.button}>
          🔥 핫플레이스 로드
        </button>
        
        {hotPlaces.length > 0 && (
          <div style={styles.list}>
            {hotPlaces.map((place, index) => (
              <div key={place.id} style={styles.item}>
                <span>{index + 1}. {place.name}</span>
                <span>🎯 {place.checkin_count}회</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: "20px",
    maxWidth: "600px",
    margin: "0 auto",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  title: {
    fontSize: "24px",
    fontWeight: "800",
    marginBottom: "30px",
    textAlign: "center",
  },
  section: {
    background: "#f8f9fa",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "20px",
  },
  sectionTitle: {
    fontSize: "18px",
    fontWeight: "700",
    marginBottom: "15px",
  },
  info: {
    background: "#fff",
    padding: "15px",
    borderRadius: "8px",
    marginBottom: "15px",
    fontSize: "14px",
  },
  button: {
    background: "#007AFF",
    color: "#fff",
    border: "none",
    padding: "12px 20px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
    marginBottom: "15px",
  },
  message: {
    padding: "10px",
    borderRadius: "6px",
    fontSize: "14px",
    background: "#e8f5e8",
    border: "1px solid #c3e6c3",
  },
  list: {
    background: "#fff",
    borderRadius: "8px",
    padding: "10px",
  },
  item: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 0",
    borderBottom: "1px solid #eee",
    fontSize: "14px",
  },
};
