import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

export default function NewPlace() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const initialStep = parseInt(searchParams.get('step')) || 1;
  const [step, setStep] = useState(initialStep);
  const [submitting, setSubmitting] = useState(false);

  // 1단계: 기본 정보
  const [basicInfo, setBasicInfo] = useState({
    name: "",
    address: "",
    latitude: null,
    longitude: null,
    phone: "",
    category: "",
    photos: [],
  });

  // 2단계: 큐레이션 정보
  const [curationInfo, setCurationInfo] = useState({
    one_line_review: "",
    tags: [],
    visit_situations: [],
    recommended_menu: "",
    price_range: "",
    visit_tips: "",
    notes: "",
    rating: null,
  });

  // 3단계: 발행 설정
  const [publishSettings, setPublishSettings] = useState({
    is_public: false,
    is_featured: false,
  });

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handlePrev = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);

      const { data, error } = await supabase.rpc("save_curator_place", {
        place_name: basicInfo.name,
        address: basicInfo.address,
        latitude: basicInfo.latitude,
        longitude: basicInfo.longitude,
        phone: basicInfo.phone,
        category: basicInfo.category,
        photos: basicInfo.photos,
        one_line_review: curationInfo.one_line_review,
        tags: curationInfo.tags,
        visit_situations: curationInfo.visit_situations,
        recommended_menu: curationInfo.recommended_menu,
        price_range: curationInfo.price_range,
        visit_tips: curationInfo.visit_tips,
        notes: curationInfo.notes,
        rating: curationInfo.rating,
        is_public: publishSettings.is_public,
        is_featured: publishSettings.is_featured,
      });

      if (error) throw error;

      navigate("/studio");
    } catch (error) {
      console.error("Save place error:", error);
      alert(error?.message || "장소 저장 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep1 = () => (
    <div style={styles.step}>
      <h2 style={styles.stepTitle}>1단계: 기본 정보</h2>
      
      <div style={styles.form}>
        <div style={styles.field}>
          <label style={styles.label}>장소명 *</label>
          <input
            type="text"
            value={basicInfo.name}
            onChange={(e) => setBasicInfo({ ...basicInfo, name: e.target.value })}
            placeholder="예: 을지로 골목집"
            style={styles.input}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>주소 *</label>
          <input
            type="text"
            value={basicInfo.address}
            onChange={(e) => setBasicInfo({ ...basicInfo, address: e.target.value })}
            placeholder="예: 서울 중구 을지로 123"
            style={styles.input}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>연락처</label>
          <input
            type="text"
            value={basicInfo.phone}
            onChange={(e) => setBasicInfo({ ...basicInfo, phone: e.target.value })}
            placeholder="예: 02-1234-5678"
            style={styles.input}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>카테고리</label>
          <select
            value={basicInfo.category}
            onChange={(e) => setBasicInfo({ ...basicInfo, category: e.target.value })}
            style={styles.select}
          >
            <option value="">선택하세요</option>
            <option value="주점">주점</option>
            <option value="맥주집">맥주집</option>
            <option value="와인바">와인바</option>
            <option value="칵테일바">칵테일바</option>
            <option value="이자카야">이자카야</option>
            <option value="포장마차">포장마차</option>
          </select>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>사진</label>
          <div style={styles.photoUpload}>
            <button type="button" style={styles.photoButton}>
              사진 추가하기
            </button>
            <div style={styles.photoHint}>최소 1장 이상 필요합니다</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div style={styles.step}>
      <h2 style={styles.stepTitle}>2단계: 큐레이터 관점</h2>
      
      <div style={styles.form}>
        <div style={styles.field}>
          <label style={styles.label}>한줄 추천 *</label>
          <textarea
            value={curationInfo.one_line_review}
            onChange={(e) => setCurationInfo({ ...curationInfo, one_line_review: e.target.value })}
            placeholder="이곳이 왜 특별한지 한줄로 설명해주세요"
            style={styles.textarea}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>태그</label>
          <input
            type="text"
            value={curationInfo.tags.join(", ")}
            onChange={(e) => setCurationInfo({ ...curationInfo, tags: e.target.value.split(",").map(t => t.trim()).filter(t => t) })}
            placeholder="예: 노포, 소주, 2차, 분위기 좋음"
            style={styles.input}
          />
          <div style={styles.hint}>쉼표(,)로 구분해서 입력하세요</div>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>추천 상황</label>
          <div style={styles.checkboxGroup}>
            {["1차", "2차", "데이트", "혼술", "회식", "생일"].map((situation) => (
              <label key={situation} style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={curationInfo.visit_situations.includes(situation)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setCurationInfo({ ...curationInfo, visit_situations: [...curationInfo.visit_situations, situation] });
                    } else {
                      setCurationInfo({ ...curationInfo, visit_situations: curationInfo.visit_situations.filter(s => s !== situation) });
                    }
                  }}
                  style={styles.checkbox}
                />
                {situation}
              </label>
            ))}
          </div>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>추천 메뉴</label>
          <input
            type="text"
            value={curationInfo.recommended_menu}
            onChange={(e) => setCurationInfo({ ...curationInfo, recommended_menu: e.target.value })}
            placeholder="예: 소주 + 안주세트"
            style={styles.input}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>가격대</label>
          <select
            value={curationInfo.price_range}
            onChange={(e) => setCurationInfo({ ...curationInfo, price_range: e.target.value })}
            style={styles.select}
          >
            <option value="">선택하세요</option>
            <option value="1-2만원">1-2만원</option>
            <option value="2-3만원">2-3만원</option>
            <option value="3-5만원">3-5만원</option>
            <option value="5만원+">5만원+</option>
          </select>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>방문 팁</label>
          <textarea
            value={curationInfo.visit_tips}
            onChange={(e) => setCurationInfo({ ...curationInfo, visit_tips: e.target.value })}
            placeholder="방문할 때 알아두면 좋은 팁이 있다면 알려주세요"
            style={styles.textarea}
          />
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div style={styles.step}>
      <h2 style={styles.stepTitle}>3단계: 발행 설정</h2>
      
      <div style={styles.form}>
        <div style={styles.field}>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={publishSettings.is_public}
              onChange={(e) => setPublishSettings({ ...publishSettings, is_public: e.target.checked })}
              style={styles.checkbox}
            />
            공개 발행
          </label>
          <div style={styles.hint}>체크하면 모든 사용자가 볼 수 있습니다</div>
        </div>

        <div style={styles.field}>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={publishSettings.is_featured}
              onChange={(e) => setPublishSettings({ ...publishSettings, is_featured: e.target.checked })}
              style={styles.checkbox}
            />
            대표 추천으로 올리기
          </label>
          <div style={styles.hint}>프로필에 대표 장소로 표시됩니다</div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button type="button" onClick={() => navigate("/studio")} style={styles.backButton}>
          ← 뒤로
        </button>
        <h1 style={styles.title}>새 장소 추가</h1>
        <div style={styles.progress}>
          <div style={{ ...styles.progressStep, ...(step >= 1 ? styles.activeStep : {}) }}>1</div>
          <div style={{ ...styles.progressStep, ...(step >= 2 ? styles.activeStep : {}) }}>2</div>
          <div style={{ ...styles.progressStep, ...(step >= 3 ? styles.activeStep : {}) }}>3</div>
        </div>
      </div>

      <div style={styles.content}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}

        <div style={styles.actions}>
          {step > 1 && (
            <button type="button" onClick={handlePrev} style={styles.secondaryButton}>
              이전
            </button>
          )}
          {step < 3 ? (
            <button type="button" onClick={handleNext} style={styles.primaryButton}>
              다음
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              style={styles.primaryButton}
            >
              {submitting ? "저장 중..." : "발행하기"}
            </button>
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
    padding: "20px",
    borderBottom: "1px solid #222222",
    position: "relative",
  },
  backButton: {
    border: "1px solid #444444",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    borderRadius: "999px",
    padding: "8px 12px",
    fontWeight: 700,
    position: "absolute",
    top: "20px",
    left: "20px",
  },
  title: {
    fontSize: "20px",
    fontWeight: 800,
    margin: "0 auto",
    textAlign: "center",
  },
  progress: {
    display: "flex",
    justifyContent: "center",
    gap: "8px",
    marginTop: "16px",
  },
  progressStep: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    border: "2px solid #444444",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "14px",
    fontWeight: 700,
  },
  activeStep: {
    backgroundColor: "#2ECC71",
    borderColor: "#2ECC71",
    color: "#111111",
  },
  content: {
    padding: "20px",
    maxWidth: "600px",
    margin: "0 auto",
  },
  step: {
    marginBottom: "32px",
  },
  stepTitle: {
    fontSize: "18px",
    fontWeight: 700,
    margin: "0 0 20px 0",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    fontSize: "14px",
    fontWeight: 700,
  },
  input: {
    border: "1px solid #333333",
    borderRadius: "8px",
    padding: "12px",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    fontSize: "14px",
  },
  select: {
    border: "1px solid #333333",
    borderRadius: "8px",
    padding: "12px",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    fontSize: "14px",
  },
  textarea: {
    border: "1px solid #333333",
    borderRadius: "8px",
    padding: "12px",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    fontSize: "14px",
    minHeight: "100px",
    resize: "vertical",
  },
  hint: {
    fontSize: "12px",
    color: "#bdbdbd",
  },
  checkboxGroup: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "14px",
  },
  checkbox: {
    width: "16px",
    height: "16px",
  },
  photoUpload: {
    border: "2px dashed #444444",
    borderRadius: "8px",
    padding: "40px",
    textAlign: "center",
  },
  photoButton: {
    border: "none",
    backgroundColor: "#2ECC71",
    color: "#111111",
    borderRadius: "8px",
    padding: "12px 24px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  photoHint: {
    fontSize: "12px",
    color: "#bdbdbd",
    marginTop: "8px",
  },
  actions: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    marginTop: "32px",
  },
  primaryButton: {
    border: "none",
    backgroundColor: "#2ECC71",
    color: "#111111",
    borderRadius: "12px",
    padding: "12px 24px",
    fontSize: "14px",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #444444",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    borderRadius: "12px",
    padding: "12px 24px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
};
