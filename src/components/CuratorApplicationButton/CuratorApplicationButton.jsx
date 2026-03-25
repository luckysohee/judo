import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

export default function CuratorApplicationButton() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [applicationStatus, setApplicationStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const checkApplicationStatus = async () => {
      try {
        const { data, error } = await supabase
          .from("curator_applications")
          .select("status")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error && error.code !== "PGRST116") {
          console.error("신청 상태 확인 오류:", error);
        }

        setApplicationStatus(data?.status || null);
      } catch (error) {
        console.error("신청 상태 확인 오류:", error);
      } finally {
        setLoading(false);
      }
    };

    checkApplicationStatus();
  }, [user?.id]);

  const handleClick = () => {
    if (applicationStatus === "pending") {
      alert("⏳ 심사중입니다\n\n큐레이터 신청서가 제출되어 검토 중입니다.\n결과가 나오면 알려드릴게요!");
      return;
    }

    if (applicationStatus === "approved") {
      alert("✅ 이미 큐레이터입니다\n\n큐레이터로 승인되어 스튜디오를 이용할 수 있습니다.");
      return;
    }

    if (applicationStatus === "rejected") {
      alert("❌ 반려된 신청입니다\n\n이전 신청이 반려되었습니다.\n관리자에게 문의해주세요.");
      return;
    }

    // 신청 가능한 경우
    navigate("/curator-apply");
  };

  if (loading) {
    return (
      <button
        type="button"
        style={{
          border: "1px solid rgba(255, 255, 255, 0.2)",
          backgroundColor: "rgba(255, 255, 255, 0.1)",
          backdropFilter: "blur(8px)",
          color: "#ffffff",
          borderRadius: "999px",
          height: "34px",
          padding: "0 10px",
          fontSize: "12px",
          fontWeight: "800",
          cursor: "not-allowed",
          transition: "all 0.2s ease"
        }}
        disabled
      >
        확인 중...
      </button>
    );
  }

  const getButtonStyle = () => {
    const baseStyle = {
      borderRadius: "999px",
      height: "34px",
      padding: "0 10px",
      fontSize: "12px",
      fontWeight: "800",
      transition: "all 0.2s ease",
      cursor: "pointer"
    };

    switch (applicationStatus) {
      case "pending":
        return {
          ...baseStyle,
          border: "1px solid rgba(255, 193, 7, 0.3)",
          backgroundColor: "rgba(255, 193, 7, 0.15)",
          color: "#FFC107",
          cursor: "pointer"
        };
      case "approved":
        return {
          ...baseStyle,
          border: "1px solid rgba(40, 167, 69, 0.3)",
          backgroundColor: "rgba(40, 167, 69, 0.15)",
          color: "#28A745",
          cursor: "pointer"
        };
      case "rejected":
        return {
          ...baseStyle,
          border: "1px solid rgba(220, 53, 69, 0.3)",
          backgroundColor: "rgba(220, 53, 69, 0.15)",
          color: "#DC3545",
          cursor: "pointer"
        };
      default:
        return {
          ...baseStyle,
          border: "1px solid rgba(46, 204, 113, 0.3)",
          backgroundColor: "rgba(46, 204, 113, 0.15)",
          backdropFilter: "blur(8px)",
          color: "#2ECC71",
          cursor: "pointer"
        };
    }
  };

  const getButtonText = () => {
    switch (applicationStatus) {
      case "pending":
        return "심사중";
      case "approved":
        return "큐레이터";
      case "rejected":
        return "반려됨";
      default:
        return "큐레이터 신청";
    }
  };

  const handleMouseOver = (e) => {
    if (applicationStatus === "pending") {
      e.target.style.backgroundColor = "rgba(255, 193, 7, 0.25)";
      e.target.style.borderColor = "rgba(255, 193, 7, 0.4)";
    } else if (applicationStatus === "approved") {
      e.target.style.backgroundColor = "rgba(40, 167, 69, 0.25)";
      e.target.style.borderColor = "rgba(40, 167, 69, 0.4)";
    } else if (applicationStatus === "rejected") {
      e.target.style.backgroundColor = "rgba(220, 53, 69, 0.25)";
      e.target.style.borderColor = "rgba(220, 53, 69, 0.4)";
    } else {
      e.target.style.backgroundColor = "rgba(46, 204, 113, 0.25)";
      e.target.style.borderColor = "rgba(46, 204, 113, 0.4)";
    }
  };

  const handleMouseOut = (e) => {
    if (applicationStatus === "pending") {
      e.target.style.backgroundColor = "rgba(255, 193, 7, 0.15)";
      e.target.style.borderColor = "rgba(255, 193, 7, 0.3)";
    } else if (applicationStatus === "approved") {
      e.target.style.backgroundColor = "rgba(40, 167, 69, 0.15)";
      e.target.style.borderColor = "rgba(40, 167, 69, 0.3)";
    } else if (applicationStatus === "rejected") {
      e.target.style.backgroundColor = "rgba(220, 53, 69, 0.15)";
      e.target.style.borderColor = "rgba(220, 53, 69, 0.3)";
    } else {
      e.target.style.backgroundColor = "rgba(46, 204, 113, 0.15)";
      e.target.style.borderColor = "rgba(46, 204, 113, 0.3)";
    }
  };

  return (
    <button
      type="button"
      style={getButtonStyle()}
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
      onClick={handleClick}
    >
      {getButtonText()}
    </button>
  );
}
