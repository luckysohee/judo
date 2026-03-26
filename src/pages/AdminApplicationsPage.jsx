import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

const COLOR_POOL = ["#2ECC71", "#FF5A5F", "#8E44AD", "#3498DB", "#A47148"];

export default function AdminApplicationsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [processingId, setProcessingId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

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

  const handleReject = async (application) => {
    try {
      // 반려 확인 알림
      const confirmed = window.confirm(`${application.name}님의 큐레이터 신청을 반려하시겠습니까?\n\n반려 시 사용자는 다시 신청할 수 있습니다.`);
      if (!confirmed) {
        return; // 사용자가 취소하면 함수 종료
      }

      setProcessingId(application.id);
      setErrorMessage("");

      const { error } = await supabase.rpc("reject_curator_application", {
        application_id: application.id,
      });

      if (error) throw error;

      // 반려된 신청에 대한 localStorage 삭제 (다음 로그인시 알림 표시)
      if (application.user_id) {
        const rejectKey = `curator_rejected_${application.user_id}_${application.id}`;
        localStorage.removeItem(rejectKey);
        console.log("🗑️ 반려 알림 localStorage 삭제:", rejectKey);
      }

      await fetchApplications();
    } catch (error) {
      console.error("reject error:", error);
      setErrorMessage(error?.message || "반려 처리 중 오류가 발생했습니다.");
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
                          onClick={() => handleReject(item)}
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
};