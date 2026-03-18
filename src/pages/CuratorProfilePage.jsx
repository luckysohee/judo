import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export default function CuratorProfilePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // URL 디코딩
  const decodedSlug = decodeURIComponent(slug);
  
  const [curator, setCurator] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!decodedSlug) return;
    fetchCurator();
  }, [decodedSlug]);

  const fetchCurator = async () => {
    try {
      console.log("Original slug:", slug);
      console.log("Decoded slug:", decodedSlug); // 디버깅
      
      const { data, error } = await supabase
        .from("curators")
        .select("*")
        .eq("slug", decodedSlug) // 디코딩된 slug 사용
        .single();

      console.log("Curator data:", data); // 디버깅
      console.log("Error:", error); // 디버깅

      if (error) throw error;
      setCurator(data);
      
      if (user) {
        await checkFollowStatus(data.id);
      }
    } catch (error) {
      console.error("fetch curator error:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkFollowStatus = async (curatorId) => {
    try {
      const { data, error } = await supabase.rpc("is_following_curator", {
        curator_id: curatorId,
      });
      setIsFollowing(data || false);
    } catch (error) {
      console.error("check follow status error:", error);
    }
  };

  const handleFollow = async () => {
    if (!user || !curator) return;
    
    try {
      setProcessing(true);
      const rpc = isFollowing ? "unfollow_curator" : "follow_curator";
      
      const { error } = await supabase.rpc(rpc, {
        curator_id: curator.id,
      });

      if (error) throw error;
      
      setIsFollowing(!isFollowing);
    } catch (error) {
      console.error("follow error:", error);
      alert(error?.message || "팔로우 처리 중 오류가 발생했습니다.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        불러오는 중...
      </div>
    );
  }

  if (!curator) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        큐레이터를 찾을 수 없습니다.
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={styles.backButton}
        >
          ← 뒤로
        </button>
      </div>

      <div style={styles.content}>
        <div style={styles.profile}>
          <div style={styles.name}>{curator.display_name}</div>
          <div style={styles.bio}>{curator.bio || "주도 큐레이터입니다."}</div>
          
          {user ? (
            <button
              type="button"
              onClick={handleFollow}
              disabled={processing}
              style={{
                ...styles.followButton,
                ...(isFollowing ? styles.followingButton : styles.followButtonActive),
                opacity: processing ? 0.6 : 1,
              }}
            >
              {processing ? "처리 중..." : isFollowing ? "팔로잉" : "팔로우"}
            </button>
          ) : (
            <div style={styles.loginPrompt}>
              팔로우하려면 로그인이 필요합니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#111111",
    color: "#ffffff",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  header: {
    padding: "16px",
    borderBottom: "1px solid #222222",
  },
  backButton: {
    border: "1px solid #444444",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    borderRadius: "999px",
    padding: "8px 12px",
    fontWeight: 700,
  },
  content: {
    padding: "20px",
  },
  profile: {
    textAlign: "center",
  },
  name: {
    fontSize: "28px",
    fontWeight: 800,
    marginBottom: "8px",
  },
  bio: {
    fontSize: "16px",
    color: "#bdbdbd",
    marginBottom: "24px",
    lineHeight: 1.5,
  },
  followButton: {
    border: "1px solid #444444",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    borderRadius: "12px",
    padding: "12px 24px",
    fontSize: "16px",
    fontWeight: 700,
    cursor: "pointer",
  },
  followButtonActive: {
    backgroundColor: "#2ECC71",
    color: "#111111",
    border: "none",
  },
  followingButton: {
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    border: "1px solid #444444",
  },
  loginPrompt: {
    fontSize: "14px",
    color: "#bdbdbd",
    padding: "12px",
    backgroundColor: "#1a1a1a",
    borderRadius: "12px",
  },
};
