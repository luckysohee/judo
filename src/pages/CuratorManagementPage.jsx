import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { adminTopNavButtonStyle } from "../styles/adminTopNavButton";
import {
  GRADE_LABELS_KO,
  gradeFromPlaceCount,
  needsGradePromotion,
} from "../utils/curatorGradeRules";
import { useToast } from "../components/Toast/ToastProvider";
import AdminConfirmDialog from "../components/AdminConfirmDialog";

export default function CuratorManagementPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [curator, setCurator] = useState(null);
  const [curatorProfile, setCuratorProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  /** DB 승급 검토 큐(미해결) — 마이그레이션 미적용 시 null 유지 */
  const [gradeReviewOpenRow, setGradeReviewOpenRow] = useState(null);
  /** 큐 없이 클라이언트만 추천일 때 배너 닫기(세션) */
  const [clientSuggestionDismissed, setClientSuggestionDismissed] = useState(false);
  /** @type {[null | { title: string, message: string, danger?: boolean, confirmLabel?: string, onConfirm: () => Promise<void> }, function]} */
  const [confirmCfg, setConfirmCfg] = useState(null);

  // 등급 시스템
  const gradeOptions = [
    { value: "bronze", label: "브론즈", color: "#CD7F32" },
    { value: "silver", label: "실버", color: "#C0C0C0" },
    { value: "gold", label: "골드", color: "#FFD700" },
    { value: "platinum", label: "플래티넘", color: "#E5E4E2" },
    { value: "diamond", label: "다이아몬드", color: "#B9F2FF" }
  ];

  // 상태 시스템
  const statusOptions = [
    { value: "active", label: "활동중", color: "#2ECC71" },
    { value: "warning", label: "경고", color: "#F39C12" },
    { value: "suspended", label: "활동중지", color: "#E74C3C" },
    { value: "inactive", label: "휴면", color: "#95A5A6" }
  ];

  useEffect(() => {
    if (authLoading || !user?.id) return;
    checkAdminAndLoadCurator();
  }, [authLoading, user?.id]);

  const checkAdminAndLoadCurator = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const pathParts = window.location.pathname.split("/");
      const userId = pathParts[pathParts.length - 1];

      if (!userId) {
        setErrorMessage("큐레이터 ID가 필요합니다.");
        return;
      }

      await loadCuratorInfo(userId);
    } catch (error) {
      console.error("admin check error:", error);
      setErrorMessage(error?.message || "불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const loadCuratorInfo = async (userId) => {
    try {
      console.log("🔍 큐레이터 정보 로드 시도:", userId);
      
      // 큐레이터 프로필 정보
      const { data: curatorData, error: curatorError } = await supabase
        .from("curators")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      console.log("📋 큐레이터 데이터:", { curatorData, curatorError });

      if (curatorError) {
        throw curatorError;
      }

      if (!curatorData) {
        console.log("❌ 큐레이터 정보 없음:", userId);
        setErrorMessage("큐레이터 정보를 찾을 수 없습니다.");
        return;
      }

      // 기본값 설정 (grade, status가 없는 경우)
      const normalizedCuratorData = {
        ...curatorData,
        grade: curatorData.grade || 'bronze',
        status: curatorData.status || 'active',
        warning_count: curatorData.warning_count || 0,
        total_places: curatorData.total_places || 0,
        total_likes: curatorData.total_likes || 0,
        last_activity_at: curatorData.last_activity_at || curatorData.created_at
      };

      // 사용자 프로필 정보
      const { data: userData, error: userError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (userError) {
        throw userError;
      }

      setCurator(userData);

      // 실제 활동(추천 장소 수·팔로워·최근 활동 시각) 반영 후 프로필 state 병합
      const activityPatch = await loadCuratorActivity(userId);
      const mergedProfile = {
        ...normalizedCuratorData,
        ...(activityPatch || {}),
      };
      setCuratorProfile(mergedProfile);
      setClientSuggestionDismissed(false);

      try {
        const { data: qrow, error: qerr } = await supabase
          .from("curator_grade_review_queue")
          .select(
            "id, suggested_grade, current_grade, total_places_at_trigger, created_at"
          )
          .eq("curator_user_id", userId)
          .is("resolved_at", null)
          .maybeSingle();
        setGradeReviewOpenRow(!qerr && qrow ? qrow : null);
      } catch {
        setGradeReviewOpenRow(null);
      }

      // 신청 정보 (location.state에서 가져오기)
      if (location.state?.application) {
        console.log("신청 정보:", location.state.application);
      }

    } catch (error) {
      console.error("curator load error:", error);
      setErrorMessage(error?.message || "큐레이터 정보를 불러오지 못했습니다.");
    }
  };

  /**
   * 신청 관리 모달과 동일 RPC + 팔로워 수로 활동 지표 채움.
   * (기존: 0으로 덮어써서 활동 탭·개요가 비어 보이던 문제)
   */
  const loadCuratorActivity = async (userId) => {
    try {
      let totalPlaces = 0;
      let lastEventAt = null;

      const { data: act, error: actErr } = await supabase.rpc(
        "admin_applicant_activity",
        { p_target_user_id: userId }
      );

      let placeCountFromSummary = false;
      if (!actErr && act && typeof act === "object") {
        const summary = act.summary;
        if (summary && typeof summary.recommend_count === "number") {
          totalPlaces = summary.recommend_count;
          placeCountFromSummary = true;
        }
        if (Array.isArray(act.items) && act.items.length > 0 && act.items[0]?.at) {
          lastEventAt = act.items[0].at;
        }
        if (
          Array.isArray(act.recommends) &&
          act.recommends.length > 0 &&
          act.recommends[0]?.at
        ) {
          if (!lastEventAt) lastEventAt = act.recommends[0].at;
          if (!placeCountFromSummary) totalPlaces = act.recommends.length;
        }
      }

      if (actErr) {
        console.warn("admin_applicant_activity RPC:", actErr.message || actErr);
      }

      if (!placeCountFromSummary) {
        const { count: cpCount, error: cpErr } = await supabase
          .from("curator_places")
          .select("*", { count: "exact", head: true })
          .eq("curator_id", userId);
        if (!cpErr && typeof cpCount === "number") {
          totalPlaces = cpCount;
        }
      }

      const { count: followCount, error: folErr } = await supabase
        .from("user_follows")
        .select("*", { count: "exact", head: true })
        .eq("curator_id", userId);

      if (folErr) {
        console.warn("user_follows count:", folErr.message || folErr);
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("updated_at")
        .eq("id", userId)
        .maybeSingle();

      const pickLatestIso = (a, b) => {
        if (!a) return b || null;
        if (!b) return a;
        return new Date(a) >= new Date(b) ? a : b;
      };
      const lastActivityAt = pickLatestIso(lastEventAt, prof?.updated_at || null);

      const patch = {
        total_places: totalPlaces,
        total_likes: typeof followCount === "number" ? followCount : 0,
        ...(lastActivityAt ? { last_activity_at: lastActivityAt } : {}),
      };

      const { error: upErr } = await supabase
        .from("curators")
        .update({
          total_places: patch.total_places,
          total_likes: patch.total_likes,
          ...(lastActivityAt ? { last_activity_at: lastActivityAt } : {}),
        })
        .eq("user_id", userId);

      if (upErr) {
        console.warn("curators 활동 필드 동기화 실패:", upErr.message || upErr);
      }

      return patch;
    } catch (error) {
      console.error("activity load error:", error);
      return null;
    }
  };

  const applyCuratorGrade = async (newGrade) => {
    const { error } = await supabase
      .from("curators")
      .update({ grade: newGrade })
      .eq("user_id", curatorProfile.user_id);
    if (error) throw error;
    setCuratorProfile((prev) => ({ ...prev, grade: newGrade }));
    setGradeReviewOpenRow(null);
  };

  const handleGradeChange = (newGrade) => {
    const label = gradeOptions.find((g) => g.value === newGrade)?.label || newGrade;
    setConfirmCfg({
      title: "등급 변경",
      message: `큐레이터 등급을 ${label}으로 변경하시겠습니까?`,
      onConfirm: async () => {
        try {
          await applyCuratorGrade(newGrade);
          showToast("등급이 변경되었습니다.", "success");
        } catch (error) {
          console.error("grade change error:", error);
          showToast(
            error?.message || "등급 변경 중 오류가 발생했습니다.",
            "error",
            5000
          );
        }
      },
    });
  };

  const handleApplySuggestedGrade = () => {
    if (!curatorProfile) return;
    const sug =
      gradeReviewOpenRow?.suggested_grade ||
      gradeFromPlaceCount(curatorProfile.total_places);
    const label = GRADE_LABELS_KO[sug] || sug;
    setConfirmCfg({
      title: "추천 등급 반영",
      message: `등록 장소 ${curatorProfile.total_places}개 기준 추천 등급 「${label}」으로 올리시겠습니까?`,
      onConfirm: async () => {
        try {
          await applyCuratorGrade(sug);
          showToast("등급이 변경되었습니다.", "success");
        } catch (error) {
          console.error("apply suggested grade error:", error);
          showToast(
            error?.message || "등급 변경 중 오류가 발생했습니다.",
            "error",
            5000
          );
        }
      },
    });
  };

  const handleDismissGradeReview = async () => {
    if (!curatorProfile) return;
    try {
      if (gradeReviewOpenRow) {
        const { error } = await supabase
          .from("curator_grade_review_queue")
          .update({
            resolved_at: new Date().toISOString(),
            resolved_action: "dismissed",
          })
          .eq("curator_user_id", curatorProfile.user_id)
          .is("resolved_at", null);
        if (error) throw error;
        setGradeReviewOpenRow(null);
      } else {
        setClientSuggestionDismissed(true);
      }
    } catch (error) {
      console.error("dismiss grade review error:", error);
      showToast(error?.message || "처리 중 오류가 발생했습니다.", "error", 5000);
    }
  };

  const handleStatusChange = (newStatus) => {
    const label = statusOptions.find((s) => s.value === newStatus)?.label || newStatus;
    setConfirmCfg({
      title: "상태 변경",
      message: `큐레이터 상태를 ${label}으로 변경하시겠습니까?`,
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from("curators")
            .update({ status: newStatus })
            .eq("user_id", curatorProfile.user_id);

          if (error) throw error;

          setCuratorProfile((prev) => ({ ...prev, status: newStatus }));
          showToast("상태가 변경되었습니다.", "success");
        } catch (error) {
          console.error("status change error:", error);
          showToast(
            error?.message || "상태 변경 중 오류가 발생했습니다.",
            "error",
            5000
          );
        }
      },
    });
  };

  const handleRevokeCurator = () => {
    setConfirmCfg({
      title: "큐레이터 자격 박탈",
      danger: true,
      confirmLabel: "박탈",
      message: `${curatorProfile.username} 큐레이터의 자격을 박탈하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`,
      onConfirm: async () => {
        try {
          const { error: deleteError } = await supabase
            .from("curators")
            .delete()
            .eq("user_id", curatorProfile.user_id);

          if (deleteError) throw deleteError;

          const { error: profileError } = await supabase
            .from("profiles")
            .update({ role: "user" })
            .eq("id", curatorProfile.user_id);

          if (profileError) {
            console.error("profile update error:", profileError);
          }

          showToast("큐레이터 자격이 박탈되었습니다.", "success");
          navigate("/admin");
        } catch (error) {
          console.error("revoke error:", error);
          showToast(
            error?.message || "자격 박탈 중 오류가 발생했습니다.",
            "error",
            5000
          );
        }
      },
    });
  };

  const runConfirmDialog = () => {
    const fn = confirmCfg?.onConfirm;
    setConfirmCfg(null);
    if (fn) void fn();
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loading}>로딩 중...</div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div style={styles.page}>
        <div style={styles.error}>{errorMessage}</div>
      </div>
    );
  }

  if (!curatorProfile || !curator) {
    return (
      <div style={styles.page}>
        <div style={styles.error}>큐레이터 정보를 찾을 수 없습니다.</div>
      </div>
    );
  }

  const currentGrade = gradeOptions.find(g => g.value === curatorProfile.grade) || gradeOptions[0];
  const currentStatus = statusOptions.find(s => s.value === curatorProfile.status) || statusOptions[0];

  const suggestedGradeValue =
    gradeReviewOpenRow?.suggested_grade ||
    gradeFromPlaceCount(curatorProfile.total_places);

  const showGradeSuggestion =
    !clientSuggestionDismissed &&
    (Boolean(gradeReviewOpenRow) ||
      needsGradePromotion(
        curatorProfile.grade,
        curatorProfile.total_places
      ));

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button
          type="button"
          onClick={() => navigate("/admin/applications")}
          style={adminTopNavButtonStyle}
          aria-label="큐레이터 신청 목록으로"
          title="큐레이터 신청 목록으로"
        >
          ←
        </button>
        <div style={styles.title}>큐레이터 관리</div>
      </div>

      <div style={styles.content}>
        {showGradeSuggestion ? (
          <div
            style={{
              border: "1px solid rgba(46, 204, 113, 0.45)",
              backgroundColor: "rgba(46, 204, 113, 0.1)",
              borderRadius: "14px",
              padding: "14px 16px",
              marginBottom: "4px",
            }}
          >
            <div
              style={{
                fontSize: "14px",
                fontWeight: 800,
                color: "#fff",
                marginBottom: "6px",
              }}
            >
              {gradeReviewOpenRow
                ? "승급 검토 대기 (알림 큐)"
                : "등급 승급 검토"}
            </div>
            <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>
              현재{" "}
              <strong>{currentGrade.label}</strong> · 등록 장소{" "}
              <strong>{curatorProfile.total_places ?? 0}개</strong> 기준 추천{" "}
              <strong>
                {GRADE_LABELS_KO[suggestedGradeValue] || suggestedGradeValue}
              </strong>
              {gradeReviewOpenRow?.created_at ? (
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px" }}>
                  {" "}
                  · 요청{" "}
                  {new Date(gradeReviewOpenRow.created_at).toLocaleString("ko-KR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
              ) : null}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "12px" }}>
              <button
                type="button"
                onClick={handleApplySuggestedGrade}
                style={{
                  border: "none",
                  borderRadius: "10px",
                  padding: "10px 14px",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                  backgroundColor: "#2ECC71",
                  color: "#0d1f14",
                }}
              >
                추천 등급으로 적용
              </button>
              <button
                type="button"
                onClick={handleDismissGradeReview}
                style={{
                  border: "1px solid rgba(255,255,255,0.25)",
                  borderRadius: "10px",
                  padding: "10px 14px",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                  backgroundColor: "rgba(0,0,0,0.2)",
                  color: "rgba(255,255,255,0.88)",
                }}
              >
                나중에 (알림 해제)
              </button>
            </div>
          </div>
        ) : null}

        {/* 큐레이터 기본 정보 */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.curatorName}>{curatorProfile.username}</div>
            <div style={styles.curatorEmail}>{curator.email}</div>
          </div>

          <div style={styles.infoGrid}>
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>활동명</div>
              <div style={styles.infoValue}>{curatorProfile.display_name || curatorProfile.username}</div>
            </div>
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>가입일</div>
              <div style={styles.infoValue}>{new Date(curator.created_at).toLocaleDateString("ko-KR")}</div>
            </div>
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>큐레이터 since</div>
              <div style={styles.infoValue}>{new Date(curatorProfile.created_at).toLocaleDateString("ko-KR")}</div>
            </div>
          </div>

          <div style={styles.bioSection}>
            <div style={styles.infoLabel}>소개</div>
            <div style={styles.bio}>{curatorProfile.bio || "소개가 없습니다."}</div>
          </div>
        </div>

        {/* 탭 메뉴 */}
        <div style={styles.tabContainer}>
          {["overview", "grade", "status", "activity"].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{
                ...styles.tab,
                ...(activeTab === tab ? styles.activeTab : {})
              }}
            >
              {tab === "overview" && "개요"}
              {tab === "grade" && "등급"}
              {tab === "status" && "상태"}
              {tab === "activity" && "활동"}
            </button>
          ))}
        </div>

        {/* 탭 내용 */}
        {activeTab === "overview" && (
          <div style={styles.tabContent}>
            <div style={styles.card}>
              <h3 style={styles.sectionTitle}>큐레이터 개요</h3>
              <div style={styles.overviewGrid}>
                <div style={styles.overviewItem}>
                  <div style={styles.overviewLabel}>현재 등급</div>
                  <div style={{ ...styles.gradeBadge, backgroundColor: currentGrade.color }}>
                    {currentGrade.label}
                  </div>
                </div>
                <div style={styles.overviewItem}>
                  <div style={styles.overviewLabel}>현재 상태</div>
                  <div style={{ ...styles.statusBadge, backgroundColor: currentStatus.color }}>
                    {currentStatus.label}
                  </div>
                </div>
                <div style={styles.overviewItem}>
                  <div style={styles.overviewLabel}>등록 장소</div>
                  <div style={styles.overviewValue}>{curatorProfile.total_places || 0}개</div>
                </div>
                <div style={styles.overviewItem}>
                  <div style={styles.overviewLabel}>총 좋아요</div>
                  <div style={styles.overviewValue}>{curatorProfile.total_likes || 0}개</div>
                </div>
                <div style={styles.overviewItem}>
                  <div style={styles.overviewLabel}>경고 횟수</div>
                  <div style={styles.overviewValue}>{curatorProfile.warning_count || 0}회</div>
                </div>
                <div style={styles.overviewItem}>
                  <div style={styles.overviewLabel}>활동 기간</div>
                  <div style={styles.overviewValue}>
                    {Math.floor((Date.now() - new Date(curatorProfile.created_at)) / (1000 * 60 * 60 * 24))}일
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "grade" && (
          <div style={styles.tabContent}>
            <div style={styles.card}>
              <h3 style={styles.sectionTitle}>등급 관리</h3>
              
              {/* 등급 기준 정보 */}
              <div style={{
                backgroundColor: "#2a2a2a",
                padding: "12px",
                borderRadius: "8px",
                marginBottom: "16px",
                fontSize: "12px",
                color: "#ccc"
              }}>
                <div style={{ marginBottom: "8px", fontWeight: "bold", color: "#fff" }}>
                  🏆 등급 기준 (등록 장소 수)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "8px" }}>
                  <div>🌱 브론즈: 100개 미만</div>
                  <div>🌟 실버: 100–199개</div>
                  <div>⭐ 골드: 200–499개</div>
                  <div>🏆 플래티넘: 500–999개</div>
                  <div>👑 다이아몬드: 1000개 이상</div>
                </div>
                <div style={{ marginTop: "8px", fontSize: "11px", color: "#999" }}>
                  * 추천 등급은 등록 장소 수로만 계산됩니다. 승급 시 알림 큐에 쌓이며, Admin은 수동으로도 조정할 수 있습니다.
                </div>
              </div>
              
              <div style={styles.gradeContainer}>
                {gradeOptions.map((grade) => (
                  <button
                    key={grade.value}
                    type="button"
                    onClick={() => handleGradeChange(grade.value)}
                    style={{
                      ...styles.gradeOption,
                      ...(curatorProfile.grade === grade.value ? styles.selectedGrade : {}),
                      backgroundColor: grade.color
                    }}
                  >
                    <div style={styles.gradeName}>{grade.label}</div>
                    {curatorProfile.grade === grade.value && (
                      <div style={styles.selectedIndicator}>✓</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "status" && (
          <div style={styles.tabContent}>
            <div style={styles.card}>
              <h3 style={styles.sectionTitle}>상태 관리</h3>
              <div style={styles.statusContainer}>
                {statusOptions.map((status) => (
                  <button
                    key={status.value}
                    type="button"
                    onClick={() => handleStatusChange(status.value)}
                    style={{
                      ...styles.statusOption,
                      ...(curatorProfile.status === status.value ? styles.selectedStatus : {}),
                      borderColor: status.color
                    }}
                  >
                    <div style={{ ...styles.statusName, color: status.color }}>
                      {status.label}
                    </div>
                    {curatorProfile.status === status.value && (
                      <div style={{ ...styles.selectedIndicator, color: status.color }}>✓</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "activity" && (
          <div style={styles.tabContent}>
            <div style={styles.card}>
              <h3 style={styles.sectionTitle}>활동 관리</h3>
              <div style={styles.activityContainer}>
                <div style={styles.activityItem}>
                  <div style={styles.activityLabel}>최근 활동</div>
                  <div style={styles.activityValue}>
                    {curatorProfile.last_activity_at
                      ? new Date(curatorProfile.last_activity_at).toLocaleString("ko-KR", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "정보 없음"}
                  </div>
                </div>
                <div style={styles.activityItem}>
                  <div style={styles.activityLabel}>등록 장소 수</div>
                  <div style={styles.activityValue}>{curatorProfile.total_places || 0}개</div>
                </div>
                <div style={styles.activityItem}>
                  <div style={styles.activityLabel}>총 좋아요</div>
                  <div style={styles.activityValue}>{curatorProfile.total_likes || 0}개</div>
                </div>
                <div style={styles.activityItem}>
                  <div style={styles.activityLabel}>경고 횟수</div>
                  <div style={styles.activityValue}>{curatorProfile.warning_count || 0}회</div>
                </div>
                <div style={styles.activityItem}>
                  <div style={styles.activityLabel}>큐레이터 since</div>
                  <div style={styles.activityValue}>
                    {new Date(curatorProfile.created_at).toLocaleDateString("ko-KR")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 관리자 액션 */}
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>관리자 액션</h3>
          <div style={styles.actionContainer}>
            <button
              type="button"
              onClick={handleRevokeCurator}
              style={styles.dangerButton}
            >
              큐레이터 자격 박탈
            </button>
          </div>
        </div>
      </div>

      <AdminConfirmDialog
        open={!!confirmCfg}
        title={confirmCfg?.title ?? ""}
        message={confirmCfg?.message ?? ""}
        danger={confirmCfg?.danger}
        confirmLabel={confirmCfg?.confirmLabel}
        onCancel={() => setConfirmCfg(null)}
        onConfirm={runConfirmDialog}
      />
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
  loading: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "50vh",
    fontSize: "16px",
    color: "#ffffff",
  },
  error: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "50vh",
    fontSize: "16px",
    color: "#FF6B6B",
  },
  header: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    backgroundColor: "#111111",
    padding: "16px",
    borderBottom: "1px solid #222222",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  title: {
    fontSize: "22px",
    fontWeight: 800,
  },
  content: {
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  card: {
    border: "1px solid #2a2a2a",
    backgroundColor: "#171717",
    borderRadius: "16px",
    padding: "16px",
  },
  cardHeader: {
    marginBottom: "16px",
  },
  curatorName: {
    fontSize: "24px",
    fontWeight: 800,
    marginBottom: "4px",
  },
  curatorEmail: {
    fontSize: "14px",
    color: "#9f9f9f",
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "16px",
    marginBottom: "16px",
  },
  infoItem: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  infoLabel: {
    fontSize: "12px",
    color: "#9f9f9f",
    fontWeight: 600,
  },
  infoValue: {
    fontSize: "14px",
    color: "#ffffff",
  },
  bioSection: {
    marginTop: "16px",
  },
  bio: {
    fontSize: "14px",
    color: "#ffffff",
    lineHeight: 1.6,
    whiteSpace: "pre-line",
  },
  tabContainer: {
    display: "flex",
    backgroundColor: "#1a1a1a",
    borderRadius: "12px",
    padding: "4px",
    gap: "4px",
  },
  tab: {
    flex: 1,
    border: "none",
    backgroundColor: "transparent",
    color: "#9f9f9f",
    borderRadius: "8px",
    padding: "12px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  activeTab: {
    backgroundColor: "#2a2a2a",
    color: "#ffffff",
  },
  tabContent: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  sectionTitle: {
    fontSize: "18px",
    fontWeight: 800,
    marginBottom: "16px",
  },
  overviewGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "16px",
  },
  overviewItem: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  overviewLabel: {
    fontSize: "12px",
    color: "#9f9f9f",
    fontWeight: 600,
  },
  overviewValue: {
    fontSize: "16px",
    color: "#ffffff",
    fontWeight: 700,
  },
  gradeBadge: {
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 700,
    color: "#000000",
  },
  statusBadge: {
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 700,
    color: "#ffffff",
  },
  gradeContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: "12px",
  },
  gradeOption: {
    border: "2px solid transparent",
    borderRadius: "12px",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  selectedGrade: {
    border: "2px solid #ffffff",
    transform: "scale(1.05)",
  },
  gradeName: {
    fontSize: "14px",
    fontWeight: 700,
    color: "#ffffff",
  },
  statusContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: "12px",
  },
  statusOption: {
    border: "2px solid transparent",
    backgroundColor: "#1a1a1a",
    borderRadius: "12px",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  selectedStatus: {
    border: "2px solid currentColor",
    transform: "scale(1.05)",
  },
  statusName: {
    fontSize: "14px",
    fontWeight: 700,
  },
  selectedIndicator: {
    fontSize: "16px",
    fontWeight: 800,
  },
  activityContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  activityItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 0",
    borderBottom: "1px solid #2a2a2a",
  },
  activityLabel: {
    fontSize: "14px",
    color: "#9f9f9f",
  },
  activityValue: {
    fontSize: "14px",
    color: "#ffffff",
    fontWeight: 600,
  },
  actionContainer: {
    display: "flex",
    gap: "12px",
  },
  dangerButton: {
    border: "1px solid #E74C3C",
    backgroundColor: "#2a1515",
    color: "#E74C3C",
    borderRadius: "12px",
    padding: "12px 16px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  dangerButtonHover: {
    backgroundColor: "#3a1f1f",
  },
};
