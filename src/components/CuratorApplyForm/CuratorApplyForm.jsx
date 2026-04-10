import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

export default function CuratorApplyForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [style, setStyle] = useState("");
  const [regions, setRegions] = useState("");
  const [samplePlaces, setSamplePlaces] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  /** 최신 신청이 반려였을 때 관리자 사유 (재작성 참고) */
  const [lastRejectionReason, setLastRejectionReason] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setLastRejectionReason("");
      return undefined;
    }
    (async () => {
      const { data, error } = await supabase
        .from("curator_applications")
        .select("status, rejection_reason")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || error) return;
      if (data?.status === "rejected" && data.rejection_reason?.trim()) {
        setLastRejectionReason(data.rejection_reason.trim());
      } else {
        setLastRejectionReason("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const resetForm = () => {
    setName("");
    setContact("");
    setStyle("");
    setRegions("");
    setSamplePlaces("");
    setMessage("");
    setErrorMessage("");
  };

  const handleSubmit = async () => {
    setErrorMessage("");
    setMessage("");

    if (!user?.id) {
      setErrorMessage("신청하려면 로그인이 필요합니다.");
      return;
    }

    if (!name.trim()) {
      setErrorMessage("이름 또는 활동명을 입력해 주세요.");
      return;
    }

    if (!contact.trim()) {
      setErrorMessage("연락처 또는 SNS 계정을 입력해 주세요.");
      return;
    }

    try {
      setSubmitting(true);

      // 기존 신청 내역 확인
      const { data: existingRows, error: checkError } = await supabase
        .from("curator_applications")
        .select("id, status, rejection_reason")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (checkError) {
        console.error("기존 신청 확인 오류:", checkError);
      }

      const existingApplication = Array.isArray(existingRows)
        ? existingRows[0] ?? null
        : null;

      // 이미 신청한 경우
      if (existingApplication) {
        if (existingApplication.status === "pending") {
          setErrorMessage("이미 신청서가 제출되어 검토 중입니다. 잠시 기다려주세요.");
          return;
        } else if (existingApplication.status === "approved") {
          setErrorMessage("이미 큐레이터로 승인되었습니다. 추가 신청이 필요 없습니다.");
          return;
        } else if (existingApplication.status === "rejected") {
          // 반려된 경우 새로운 신청 생성 (기존 신청은 그대로 둠)
          console.log("🔄 반려된 신청자 새로운 신청 생성 시도");

          // 새로운 신청 생성 (기존 반려된 신청은 유지)
          const { data, error } = await supabase
            .from("curator_applications")
            .insert([
              {
                name: name.trim(),
                contact: contact.trim(),
                style: style.trim(),
                regions: regions.trim(),
                sample_places: samplePlaces.trim(),
                user_id: user.id,
                status: "pending",
              },
            ])
            .select();

          if (error) throw error;

          console.log("✅ 새로운 신청 생성 성공:", data);

          // 반려 알림 localStorage 삭제 (다시 반려될 때 알림 표시되도록)
          const rejectKey = `curator_rejected_${user.id}_${existingApplication.id}`;
          localStorage.removeItem(rejectKey);
          console.log("🗑️ 재신청 시 반려 알림 localStorage 삭제:", rejectKey);

          setLastRejectionReason("");
          setMessage("큐레이터 신청서가 다시 제출되었습니다. 검토 후 결과를 알려드릴게요!");
          setName("");
          setContact("");
          setStyle("");
          setRegions("");
          setSamplePlaces("");
          return;
        }
      }

      const { data, error } = await supabase
        .from("curator_applications")
        .insert([
          {
            name: name.trim(),
            contact: contact.trim(),
            style: style.trim(),
            regions: regions.trim(),
            sample_places: samplePlaces.trim(),
            user_id: user.id,
            status: "pending",
          },
        ])
        .select();

      if (error) throw error;

      setMessage("✅ 큐레이터 신청이 성공적으로 제출되었습니다!\n검토 후 결과를 알려드립니다.");
      resetForm();

      // 성공 알림
      alert("✅ 큐레이터 신청이 완료되었습니다!\n\n신청 내용이 성공적으로 저장되었으며,\n관리자 검토 후 결과를 알려드립니다.");

      setTimeout(() => {
        navigate("/");
        setMessage("");
      }, 2000);
    } catch (error) {
      console.error("submit error:", error);
      setErrorMessage(
        error?.message || JSON.stringify(error) || "신청 저장 중 오류가 발생했습니다."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.title}>큐레이터 신청</div>

        <div style={styles.infoBox}>
          <div style={styles.infoTitle}>심사 시 참고하는 점</div>
          <ul style={styles.infoList}>
            <li>샘플 술집과 큐레이션 스타일·지역을 구체적으로 적어 주세요.</li>
            <li>연락 가능한 SNS 또는 이메일을 남겨 주시면 소통이 수월합니다.</li>
            <li>
              숫자로 된 &quot;최소 N건&quot; 같은 자동 기준은 두지 않았으며, 내용과 품질을
              종합해 판단합니다.
            </li>
          </ul>
        </div>

        <div style={styles.privacyNote}>
          입력하신 연락처·SNS는 큐레이터 신청 검토·안내 목적으로만 사용되며, 제3자에게
          제공하지 않습니다.
        </div>

        {lastRejectionReason ? (
          <div style={styles.rejectionBanner}>
            <div style={styles.rejectionBannerTitle}>이전 신청 반려 사유</div>
            <div style={styles.rejectionBannerBody}>{lastRejectionReason}</div>
            <div style={styles.rejectionBannerFoot}>
              아래 양식을 보완해 다시 제출해 주세요.
            </div>
          </div>
        ) : null}

        <div style={styles.field}>
          <div style={styles.label}>이름 / 활동명</div>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="예: 소주안주 / 노포헌터"
            style={styles.input}
            disabled={submitting}
          />
        </div>

        <div style={styles.field}>
          <div style={styles.label}>연락처 / SNS 계정</div>
          <input
            type="text"
            value={contact}
            onChange={(event) => setContact(event.target.value)}
            placeholder="예: @soju_anju"
            style={styles.input}
            disabled={submitting}
          />
        </div>

        <div style={styles.field}>
          <div style={styles.label}>큐레이션 스타일</div>
          <input
            type="text"
            value={style}
            onChange={(event) => setStyle(event.target.value)}
            placeholder="예: 소주 안주 맛집 / 노포 중심"
            style={styles.input}
            disabled={submitting}
          />
        </div>

        <div style={styles.field}>
          <div style={styles.label}>주 활동 지역</div>
          <input
            type="text"
            value={regions}
            onChange={(event) => setRegions(event.target.value)}
            placeholder="예: 을지로, 성수, 강남"
            style={styles.input}
            disabled={submitting}
          />
        </div>

        <div style={styles.field}>
          <div style={styles.label}>샘플 술집 3곳</div>
          <textarea
            value={samplePlaces}
            onChange={(event) => setSamplePlaces(event.target.value)}
            placeholder={"예:\n을지로 골목집\n만선호프\n성수 와인룸"}
            style={styles.textarea}
            disabled={submitting}
          />
        </div>

        {errorMessage ? (
          <div style={styles.errorText}>{errorMessage}</div>
        ) : null}

        {message ? <div style={styles.successText}>{message}</div> : null}

        <div style={styles.buttonRow}>
          <button
            type="button"
            onClick={() => navigate("/")}
            style={styles.cancelButton}
            disabled={submitting}
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            style={styles.submitButton}
            disabled={submitting}
          >
            {submitting ? "저장 중..." : "신청하기"}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 80,
    backgroundColor: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
  },
  modal: {
    width: "100%",
    maxWidth: "480px",
    maxHeight: "92vh",
    overflowY: "auto",
    backgroundColor: "#111111",
    border: "1px solid #2a2a2a",
    borderRadius: "20px",
    padding: "18px",
  },
  title: {
    fontSize: "20px",
    fontWeight: 800,
    color: "#ffffff",
  },
  infoBox: {
    marginTop: "14px",
    padding: "12px 14px",
    borderRadius: "14px",
    backgroundColor: "#161616",
    border: "1px solid #2e2e2e",
  },
  infoTitle: {
    fontSize: "12px",
    fontWeight: 800,
    color: "#e5e5e5",
    marginBottom: "8px",
  },
  infoList: {
    margin: 0,
    paddingLeft: "18px",
    fontSize: "12px",
    color: "#bdbdbd",
    lineHeight: 1.55,
  },
  privacyNote: {
    marginTop: "12px",
    fontSize: "11px",
    color: "#888",
    lineHeight: 1.5,
  },
  rejectionBanner: {
    marginTop: "14px",
    padding: "12px 14px",
    borderRadius: "14px",
    backgroundColor: "#221010",
    border: "1px solid #4a2a2a",
  },
  rejectionBannerTitle: {
    fontSize: "12px",
    fontWeight: 800,
    color: "#FF6B6B",
    marginBottom: "8px",
  },
  rejectionBannerBody: {
    fontSize: "13px",
    color: "#f0d0d0",
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
  },
  rejectionBannerFoot: {
    marginTop: "8px",
    fontSize: "11px",
    color: "#9f8f8f",
  },
  field: {
    marginTop: "14px",
  },
  label: {
    marginBottom: "8px",
    fontSize: "13px",
    fontWeight: 700,
    color: "#ffffff",
  },
  input: {
    width: "100%",
    height: "44px",
    boxSizing: "border-box",
    border: "1px solid #333333",
    borderRadius: "12px",
    padding: "0 12px",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    outline: "none",
  },
  textarea: {
    width: "100%",
    minHeight: "110px",
    boxSizing: "border-box",
    border: "1px solid #333333",
    borderRadius: "12px",
    padding: "12px",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    outline: "none",
    resize: "vertical",
  },
  errorText: {
    marginTop: "12px",
    color: "#FF6B6B",
    fontSize: "13px",
  },
  successText: {
    marginTop: "12px",
    color: "#2ECC71",
    fontSize: "13px",
    fontWeight: 700,
  },
  buttonRow: {
    marginTop: "18px",
    display: "flex",
    gap: "10px",
  },
  cancelButton: {
    flex: 1,
    border: "1px solid #444444",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    borderRadius: "12px",
    padding: "12px",
    fontSize: "14px",
    fontWeight: 700,
  },
  submitButton: {
    flex: 1,
    border: "none",
    backgroundColor: "#2ECC71",
    color: "#111111",
    borderRadius: "12px",
    padding: "12px",
    fontSize: "14px",
    fontWeight: 800,
  },
};