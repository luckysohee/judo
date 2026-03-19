import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

export default function StudioHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [curator, setCurator] = useState(null);
  const [myPlaces, setMyPlaces] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [stats, setStats] = useState({
    totalPlaces: 0,
    totalDrafts: 0,
    totalSaved: 0,
    totalViews: 0,
    followerCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }
    checkCuratorAndLoadData();
  }, [user]);

  const checkCuratorAndLoadData = async () => {
    try {
      // 큐레이터 정보 확인
      const { data: curatorData, error: curatorError } = await supabase
        .from("curators")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (curatorError) {
        navigate("/");
        return;
      }

      setCurator(curatorData);

      // 내 장소 목록 (공개)
      const { data: placesData } = await supabase
        .from("places")
        .select("*")
        .eq("curator_id", curatorData.id)
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(10);

      setMyPlaces(placesData || []);

      // 임시저장/작성중 (비공개)
      const { data: draftsData } = await supabase
        .from("places")
        .select("*")
        .eq("curator_id", curatorData.id)
        .eq("is_public", false)
        .order("updated_at", { ascending: false })
        .limit(5);

      setDrafts(draftsData || []);

      // 성과/반응 데이터
      const { data: statsData } = await supabase
        .from("places")
        .select("saved_count, view_count")
        .eq("curator_id", curatorData.id);

      // 팔로워 수
      const { count: followerCount } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("curator_id", curatorData.id);

      // 통계 계산
      const totalSaved = (statsData || []).reduce((sum, place) => sum + (place.saved_count || 0), 0);
      const totalViews = (statsData || []).reduce((sum, place) => sum + (place.view_count || 0), 0);
      
      setStats({
        totalPlaces: (placesData || []).length,
        totalDrafts: (draftsData || []).length,
        totalSaved,
        totalViews,
        followerCount: followerCount || 0,
      });
    } catch (error) {
      console.error("Studio data loading error:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        로딩 중...
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>큐레이터 스튜디오</h1>
        <p style={styles.subtitle}>{curator?.display_name}님의 작업 공간</p>
      </div>

      <div style={styles.content}>
        {/* 빠른 추가 */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>새 장소 추가</h2>
          <div style={styles.quickActionsHorizontal}>
            <button
              type="button"
              onClick={() => navigate("/studio/new-place")}
              style={styles.primaryButton}
            >
              + 새 장소 추가
            </button>
            <button
              type="button"
              onClick={() => navigate("/studio/batch-import")}
              style={styles.secondaryButton}
            >
              📁 일괄 가져오기
            </button>
            <button
              type="button"
              onClick={() => navigate("/studio/templates")}
              style={styles.tertiaryButton}
            >
              📝 템플릿으로 추가
            </button>
          </div>
          <div style={styles.quickStats}>
            <div style={styles.quickStat}>
              <span style={styles.quickStatNumber}>{stats.totalPlaces}</span>
              <span style={styles.quickStatLabel}>올린 장소</span>
            </div>
            <div style={styles.quickStat}>
              <span style={styles.quickStatNumber}>{stats.totalDrafts}</span>
              <span style={styles.quickStatLabel}>작성중</span>
            </div>
          </div>
          
          {/* 단계별 장소 추가 가이드 */}
          <div style={styles.stepGuide}>
            <h3 style={styles.stepGuideTitle}>단계별 장소 추가</h3>
            <div style={styles.stepGuideSteps}>
              <div style={styles.stepGuideStep}>
                <div style={styles.stepNumber}>1</div>
                <div style={styles.stepContent}>
                  <div style={styles.stepTitle}>기본 정보 입력</div>
                  <div style={styles.stepDescription}>장소명, 주소, 연락처, 카테고리</div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/studio/new-place?step=1")}
                  style={styles.stepButton}
                >
                  시작하기
                </button>
              </div>
              
              <div style={styles.stepGuideStep}>
                <div style={styles.stepNumber}>2</div>
                <div style={styles.stepContent}>
                  <div style={styles.stepTitle}>큐레이션 정보</div>
                  <div style={styles.stepDescription}>한줄평, 태그, 추천 상황, 메뉴</div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/studio/new-place?step=2")}
                  style={styles.stepButton}
                  disabled
                >
                  다음 단계
                </button>
              </div>
              
              <div style={styles.stepGuideStep}>
                <div style={styles.stepNumber}>3</div>
                <div style={styles.stepContent}>
                  <div style={styles.stepTitle}>발행 설정</div>
                  <div style={styles.stepDescription}>공개 여부, 대표 추천 설정</div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/studio/new-place?step=3")}
                  style={styles.stepButton}
                  disabled
                >
                  완료하기
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 임시 저장소 */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>임시 저장소</h2>
            <button
              type="button"
              onClick={() => navigate("/studio/drafts")}
              style={styles.viewAllButton}
            >
              전체 보기
            </button>
          </div>
          {drafts.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>📝</div>
              <p style={styles.emptyText}>작성중인 초안이 없습니다.</p>
              <button
                type="button"
                onClick={() => navigate("/studio/new-place")}
                style={styles.primaryButton}
              >
                첫 장소 작성하기
              </button>
            </div>
          ) : (
            <div style={styles.list}>
              {drafts.map((draft) => (
                <div key={draft.id} style={styles.card}>
                  <div style={styles.cardContent}>
                    <div style={styles.cardTitle}>
                      {draft.name || "제목 없음"}
                    </div>
                    <div style={styles.cardMeta}>
                      {draft.updated_at && new Date(draft.updated_at).toLocaleDateString()}
                      {draft.category && ` • ${draft.category}`}
                    </div>
                    {draft.one_line_review && (
                      <div style={styles.cardDescription}>
                        {draft.one_line_review}
                      </div>
                    )}
                    <div style={styles.cardTags}>
                      {(draft.tags || []).slice(0, 3).map((tag, index) => (
                        <span key={index} style={styles.tag}>{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div style={styles.cardActions}>
                    <button
                      type="button"
                      onClick={() => navigate(`/studio/place/${draft.id}/edit`)}
                      style={styles.editButton}
                    >
                      이어서 작성
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("삭제하시겠습니까?")) {
                          // TODO: 삭제 기능 구현
                        }
                      }}
                      style={styles.deleteButton}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 내 장소 리스트 */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>내 장소 리스트</h2>
            <div style={styles.sectionActions}>
              <select style={styles.sortSelect}>
                <option value="recent">최신순</option>
                <option value="popular">인기순</option>
                <option value="saved">저장순</option>
              </select>
              <button
                type="button"
                onClick={() => navigate("/studio/places")}
                style={styles.viewAllButton}
              >
                전체 보기
              </button>
            </div>
          </div>
          {myPlaces.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>📍</div>
              <p style={styles.emptyText}>아직 올린 장소가 없습니다.</p>
              <button
                type="button"
                onClick={() => navigate("/studio/new-place")}
                style={styles.primaryButton}
              >
                첫 장소 추가하기
              </button>
            </div>
          ) : (
            <div style={styles.list}>
              {myPlaces.map((place) => (
                <div key={place.id} style={styles.card}>
                  <div style={styles.cardContent}>
                    <div style={styles.cardTitle}>{place.name}</div>
                    <div style={styles.cardMeta}>
                      {place.category && `${place.category} • `}
                      {place.address}
                    </div>
                    {place.one_line_review && (
                      <div style={styles.cardDescription}>
                        {place.one_line_review}
                      </div>
                    )}
                    <div style={styles.cardTags}>
                      {(place.tags || []).slice(0, 3).map((tag, index) => (
                        <span key={index} style={styles.tag}>{tag}</span>
                      ))}
                    </div>
                    <div style={styles.cardStats}>
                      <span style={styles.cardStat}>
                        ❤️ {place.saved_count || 0}
                      </span>
                      <span style={styles.cardStat}>
                        👁️ {place.view_count || 0}
                      </span>
                    </div>
                  </div>
                  <div style={styles.cardActions}>
                    <button
                      type="button"
                      onClick={() => navigate(`/studio/place/${place.id}/edit`)}
                      style={styles.editButton}
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/place/${place.id}`)}
                      style={styles.viewButton}
                    >
                      보기
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 성과 및 반응 */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>성과 및 반응</h2>
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statIcon}>📍</div>
              <div style={styles.statNumber}>{stats.totalPlaces}</div>
              <div style={styles.statLabel}>올린 장소</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statIcon}>❤️</div>
              <div style={styles.statNumber}>{stats.totalSaved}</div>
              <div style={styles.statLabel}>저장된 수</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statIcon}>👁️</div>
              <div style={styles.statNumber}>{stats.totalViews}</div>
              <div style={styles.statLabel}>조회 수</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statIcon}>👥</div>
              <div style={styles.statNumber}>{stats.followerCount}</div>
              <div style={styles.statLabel}>팔로워</div>
            </div>
          </div>
          
          <div style={styles.recentActivity}>
            <h3 style={styles.activityTitle}>최근 활동</h3>
            <div style={styles.activityList}>
              <div style={styles.activityItem}>
                <div style={styles.activityIcon}>📈</div>
                <div style={styles.activityText}>
                  <strong>을지로 골목집</strong>에 저장이 10개 늘었어요
                </div>
                <div style={styles.activityTime}>2시간 전</div>
              </div>
              <div style={styles.activityItem}>
                <div style={styles.activityIcon}>👤</div>
                <div style={styles.activityText}>
                  <strong>새로운 팔로워</strong>가 생겼어요
                </div>
                <div style={styles.activityTime}>5시간 전</div>
              </div>
              <div style={styles.activityItem}>
                <div style={styles.activityIcon}>💬</div>
                <div style={styles.activityText}>
                  <strong>만선호프</strong>에 댓글이 달렸어요
                </div>
                <div style={styles.activityTime}>1일 전</div>
              </div>
            </div>
          </div>
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
    padding: "24px 20px",
    borderBottom: "1px solid #222222",
    textAlign: "center",
  },
  title: {
    fontSize: "24px",
    fontWeight: 800,
    margin: "0 0 8px 0",
  },
  subtitle: {
    fontSize: "14px",
    color: "#bdbdbd",
    margin: 0,
  },
  content: {
    padding: "20px",
    maxWidth: "900px",
    margin: "0 auto",
  },
  section: {
    marginBottom: "32px",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  sectionTitle: {
    fontSize: "18px",
    fontWeight: 700,
    margin: 0,
  },
  sectionActions: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  sortSelect: {
    border: "1px solid #333333",
    borderRadius: "8px",
    padding: "6px 12px",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    fontSize: "12px",
  },
  viewAllButton: {
    border: "1px solid #444444",
    backgroundColor: "transparent",
    color: "#ffffff",
    borderRadius: "8px",
    padding: "6px 12px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  quickActions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    marginBottom: "16px",
  },
  quickActionsHorizontal: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    marginBottom: "16px",
    flexWrap: "wrap",
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
  tertiaryButton: {
    border: "1px solid #666666",
    backgroundColor: "transparent",
    color: "#ffffff",
    borderRadius: "12px",
    padding: "12px 24px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  quickStats: {
    display: "flex",
    gap: "24px",
  },
  quickStat: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  quickStatNumber: {
    fontSize: "24px",
    fontWeight: 800,
    color: "#2ECC71",
  },
  quickStatLabel: {
    fontSize: "12px",
    color: "#bdbdbd",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  card: {
    border: "1px solid #222222",
    borderRadius: "12px",
    padding: "16px",
    backgroundColor: "#1a1a1a",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: "16px",
    fontWeight: 700,
    marginBottom: "4px",
  },
  cardMeta: {
    fontSize: "12px",
    color: "#bdbdbd",
    marginBottom: "8px",
  },
  cardDescription: {
    fontSize: "14px",
    color: "#ffffff",
    lineHeight: 1.4,
    marginBottom: "8px",
  },
  cardTags: {
    display: "flex",
    gap: "6px",
    marginBottom: "8px",
    flexWrap: "wrap",
  },
  tag: {
    backgroundColor: "#333333",
    color: "#ffffff",
    borderRadius: "12px",
    padding: "4px 8px",
    fontSize: "11px",
    fontWeight: 600,
  },
  cardStats: {
    display: "flex",
    gap: "16px",
    marginBottom: "8px",
  },
  cardStat: {
    fontSize: "12px",
    color: "#bdbdbd",
  },
  cardActions: {
    display: "flex",
    gap: "8px",
    flexShrink: 0,
  },
  editButton: {
    border: "1px solid #444444",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  deleteButton: {
    border: "1px solid #FF6B6B",
    backgroundColor: "transparent",
    color: "#FF6B6B",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  viewButton: {
    border: "1px solid #2ECC71",
    backgroundColor: "transparent",
    color: "#2ECC71",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  emptyState: {
    textAlign: "center",
    padding: "40px 20px",
    color: "#bdbdbd",
  },
  emptyIcon: {
    fontSize: "48px",
    marginBottom: "16px",
  },
  emptyText: {
    fontSize: "16px",
    marginBottom: "20px",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "16px",
    marginBottom: "32px",
  },
  statCard: {
    border: "1px solid #222222",
    borderRadius: "12px",
    padding: "20px",
    backgroundColor: "#1a1a1a",
    textAlign: "center",
  },
  statIcon: {
    fontSize: "24px",
    marginBottom: "8px",
  },
  statNumber: {
    fontSize: "28px",
    fontWeight: 800,
    marginBottom: "4px",
    color: "#2ECC71",
  },
  statLabel: {
    fontSize: "12px",
    color: "#bdbdbd",
  },
  recentActivity: {
    border: "1px solid #222222",
    borderRadius: "12px",
    padding: "20px",
    backgroundColor: "#1a1a1a",
  },
  activityTitle: {
    fontSize: "16px",
    fontWeight: 700,
    margin: "0 0 16px 0",
  },
  activityList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  activityItem: {
    display: "flex",
    gap: "12px",
    alignItems: "flex-start",
  },
  activityIcon: {
    fontSize: "16px",
    flexShrink: 0,
  },
  activityText: {
    flex: 1,
    fontSize: "14px",
    lineHeight: 1.4,
  },
  activityTime: {
    fontSize: "12px",
    color: "#bdbdbd",
    flexShrink: 0,
  },
  stepGuide: {
    border: "1px solid #222222",
    borderRadius: "12px",
    padding: "20px",
    backgroundColor: "#1a1a1a",
    marginTop: "16px",
  },
  stepGuideTitle: {
    fontSize: "16px",
    fontWeight: 700,
    margin: "0 0 16px 0",
  },
  stepGuideSteps: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  stepGuideStep: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "16px",
    border: "1px solid #333333",
    borderRadius: "12px",
    backgroundColor: "#222222",
  },
  stepNumber: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    backgroundColor: "#2ECC71",
    fontSize: "16px",
    fontWeight: 700,
    marginBottom: "4px",
  },
  stepDescription: {
    fontSize: "14px",
    color: "#bdbdbd",
  },
  stepButton: {
    border: "1px solid #444444",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    borderRadius: "8px",
    padding: "8px 16px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    flexShrink: 0,
  },
  "stepButton:disabled": {
    opacity: 0.5,
    cursor: "not-allowed",
  },
};
