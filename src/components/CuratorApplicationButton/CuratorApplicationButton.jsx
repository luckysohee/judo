import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

export default function CuratorApplicationButton({ compact = false }) {
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
          .order("created_at", { ascending: false })
          .limit(1)
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
      // 반려된 경우 바로 신청 페이지로 이동 (알림 없음)
      navigate("/curator-apply");
      return;
    }

    // 신청 가능한 경우
    navigate("/curator-apply");
  };

  // 승인된 큐레이터는 버튼 표시 안함
  if (applicationStatus === "approved") {
    return null;
  }

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
          height: compact ? "32px" : "34px",
          padding: compact ? "0 5px" : "0 8px",
          fontSize: compact ? "9px" : "10px",
          fontWeight: "700",
          letterSpacing: "0.04em",
          cursor: "not-allowed",
          transition: "all 0.2s ease",
          maxWidth: compact ? "48px" : undefined,
          overflow: compact ? "hidden" : undefined,
          textOverflow: compact ? "ellipsis" : undefined,
          whiteSpace: compact ? "nowrap" : undefined,
        }}
        disabled
      >
        {compact ? "…" : "확인 중..."}
      </button>
    );
  }

  const getButtonStyle = () => {
    const baseStyle = {
      borderRadius: "999px",
      height: compact ? "32px" : "34px",
      padding: compact ? "0 6px" : "0 9px",
      fontSize: compact ? "9px" : "10px",
      fontWeight: "700",
      letterSpacing: "0.06em",
      textTransform: "lowercase",
      transition: "all 0.2s ease",
      cursor: "pointer",
      ...(compact
        ? {
            maxWidth: "44px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }
        : {}),
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
          border: "1px solid rgba(46, 204, 113, 0.3)",
          backgroundColor: "rgba(46, 204, 113, 0.15)",
          backdropFilter: "blur(8px)",
          color: "#2ECC71",
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
        return compact ? "대기" : "심사중";
      case "approved":
        return null; // 승인된 큐레이터는 버튼 표시 안함
      case "rejected":
        return "join";
      default:
        return "join";
    }
  };

  const handleMouseOver = (e) => {
    if (applicationStatus === "pending") {
      e.target.style.backgroundColor = "rgba(255, 193, 7, 0.25)";
      e.target.style.borderColor = "rgba(255, 193, 7, 0.4)";
    } else if (applicationStatus === "approved") {
      e.target.style.backgroundColor = "rgba(40, 167, 69, 0.25)";
      e.target.style.borderColor = "rgba(40, 167, 69, 0.4)";
    } else {
      // rejected와 default 모두 동일한 효과
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
    } else {
      // rejected와 default 모두 동일한 효과
      e.target.style.backgroundColor = "rgba(46, 204, 113, 0.15)";
      e.target.style.borderColor = "rgba(46, 204, 113, 0.3)";
    }
  };

  const ariaAndTitle =
    applicationStatus === "pending"
      ? "큐레이터 심사 진행 중"
      : "큐레이터 신청";

  return (
    <button
      type="button"
      style={getButtonStyle()}
      title={ariaAndTitle}
      aria-label={ariaAndTitle}
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
      onClick={handleClick}
    >
      {getButtonText()}
    </button>
  );
}
