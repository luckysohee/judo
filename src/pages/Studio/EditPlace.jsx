import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

export default function EditPlace() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const [place, setPlace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    fetchPlace();
  }, [id, user]);

  const fetchPlace = async () => {
    try {
      const { data, error } = await supabase
        .from("places")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      
      const { data: cp } = await supabase
        .from("curator_places")
        .select("id")
        .eq("place_id", id)
        .eq("curator_id", user.id)
        .maybeSingle();

      if (!cp) {
        navigate("/studio");
        return;
      }

      setPlace(data);
    } catch (error) {
      console.error("Fetch place error:", error);
      navigate("/studio");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);

      const { error } = await supabase.rpc("update_curator_place", {
        place_id: id,
        place_name: place.name,
        address: place.address,
        latitude: place.latitude,
        longitude: place.longitude,
        phone: place.phone,
        category: place.category,
        photos: place.photos,
        one_line_review: place.one_line_review,
        tags: place.tags,
        visit_situations: place.visit_situations,
        recommended_menu: place.recommended_menu,
        price_range: place.price_range,
        visit_tips: place.visit_tips,
        notes: place.notes,
        rating: place.rating,
        is_public: place.is_public,
        is_featured: place.is_featured,
      });

      if (error) throw error;

      navigate("/studio");
    } catch (error) {
      console.error("Update place error:", error);
      alert(error?.message || "장소 수정 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (field, value) => {
    setPlace({ ...place, [field]: value });
  };

  if (loading) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        로딩 중...
      </div>
    );
  }

  if (!place) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        장소를 찾을 수 없습니다.
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button type="button" onClick={() => navigate("/studio")} style={styles.backButton}>
          ← 뒤로
        </button>
        <h1 style={styles.title}>장소 수정</h1>
      </div>

      <div style={styles.content}>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>기본 정보</h2>
            
            <div style={styles.field}>
              <label style={styles.label}>장소명 *</label>
              <input
                type="text"
                value={place.name || ""}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="예: 을지로 골목집"
                style={styles.input}
                required
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>주소 *</label>
              <input
                type="text"
                value={place.address || ""}
                onChange={(e) => handleChange("address", e.target.value)}
                placeholder="예: 서울 중구 을지로 123"
                style={styles.input}
                required
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>연락처</label>
              <input
                type="text"
                value={place.phone || ""}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="예: 02-1234-5678"
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>카테고리</label>
              <select
                value={place.category || ""}
                onChange={(e) => handleChange("category", e.target.value)}
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
          </div>

          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>큐레이션 정보</h2>
            
            <div style={styles.field}>
              <label style={styles.label}>한줄 추천 *</label>
              <textarea
                value={place.one_line_review || ""}
                onChange={(e) => handleChange("one_line_review", e.target.value)}
                placeholder="이곳이 왜 특별한지 한줄로 설명해주세요"
                style={styles.textarea}
                required
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>태그</label>
              <input
                type="text"
                value={(place.tags || []).join(", ")}
                onChange={(e) => handleChange("tags", e.target.value.split(",").map(t => t.trim()).filter(t => t))}
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
                      checked={(place.visit_situations || []).includes(situation)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          handleChange("visit_situations", [...(place.visit_situations || []), situation]);
                        } else {
                          handleChange("visit_situations", (place.visit_situations || []).filter(s => s !== situation));
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
                value={place.recommended_menu || ""}
                onChange={(e) => handleChange("recommended_menu", e.target.value)}
                placeholder="예: 소주 + 안주세트"
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>가격대</label>
              <select
                value={place.price_range || ""}
                onChange={(e) => handleChange("price_range", e.target.value)}
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
                value={place.visit_tips || ""}
                onChange={(e) => handleChange("visit_tips", e.target.value)}
                placeholder="방문할 때 알아두면 좋은 팁이 있다면 알려주세요"
                style={styles.textarea}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>메모</label>
              <textarea
                value={place.notes || ""}
                onChange={(e) => handleChange("notes", e.target.value)}
                placeholder="개인적인 메모가 있다면 작성해주세요"
                style={styles.textarea}
              />
            </div>
          </div>

          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>발행 설정</h2>
            
            <div style={styles.field}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={place.is_public || false}
                  onChange={(e) => handleChange("is_public", e.target.checked)}
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
                  checked={place.is_featured || false}
                  onChange={(e) => handleChange("is_featured", e.target.checked)}
                  style={styles.checkbox}
                />
                대표 추천으로 올리기
              </label>
              <div style={styles.hint}>프로필에 대표 장소로 표시됩니다</div>
            </div>
          </div>

          <div style={styles.actions}>
            <button
              type="button"
              onClick={() => navigate("/studio")}
              style={styles.secondaryButton}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={styles.primaryButton}
            >
              {submitting ? "저장 중..." : "저장하기"}
            </button>
          </div>
        </form>
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
  content: {
    padding: "20px",
    maxWidth: "600px",
    margin: "0 auto",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "32px",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  sectionTitle: {
    fontSize: "18px",
    fontWeight: 700,
    margin: 0,
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
