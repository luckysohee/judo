import React from "react";
import { useNavigate } from "react-router-dom";

export default function StudioAccessDenied() {
  const navigate = useNavigate();

  return (
    <div style={styles.shell}>
      <div style={styles.inner}>
        <h1 style={styles.title}>접근 불가</h1>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>🚫 큐레이터 전용 페이지</h2>
          <p style={styles.cardBody}>
            스튜디오는 큐레이터만 접근할 수 있습니다.
            <br />
            일반 사용자는 홈 화면에서 @아이디를 클릭하여
            <br />
            저장한 장소와 팔로우한 큐레이터를 확인할 수 있습니다.
          </p>

          <button
            type="button"
            onClick={() => navigate("/")}
            style={styles.primaryBtn}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = "#2980B9";
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = "#3498DB";
            }}
          >
            🏠 홈으로 가기
          </button>
        </div>

        <div style={styles.footer}>
          큐레이터가 되고 싶으신가요?{" "}
          <span style={styles.footerLink}>큐레이터 신청하기</span>
        </div>
      </div>
    </div>
  );
}

const styles = {
  shell: {
    padding: "20px",
    textAlign: "center",
    minHeight: "100vh",
    backgroundColor: "#111111",
    color: "#ffffff",
  },
  inner: {
    marginTop: "100px",
    maxWidth: "600px",
    margin: "100px auto 0",
  },
  title: {
    fontSize: "32px",
    fontWeight: "bold",
    marginBottom: "20px",
    color: "#e74c3c",
  },
  card: {
    backgroundColor: "rgba(231, 76, 60, 0.1)",
    border: "1px solid rgba(231, 76, 60, 0.3)",
    borderRadius: "12px",
    padding: "30px",
    marginBottom: "30px",
  },
  cardTitle: {
    fontSize: "20px",
    fontWeight: "600",
    marginBottom: "15px",
    color: "#e74c3c",
  },
  cardBody: {
    fontSize: "16px",
    lineHeight: "1.6",
    color: "#ccc",
    marginBottom: "20px",
  },
  primaryBtn: {
    width: "100%",
    padding: "16px",
    backgroundColor: "#3498DB",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "18px",
    fontWeight: "bold",
    cursor: "pointer",
    transition: "background-color 0.2s ease",
  },
  footer: {
    textAlign: "center",
    color: "#666",
    fontSize: "14px",
  },
  footerLink: {
    color: "#3498DB",
    cursor: "pointer",
  },
};
