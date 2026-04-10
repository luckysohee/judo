import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

const COLOR_POOL = ["#2ECC71", "#FF5A5F", "#8E44AD", "#3498DB", "#A47148"];

function isApplicantActivityEmpty(m) {
  if (!m || m.loading || m.error) return false;
  return (m.rows ?? []).length === 0;
}

export default function AdminApplicationsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [processingId, setProcessingId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  /** 신청자 앱 내 장소·저장 (admin_applicant_activity RPC) */
  const [activityModal, setActivityModal] = useState(null);
  /** 반려 시 사유 입력 */
  const [rejectModalApp, setRejectModalApp] = useState(null);
  const [rejectReasonDraft, setRejectReasonDraft] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      setIsAdmin(false);
      setLoading(false);
      setApplications([]);
      setErrorMessage("관리자 페이지입니다. 로그인이 필요합니다.");
      return;
    }

    checkAdminAndLoad();
  }, [authLoading, user]);

  const checkAdminAndLoad = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const admin = data?.role === "admin";
      setIsAdmin(admin);

      if (!admin) {
        setApplications([]);
        setErrorMessage("권한이 없습니다.");
        return;
      }

      await fetchApplications();
    } catch (error) {
      console.error("admin check error:", error);
      setIsAdmin(false);
      setApplications([]);
      setErrorMessage(error?.message || "권한 확인 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const fetchApplications = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("curator_applications")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setApplications(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("admin fetch error:", error);
      setApplications([]);
      setErrorMessage(error?.message || "신청 내역을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (application) => {
    try {
      // 승인 확인 알림
      const confirmed = window.confirm(`${application.name}님의 큐레이터 신청을 승인하시겠습니까?\n\n승인 시 사용자는 큐레이터 자격을 얻게 됩니다.`);
      if (!confirmed) {
        return; // 사용자가 취소하면 함수 종료
      }

      setProcessingId(application.id);
      setErrorMessage("");

      const { error } = await supabase.rpc("approve_curator_application", {
        application_id: application.id,
      });

      if (error) throw error;

      await fetchApplications();
    } catch (error) {
      console.error("approve error:", error);
      setErrorMessage(error?.message || "승인 처리 중 오류가 발생했습니다.");
    } finally {
      setProcessingId("");
    }
  };

  const openRejectModal = (application) => {
    setRejectReasonDraft("");
    setRejectModalApp(application);
  };

  const closeRejectModal = () => {
    setRejectModalApp(null);
    setRejectReasonDraft("");
  };

  const submitRejectWithReason = async () => {
    if (!rejectModalApp?.id) return;
    const application = rejectModalApp;
    const trimmed = rejectReasonDraft.trim();

    try {
      setProcessingId(application.id);
      setErrorMessage("");

      const { error } = await supabase.rpc("reject_curator_application", {
        application_id: application.id,
        p_reason: trimmed || null,
      });

      if (error) throw error;

      if (application.user_id) {
        const rejectKey = `curator_rejected_${application.user_id}_${application.id}`;
        localStorage.removeItem(rejectKey);
      }

      closeRejectModal();
      await fetchApplications();
    } catch (error) {
      console.error("reject error:", error);
      setErrorMessage(
        error?.message ||
          "반려 처리 중 오류가 발생했습니다. DB에 `rejection_reason` 컬럼·RPC 갱신(20260416_curator_rejection_reason.sql)을 적용했는지 확인하세요."
      );
    } finally {
      setProcessingId("");
    }
  };

  const handleViewCurator = (application) => {
    // 큐레이터 관리 페이지로 이동
    navigate(`/admin/curator/${application.user_id}`, {
      state: {
        application: application
      }
    });
  };

  const closeApplicantActivityModal = () => {
    setActivityModal(null);
  };

  const openApplicantActivity = async (application) => {
    if (!application?.user_id) return;
    setActivityModal({
      name: application.name,
      userId: application.user_id,
      activityFormat: null,
      rows: [],
      summary: null,
      loading: true,
      error: "",
    });
    const { data, error } = await supabase.rpc("admin_applicant_activity", {
      p_target_user_id: application.user_id,
    });
    if (error) {
      const raw = String(error.message || error.details || "");
      const missingFn =
        error.code === "PGRST202" ||
        error.code === "42883" ||
        /could not find the function|function .* does not exist|404/i.test(raw);
      const hint = missingFn
        ? " ① Dashboard → SQL Editor에 `database/migrations/20260413_admin_applicant_activity.sql` 전체 붙여 실행(가장 빠름). ② 또는 CLI: 프로젝트 연결 후 `supabase db push`로 `20260415190000_admin_applicant_activity_simple_array_final.sql`까지 적용. URL은 `.env`의 VITE_SUPABASE_URL 과 같은 프로젝트여야 합니다."
        : "";
      setActivityModal((m) =>
        m
          ? {
              ...m,
              loading: false,
              error: missingFn
                ? `RPC admin_applicant_activity 가 없습니다 (404 / PGRST202).${hint}`
                : raw || "조회 실패",
            }
          : m
      );
      return;
    }

    let rows = [];
    let summary = null;
    let activityFormat = "legacy_array";
    if (
      data != null &&
      typeof data === "object" &&
      !Array.isArray(data) &&
      Array.isArray(data.items)
    ) {
      rows = data.items;
      summary =
        data.summary && typeof data.summary === "object" ? data.summary : null;
      activityFormat = "legacy_items";
    } else if (Array.isArray(data)) {
      rows = data;
      activityFormat = "legacy_array";
    } else {
      rows = [];
      activityFormat = "legacy_array";
    }
    setActivityModal((m) =>
      m
        ? {
            ...m,
            loading: false,
            activityFormat,
            rows,
            summary,
          }
        : m
    );
  };

  const handleDelete = async (application) => {
    try {
      setProcessingId(application.id);
      setErrorMessage("");

      // 1. 신청서 삭제
      const { error: deleteError } = await supabase.rpc("delete_curator_application", {
        application_id: application.id,
      });

      if (deleteError) throw deleteError;

      // 2. 큐레이터 자격 박탈 (이미 큐레이터인 경우)
      if (application.status === "approved" && application.user_id) {
        // profiles 테이블 업데이트 시도
        const { error: revokeError } = await supabase
          .from("profiles")
          .update({ role: "user" })
          .eq("id", application.user_id);

        if (revokeError) {
          console.error("🔍 삭제 시 자격 박탈 오류:", revokeError);
          
          // RLS 권한 오류 시 curators 테이블에서 직접 삭제 시도
          if (revokeError.code === "42501" || revokeError.message?.includes("permission denied")) {
            console.log("🔄 삭제 시 자격 박탈 RLS 권한 오류 - curators 테이블 직접 삭제 시도");
            
            const { error: deleteError } = await supabase
              .from("curators")
              .delete()
              .eq("user_id", application.user_id);
            
            if (deleteError) {
              console.error("🔍 삭제 시 curators 테이블 삭제 오류:", deleteError);
              setErrorMessage("큐레이터 자격 박탈에 실패했습니다: " + deleteError.message);
              return;
            } else {
              console.log("✅ 삭제 시 curators 테이블에서 직접 삭제 성공");
            }
          } else {
            setErrorMessage("큐레이터 자격 박탈에 실패했습니다: " + revokeError.message);
            return;
          }
        } else {
          console.log("✅ 삭제 시 직접 업데이트로 자격 박탈 성공");
        }

        // 성공적으로 자격 박탈 알림
        alert(`✅ 큐레이터 자격이 박탈되었습니다.\n\n사용자: ${application.name}\n상태: 일반 유저로 변경됨`);
        
        // 환영 메시지 localStorage 삭제 (재승인 시 다시 표시되도록)
        if (application.user_id) {
          const welcomeKey = `curator_welcome_${application.user_id}`;
          localStorage.removeItem(welcomeKey);
          console.log("🗑️ 큐레이터 환영 메시지 localStorage 삭제:", welcomeKey);
        }
      }

      await fetchApplications();
    } catch (error) {
      console.error("delete error:", error);
      setErrorMessage(error?.message || "삭제 처리 중 오류가 발생했습니다.");
    } finally {
      setProcessingId("");
    }
  };

  const handleRevoke = async (application) => {
    try {
      setProcessingId(application.id);
      setErrorMessage("");

      // 큐레이터 자격 박탈 (직접 업데이트 시도)
      const { error: revokeError } = await supabase
        .from("profiles")
        .update({ role: "user" })
        .eq("id", application.user_id);

      if (revokeError) {
        console.error("🔍 자격 박탈 직접 변경 오류:", revokeError);
        
        // RLS 권한 오류 시 기존 RPC 함수 사용 시도
        if (revokeError.code === "42501" || revokeError.message?.includes("permission denied")) {
          console.log("🔄 자격 박탈 RLS 권한 오류 - RPC 함수 없음, 직접 삭제 시도");
          
          // curators 테이블에서 직접 삭제 시도
          const { error: deleteError } = await supabase
            .from("curators")
            .delete()
            .eq("user_id", application.user_id);
          
          if (deleteError) {
            console.error("🔍 curators 테이블 삭제 오류:", deleteError);
            setErrorMessage("큐레이터 자격 박탈에 실패했습니다: " + deleteError.message);
            return;
          } else {
            console.log("✅ curators 테이블에서 직접 삭제 성공");
          }
        } else {
          setErrorMessage("큐레이터 자격 박탈에 실패했습니다: " + revokeError.message);
          return;
        }
      } else {
        console.log("✅ 직접 업데이트로 자격 박탈 성공");
      }

      // 신청서 상태도 "pending"으로 되돌리기 (직접 업데이트 시도)
      const { error: statusError } = await supabase
        .from("curator_applications")
        .update({ status: "pending" })
        .eq("id", application.id);
      
      if (statusError) {
        console.error("🔍 신청서 상태 직접 변경 오류:", statusError);
        
        // RLS 권한 오류 시 기존 RPC 함수 사용 시도
        if (statusError.code === "42501" || statusError.message?.includes("permission denied")) {
          console.log("🔄 신청서 상태 변경 RLS 권한 오류 - 기존 RPC 함수로 시도");
          
          // reject_curator_application을 사용하여 상태를 pending으로 변경
          const { error: rejectRpcError } = await supabase.rpc("reject_curator_application", {
            application_id: application.id
          });
          
          if (rejectRpcError) {
            console.error("🔍 reject RPC 변경 오류:", rejectRpcError);
            // 상태 변경 실패해도 자격 박탈은 성공했으므로 계속 진행
          } else {
            console.log("✅ 신청서 상태도 reject RPC 함수로 변경됨 (rejected 상태)");
          }
        } else {
          console.error("신청서 상태 변경 일반 오류:", statusError);
        }
      } else {
        console.log("✅ 신청서 상태도 직접 업데이트로 'pending'으로 변경됨");
      }

      // 환영 메시지 localStorage 삭제 (재승인 시 다시 표시되도록)
      if (application.user_id) {
        const welcomeKey = `curator_welcome_${application.user_id}`;
        localStorage.removeItem(welcomeKey);
        console.log("🗑️ 되돌리기 시 큐레이터 환영 메시지 localStorage 삭제:", welcomeKey);
      }

      await fetchApplications();
    } catch (error) {
      console.error("revoke error:", error);
      setErrorMessage(error?.message || "되돌리기 처리 중 오류가 발생했습니다.");
    } finally {
      setProcessingId("");
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={styles.backButton}
        >
          ← 뒤로
        </button>

        <div style={styles.title}>큐레이터 신청 내역</div>

        {!loading && isAdmin ? (
          <button
            type="button"
            onClick={() => navigate("/admin/search-insights")}
            style={{
              ...styles.refreshButton,
              marginRight: 8,
              backgroundColor: "#2c3e50",
            }}
          >
            검색 인사이트
          </button>
        ) : null}

        <button
          type="button"
          onClick={fetchApplications}
          style={styles.refreshButton}
        >
          새로고침
        </button>
      </div>

      <div style={styles.content}>
        {!loading && !isAdmin && errorMessage ? (
          <div style={styles.errorText}>{errorMessage}</div>
        ) : null}

        {loading ? (
          <div style={styles.emptyText}>불러오는 중...</div>
        ) : errorMessage ? (
          <div style={styles.errorText}>{errorMessage}</div>
        ) : applications.length === 0 ? (
          <div style={styles.emptyText}>아직 신청 내역이 없습니다.</div>
        ) : (
          <div style={styles.list}>
            {applications.map((item) => {
              const isProcessing = processingId === item.id;
              const isApproved = item.status === "approved";
              const isRejected = item.status === "rejected";
              const isPending = item.status === "pending";

              return (
                <div key={item.id} style={styles.card}>
                  <div style={styles.topRow}>
                    <div style={styles.name}>{item.name}</div>
                    <span
                      style={{
                        ...styles.statusBadge,
                        ...(isApproved
                          ? styles.statusApproved
                          : isRejected
                          ? styles.statusRejected
                          : styles.statusPending),
                      }}
                    >
                      {item.status}
                    </span>
                  </div>

                  <div style={styles.meta}>연락처 / SNS · {item.contact}</div>
                  <div style={styles.meta}>스타일 · {item.style || "-"}</div>
                  <div style={styles.meta}>지역 · {item.regions || "-"}</div>

                  <div style={styles.label}>샘플 술집</div>
                  <div style={styles.sample}>{item.sample_places || "-"}</div>

                  <div style={styles.date}>
                    {new Date(item.created_at).toLocaleString("ko-KR")}
                  </div>

                  {isRejected && item.rejection_reason ? (
                    <div style={styles.rejectionReasonBox}>
                      <span style={styles.rejectionReasonLabel}>반려 사유</span>
                      <div style={styles.rejectionReasonText}>{item.rejection_reason}</div>
                    </div>
                  ) : null}

                  <div style={{ marginTop: "10px" }}>
                    <button
                      type="button"
                      onClick={() => openApplicantActivity(item)}
                      style={styles.activityButton}
                    >
                      앱 내 활동 (추천·저장)
                    </button>
                  </div>

                  <div style={styles.buttonRow}>
                    {isPending && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleApprove(item)}
                          disabled={isProcessing}
                          style={{
                            ...styles.approveButton,
                            opacity: isProcessing ? 0.5 : 1,
                          }}
                        >
                          {isProcessing ? "처리 중..." : "승인"}
                        </button>

                        <button
                          type="button"
                          onClick={() => openRejectModal(item)}
                          disabled={isProcessing}
                          style={{
                            ...styles.rejectButton,
                            opacity: isProcessing ? 0.5 : 1,
                          }}
                        >
                          반려
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          disabled={isProcessing}
                          style={{
                            ...styles.deleteButton,
                            opacity: isProcessing ? 0.5 : 1,
                          }}
                        >
                          삭제
                        </button>
                      </>
                    )}

                    {isApproved && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleViewCurator(item)}
                          disabled={isProcessing}
                          style={{
                            ...styles.detailButton,
                            opacity: isProcessing ? 0.5 : 1,
                          }}
                        >
                          상세보기
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          disabled={isProcessing}
                          style={{
                            ...styles.deleteButton,
                            opacity: isProcessing ? 0.5 : 1,
                          }}
                        >
                          삭제
                        </button>
                      </>
                    )}

                    {isRejected && (
                      <>
                        <span style={styles.statusTextRejected}>반려됨</span>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          disabled={isProcessing}
                          style={{
                            ...styles.deleteButton,
                            opacity: isProcessing ? 0.5 : 1,
                          }}
                        >
                          삭제
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {activityModal ? (
        activityModal.loading ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-busy="true"
            aria-label="신청자 활동 불러오는 중"
            style={styles.modalOverlay}
            onClick={closeApplicantActivityModal}
          >
            <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalBody}>불러오는 중…</div>
            </div>
          </div>
        ) : activityModal.error ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="applicant-activity-title"
            style={styles.modalOverlay}
            onClick={closeApplicantActivityModal}
          >
            <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <h2 id="applicant-activity-title" style={styles.modalTitle}>
                  앱 내 활동 · {activityModal.name}
                </h2>
                <button
                  type="button"
                  aria-label="닫기"
                  onClick={closeApplicantActivityModal}
                  style={styles.modalClose}
                >
                  ×
                </button>
              </div>
              <div style={{ ...styles.modalBody, color: "#FF6B6B" }}>
                {activityModal.error}
                <div style={{ marginTop: "8px", fontSize: "12px", color: "#9f9f9f" }}>
                  SQL Editor에{" "}
                  <code style={styles.modalCode}>
                    database/migrations/20260413_admin_applicant_activity.sql
                  </code>
                  {" "}내용을 실행하거나,{" "}
                  <code style={styles.modalCode}>supabase db push</code>
                  로{" "}
                  <code style={styles.modalCode}>
                    20260415190000_admin_applicant_activity_simple_array_final.sql
                  </code>
                  까지 적용하세요.
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="applicant-activity-title"
            style={styles.modalOverlay}
            onClick={closeApplicantActivityModal}
          >
            <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <h2 id="applicant-activity-title" style={styles.modalTitle}>
                  앱 내 활동 · {activityModal.name}
                </h2>
                <button
                  type="button"
                  aria-label="닫기"
                  onClick={closeApplicantActivityModal}
                  style={styles.modalClose}
                >
                  ×
                </button>
              </div>
              <div style={styles.modalMeta}>
                user_id{" "}
                <code style={styles.modalCode}>{activityModal.userId}</code>
              </div>
              {isApplicantActivityEmpty(activityModal) ? (
                <div style={styles.modalBody}>등록된 추천·저장이 없습니다.</div>
              ) : (
                <>
                  {activityModal.summary ? (
                    <div style={styles.modalSummary}>
                      추천{" "}
                      <strong style={{ color: "#e5e5e5" }}>
                        {Number(activityModal.summary.recommend_count) || 0}
                      </strong>
                      건 · 저장{" "}
                      <strong style={{ color: "#e5e5e5" }}>
                        {Number(activityModal.summary.saved_count) || 0}
                      </strong>
                      건
                      {Array.isArray(activityModal.summary.folders) &&
                      activityModal.summary.folders.length > 0 ? (
                        <div style={styles.modalSummaryFolders}>
                          <span style={{ color: "#bdbdbd" }}>폴더별</span>{" "}
                          {activityModal.summary.folders
                            .map((f) => {
                              const n = Number(f.count) || 0;
                              const label = f.name || "—";
                              return `${label} (${n})`;
                            })
                            .join(" · ")}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <ul style={styles.modalList}>
                    {(activityModal.rows ?? []).map((row, idx) => (
                      <li key={`${row.kind}-${row.at}-${idx}`} style={styles.modalListItem}>
                        <span
                          style={{
                            ...styles.modalKind,
                            ...(row.kind === "recommend"
                              ? styles.modalKindRecommend
                              : styles.modalKindSaved),
                          }}
                        >
                          {row.kind === "recommend" ? "추천" : "저장"}
                        </span>
                        <div style={styles.modalPlaceName}>{row.place_name || "(이름 없음)"}</div>
                        {row.address ? (
                          <div style={styles.modalAddress}>{row.address}</div>
                        ) : null}
                        {row.kind === "saved" &&
                        (row.folder_names || Number(row.folder_count) > 0) ? (
                          <div style={styles.modalFolder}>
                            {row.folder_names ? (
                              <>
                                폴더{" "}
                                {row.folder_count > 0 ? (
                                  <span style={{ color: "#888" }}>({row.folder_count}) </span>
                                ) : null}
                                {row.folder_names}
                              </>
                            ) : (
                              <>폴더 {row.folder_count}개 (이름 없음)</>
                            )}
                          </div>
                        ) : null}
                        <div style={styles.modalAt}>
                          {row.at
                            ? new Date(row.at).toLocaleString("ko-KR")
                            : "-"}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        )
      ) : null}

      {rejectModalApp ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-modal-title"
          style={styles.modalOverlay}
          onClick={closeRejectModal}
        >
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 id="reject-modal-title" style={styles.modalTitle}>
                신청 반려 · {rejectModalApp.name}
              </h2>
              <button
                type="button"
                aria-label="닫기"
                onClick={closeRejectModal}
                style={styles.modalClose}
              >
                ×
              </button>
            </div>
            <p style={styles.rejectModalHint}>
              사유는 선택입니다. 입력 시 신청자 화면 알림에 포함됩니다. 비워 두면 안내 문구만
              표시됩니다.
            </p>
            <textarea
              value={rejectReasonDraft}
              onChange={(e) => setRejectReasonDraft(e.target.value)}
              placeholder="예: 샘플 장소 설명이 부족합니다. 활동 지역을 구체적으로 적어 주세요."
              style={styles.rejectReasonTextarea}
              rows={4}
              disabled={processingId === rejectModalApp.id}
            />
            <div style={styles.rejectModalActions}>
              <button
                type="button"
                onClick={closeRejectModal}
                style={styles.rejectModalCancel}
                disabled={processingId === rejectModalApp.id}
              >
                취소
              </button>
              <button
                type="button"
                onClick={submitRejectWithReason}
                style={styles.rejectModalConfirm}
                disabled={processingId === rejectModalApp.id}
              >
                {processingId === rejectModalApp.id ? "처리 중…" : "반려 확정"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function makeSlug(name = "") {
  const normalized = String(name)
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "_")
    .replace(/[^\w가-힣_]/g, "");

  return normalized || `curator_${Date.now()}`;
}

function makeBio(application) {
  const style = application.style?.trim();
  const regions = application.regions?.trim();

  if (style && regions) {
    return `${regions} 중심으로 ${style} 스타일의 큐레이션을 합니다.`;
  }

  if (style) {
    return `${style} 스타일의 큐레이션을 합니다.`;
  }

  if (regions) {
    return `${regions} 중심으로 술집 큐레이션을 합니다.`;
  }

  return "주도 큐레이터입니다.";
}

function pickColor(seed = "") {
  const text = String(seed);
  let sum = 0;

  for (let i = 0; i < text.length; i += 1) {
    sum += text.charCodeAt(i);
  }

  return COLOR_POOL[sum % COLOR_POOL.length];
}

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#111111",
    color: "#ffffff",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
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
    flexWrap: "wrap",
  },
  backButton: {
    border: "1px solid #444444",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    borderRadius: "999px",
    padding: "8px 12px",
    fontWeight: 700,
  },
  refreshButton: {
    border: "1px solid #444444",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    borderRadius: "999px",
    padding: "8px 12px",
    fontWeight: 700,
    marginLeft: "auto",
  },
  title: {
    width: "100%",
    fontSize: "22px",
    fontWeight: 800,
  },
  content: {
    padding: "16px",
  },
  emptyText: {
    color: "#bdbdbd",
    fontSize: "14px",
  },
  errorText: {
    color: "#FF6B6B",
    fontSize: "14px",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  card: {
    border: "1px solid #2a2a2a",
    backgroundColor: "#171717",
    borderRadius: "16px",
    padding: "14px",
  },
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    marginBottom: "6px",
  },
  name: {
    fontSize: "18px",
    fontWeight: 800,
  },
  statusBadge: {
    fontSize: "12px",
    fontWeight: 700,
    padding: "6px 10px",
    borderRadius: "999px",
  },
  statusPending: {
    backgroundColor: "#2a2a2a",
    color: "#f3f3f3",
  },
  statusApproved: {
    backgroundColor: "#1f3d2c",
    color: "#2ECC71",
  },
  statusRejected: {
    backgroundColor: "#3a1f1f",
    color: "#FF6B6B",
  },
  meta: {
    fontSize: "13px",
    color: "#d4d4d4",
    lineHeight: 1.6,
  },
  label: {
    marginTop: "10px",
    marginBottom: "6px",
    fontSize: "12px",
    color: "#9f9f9f",
  },
  sample: {
    fontSize: "13px",
    color: "#ffffff",
    whiteSpace: "pre-line",
    lineHeight: 1.6,
  },
  date: {
    marginTop: "10px",
    fontSize: "12px",
    color: "#bdbdbd",
  },
  rejectionReasonBox: {
    marginTop: "10px",
    padding: "10px 12px",
    borderRadius: "10px",
    backgroundColor: "#221010",
    border: "1px solid #4a2a2a",
  },
  rejectionReasonLabel: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#FF6B6B",
    display: "block",
    marginBottom: "6px",
  },
  rejectionReasonText: {
    fontSize: "13px",
    color: "#f0d0d0",
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
  },
  rejectModalHint: {
    fontSize: "12px",
    color: "#bdbdbd",
    lineHeight: 1.5,
    marginBottom: "10px",
  },
  rejectReasonTextarea: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #3a3a3a",
    borderRadius: "12px",
    padding: "12px",
    backgroundColor: "#141414",
    color: "#fff",
    fontSize: "13px",
    resize: "vertical",
    minHeight: "100px",
    marginBottom: "14px",
  },
  rejectModalActions: {
    display: "flex",
    gap: "10px",
  },
  rejectModalCancel: {
    flex: 1,
    border: "1px solid #444",
    backgroundColor: "#1a1a1a",
    color: "#fff",
    borderRadius: "12px",
    padding: "12px",
    fontWeight: 700,
  },
  rejectModalConfirm: {
    flex: 1,
    border: "none",
    backgroundColor: "#c0392b",
    color: "#fff",
    borderRadius: "12px",
    padding: "12px",
    fontWeight: 800,
  },
  buttonRow: {
    marginTop: "14px",
    display: "flex",
    gap: "10px",
  },
  approveButton: {
    flex: 1,
    border: "none",
    backgroundColor: "#2ECC71",
    color: "#111111",
    borderRadius: "12px",
    padding: "12px",
    fontSize: "14px",
    fontWeight: 800,
  },
  rejectButton: {
    flex: 1,
    border: "1px solid #5a2a2a",
    backgroundColor: "#2a1515",
    color: "#FF6B6B",
    borderRadius: "12px",
    padding: "12px",
    fontSize: "14px",
    fontWeight: 700,
  },
  detailButton: {
    flex: 1,
    border: "1px solid #2a5a2a",
    backgroundColor: "#152a15",
    color: "#2ECC71",
    borderRadius: "12px",
    padding: "12px",
    fontSize: "14px",
    fontWeight: 700,
  },
  deleteButton: {
    flex: 1,
    border: "1px solid #5a2a2a",
    backgroundColor: "#2a1515",
    color: "#FF6B6B",
    borderRadius: "12px",
    padding: "12px",
    fontSize: "14px",
    fontWeight: 700,
  },
  revokeButton: {
    flex: 1,
    border: "1px solid #5a2a2a",
    backgroundColor: "#2a1515",
    color: "#FF6B6B",
    borderRadius: "12px",
    padding: "12px",
    fontSize: "14px",
    fontWeight: 700,
  },
  statusText: {
    color: "#2ECC71",
    fontSize: "14px",
    fontWeight: 700,
    padding: "12px",
    display: "flex",
    alignItems: "center",
  },
  statusTextRejected: {
    color: "#FF6B6B",
    fontSize: "14px",
    fontWeight: 700,
    padding: "12px",
    display: "flex",
    alignItems: "center",
  },
  activityButton: {
    border: "1px solid #3d4f6a",
    backgroundColor: "#1a2332",
    color: "#7eb8ff",
    borderRadius: "10px",
    padding: "8px 12px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    width: "100%",
    boxSizing: "border-box",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 2000,
    backgroundColor: "rgba(0,0,0,0.65)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
    boxSizing: "border-box",
  },
  modalCard: {
    width: "100%",
    maxWidth: "520px",
    maxHeight: "min(85vh, 720px)",
    overflow: "auto",
    backgroundColor: "#171717",
    border: "1px solid #2a2a2a",
    borderRadius: "16px",
    padding: "16px",
    boxSizing: "border-box",
  },
  modalHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "8px",
  },
  modalTitle: {
    margin: 0,
    fontSize: "17px",
    fontWeight: 800,
    lineHeight: 1.3,
  },
  modalClose: {
    flexShrink: 0,
    width: "36px",
    height: "36px",
    border: "none",
    borderRadius: "10px",
    backgroundColor: "#2a2a2a",
    color: "#fff",
    fontSize: "22px",
    lineHeight: 1,
    cursor: "pointer",
  },
  modalMeta: {
    fontSize: "11px",
    color: "#9f9f9f",
    marginBottom: "12px",
    wordBreak: "break-all",
  },
  modalMuted: {
    fontSize: "12px",
    color: "#888",
    marginBottom: "8px",
  },
  modalSummary: {
    fontSize: "12px",
    color: "#bdbdbd",
    lineHeight: 1.5,
    marginBottom: "12px",
    padding: "10px 12px",
    borderRadius: "10px",
    backgroundColor: "#141414",
    border: "1px solid #2a2a2a",
  },
  modalSummaryFolders: {
    marginTop: "6px",
    fontSize: "11px",
    color: "#9f9f9f",
  },
  modalCode: {
    fontFamily: "ui-monospace, monospace",
    fontSize: "10px",
    color: "#d4d4d4",
  },
  modalBody: {
    fontSize: "14px",
    color: "#d4d4d4",
    lineHeight: 1.5,
  },
  modalList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  modalListItem: {
    border: "1px solid #2a2a2a",
    borderRadius: "12px",
    padding: "10px 12px",
    backgroundColor: "#111",
  },
  modalKind: {
    display: "inline-block",
    fontSize: "10px",
    fontWeight: 800,
    padding: "3px 8px",
    borderRadius: "6px",
    marginBottom: "6px",
  },
  modalKindRecommend: {
    backgroundColor: "#1f3d2c",
    color: "#2ECC71",
  },
  modalKindSaved: {
    backgroundColor: "#2a2540",
    color: "#a78bfa",
  },
  modalPlaceName: {
    fontSize: "15px",
    fontWeight: 700,
    color: "#fff",
  },
  modalAddress: {
    fontSize: "12px",
    color: "#bdbdbd",
    marginTop: "4px",
  },
  modalFolder: {
    fontSize: "12px",
    color: "#c4b5fd",
    marginTop: "6px",
  },
  modalAt: {
    fontSize: "11px",
    color: "#888",
    marginTop: "6px",
  },
};