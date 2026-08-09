import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  abandonCourseSession,
  completeCourseSession,
  getMyActiveCourseSession,
  startCourseSession,
  updateCourseSessionStep,
} from "../../api/courseSessions";
import {
  getCourseEngagementStats,
  formatCourseEngagementSocialSummary,
} from "../../api/courseCompletionStats";
import { isCourseLikedByMe, toggleCuratorCourseLike } from "../../api/courseLikes";
import {
  importPublicCuratorCourseSnapshot,
  isPublicCourseImportedByMe,
  removeImportedCuratorCourse,
  removeImportedCuratorCourseBySource,
} from "../../api/courseImports";
import {
  getMyLatestCompletionAtForCourse,
  recordCourseCompletionAfterSessionClosed,
} from "../../api/completedCourseLogs";
import { dispatchCourseCompletedCelebration } from "../../lib/courseCompletionEvents";
import { fetchCuratorCourseById } from "../../api/curatorCourses";
import { resolveCourseCoverForCourse } from "../../utils/courseStepThumb";
import { rewriteLegacySupabaseStorageUrl } from "../../utils/rewriteLegacySupabaseStorageUrl";
import { mapPlaceRowForCourse } from "../../api/places";
import CourseMapPreview from "../../components/Course/CourseMapPreview";
import CourseStepScheduleList from "../../components/Course/CourseStepScheduleList";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import {
  studioCoursesInner,
  studioCoursesCard,
  studioCoursesBtnPrimary,
  studioCoursesBtnGhost,
  studioCoursesBtnDanger,
  studioCoursesRowActions,
  studioCoursesScrollMain,
} from "../Studio/studioCoursesSharedStyles";
import StudioScrollLayout from "../../components/Studio/StudioScrollLayout";
import {
  canBookmarkPublishedPublicCourse,
  getCourseVisibilityBadge,
  isValidUuidCourseId,
  shareOrCopyCourseLink,
} from "../../utils/courseDetailUi";
import {
  canEditCuratorCourse,
  isImportedCuratorCourse,
  isMyImportedCourseSnapshot,
} from "../../utils/courseImportUi";
import { buildHomeCourseFollowNavigationState } from "../../utils/homeCourseFollowNavigation";
import {
  COURSE_SCRAP_LABEL_SHORT,
  COURSE_SCRAPED_LABEL,
} from "../../utils/coursePickCopy";

const PAGE_TITLE_APP = "주도";

function formatCourseDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(iso);
  }
}

function curatorDisplayName(profile) {
  if (!profile || typeof profile !== "object") return "큐레이터";
  const dn = String(profile.display_name || "").trim();
  if (dn) return dn;
  const un = String(profile.username || "").trim();
  if (un) return `@${un}`;
  return "큐레이터";
}

