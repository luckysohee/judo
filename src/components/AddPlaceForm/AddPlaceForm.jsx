import { useMemo, useState } from "react";
import { addCustomPlace } from "../../utils/customPlacesStorage";

const REGION_OPTIONS = [
  "을지로",
  "성수",
  "한남",
  "압구정",
  "강남",
  "문래",
  "망원",
  "연남",
  "해방촌",
  "서촌",
];

const TAG_OPTIONS = [
  "노포",
  "소주",
  "맥주",
  "와인",
  "하이볼",
  "데이트",
  "2차",
  "1차",
  "혼술",
  "회식",
  "해산물",
  "안주맛집",
  "분위기",
  "심야",
];

export default function AddPlaceForm({
  open,
  curators = [],
  onClose,
  onAdded,
}) {
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [address, setAddress] = useState("");
  const [image, setImage] = useState("");
  const [comment, setComment] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedCurators, setSelectedCurators] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const safeCurators = useMemo(() => {
    return Array.isArray(curators) ? curators.filter(Boolean) : [];
  }, [curators]);

  if (!open) return null;

  const resetForm = () => {
    setName("");
    setRegion("");
    setAddress("");
    setImage("");
    setComment("");
    setLat("");
    setLng("");
    setSelectedTags([]);
    setSelectedCurators([]);
    setSubmitting(false);
  };

  const handleToggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  };

  const handleToggleCurator = (curatorName) => {
    setSelectedCurators((prev) =>
      prev.includes(curatorName)
        ? prev.filter((item) => item !== curatorName)
        : [...prev, curatorName]
    );
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!name.trim()) {
      alert("술집 이름을 입력해 주세요.");
      return;
    }

    if (!region.trim()) {
      alert("지역을 선택해 주세요.");
      return;
    }

    if (selectedCurators.length === 0) {
      alert("큐레이터를 최소 1명 선택해 주세요.");
      return;
    }

    const parsedLat = Number(lat);
    const parsedLng = Number(lng);

    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
      alert("위도와 경도를 올바르게 입력해 주세요.");
      return;
    }

    setSubmitting(true);

    const primaryCurator = selectedCurators[0];

    addCustomPlace({
      name: name.trim(),
      region: region.trim(),
      address: address.trim(),
      image: image.trim() || "https://placehold.co/400x400?text=JU-DO",
      comment: comment.trim() || "직접 추가한 술집입니다.",
      lat: parsedLat,
      lng: parsedLng,
      primaryCurator,
      curators: selectedCurators,
      tags: selectedTags,
    });

    if (typeof onAdded === "function") {
      onAdded();
    }

    alert("술집이 추가되었습니다.");
    handleClose();
  };

  return (
    <div style={styles.overlay} onClick={handleClose}>
      <div style={styles.backdrop} />

      <div style={styles.sheet} onClick={(event) => event.stopPropagation()}>
        <div style={styles.handleWrap}>
          <button
            type="button"
            onClick={handleClose}
            style={styles.handleButton}
            aria-label="술집 추가 닫기"
          >
            <span style={styles.handleBar} />
          </button>
        </div>

        <div style={styles.header}>
          <div style={styles.title}>술집 추가</div>
          <button type="button" onClick={handleClose} style={styles.closeButton}>
            닫기
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.content}>
          <Field label="술집 이름">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="예: 을지로 골목집"
              style={styles.input}
            />
          </Field>

          <Field label="지역">
            <div style={styles.chipWrap}>
              {REGION_OPTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setRegion(item)}
                  style={{
                    ...styles.chip,
                    ...(region === item ? styles.chipActive : null),
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
          </Field>

          <Field label="주소">
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="예: 서울 중구 ..."
              style={styles.input}
            />
          </Field>

          <Field label="대표 이미지 URL">
            <input
              value={image}
              onChange={(event) => setImage(event.target.value)}
              placeholder="https://..."
              style={styles.input}
            />
          </Field>

          <div style={styles.row2}>
            <Field label="위도">
              <input
                value={lat}
                onChange={(event) => setLat(event.target.value)}
                placeholder="37.56..."
                style={styles.input}
              />
            </Field>

            <Field label="경도">
              <input
                value={lng}
                onChange={(event) => setLng(event.target.value)}
                placeholder="126.97..."
                style={styles.input}
              />
            </Field>
          </div>

          <Field label="한줄 코멘트">
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="이 술집 추천 이유를 적어주세요"
              style={styles.textarea}
            />
          </Field>

          <Field label="태그">
            <div style={styles.chipWrap}>
              {TAG_OPTIONS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleToggleTag(tag)}
                  style={{
                    ...styles.chip,
                    ...(selectedTags.includes(tag) ? styles.chipActive : null),
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
          </Field>

          <Field label="큐레이터">
            <div style={styles.chipWrap}>
              {safeCurators.map((curator) => {
                const curatorName = curator.name;
                const active = selectedCurators.includes(curatorName);

                return (
                  <button
                    key={curator.id || curatorName}
                    type="button"
                    onClick={() => handleToggleCurator(curatorName)}
                    style={{
                      ...styles.chip,
                      borderColor: curator.color || "#444444",
                      ...(active
                        ? {
                            backgroundColor: curator.color || "#2ECC71",
                            color: "#111111",
                            borderColor: curator.color || "#2ECC71",
                          }
                        : null),
                    }}
                  >
                    {curator.displayName || curatorName}
                  </button>
                );
              })}
            </div>
          </Field>

          <div style={styles.submitRow}>
            <button
              type="submit"
              disabled={submitting}
              style={styles.submitButton}
            >
              {submitting ? "추가 중..." : "술집 추가하기"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={styles.field}>
      <div style={styles.label}>{label}</div>
      {children}
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 320,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  backdrop: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    position: "relative",
    width: "100%",
    maxHeight: "82vh",
    backgroundColor: "rgba(18,18,18,0.98)",
    borderTopLeftRadius: "24px",
    borderTopRightRadius: "24px",
    boxShadow: "0 -10px 30px rgba(0,0,0,0.35)",
    overflow: "hidden",
    animation: "judoBottomSheetUp 260ms ease-out",
  },
  handleWrap: {
    display: "flex",
    justifyContent: "center",
    paddingTop: "8px",
    paddingBottom: "2px",
  },
  handleButton: {
    width: "100%",
    border: "none",
    backgroundColor: "transparent",
    display: "flex",
    justifyContent: "center",
    padding: "4px 0 6px",
    cursor: "pointer",
  },
  handleBar: {
    width: "48px",
    height: "5px",
    borderRadius: "999px",
    backgroundColor: "#5e5e5e",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 16px 12px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  title: {
    fontSize: "18px",
    fontWeight: 800,
    color: "#ffffff",
  },
  closeButton: {
    border: "1px solid #3a3a3a",
    backgroundColor: "#171717",
    color: "#ffffff",
    borderRadius: "999px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 700,
  },
  content: {
    padding: "14px 16px 24px",
    overflowY: "auto",
    maxHeight: "calc(82vh - 64px)",
  },
  field: {
    marginBottom: "16px",
  },
  label: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#ffffff",
    marginBottom: "8px",
  },
  input: {
    width: "100%",
    height: "44px",
    border: "1px solid rgba(255,255,255,0.08)",
    backgroundColor: "#171717",
    color: "#ffffff",
    borderRadius: "12px",
    padding: "0 12px",
    outline: "none",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    minHeight: "100px",
    border: "1px solid rgba(255,255,255,0.08)",
    backgroundColor: "#171717",
    color: "#ffffff",
    borderRadius: "12px",
    padding: "12px",
    outline: "none",
    fontSize: "14px",
    resize: "vertical",
    boxSizing: "border-box",
  },
  chipWrap: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  chip: {
    border: "1px solid #333333",
    backgroundColor: "#151515",
    color: "#ffffff",
    borderRadius: "999px",
    padding: "8px 11px",
    fontSize: "12px",
    fontWeight: 600,
  },
  chipActive: {
    backgroundColor: "#ffffff",
    color: "#111111",
    borderColor: "#ffffff",
  },
  row2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
  },
  submitRow: {
    paddingTop: "4px",
  },
  submitButton: {
    width: "100%",
    height: "48px",
    border: "none",
    borderRadius: "14px",
    backgroundColor: "#2ECC71",
    color: "#111111",
    fontSize: "14px",
    fontWeight: 800,
  },
};