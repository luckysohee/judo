import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { GRADE_LABELS_KO } from "../utils/curatorGradeRules";
import { adminTopNavButtonStyle } from "../styles/adminTopNavButton";
import { useToast } from "../components/Toast/ToastProvider";
import AdminConfirmDialog from "../components/AdminConfirmDialog";

const COLOR_POOL = ["#2ECC71", "#FF5A5F", "#8E44AD", "#3498DB", "#A47148"];

function isApplicantActivityEmpty(m) {
  if (!m || m.loading || m.error) return false;
  return (m.rows ?? []).length === 0;
}

function applicationSearchBlob(item) {
  const statusKo =
    item.status === "pending"
      ? "대기 검토 신규 pending"
      : item.status === "approved"
        ? "승인 approved"
        : item.status === "rejected"
          ? "반려 rejected"
          : String(item.status ?? "");
  return [
    item.name,
    item.contact,
    item.style,
    item.regions,
    item.sample_places,
    item.status,
    statusKo,
    item.user_id,
    item.id,
    item.rejection_reason,
  ]
    .map((x) => String(x ?? "").toLowerCase())
    .join(" ");
}

function applicationMatchesSearch(item, queryRaw) {
  const q = queryRaw.trim().toLowerCase();
  if (!q) return true;
  const blob = applicationSearchBlob(item);
  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every((t) => blob.includes(t));
}

