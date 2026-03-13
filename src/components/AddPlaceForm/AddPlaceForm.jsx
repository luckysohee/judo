import { useMemo, useState } from "react";
import { addCustomPlace } from "../../utils/customPlacesStorage";

export default function AddPlaceForm({
  open,
  curators,
  onClose,
  onAdded,
}) {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);
  const [selectedCurator, setSelectedCurator] = useState(curators[0]?.name || "");
  const [tags, setTags] = useState("소주,안주맛집");
  const [comment, setComment] = useState("");
  const [uploadedImage, setUploadedImage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const tagArray = useMemo(() => {
    return tags
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }, [tags]);

  if (!open) return null;

  const handleSearch = () => {
    if (!window.kakao || !window.kakao.maps || !window.kakao.maps.services) {
      setErrorMessage("카카오 Places 서비스를 불러오지 못했습니다.");
      return;
    }

    if (!keyword.trim()) {
      setErrorMessage("검색어를 입력해 주세요.");
      return;
    }

    const placesService = new window.kakao.maps.services.Places();

    placesService.keywordSearch(keyword, (data, status) => {
      if (status === window.kakao.maps.services.Status.OK) {
        setResults(data);
        setErrorMessage("");
      } else if (status === window.kakao.maps.services.Status.ZERO_RESULT) {
        setResults([]);
        setErrorMessage("검색 결과가 없습니다.");
      } else {
        setResults([]);
        setErrorMessage("장소 검색 중 오류가 발생했습니다.");
      }
    });
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setUploadedImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAdd = () => {
    if (!selectedResult) {
      setErrorMessage("추가할 장소를 선택해 주세요.");
      return;
    }

    if (!selectedCurator) {
      setErrorMessage("대표 큐레이터를 선택해 주세요.");
      return;
    }

    try {
      const payload = {
        name: selectedResult.place_name,
        region: inferRegion(selectedResult.address_name),
        lat: Number(selectedResult.y),
        lng: Number(selectedResult.x),
        image:
          uploadedImage ||
          "https://placehold.co/800x500?text=JU-DO+Custom+Place",
        primaryCurator: selectedCurator,
        curators: [selectedCurator],
        tags: tagArray.length > 0 ? tagArray : ["술집"],
        comment: comment.trim() || `${selectedResult.place_name} 추천 술집`,
        savedCount: 0,
        address:
          selectedResult.address_name || selectedResult.road_address_name || "",
      };

      addCustomPlace(payload);

      setKeyword("");
      setResults([]);
      setSelectedResult(null);
      setComment("");
      setUploadedImage("");
      setErrorMessage("");
      onAdded();
      onClose();
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.title}>술집 추가</div>

        <div style={styles.label}>장소 검색</div>
        <div style={styles.searchRow}>
          <input
            type="text"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="예: 을지로 골목집"
            style={styles.input}
          />
          <button type="button" onClick={handleSearch} style={styles.searchButton}>
            검색
          </button>
        </div>

        <div style={styles.resultList}>
          {results.map((item) => {
            const selected = selectedResult?.id === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedResult(item)}
                style={{
                  ...styles.resultItem,
                  borderColor: selected ? "#2ECC71" : "#333333",
                }}
              >
                <div style={styles.resultName}>{item.place_name}</div>
                <div style={styles.resultAddress}>{item.address_name}</div>
              </button>
            );
          })}
        </div>

        <div style={styles.label}>대표 큐레이터</div>
        <select
          value={selectedCurator}
          onChange={(event) => setSelectedCurator(event.target.value)}
          style={styles.select}
        >
          {curators.map((curator) => (
            <option key={curator.id} value={curator.name}>
              {curator.name}
            </option>
          ))}
        </select>

        <div style={styles.label}>태그 (쉼표로 구분)</div>
        <input
          type="text"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          placeholder="노포,소주,2차"
          style={styles.input}
        />

        <div style={styles.label}>한 줄 설명</div>
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="을지로에서 2차로 가기 좋은 술집"
          style={styles.textarea}
        />

        <div style={styles.label}>대표 사진 업로드</div>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          style={styles.fileInput}
        />

        {uploadedImage ? (
          <img src={uploadedImage} alt="preview" style={styles.previewImage} />
        ) : null}

        {errorMessage ? <div style={styles.errorText}>{errorMessage}</div> : null}

        <div style={styles.bottomRow}>
          <button type="button" onClick={onClose} style={styles.cancelButton}>
            취소
          </button>
          <button type="button" onClick={handleAdd} style={styles.addButton}>
            추가
          </button>
        </div>
      </div>
    </div>
  );
}

function inferRegion(address = "") {
  if (address.includes("을지로")) return "을지로";
  if (address.includes("성수")) return "성수";
  if (address.includes("강남")) return "강남";
  if (address.includes("연남")) return "연남";
  if (address.includes("망원")) return "망원";
  if (address.includes("종로")) return "종로";
  return "서울";
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 75,
    backgroundColor: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
  },
  modal: {
    width: "100%",
    maxWidth: "460px",
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
    marginBottom: "14px",
  },
  label: {
    fontSize: "13px",
    color: "#ffffff",
    marginBottom: "8px",
    marginTop: "12px",
    fontWeight: 700,
  },
  searchRow: {
    display: "flex",
    gap: "8px",
  },
  input: {
    flex: 1,
    height: "44px",
    border: "1px solid #333333",
    borderRadius: "12px",
    padding: "0 12px",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    outline: "none",
    boxSizing: "border-box",
  },
  searchButton: {
    border: "none",
    backgroundColor: "#2ECC71",
    color: "#111111",
    borderRadius: "12px",
    padding: "0 14px",
    fontSize: "13px",
    fontWeight: 800,
  },
  resultList: {
    marginTop: "10px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  resultItem: {
    border: "1px solid #333333",
    backgroundColor: "#171717",
    borderRadius: "12px",
    padding: "10px",
    textAlign: "left",
  },
  resultName: {
    fontSize: "14px",
    fontWeight: 700,
    color: "#ffffff",
    marginBottom: "4px",
  },
  resultAddress: {
    fontSize: "12px",
    color: "#bdbdbd",
  },
  select: {
    width: "100%",
    height: "44px",
    border: "1px solid #333333",
    borderRadius: "12px",
    padding: "0 12px",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    outline: "none",
  },
  textarea: {
    width: "100%",
    minHeight: "90px",
    border: "1px solid #333333",
    borderRadius: "12px",
    padding: "12px",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    outline: "none",
    resize: "vertical",
    boxSizing: "border-box",
  },
  fileInput: {
    width: "100%",
    color: "#ffffff",
  },
  previewImage: {
    marginTop: "12px",
    width: "100%",
    height: "180px",
    objectFit: "cover",
    borderRadius: "12px",
    border: "1px solid #2a2a2a",
  },
  errorText: {
    marginTop: "10px",
    color: "#FF6B6B",
    fontSize: "13px",
  },
  bottomRow: {
    marginTop: "16px",
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
  addButton: {
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