export default function CourseDetailPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [phase, setPhase] = useState("loading");
  const [course, setCourse] = useState(null);
  const [curatorProfile, setCuratorProfile] = useState(null);
  const [curatorSlug, setCuratorSlug] = useState(null);
  const [importedByMe, setImportedByMe] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [activeCourseSession, setActiveCourseSession] = useState(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [lastCompletionAtIso, setLastCompletionAtIso] = useState(null);
  const [coursePublicStats, setCoursePublicStats] = useState(null);
  const [likedByMe, setLikedByMe] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [isCurator, setIsCurator] = useState(false);
  const [scheduleStartClock, setScheduleStartClock] = useState("18:00");

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setIsCurator(false);
      return undefined;
    }
    void supabase
      .from("curators")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setIsCurator(false);
          return;
        }
        setIsCurator(Boolean(data?.user_id));
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const loadCourseBundle = useCallback(async () => {
    const id = String(courseId ?? "").trim();
    if (!isValidUuidCourseId(id)) {
      setCourse(null);
      setCuratorProfile(null);
      setCuratorSlug(null);
      setPhase("forbidden");
      return;
    }
    setPhase("loading");
    setCourse(null);
    try {
      const row = await fetchCuratorCourseById(id);
      if (!row) {
        setCourse(null);
        setCuratorProfile(null);
        setCuratorSlug(null);
        setPhase("forbidden");
        return;
      }
      const autoCover = await resolveCourseCoverForCourse(row);
      setCourse(
        autoCover && !String(row.cover_image_url || "").trim()
          ? { ...row, cover_image_url: autoCover }
          : row
      );
      const cid = String(row.curator_id ?? "").trim();
      if (cid) {
        const [profRes, curRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("username, display_name, avatar_url")
            .eq("id", cid)
            .maybeSingle(),
          supabase
            .from("curators")
            .select("slug")
            .eq("user_id", cid)
            .maybeSingle(),
        ]);
        setCuratorProfile(profRes.data && !profRes.error ? profRes.data : null);
        const slug = curRes.data?.slug;
        setCuratorSlug(slug ? String(slug).trim() : null);
      } else {
        setCuratorProfile(null);
        setCuratorSlug(null);
      }
      setPhase("ok");
    } catch (e) {
      console.error("[코스 상세 로드]", e);
      setCourse(null);
      setCuratorProfile(null);
      setCuratorSlug(null);
      setPhase("forbidden");
    }
  }, [courseId]);

  useEffect(() => {
    void loadCourseBundle();
  }, [loadCourseBundle]);

  useEffect(() => {
    let cancelled = false;
    const id = course?.id;
    if (!id) {
      setCoursePublicStats(null);
      return undefined;
    }
    void getCourseEngagementStats(String(id)).then((s) => {
      if (!cancelled) setCoursePublicStats(s);
    });
    return () => {
      cancelled = true;
    };
  }, [course?.id]);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id || !course?.id || !canBookmarkPublishedPublicCourse(course)) {
      setLikedByMe(false);
      return undefined;
    }
    void isCourseLikedByMe(String(course.id)).then((v) => {
      if (!cancelled) setLikedByMe(v);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, course]);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id || !course?.id) {
      setImportedByMe(false);
      return undefined;
    }
    if (isImportedCuratorCourse(course)) {
      setImportedByMe(isMyImportedCourseSnapshot(course, user.id));
      return undefined;
    }
    if (!canBookmarkPublishedPublicCourse(course)) {
      setImportedByMe(false);
      return undefined;
    }
    void isPublicCourseImportedByMe(String(course.id)).then((v) => {
      if (!cancelled) setImportedByMe(v);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, course]);

  const refreshActiveCourseSession = useCallback(async () => {
    if (!user?.id) {
      setActiveCourseSession(null);
      return;
    }
    try {
      const s = await getMyActiveCourseSession();
      setActiveCourseSession(s);
    } catch (e) {
      console.warn("[active course session]", e);
      setActiveCourseSession(null);
    }
  }, [user?.id]);

  useEffect(() => {
    if (authLoading) return;
    void refreshActiveCourseSession();
  }, [authLoading, refreshActiveCourseSession]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const sync = () => {
      void refreshActiveCourseSession();
      if (user?.id && course?.id) {
        void getMyLatestCompletionAtForCourse(String(course.id)).then((iso) =>
          setLastCompletionAtIso(iso || null)
        );
      }
    };
    const onVis = () => {
      if (document.visibilityState === "visible") {
        sync();
      }
    };
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refreshActiveCourseSession, user?.id, course?.id]);

  useEffect(() => {
    let cancelled = false;
    const id = course?.id;
    if (!user?.id || !id) {
      setLastCompletionAtIso(null);
      return undefined;
    }
    void getMyLatestCompletionAtForCourse(String(id)).then((iso) => {
      if (!cancelled) setLastCompletionAtIso(iso || null);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, course?.id]);

  useEffect(() => {
    if (!course || typeof course.title !== "string") {
      return undefined;
    }
    const t = String(course.title).trim() || "코스";
    const prev = document.title;
    document.title = `${t} | ${PAGE_TITLE_APP}`;
    return () => {
      document.title = prev || "judo";
    };
  }, [course]);

  const sortedSteps = useMemo(() => {
    const raw = course?.curator_course_places;
    if (!Array.isArray(raw)) return [];
    return [...raw].sort(
      (a, b) => Number(a.order_index) - Number(b.order_index)
    );
  }, [course]);

  const previewPlaceRows = useMemo(
    () =>
      sortedSteps.map((s, i) => {
        const pl = s.places && typeof s.places === "object" ? s.places : {};
        const meta = mapPlaceRowForCourse({ id: s.place_id, ...pl });
        return {
          key: String(s.id || `step-${s.place_id}-${i}`),
          place_id: String(s.place_id ?? ""),
          place_lat: meta.lat,
          place_lng: meta.lng,
        };
      }),
    [sortedSteps]
  );

  const displaySteps = useMemo(
    () =>
      sortedSteps.map((s, i) => {
        const pl = s.places && typeof s.places === "object" ? s.places : {};
        const meta = mapPlaceRowForCourse({ id: s.place_id, ...pl });
        const sm = s.stay_minutes;
        const stay =
          sm != null && sm !== "" && Number.isFinite(Number(sm))
            ? Math.max(0, Math.floor(Number(sm)))
            : null;
        return {
          key: String(s.id || `disp-${s.place_id}-${i}`),
          place_id: String(s.place_id ?? "").trim(),
          orderLabel: `${i + 1}차`,
          name: meta.name,
          address: meta.address || "주소 없음",
          category: meta.category,
          memo: s.memo != null ? String(s.memo).trim() : "",
          stay_minutes: stay,
          booking_status: String(s.booking_status || "unknown").trim() || "unknown",
          booking_url: String(s.booking_url || "").trim(),
          booking_phone: String(s.booking_phone || "").trim(),
          crowd_note: String(s.crowd_note || "").trim(),
        };
      }),
    [sortedSteps]
  );

  const canFollowCourse = useMemo(
    () =>
      Boolean(
        course &&
          String(course.status || "") === "published" &&
          course.is_public === true
      ),
    [course]
  );

  const followingThisCourse = useMemo(() => {
    if (!activeCourseSession?.course_id || !course?.id) return false;
    return (
      String(activeCourseSession.course_id) === String(course.id)
    );
  }, [activeCourseSession, course?.id]);

  const completionDateLabel = useMemo(() => {
    if (!lastCompletionAtIso) return null;
    try {
      return new Date(lastCompletionAtIso).toLocaleDateString("ko-KR", {
        dateStyle: "medium",
      });
    } catch {
      return null;
    }
  }, [lastCompletionAtIso]);

  const completionSocialLine = useMemo(
    () => formatCourseEngagementSocialSummary(coursePublicStats),
    [coursePublicStats]
  );

  const handleToggleLike = async () => {
    if (!course?.id || !canSavePublic) return;
    if (!user?.id) {
      window.alert("로그인한 뒤 좋아요를 눌러 주세요.");
      return;
    }
    setLikeBusy(true);
    try {
      const r = await toggleCuratorCourseLike(String(course.id));
      setLikedByMe(r.liked);
      setCoursePublicStats((prev) => ({
        ...(prev && typeof prev === "object" ? prev : {}),
        like_count: r.likeCount,
      }));
    } catch (e) {
      window.alert(e?.message || "좋아요를 처리하지 못했습니다.");
    } finally {
      setLikeBusy(false);
    }
  };

  const visibilityBadge = useMemo(
    () => getCourseVisibilityBadge(course),
    [course]
  );

  const canSavePublic = useMemo(
    () => canBookmarkPublishedPublicCourse(course),
    [course]
  );

  const isMyImportedSnapshot = useMemo(
    () => isMyImportedCourseSnapshot(course, user?.id),
    [course, user?.id]
  );

  const canEditAsAuthor = useMemo(
    () => canEditCuratorCourse(course, user?.id),
    [course, user?.id]
  );

  const canImportFromPublic = useMemo(
    () =>
      isCurator &&
      canSavePublic &&
      !isMyImportedSnapshot &&
      !canEditAsAuthor,
    [isCurator, canSavePublic, isMyImportedSnapshot, canEditAsAuthor]
  );

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined" || !courseId) return "";
    const u = new URL(window.location.href);
    u.pathname = `/courses/${encodeURIComponent(String(courseId).trim())}`;
    u.search = "";
    u.hash = "";
    return u.toString();
  }, [courseId]);

  const handleShare = async () => {
    const title = String(course?.title || "").trim() || "코스";
    try {
      const r = await shareOrCopyCourseLink({
        url: shareUrl,
        title,
        text: `${title} — ${PAGE_TITLE_APP}`,
      });
      if (r === "clipboard") {
        window.alert("링크를 클립보드에 복사했어요.");
      }
    } catch {
      window.prompt("아래 링크를 복사해 주세요.", shareUrl);
    }
  };

  const handleImport = async () => {
    if (!courseId || !canImportFromPublic) return;
    if (!user?.id) {
      window.alert("로그인이 필요해요.");
      return;
    }
    setImportBusy(true);
    try {
      await importPublicCuratorCourseSnapshot(String(courseId).trim());
      setImportedByMe(true);
      window.alert(
        "코스를 스크랩했어요. 읽기 전용으로 저장되며 수정·공개는 할 수 없습니다."
      );
    } catch (e) {
      window.alert(e?.message || "코스 스크랩을 처리하지 못했습니다.");
    } finally {
      setImportBusy(false);
    }
  };

  const handleDeleteImport = async () => {
    if (!courseId || !user?.id) return;
    if (!isMyImportedSnapshot && !canSavePublic) return;
    if (
      !window.confirm(
        "스크랩한 코스를 삭제할까요? 내 목록에서만 지워지고 원본은 그대로입니다."
      )
    ) {
      return;
    }
    setImportBusy(true);
    try {
      if (isMyImportedSnapshot) {
        await removeImportedCuratorCourse(String(courseId).trim());
        navigate("/studio/courses");
        return;
      }
      await removeImportedCuratorCourseBySource(String(courseId).trim());
      setImportedByMe(false);
    } catch (e) {
      window.alert(e?.message || "삭제하지 못했습니다.");
    } finally {
      setImportBusy(false);
    }
  };

  const handleStartFollow = useCallback(() => {
    const id = String(course?.id || "").trim();
    if (!id) return;
    if (!user?.id) {
      window.alert("로그인하면 이 코스를 따라갈 수 있어요.");
      return;
    }
    const state = buildHomeCourseFollowNavigationState(id);
    if (!state) return;
    navigate("/", { state });
  }, [course?.id, user?.id, navigate]);

  const handleNextFollowStep = useCallback(async () => {
    if (!activeCourseSession?.id || !followingThisCourse) return;
    const last = displaySteps.length - 1;
    if (last < 0) return;
    const cur = Number(activeCourseSession.current_step_index) || 0;
    const next = cur + 1;
    if (next > last) return;
    setFollowBusy(true);
    try {
      const s = await updateCourseSessionStep(activeCourseSession.id, next);
      setActiveCourseSession(s);
    } catch (e) {
      window.alert(e?.message || "단계를 옮기지 못했어요.");
    } finally {
      setFollowBusy(false);
    }
  }, [
    activeCourseSession,
    displaySteps.length,
    followingThisCourse,
  ]);

  const handleCompleteFollow = useCallback(async () => {
    if (!activeCourseSession?.id) return;
    setFollowBusy(true);
    try {
      const completed = await completeCourseSession(activeCourseSession.id);
      setActiveCourseSession(null);
      if (completed) {
        try {
          const detail = await recordCourseCompletionAfterSessionClosed(
            completed,
            { placeCount: displaySteps.length }
          );
          if (detail) {
            dispatchCourseCompletedCelebration(detail);
          }
          if (completed.completed_at) {
            setLastCompletionAtIso(String(completed.completed_at));
          }
          const cid = String(
            completed.course_id ?? course?.id ?? ""
          ).trim();
          if (cid) {
            void getCourseStats(cid).then(setCoursePublicStats);
          }
        } catch (e) {
          console.warn("[완주 기록]", e);
        }
      }
    } catch (e) {
      window.alert(e?.message || "완주 처리에 실패했어요.");
    } finally {
      setFollowBusy(false);
    }
  }, [activeCourseSession?.id, course?.id, displaySteps.length]);

  const handleAbandonFollow = useCallback(async () => {
    if (!activeCourseSession?.id) return;
    if (!window.confirm("따라가기를 종료할까요?")) return;
    setFollowBusy(true);
    try {
      await abandonCourseSession(activeCourseSession.id);
      setActiveCourseSession(null);
    } catch (e) {
      window.alert(e?.message || "종료하지 못했어요.");
    } finally {
      setFollowBusy(false);
    }
  }, [activeCourseSession?.id]);

  if (phase === "loading" || (phase === "ok" && !course)) {
    return (
      <StudioScrollLayout mainStyle={studioCoursesScrollMain}>
        <div style={{ ...studioCoursesInner, paddingTop: "28px" }}>
          <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.6)" }}>
            불러오는 중…
          </div>
        </div>
      </StudioScrollLayout>
    );
  }

  if (phase === "forbidden" || !course) {
    return (
      <StudioScrollLayout mainStyle={studioCoursesScrollMain}>
        <div style={{ ...studioCoursesInner, paddingTop: "28px" }}>
          <p style={{ fontSize: "15px", lineHeight: 1.55, marginBottom: "16px" }}>
            이 코스는 비공개이거나 접근 권한이 없어요.
          </p>
          <button
            type="button"
            style={studioCoursesBtnGhost}
            onClick={() => navigate("/")}
          >
            홈으로
          </button>
        </div>
      </StudioScrollLayout>
    );
  }

  const coverUrl = rewriteLegacySupabaseStorageUrl(
    String(course.cover_image_url || "").trim()
  );
  const curatorAvatarUrl = rewriteLegacySupabaseStorageUrl(
    String(curatorProfile?.avatar_url || "").trim()
  );
  const tags = Array.isArray(course.theme_tags) ? course.theme_tags : [];

  return (
    <StudioScrollLayout mainStyle={studioCoursesScrollMain}>
      <div
        style={{
          ...studioCoursesInner,
          maxWidth: "min(560px, 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "14px",
            gap: "8px",
          }}
        >
          <button
            type="button"
            style={studioCoursesBtnGhost}
            onClick={() => navigate(-1)}
          >
            ← 뒤로
          </button>
          <button
            type="button"
            style={studioCoursesBtnGhost}
            onClick={() => navigate("/")}
          >
            홈
          </button>
        </div>

        <div
          style={{
            borderRadius: "14px",
            overflow: "hidden",
            marginBottom: "14px",
            backgroundColor: "#1f2937",
            minHeight: coverUrl ? "auto" : "120px",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {coverUrl ? (
            <img
              src={coverUrl}
              alt=""
              style={{
                width: "100%",
                maxHeight: "220px",
                objectFit: "cover",
                display: "block",
              }}
            />
          ) : (
            <div
              style={{
                padding: "36px 16px",
                textAlign: "center",
                fontSize: "13px",
                color: "rgba(255,255,255,0.45)",
                letterSpacing: "-0.02em",
              }}
            >
              코스 커버
            </div>
          )}
        </div>

        <div style={{ marginBottom: "10px", display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
          {lastCompletionAtIso ? (
            <span
              style={{
                fontSize: "11px",
                fontWeight: 800,
                padding: "5px 12px",
                borderRadius: "999px",
                background:
                  "linear-gradient(135deg, rgba(251,191,36,0.35) 0%, rgba(245,158,11,0.22) 100%)",
                color: "#fffbeb",
                border: "1px solid rgba(251, 191, 36, 0.55)",
                boxShadow: "0 4px 14px rgba(251,191,36,0.15)",
              }}
            >
              완주한 코스
              {completionDateLabel ? (
                <span
                  style={{
                    fontWeight: 650,
                    marginLeft: "6px",
                    opacity: 0.92,
                  }}
                >
                  · {completionDateLabel}
                </span>
              ) : null}
            </span>
          ) : null}
          {visibilityBadge ? (
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: "999px",
                backgroundColor:
                  visibilityBadge.kind === "draft"
                    ? "rgba(241,196,15,0.25)"
                    : "rgba(149,165,166,0.35)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              {visibilityBadge.label}
            </span>
          ) : (
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: "999px",
                backgroundColor: "rgba(46,204,113,0.22)",
                color: "#dfffea",
                border: "1px solid rgba(46,204,113,0.35)",
              }}
            >
              공개 코스
            </span>
          )}
        </div>

        <h1
          style={{
            fontSize: "clamp(22px, 5vw, 26px)",
            fontWeight: 800,
            margin: "0 0 6px",
            lineHeight: 1.2,
            letterSpacing: "-0.03em",
          }}
        >
          {String(course.title || "").trim() || "제목 없음"}
        </h1>
        {isMyImportedSnapshot ? (
          <p
            style={{
              fontSize: "12px",
              fontWeight: 650,
              color: "rgba(165,180,252,0.9)",
              margin: "0 0 10px",
              lineHeight: 1.45,
            }}
          >
            스크랩한 코스예요. 보기와 삭제만 할 수 있고, 수정·공개는 할 수 없어요.
            {course.imported_from_course_id ? (
              <>
                {" "}
                <button
                  type="button"
                  style={{
                    border: "none",
                    background: "none",
                    padding: 0,
                    color: "#c4b5fd",
                    fontWeight: 700,
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                  onClick={() =>
                    navigate(
                      `/courses/${encodeURIComponent(
                        String(course.imported_from_course_id)
                      )}`
                    )
                  }
                >
                  원본 코스 보기
                </button>
              </>
            ) : null}
          </p>
        ) : null}
        {completionSocialLine ? (
          <p
            style={{
              fontSize: "13px",
              fontWeight: 650,
              color: "rgba(255,255,255,0.62)",
              margin: "0 0 8px",
              lineHeight: 1.45,
              letterSpacing: "-0.02em",
            }}
          >
            {completionSocialLine}
          </p>
        ) : null}
        {canSavePublic ? (
          <div style={{ marginBottom: "12px" }}>
            <button
              type="button"
              disabled={likeBusy}
              onClick={() => void handleToggleLike()}
              style={{
                ...studioCoursesBtnGhost,
                padding: "6px 12px",
                fontSize: "12px",
                color: likedByMe ? "#ff8a9b" : "rgba(255,255,255,0.88)",
                borderColor: likedByMe
                  ? "rgba(255,120,140,0.45)"
                  : "rgba(255,255,255,0.14)",
              }}
            >
              {likeBusy ? "처리 중…" : likedByMe ? "♥ 좋아요 취소" : "♡ 좋아요"}
            </button>
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "14px",
          }}
        >
          {curatorAvatarUrl ? (
            <img
              src={curatorAvatarUrl}
              alt=""
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                objectFit: "cover",
                border: "2px solid rgba(255,255,255,0.12)",
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                backgroundColor: "rgba(255,255,255,0.1)",
                flexShrink: 0,
              }}
            />
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)" }}>
              큐레이터
            </div>
            {curatorSlug ? (
              <Link
                to={`/curator-profile/${encodeURIComponent(curatorSlug)}`}
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "#7dd3fc",
                  textDecoration: "none",
                  wordBreak: "break-word",
                }}
              >
                {curatorDisplayName(curatorProfile)}
              </Link>
            ) : (
              <div style={{ fontSize: "16px", fontWeight: 700 }}>
                {curatorDisplayName(curatorProfile)}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            fontSize: "12px",
            color: "rgba(255,255,255,0.5)",
            marginBottom: "16px",
            lineHeight: 1.5,
          }}
        >
          {course.area ? (
            <>
              <span style={{ color: "rgba(255,255,255,0.75)" }}>지역</span>{" "}
              {String(course.area)}
              <span style={{ margin: "0 8px", opacity: 0.35 }}>·</span>
            </>
          ) : null}
          <span style={{ color: "rgba(255,255,255,0.75)" }}>생성</span>{" "}
          {formatCourseDate(course.created_at)}
        </div>

        {tags.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "6px",
              marginBottom: "16px",
            }}
          >
            {tags.map((t) => (
              <span
                key={t}
                style={{
                  fontSize: "12px",
                  padding: "5px 10px",
                  borderRadius: "999px",
                  backgroundColor: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}

        {String(course.description || "").trim() ? (
          <div style={{ ...studioCoursesCard, marginBottom: "14px" }}>
            <div
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "rgba(255,255,255,0.75)",
                marginBottom: "8px",
              }}
            >
              소개
            </div>
            <p
              style={{
                margin: 0,
                fontSize: "14px",
                lineHeight: 1.65,
                color: "rgba(255,255,255,0.88)",
                whiteSpace: "pre-wrap",
              }}
            >
              {String(course.description).trim()}
            </p>
          </div>
        ) : null}

        {canFollowCourse && displaySteps.length > 0 ? (
          <div style={{ ...studioCoursesCard, marginBottom: "14px" }}>
            <div
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "rgba(255,255,255,0.75)",
                marginBottom: "8px",
              }}
            >
              따라가기
            </div>
            {!user?.id ? (
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "rgba(255,255,255,0.55)",
                  lineHeight: 1.5,
                }}
              >
                로그인하면 이 코스를 따라갈 수 있어요.
              </p>
            ) : followingThisCourse ? (
              <>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 800,
                    marginBottom: "10px",
                    color: "#fcd34d",
                    letterSpacing: "-0.02em",
                  }}
                >
                  지금 따라가는 중
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    alignItems: "center",
                  }}
                >
                  {(() => {
                    const last = displaySteps.length - 1;
                    const cur = Number(activeCourseSession?.current_step_index) || 0;
                    const canNext = cur < last;
                    const isLast = last >= 0 && cur >= last;
                    return (
                      <>
                        {canNext ? (
                          <button
                            type="button"
                            style={studioCoursesBtnGhost}
                            disabled={followBusy}
                            onClick={() => void handleNextFollowStep()}
                          >
                            다음 단계로
                          </button>
                        ) : null}
                        {isLast ? (
                          <button
                            type="button"
                            style={studioCoursesBtnPrimary}
                            disabled={followBusy}
                            onClick={() => void handleCompleteFollow()}
                          >
                            완주하기
                          </button>
                        ) : null}
                        <button
                          type="button"
                          style={{ ...studioCoursesBtnGhost, opacity: 0.92 }}
                          disabled={followBusy}
                          onClick={() => void handleAbandonFollow()}
                        >
                          따라가기 그만두기
                        </button>
                      </>
                    );
                  })()}
                </div>
              </>
            ) : (
              <button
                type="button"
                style={studioCoursesBtnPrimary}
                disabled={followBusy}
                onClick={handleStartFollow}
              >
                코스 따라가기
              </button>
            )}
          </div>
        ) : null}

        <div style={{ ...studioCoursesCard, marginBottom: "14px" }}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 700,
              marginBottom: "8px",
              color: "rgba(255,255,255,0.9)",
            }}
          >
            동선
          </div>
          <CourseMapPreview placeRows={previewPlaceRows} compact />
        </div>

        <div style={{ ...studioCoursesCard, marginBottom: "14px", padding: "12px 12px 10px" }}>
          <div
            style={{
              fontSize: "12px",
              fontWeight: 700,
              marginBottom: "8px",
              color: "rgba(255,255,255,0.9)",
            }}
          >
            코스 흐름
          </div>
          {displaySteps.length === 0 ? (
            <div
              style={{
                fontSize: "12px",
                color: "rgba(255,255,255,0.45)",
                padding: "4px 0",
              }}
            >
              등록된 장소가 없습니다.
            </div>
          ) : (
            displaySteps.map((step, idx) => {
              const isCurrentStep =
                followingThisCourse &&
                Number(activeCourseSession?.current_step_index) === idx;
              return (
                <div key={step.key}>
                  {idx > 0 ? (
                    <div
                      aria-hidden
                      style={{
                        textAlign: "center",
                        padding: "2px 0 4px",
                        color: "rgba(255,255,255,0.28)",
                        fontSize: "12px",
                        lineHeight: 1,
                      }}
                    >
                      ↓
                    </div>
                  ) : null}
                  <div
                    style={{
                      padding: "8px 10px",
                      borderRadius: "8px",
                      backgroundColor: isCurrentStep
                        ? "rgba(251, 191, 36, 0.08)"
                        : "rgba(255,255,255,0.04)",
                      border: isCurrentStep
                        ? "1px solid rgba(251, 191, 36, 0.55)"
                        : "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginBottom: "4px",
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 800,
                          color: "rgba(52,152,219,0.95)",
                          letterSpacing: "0.03em",
                          flexShrink: 0,
                        }}
                      >
                        {step.orderLabel}
                      </span>
                      {isCurrentStep ? (
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: 800,
                            padding: "2px 6px",
                            borderRadius: "999px",
                            backgroundColor: "rgba(251, 191, 36, 0.95)",
                            color: "#1f2937",
                            flexShrink: 0,
                          }}
                        >
                          지금 여기
                        </span>
                      ) : null}
                    </div>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        marginBottom: "2px",
                        lineHeight: 1.25,
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {step.name}
                    </div>
                    {step.address ? (
                      <div
                        style={{
                          fontSize: "11px",
                          color: "rgba(255,255,255,0.5)",
                          lineHeight: 1.35,
                          marginBottom:
                            step.category || step.memo || step.stay_minutes != null
                              ? "4px"
                              : 0,
                        }}
                      >
                        {step.address}
                      </div>
                    ) : null}
                    {step.category ? (
                      <div
                        style={{
                          fontSize: "10px",
                          color: "rgba(255,255,255,0.38)",
                          marginBottom:
                            step.memo || step.stay_minutes != null ? "4px" : 0,
                        }}
                      >
                        {step.category}
                      </div>
                    ) : null}
                    {step.memo ? (
                      <div
                        style={{
                          fontSize: "11px",
                          color: "rgba(255,255,255,0.72)",
                          marginBottom: step.stay_minutes != null ? "4px" : 0,
                          padding: "6px 8px",
                          backgroundColor: "rgba(0,0,0,0.22)",
                          borderRadius: "6px",
                          lineHeight: 1.4,
                        }}
                      >
                        {step.memo}
                      </div>
                    ) : null}
                    {step.stay_minutes != null ? (
                      <div
                        style={{ fontSize: "10px", color: "rgba(255,255,255,0.45)" }}
                      >
                        약 {step.stay_minutes}분
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
        {displaySteps.length > 0 ? (
          <div style={{ marginTop: 16 }}>
            <CourseStepScheduleList
              steps={displaySteps}
              startClock={scheduleStartClock}
              onStartClockChange={setScheduleStartClock}
            />
          </div>
        ) : null}
        <div style={{ ...studioCoursesRowActions, marginTop: "22px" }}>
          <button
            type="button"
            style={studioCoursesBtnGhost}
            onClick={() => void handleShare()}
          >
            공유하기
          </button>
          {isMyImportedSnapshot ? (
            <button
              type="button"
              style={{
                ...studioCoursesBtnDanger,
                opacity: user?.id && !importBusy ? 1 : 0.45,
              }}
              disabled={!user?.id || importBusy}
              title="스크랩한 코스 삭제"
              onClick={() => void handleDeleteImport()}
            >
              {importBusy ? "삭제 중…" : "삭제"}
            </button>
          ) : canImportFromPublic ? (
            importedByMe ? (
              <>
                <button
                  type="button"
                  style={{
                    ...studioCoursesBtnGhost,
                    color: "#a5b4fc",
                    borderColor: "rgba(129,140,248,0.45)",
                    opacity: 0.85,
                  }}
                  disabled
                  aria-pressed
                >
                  {COURSE_SCRAPED_LABEL}
                </button>
                <button
                  type="button"
                  style={{
                    ...studioCoursesBtnDanger,
                    opacity: user?.id && !importBusy ? 1 : 0.45,
                  }}
                  disabled={!user?.id || importBusy}
                  title="스크랩한 코스 삭제"
                  onClick={() => void handleDeleteImport()}
                >
                  {importBusy ? "삭제 중…" : "삭제"}
                </button>
              </>
            ) : (
              <button
                type="button"
                style={{
                  ...studioCoursesBtnGhost,
                  opacity: user?.id && !importBusy ? 1 : 0.45,
                }}
                disabled={!user?.id || importBusy}
                title={!user?.id ? "로그인이 필요해요." : "코스 스크랩"}
                onClick={() => void handleImport()}
              >
                {importBusy ? "처리 중…" : COURSE_SCRAP_LABEL_SHORT}
              </button>
            )
          ) : null}
        </div>

        {canEditAsAuthor ? (
          <div style={{ marginTop: "14px" }}>
            <button
              type="button"
              style={studioCoursesBtnGhost}
              onClick={() =>
                navigate(
                  `/studio/courses/${encodeURIComponent(String(course.id))}/edit`
                )
              }
            >
              스튜디오에서 편집
            </button>
          </div>
        ) : null}
      </div>
    </StudioScrollLayout>
  );
}
