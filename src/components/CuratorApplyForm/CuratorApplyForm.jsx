import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function CuratorApplyForm({ open, onClose }) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [style, setStyle] = useState("");
  const [regions, setRegions] = useState("");
  const [samplePlaces, setSamplePlaces] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const resetForm = () => {
    setName("");
    setContact("");
    setStyle("");
    setRegions("");
    setSamplePlaces("");
  };

  const handleSubmit = async () => {
    setErrorMessage("");
    setMessage("");

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

      console.log("submit start");
      console.log("payload:", {
        name: name.trim(),
        contact: contact.trim(),
        style: style.trim(),
        regions: regions.trim(),
        sample_places: samplePlaces.trim(),
        status: "pending",
      });

      const { data, error } = await supabase
        .from("curator_applications")
        .insert([
          {
            name: name.trim(),
            contact: contact.trim(),
            style: style.trim(),
            regions: regions.trim(),
            sample_places: samplePlaces.trim(),
            status: "pending",
          },
        ])
        .select();

      console.log("supabase data:", data);
      console.log("supabase error:", error);

      if (error) {
        throw error;
      }

      setMessage("큐레이터 신청이 정상적으로 접수되었습니다.");
      resetForm();

      setTimeout(() => {
        onClose();
        setMessage("");
      }, 1000);
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
        <div style={styles.subtitle}>
          초기에는 신청 후 승인 방식으로 운영됩니다.
        </div>

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
            onClick={onClose}
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
  subtitle: {
    marginTop: "6px",
    fontSize: "13px",
    color: "#bdbdbd",
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