export default function AdminApplicationsPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [processingId, setProcessingId] = useState("");
  /** 신청자 앱 내 장소·저장 (admin_applicant_activity RPC) */
  const [activityModal, setActivityModal] = useState(null);
  /** 반려 시 사유 입력 */
  const [rejectModalApp, setRejectModalApp] = useState(null);
  const [rejectReasonDraft, setRejectReasonDraft] = useState("");
  /** 승급 검토 큐 (curators.total_places 갱신 시 DB 트리거로 쌓임) */
  const [gradeReviewItems, setGradeReviewItems] = useState([]);
  /** 신청 목록 필터 (이름·연락처·지역 등) */
  const [applicationSearch, setApplicationSearch] = useState("");
  const [approveTarget, setApproveTarget] = useState(null);

  useEffect(() => {
    if (authLoading || !user?.id) return;
    fetchApplications();
  }, [authLoading, user?.id]);

  const loadGradeReviews = async () => {
    try {
      const { data, error } = await supabase
        .from("curator_grade_review_queue")
        .select(
          "id, curator_user_id, current_grade, suggested_grade, total_places_at_trigger, created_at"
        )
        .is("resolved_at", null)
        .order("created_at", { ascending: false })
        .limit(40);

      if (error) {
        const msg = String(error.message || error.details || "");
        if (
          /does not exist|schema cache|relation|42P01|PGRST205/i.test(msg)
        ) {
          setGradeReviewItems([]);
          return;
        }
        console.warn("grade review queue:", msg);
        setGradeReviewItems([]);
        return;
      }

      const rows = Array.isArray(data) ? data : [];
      const ids = [...new Set(rows.map((r) => r.curator_user_id).filter(Boolean))];
      let nameById = {};
      if (ids.length > 0) {
        const { data: cr } = await supabase
          .from("curators")
          .select("user_id, username")
          .in("user_id", ids);
        nameById = Object.fromEntries(
          (cr || []).map((c) => [c.user_id, c.username])
        );
      }
      setGradeReviewItems(
        rows.map((r) => ({
          ...r,
          username: nameById[r.curator_user_id] || String(r.curator_user_id).slice(0, 8),
        }))
      );
    } catch (e) {
      console.warn("loadGradeReviews:", e);
      setGradeReviewItems([]);
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
    await loadGradeReviews();
  };

  const handleApprove = (application) => {
    setApproveTarget(application);
  };

  const runApproveConfirmed = async () => {
    const application = approveTarget;
    setApproveTarget(null);
    if (!application?.id) return;
    try {
      setProcessingId(application.id);
      setErrorMessage("");

      const { error } = await supabase.rpc("approve_curator_application", {
        application_id: application.id,
      });

      if (error) throw error;

      showToast(`${application.name}님 신청을 승인했습니다.`, "success");
      await fetchApplications();
    } catch (error) {
      console.error("approve error:", error);
      const msg = error?.message || "승인 처리 중 오류가 발생했습니다.";
      setErrorMessage(msg);
      showToast(msg, "error", 5000);
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

      showToast(`${application.name}님 신청을 반려했습니다.`, "success");
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

        showToast(
          `큐레이터 자격을 박탈했습니다. (${application.name} → 일반 유저)`,
          "success",
          4000
        );
        
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

  const applicationSummary = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let other = 0;
    for (const row of applications) {
      const s = row.status;
      if (s === "pending") pending += 1;
      else if (s === "approved") approved += 1;
      else if (s === "rejected") rejected += 1;
      else other += 1;
    }
    return {
      pending,
      approved,
      rejected,
      other,
      total: applications.length,
    };
  }, [applications]);

  const filteredApplications = useMemo(() => {
    const q = applicationSearch.trim();
    const matched = applications.filter((item) =>
      applicationMatchesSearch(item, applicationSearch)
    );
    if (!q) return matched;
    const order = { pending: 0, approved: 1, rejected: 2 };
    return [...matched].sort((a, b) => {
      const da = order[a.status] ?? 9;
      const db = order[b.status] ?? 9;
      if (da !== db) return da - db;
      return (
        new Date(b.created_at || 0) - new Date(a.created_at || 0)
      );
    });
  }, [applications, applicationSearch]);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={styles.headerTop}>
          <button
            type="button"
            onClick={() => navigate("/admin")}
            style={adminTopNavButtonStyle}
            aria-label="관리자 허브로"
            title="관리자 허브로"
          >
            ←
          </button>

          <div style={styles.title}>큐레이터 신청 내역</div>

          <button
            type="button"
            onClick={fetchApplications}
            style={styles.refreshButton}
            aria-label="새로고침"
            title="새로고침"
          >
            <svg
              width={13}
              height={13}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M8 16H3v5" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div style={styles.summaryStripMuted}>요약 불러오는 중…</div>
        ) : errorMessage && applicationSummary.total === 0 ? null : (
          <div style={styles.summaryStrip} aria-label="신청 현황 요약">
            <span
              style={{
                ...styles.summaryPill,
                ...(applicationSummary.pending > 0
                  ? styles.summaryPillPendingHi
                  : styles.summaryPillMuted),
              }}
            >
              신규 대기 {applicationSummary.pending}
            </span>
            <span style={styles.summaryPill}>승인 {applicationSummary.approved}</span>
            <span style={styles.summaryPill}>반려 {applicationSummary.rejected}</span>
            {applicationSummary.other > 0 ? (
              <span style={styles.summaryPill}>기타 {applicationSummary.other}</span>
            ) : null}
            <span style={styles.summaryPillOutline}>전체 {applicationSummary.total}</span>
            <span
              style={{
                ...styles.summaryPill,
                ...(gradeReviewItems.length > 0
                  ? styles.summaryPillGradeHi
                  : styles.summaryPillMuted),
              }}
            >
              승급 검토 {gradeReviewItems.length}
            </span>
          </div>
        )}
      </div>

      <div style={styles.content}>
        {!loading && gradeReviewItems.length > 0 ? (
          <div
            style={{
              marginBottom: "8px",
              padding: "10px 12px",
              borderRadius: "10px",
              border: "1px solid rgba(241, 196, 15, 0.45)",
              backgroundColor: "rgba(241, 196, 15, 0.12)",
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
              승급 검토 알림 · {gradeReviewItems.length}건
            </div>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.65)", marginBottom: "8px" }}>
              등록 장소 수가 올라가 추천 등급이 현재 등급보다 높아진 큐레이터입니다. 확인 후 등급을 올려 주세요.
            </div>
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              {gradeReviewItems.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/admin/curator/${row.curator_user_id}`)
                    }
                    style={{
                      width: "100%",
                      textAlign: "left",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: "8px",
                      padding: "8px 10px",
                      backgroundColor: "rgba(0,0,0,0.25)",
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: "13px",
                    }}
                  >
                    <strong>@{row.username}</strong>
                    <span style={{ color: "rgba(255,255,255,0.55)" }}>
                      {" "}
                      · {GRADE_LABELS_KO[row.current_grade] || row.current_grade} →{" "}
                      <span style={{ color: "#f1c40f" }}>
                        {GRADE_LABELS_KO[row.suggested_grade] || row.suggested_grade}
                      </span>
                      {" "}
                      · 장소 {row.total_places_at_trigger}개
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!loading && !errorMessage && applications.length > 0 ? (
          <div style={styles.searchBarRow}>
            <label htmlFor="admin-applications-search" style={styles.searchLabel}>
              신청 검색
            </label>
            <div style={styles.searchInputWrap}>
              <span style={styles.searchIcon} aria-hidden="true">
                <svg
                  width={18}
                  height={18}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="rgba(255,255,255,0.45)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </span>
              <input
                id="admin-applications-search"
                type="search"
                value={applicationSearch}
                onChange={(e) => setApplicationSearch(e.target.value)}
                placeholder="이름, 연락처, 지역, 스타일, 상태(대기·승인·반려), user id…"
                style={styles.searchInput}
                autoComplete="off"
                enterKeyHint="search"
              />
              {applicationSearch.trim() ? (
                <button
                  type="button"
                  onClick={() => setApplicationSearch("")}
                  style={styles.searchClear}
                  aria-label="검색어 지우기"
                >
                  ×
                </button>
              ) : null}
            </div>
            <p style={styles.searchHint}>
              공백으로 여러 키워드를 넣으면 모두 포함되는 신청만 보입니다. 검색 중에는{" "}
              <strong style={{ color: "rgba(255,255,255,0.65)" }}>대기 → 승인 → 반려</strong> 순으로
              정렬됩니다.
            </p>
            {applicationSearch.trim() ? (
              <p style={styles.searchMeta}>
                표시 <strong>{filteredApplications.length}</strong>건 · 전체{" "}
                {applications.length}건
              </p>
            ) : null}
          </div>
        ) : null}

        {loading ? (
          <div style={styles.emptyText}>불러오는 중...</div>
        ) : errorMessage ? (
          <div style={styles.errorText}>{errorMessage}</div>
        ) : applications.length === 0 ? (
          <div style={styles.emptyText}>아직 신청 내역이 없습니다.</div>
        ) : filteredApplications.length === 0 ? (
          <div style={styles.searchNoResults}>
            <p style={styles.emptyText}>검색과 일치하는 신청이 없습니다.</p>
            <button
              type="button"
              onClick={() => setApplicationSearch("")}
              style={styles.searchClearAllButton}
            >
              검색 지우기
            </button>
          </div>
        ) : (
          <div style={styles.list}>
            {filteredApplications.map((item) => {
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

      <AdminConfirmDialog
        open={!!approveTarget}
        title="큐레이터 신청 승인"
        message={
          approveTarget
            ? `${approveTarget.name}님의 큐레이터 신청을 승인하시겠습니까?\n\n승인 시 사용자는 큐레이터 자격을 얻게 됩니다.`
            : ""
        }
        confirmLabel="승인"
        onCancel={() => setApproveTarget(null)}
        onConfirm={() => void runApproveConfirmed()}
      />
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
    padding: "14px 18px 16px",
    borderBottom: "1px solid #222222",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: "14px",
  },
  headerTop: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "nowrap",
  },
  summaryStrip: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    gap: "8px",
    borderTop: "1px solid #2a2a2a",
    paddingTop: "14px",
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
    scrollbarWidth: "thin",
    paddingBottom: "2px",
  },
  summaryStripMuted: {
    fontSize: "13px",
    color: "rgba(255,255,255,0.4)",
    borderTop: "1px solid #2a2a2a",
    paddingTop: "14px",
  },
  summaryPill: {
    flexShrink: 0,
    fontSize: "12px",
    fontWeight: 700,
    padding: "6px 12px",
    borderRadius: "999px",
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.85)",
    whiteSpace: "nowrap",
  },
  summaryPillMuted: {
    backgroundColor: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.5)",
  },
  summaryPillPendingHi: {
    backgroundColor: "rgba(241, 196, 15, 0.2)",
    color: "#f1c40f",
    border: "1px solid rgba(241, 196, 15, 0.35)",
  },
  summaryPillGradeHi: {
    backgroundColor: "rgba(241, 196, 15, 0.14)",
    color: "#e8d089",
    border: "1px solid rgba(241, 196, 15, 0.28)",
  },
  summaryPillOutline: {
    flexShrink: 0,
    fontSize: "12px",
    fontWeight: 700,
    padding: "6px 12px",
    borderRadius: "999px",
    border: "1px solid #3a3a3a",
    color: "rgba(255,255,255,0.55)",
    whiteSpace: "nowrap",
  },
  refreshButton: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #444444",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    borderRadius: "999px",
    padding: "7px",
    minWidth: "30px",
    minHeight: "30px",
    boxSizing: "border-box",
    cursor: "pointer",
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: "19px",
    fontWeight: 800,
    lineHeight: 1.35,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  content: {
    padding: "14px 18px 20px",
  },
  searchBarRow: {
    marginBottom: "16px",
  },
  searchLabel: {
    display: "block",
    fontSize: "13px",
    fontWeight: 700,
    color: "rgba(255,255,255,0.75)",
    marginBottom: "8px",
  },
  searchInputWrap: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  searchIcon: {
    position: "absolute",
    left: "14px",
    top: "50%",
    transform: "translateY(-50%)",
    display: "flex",
    pointerEvents: "none",
  },
  searchInput: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 40px 12px 44px",
    borderRadius: "12px",
    border: "1px solid #3a3a3a",
    backgroundColor: "#141414",
    color: "#ffffff",
    fontSize: "15px",
    outline: "none",
  },
  searchClear: {
    position: "absolute",
    right: "8px",
    top: "50%",
    transform: "translateY(-50%)",
    width: "32px",
    height: "32px",
    border: "none",
    borderRadius: "8px",
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.75)",
    fontSize: "20px",
    lineHeight: 1,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  },
  searchHint: {
    fontSize: "12px",
    color: "rgba(255,255,255,0.45)",
    marginTop: "8px",
    lineHeight: 1.5,
    marginBottom: 0,
  },
  searchMeta: {
    fontSize: "12px",
    color: "rgba(255,255,255,0.55)",
    marginTop: "8px",
    marginBottom: 0,
  },
  searchNoResults: {
    padding: "12px 0 8px",
  },
  searchClearAllButton: {
    marginTop: "10px",
    border: "1px solid #444444",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    borderRadius: "999px",
    padding: "8px 16px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
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
    gap: "8px",
  },
  card: {
    border: "1px solid #2a2a2a",
    backgroundColor: "#171717",
    borderRadius: "12px",
    padding: "10px 12px",
  },
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "8px",
    marginBottom: "4px",
  },
  name: {
    fontSize: "16px",
    fontWeight: 800,
  },
  statusBadge: {
    fontSize: "11px",
    fontWeight: 700,
    padding: "4px 8px",
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
    fontSize: "12px",
    color: "#d4d4d4",
    lineHeight: 1.45,
  },
  label: {
    marginTop: "6px",
    marginBottom: "4px",
    fontSize: "11px",
    color: "#9f9f9f",
  },
  sample: {
    fontSize: "12px",
    color: "#ffffff",
    whiteSpace: "pre-line",
    lineHeight: 1.45,
  },
  date: {
    marginTop: "6px",
    fontSize: "11px",
    color: "#bdbdbd",
  },
  rejectionReasonBox: {
    marginTop: "8px",
    padding: "8px 10px",
    borderRadius: "8px",
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
    marginTop: "10px",
    display: "flex",
    gap: "8px",
  },
  approveButton: {
    flex: 1,
    border: "none",
    backgroundColor: "#2ECC71",
    color: "#111111",
    borderRadius: "10px",
    padding: "9px 10px",
    fontSize: "13px",
    fontWeight: 800,
  },
  rejectButton: {
    flex: 1,
    border: "1px solid #5a2a2a",
    backgroundColor: "#2a1515",
    color: "#FF6B6B",
    borderRadius: "10px",
    padding: "9px 10px",
    fontSize: "13px",
    fontWeight: 700,
  },
  detailButton: {
    flex: 1,
    border: "1px solid #2a5a2a",
    backgroundColor: "#152a15",
    color: "#2ECC71",
    borderRadius: "10px",
    padding: "9px 10px",
    fontSize: "13px",
    fontWeight: 700,
  },
  deleteButton: {
    flex: 1,
    border: "1px solid #5a2a2a",
    backgroundColor: "#2a1515",
    color: "#FF6B6B",
    borderRadius: "10px",
    padding: "9px 10px",
    fontSize: "13px",
    fontWeight: 700,
  },
  revokeButton: {
    flex: 1,
    border: "1px solid #5a2a2a",
    backgroundColor: "#2a1515",
    color: "#FF6B6B",
    borderRadius: "10px",
    padding: "9px 10px",
    fontSize: "13px",
    fontWeight: 700,
  },
  statusText: {
    color: "#2ECC71",
    fontSize: "13px",
    fontWeight: 700,
    padding: "9px 10px",
    display: "flex",
    alignItems: "center",
  },
  statusTextRejected: {
    color: "#FF6B6B",
    fontSize: "13px",
    fontWeight: 700,
    padding: "9px 10px",
    display: "flex",
    alignItems: "center",
  },
  activityButton: {
    border: "1px solid #3d4f6a",
    backgroundColor: "#1a2332",
    color: "#7eb8ff",
    borderRadius: "8px",
    padding: "7px 10px",
    fontSize: "12px",
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