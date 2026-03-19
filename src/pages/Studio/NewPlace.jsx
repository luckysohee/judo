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
    alcohol_type: "",
    atmosphere: "",
    recommended_menu: "",
    menu_reason: "",
    tags: [],
  });

  // 2단계: 큐레이션 정보
  const [curationInfo, setCurationInfo] = useState({
    one_line_review: "",
    visit_situations: [],
    price_range: "",
    visit_tips: "",
  });

  // 3단계: 발행 설정
  const [publishInfo, setPublishInfo] = useState({
    is_public: true,
    is_featured: false,
  });

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handlePrev = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSaveDraft = async () => {
    try {
      setSubmitting(true);
      
      const { data, error } = await supabase.rpc("save_curator_place", {
        p_curator_id: user.id,
        p_name: basicInfo.name,
        p_address: basicInfo.address,
        p_latitude: basicInfo.latitude,
        p_longitude: basicInfo.longitude,
        p_phone: basicInfo.phone,
        p_category: basicInfo.category,
        p_alcohol_type: basicInfo.alcohol_type,
        p_atmosphere: basicInfo.atmosphere,
        p_recommended_menu: basicInfo.recommended_menu,
        p_menu_reason: basicInfo.menu_reason,
        p_tags: basicInfo.tags,
        p_one_line_review: curationInfo.one_line_review,
        p_visit_situations: curationInfo.visit_situations,
        p_price_range: curationInfo.price_range,
        p_visit_tips: curationInfo.visit_tips,
        p_is_public: false, // 임시저장은 비공개
        p_is_featured: false,
      });

      if (error) throw error;
      
      alert("임시저장되었습니다!");
      navigate("/studio");
    } catch (error) {
      console.error("임시저장 오류:", error);
      alert("임시저장에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      
      const { data, error } = await supabase.rpc("save_curator_place", {
        p_curator_id: user.id,
        p_name: basicInfo.name,
        p_address: basicInfo.address,
        p_latitude: basicInfo.latitude,
        p_longitude: basicInfo.longitude,
        p_phone: basicInfo.phone,
        p_category: basicInfo.category,
        p_alcohol_type: basicInfo.alcohol_type,
        p_atmosphere: basicInfo.atmosphere,
        p_recommended_menu: basicInfo.recommended_menu,
        p_menu_reason: basicInfo.menu_reason,
        p_tags: basicInfo.tags,
        p_one_line_review: curationInfo.one_line_review,
        p_visit_situations: curationInfo.visit_situations,
        p_price_range: curationInfo.price_range,
        p_visit_tips: curationInfo.visit_tips,
        p_is_public: publishInfo.is_public,
        p_is_featured: publishInfo.is_featured,
      });

      if (error) throw error;
      
      alert("장소가 추가되었습니다!");
      navigate("/studio");
    } catch (error) {
      console.error("저장 오류:", error);
      alert("저장에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep1 = () => (
    <div style={styles.step}>
      <h2 style={styles.stepTitle}>1단계: 기본 정보</h2>
      
      <div style={styles.form}>
        <div style={styles.formGroup}>
          <label style={styles.label}>가게 이름 *</label>
          <input
            type="text"
            value={basicInfo.name}
            onChange={(e) => setBasicInfo({...basicInfo, name: e.target.value})}
            placeholder="가게 이름을 입력하세요"
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>주소 *</label>
          <input
            type="text"
            value={basicInfo.address}
            onChange={(e) => setBasicInfo({...basicInfo, address: e.target.value})}
            placeholder="주소를 입력하세요"
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>연락처</label>
          <input
            type="tel"
            value={basicInfo.phone}
            onChange={(e) => setBasicInfo({...basicInfo, phone: e.target.value})}
            placeholder="전화번호를 입력하세요"
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>카테고리 *</label>
          <select
            value={basicInfo.category}
            onChange={(e) => setBasicInfo({...basicInfo, category: e.target.value})}
            style={styles.select}
          >
            <option value="">선택하세요</option>
            <option value="bar">바</option>
            <option value="pub">펍</option>
            <option value="restaurant">레스토랑</option>
            <option value="cafe">카페</option>
            <option value="etc">기타</option>
          </select>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>술 종류</label>
          <select
            value={basicInfo.alcohol_type}
            onChange={(e) => setBasicInfo({...basicInfo, alcohol_type: e.target.value})}
            style={styles.select}
          >
            <option value="">선택하세요</option>
            <option value="soju">소주</option>
            <option value="beer">맥주</option>
            <option value="wine">와인</option>
            <option value="whiskey">위스키</option>
            <option value="cocktail">칵테일</option>
            <option value="traditional">전통주</option>
            <option value="various">다양함</option>
          </select>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>분위기</label>
          <select
            value={basicInfo.atmosphere}
            onChange={(e) => setBasicInfo({...basicInfo, atmosphere: e.target.value})}
            style={styles.select}
          >
            <option value="">선택하세요</option>
            <option value="quiet">조용한</option>
            <option value="lively">활기찬</option>
            <option value="modern">모던한</option>
            <option value="traditional">전통적인</option>
            <option value="cozy">아늑한</option>
            <option value="luxury">고급스러운</option>
          </select>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>추천 메뉴</label>
          <input
            type="text"
            value={basicInfo.recommended_menu}
            onChange={(e) => setBasicInfo({...basicInfo, recommended_menu: e.target.value})}
            placeholder="추천하는 메뉴를 입력하세요"
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>추천 이유</label>
          <textarea
            value={basicInfo.menu_reason}
            onChange={(e) => setBasicInfo({...basicInfo, menu_reason: e.target.value})}
            placeholder="이 메뉴를 추천하는 이유를 설명해주세요"
            style={styles.textarea}
            rows={3}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>태그</label>
          <input
            type="text"
            value={basicInfo.tags.join(", ")}
            onChange={(e) => setBasicInfo({...basicInfo, tags: e.target.value.split(",").map(tag => tag.trim()).filter(tag => tag)})}
            placeholder="#태그1 #태그2 #태그3 (쉼표로 구분)"
            style={styles.input}
          />
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div style={styles.step}>
      <h2 style={styles.stepTitle}>2단계: 큐레이션 정보</h2>
      
      <div style={styles.form}>
        <div style={styles.formGroup}>
          <label style={styles.label}>한줄평</label>
          <textarea
            value={curationInfo.one_line_review}
            onChange={(e) => setCurationInfo({...curationInfo, one_line_review: e.target.value})}
            placeholder="이 장소를 한마디로 표현해주세요"
            style={styles.textarea}
            rows={2}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>방문 추천 상황</label>
          <div style={styles.checkboxGroup}>
            {["데이트", "친구와", "회식", "혼자", "가족과"].map((situation) => (
              <label key={situation} style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={curationInfo.visit_situations.includes(situation)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setCurationInfo({...curationInfo, visit_situations: [...curationInfo.visit_situations, situation]});
                    } else {
                      setCurationInfo({...curationInfo, visit_situations: curationInfo.visit_situations.filter(s => s !== situation)});
                    }
                  }}
                  style={styles.checkbox}
                />
                {situation}
              </label>
            ))}
          </div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>가격대</label>
          <select
            value={curationInfo.price_range}
            onChange={(e) => setCurationInfo({...curationInfo, price_range: e.target.value})}
            style={styles.select}
          >
            <option value="">선택하세요</option>
            <option value="cheap">저렴함 (1~2만원)</option>
            <option value="moderate">보통 (2~4만원)</option>
            <option value="expensive">비쌈 (4만원+)</option>
          </select>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>방문 팁</label>
          <textarea
            value={curationInfo.visit_tips}
            onChange={(e) => setCurationInfo({...curationInfo, visit_tips: e.target.value})}
            placeholder="방문할 때 알아두면 좋은 팁을 알려주세요"
            style={styles.textarea}
            rows={3}
          />
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div style={styles.step}>
      <h2 style={styles.stepTitle}>3단계: 발행 설정</h2>
      
      <div style={styles.form}>
        <div style={styles.formGroup}>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={publishInfo.is_public}
              onChange={(e) => setPublishInfo({...publishInfo, is_public: e.target.checked})}
              style={styles.checkbox}
            />
            공개하기
          </label>
          <p style={styles.helpText}>
            공개하면 다른 사용자들이 이 장소를 볼 수 있습니다.
          </p>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={publishInfo.is_featured}
              onChange={(e) => setPublishInfo({...publishInfo, is_featured: e.target.checked})}
              style={styles.checkbox}
            />
            대표 추천으로 설정
          </label>
          <p style={styles.helpText}>
            대표 추천 장소로 설정하면 더 많은 사용자에게 노출됩니다.
          </p>
        </div>
      </div>
    </div>
  );

  const renderStepIndicator = () => (
    <div style={styles.stepIndicator}>
      {[1, 2, 3].map((num) => (
        <div key={num} style={styles.stepDot}>
          <div style={{
            ...styles.stepDotInner,
            backgroundColor: step >= num ? "#2ECC71" : "#333333"
          }} />
          <span style={styles.stepDotText}>{num}단계</span>
        </div>
      ))}
    </div>
  );

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>새 장소 추가</h1>
        {renderStepIndicator()}
      </div>

      <div style={styles.content}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}

        <div style={styles.actions}>
          {step > 1 && (
            <button
              type="button"
              onClick={handlePrev}
              style={styles.secondaryButton}
              disabled={submitting}
            >
              이전
            </button>
          )}

          {step < 3 && (
            <button
              type="button"
              onClick={handleNext}
              style={styles.primaryButton}
              disabled={submitting}
            >
              다음
            </button>
          )}

          {step === 3 && (
            <>
              <button
                type="button"
                onClick={handleSaveDraft}
                style={styles.secondaryButton}
                disabled={submitting}
              >
                임시저장
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                style={styles.primaryButton}
                disabled={submitting}
              >
                완료
              </button>
            </>
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
    textAlign: "center",
  },
  title: {
    fontSize: "24px",
    fontWeight: 800,
    margin: "0 0 16px 0",
  },
  stepIndicator: {
    display: "flex",
    justifyContent: "center",
    gap: "24px",
  },
  stepDot: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
  },
  stepDotInner: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    backgroundColor: "#333333",
    transition: "background-color 0.3s",
  },
  stepDotText: {
    fontSize: "12px",
    color: "#bdbdbd",
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
    fontSize: "20px",
    fontWeight: 700,
    margin: "0 0 24px 0",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#ffffff",
  },
  input: {
    border: "1px solid #333333",
    borderRadius: "8px",
    padding: "12px 16px",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    fontSize: "16px",
    outline: "none",
  },
  select: {
    border: "1px solid #333333",
    borderRadius: "8px",
    padding: "12px 16px",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    fontSize: "16px",
    outline: "none",
  },
  textarea: {
    border: "1px solid #333333",
    borderRadius: "8px",
    padding: "12px 16px",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    fontSize: "16px",
    outline: "none",
    resize: "vertical",
  },
  checkboxGroup: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    cursor: "pointer",
  },
  checkbox: {
    width: "16px",
    height: "16px",
    accentColor: "#2ECC71",
  },
  helpText: {
    fontSize: "12px",
    color: "#bdbdbd",
    margin: "4px 0 0 0",
  },
  actions: {
    display: "flex",
    gap: "12px",
    justifyContent: "flex-end",
    marginTop: "32px",
  },
  primaryButton: {
    border: "none",
    backgroundColor: "#2ECC71",
    color: "#111111",
    borderRadius: "8px",
    padding: "12px 24px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #444444",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    borderRadius: "8px",
    padding: "12px 24px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
};
