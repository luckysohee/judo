import { useCallback, useEffect, useMemo, useState, Fragment } from "react";
import { isCourseLikedByMe, toggleCuratorCourseLike } from "../../api/courseLikes";
import {
  importPublicCuratorCourseSnapshot,
  isPublicCourseImportedByMe,
  removeImportedCuratorCourseBySource,
} from "../../api/courseImports";
import {
  getCourseEngagementStatsBatch,
  pickHomeCourseCompletionMetricLine,
} from "../../api/courseCompletionStats";
import { shareOrCopyCourseLink } from "../../utils/courseDetailUi";
import { supabase } from "../../lib/supabase";
import CoursePreviewPlaceStampRow from "../Course/CoursePreviewPlaceStampRow";
import CourseStepScheduleList from "../Course/CourseStepScheduleList";
import {
  areAllCourseStepsStamped,
  fetchCourseStampSteps,
  fetchMyCoursePlaceStamps,
  resolveCourseGuideStepIndex,
} from "../../api/coursePlaceStamps";
import { useToast } from "../Toast/ToastProvider";
import { HOME_COURSE_PREVIEW_STAMP_GUIDE } from "../../utils/homeCourseStampCopy";
import {
  COURSE_SCRAP_LABEL_SHORT,
  COURSE_SCRAPED_LABEL,
} from "../../utils/coursePickCopy";
import { HOME_COURSE_SHEET as T } from "../../utils/homeCourseSheetTheme";
import { pickCourseDisplayCoverUrl } from "../../utils/courseStepThumb";

const PAGE_TITLE_APP = "주도";

function formatCuratorAtHandle(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  return s.startsWith("@") ? s : `@${s}`;
}

function curatorHandleFromCuratorRow(row) {
  if (!row || typeof row !== "object") return "";
  return formatCuratorAtHandle(row.slug || row.username);
}

function curatorHandleFromProfile(p) {
  if (!p || typeof p !== "object") return "";
  return formatCuratorAtHandle(p.username);
}

function curatorDisplayNameFromCuratorRow(row) {
  if (!row || typeof row !== "object") return "큐레이터";
  const nick = String(row.name || row.display_name || "").trim();
  if (nick) return nick;
  const handle = String(row.slug || row.username || "").trim();
  if (!handle) return "큐레이터";
  return handle.startsWith("@") ? handle.slice(1) : handle;
}

function curatorDisplayNameFromProfile(p) {
  if (!p || typeof p !== "object") return "큐레이터";
  const dn = String(p.display_name || "").trim();
  if (dn) return dn;
  const un = String(p.username || "").trim();
  if (!un) return "큐레이터";
  return un.startsWith("@") ? un.slice(1) : un;
}

const styles = {
  root: {
    display: "flex",
    flexDirection: "column",
    flex: "1 1 auto",
    minHeight: 0,
    height: "100%",
    gap: 0,
  },
  topBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
    padding: "0 2px 6px",
  },
  backBtn: {
    border: T.chipBorder,
    background: T.chipBg,
    color: T.textSub,
    borderRadius: 999,
    padding: "5px 10px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    flexShrink: 0,
  },
  collapseBtn: {
    border: T.chipBorder,
    background: T.chipBg,
    color: T.textSub,
    borderRadius: 999,
    padding: "5px 9px",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
    flexShrink: 0,
    lineHeight: 1,
  },
  topTitle: {
    flex: 1,
    minWidth: 0,
    margin: 0,
    fontSize: 12,
    fontWeight: 800,
    color: T.textSub,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  scroll: {
    flex: "1 1 auto",
    minHeight: 0,
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    padding: "0 2px 8px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  cover: {
    width: "100%",
    maxHeight: 140,
    objectFit: "cover",
    borderRadius: 12,
    display: "block",
    background: T.thumbBg,
  },
  coverPlaceholder: {
    width: "100%",
    height: 88,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 600,
    color: T.textMuted,
    background: T.thumbBg,
  },
  h1: {
    margin: 0,
    fontSize: 17,
    fontWeight: 800,
    letterSpacing: "-0.04em",
    lineHeight: 1.3,
    color: T.text,
  },
  meta: {
    margin: "6px 0 0",
    fontSize: 11,
    fontWeight: 600,
    color: T.textSub,
    lineHeight: 1.45,
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 0,
  },
  metaSep: {
    margin: "0 4px",
    color: T.textMuted,
    fontWeight: 600,
  },
  curatorBtn: {
    margin: 0,
    padding: "3px 9px",
    borderRadius: 999,
    border: T.chipBorder,
    background: T.chipActiveBg,
    color: T.text,
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
    lineHeight: 1.35,
    WebkitTapHighlightColor: "transparent",
  },
  metric: {
    fontSize: 11,
    fontWeight: 700,
    color: T.textSub,
  },
  desc: {
    margin: "6px 0 0",
    fontSize: 13,
    fontWeight: 550,
    lineHeight: 1.5,
    color: T.textSub,
    whiteSpace: "pre-wrap",
  },
  tags: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    fontSize: 10,
    fontWeight: 700,
    padding: "4px 8px",
    borderRadius: 999,
    background: T.chipBg,
    color: T.textSub,
    border: T.chipBorder,
  },
  sectionLabel: {
    margin: "4px 0 0",
    fontSize: 11,
    fontWeight: 800,
    color: T.textMuted,
  },
  footer: {
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    paddingTop: 6,
    borderTop: T.divider,
  },
  btnPrimary: {
    width: "100%",
    padding: "11px 14px",
    borderRadius: 12,
    border: T.btnPrimaryBorder,
    background: T.btnPrimaryBg,
    color: "#fff",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
  },
  btnGhost: {
    width: "100%",
    padding: "9px 14px",
    borderRadius: 12,
    border: T.btnGhostBorder,
    background: T.btnGhostBg,
    color: T.textSub,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  mapHint: {
    margin: 0,
    fontSize: 10,
    fontWeight: 600,
    textAlign: "center",
    color: T.textMuted,
    lineHeight: 1.4,
  },
  actionRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  actionBtn: (active) => ({
    flex: "1 1 0",
    minWidth: 72,
    padding: "8px 10px",
    borderRadius: 10,
    border: active
      ? "1px solid rgba(244,63,94,0.45)"
      : T.btnGhostBorder,
    background: active ? "rgba(244,63,94,0.12)" : T.btnGhostBg,
    color: active ? "#fb7185" : T.textSub,
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
    lineHeight: 1.25,
    textAlign: "center",
  }),
  actionBtnDisabled: {
    opacity: 0.45,
    cursor: "not-allowed",
  },
  ownerRow: {
    display: "flex",
    gap: 8,
    marginTop: 6,
    paddingTop: 10,
    borderTop: T.divider,
  },
  ownerEditBtn: {
    flex: "1 1 0",
    padding: "10px 12px",
    borderRadius: 10,
    border: T.btnGhostBorder,
    background: T.btnGhostBg,
    color: T.text,
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  ownerDeleteBtn: {
    flex: "0 0 auto",
    minWidth: 84,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(225,29,72,0.4)",
    background: "rgba(225,29,72,0.1)",
    color: "#fb7185",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  stampGuide: {
    margin: "10px 0 0",
    padding: "8px 10px",
    borderRadius: 10,
    background: T.chipBg,
    border: T.chipBorder,
    fontSize: 11,
    fontWeight: 600,
    color: T.textMuted,
    lineHeight: 1.45,
  },
  stateBox: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 600,
    color: T.textMuted,
  },
};

/**
 * 홈 코스 패널 — 지도 전 코스 소개(상세) 시트.
 */
export default function HomeCourseDiscoveryDetail({
  course = null,
  loading = false,
  followCourseId = "",
  followBusy = false,
  stampedPlaceIds = null,
  guideStepIndex: guideStepIndexProp = 0,
  courseCompleted: courseCompletedProp = false,
  stampStateVersion = 0,
  replayBusy = false,
  onBack,
  onStartFollow,
  onStampStateRefresh,
  onReplayStamps,
  user = null,
  isCurator = false,
  /** 바텀시트 한 단계 접기(사진 스트립) */
  onSheetCollapse,
  /** 큐레이터 프로필(홈 팔로우 모달) */
  onOpenCurator,
  /** `dbCurators` 등에서 즉시 핸들 복원 — profiles.username 비어 있어도 버튼 표시 */
  resolveCuratorHandle,
  /** 내 코스 편집(스튜디오 잔코스 수정 시트) */
  onEditCourse,
  /** 내 코스 삭제 — courseId 전달, 부모가 닫기·새로고침 처리 */
  onDeleteCourse,
}) {
  const { showToast } = useToast();
  /** 코스미리보기 버튼에 표시할 큐레이터 핸들(@username) */
  const [curatorHandle, setCuratorHandle] = useState("큐레이터");
  /** 팔로우/프로필 모달에서 쓸 표시명(display_name 우선) */
  const [curatorDisplayName, setCuratorDisplayName] = useState(
    "큐레이터"
  );
  const [curatorProfile, setCuratorProfile] = useState(null);
  const [metricLine, setMetricLine] = useState(null);
  const [likedByMe, setLikedByMe] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeBusy, setLikeBusy] = useState(false);
  const [importedByMe, setImportedByMe] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [ownerDeleteBusy, setOwnerDeleteBusy] = useState(false);
  const [localStampIds, setLocalStampIds] = useState(() => new Set());
  const [localGuideIndex, setLocalGuideIndex] = useState(0);
  const [localCompleted, setLocalCompleted] = useState(false);
  const [stampStateLoading, setStampStateLoading] = useState(false);
  const [scheduleStartClock, setScheduleStartClock] = useState("18:00");

  const courseId = String(course?.courseId || "").trim();
  const activeFollowId = String(followCourseId || "").trim();
  const followingThisPreview = Boolean(
    activeFollowId && courseId && activeFollowId === courseId
  );

  const reloadStampState = useCallback(async () => {
    if (!courseId) {
      setLocalStampIds(new Set());
      setLocalGuideIndex(0);
      setLocalCompleted(false);
      return;
    }
    setStampStateLoading(true);
    try {
      const [stamps, steps] = await Promise.all([
        fetchMyCoursePlaceStamps(courseId),
        fetchCourseStampSteps(courseId),
      ]);
      const ids = stamps.stampedPlaceIds;
      setLocalStampIds(ids);
      setLocalGuideIndex(
        resolveCourseGuideStepIndex(steps.length, ids, steps)
      );
      setLocalCompleted(areAllCourseStepsStamped(steps, ids));
    } catch {
      setLocalStampIds(new Set());
      setLocalGuideIndex(0);
      setLocalCompleted(false);
    } finally {
      setStampStateLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void reloadStampState();
  }, [reloadStampState, stampStateVersion]);

  const stampedSet = useMemo(() => {
    if (followingThisPreview && stampedPlaceIds instanceof Set) {
      return stampedPlaceIds;
    }
    if (followingThisPreview && stampedPlaceIds) {
      return new Set(stampedPlaceIds);
    }
    return localStampIds;
  }, [followingThisPreview, stampedPlaceIds, localStampIds]);

  const guideStepIndex = followingThisPreview
    ? guideStepIndexProp
    : localGuideIndex;
  const courseCompleted = followingThisPreview
    ? courseCompletedProp
    : localCompleted;

  const handleStampRefresh = useCallback(() => {
    if (typeof onStampStateRefresh === "function") onStampStateRefresh();
    void reloadStampState();
  }, [onStampStateRefresh, reloadStampState]);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined" || !courseId) return "";
    const u = new URL(window.location.href);
    u.pathname = `/courses/${encodeURIComponent(courseId)}`;
    u.search = "";
    u.hash = "";
    return u.toString();
  }, [courseId]);

  useEffect(() => {
    let cancelled = false;
    const cid = String(course?.curator_id || "").trim();
    if (!cid) {
      setCuratorHandle("큐레이터");
      setCuratorDisplayName("큐레이터");
      setCuratorProfile(null);
      return undefined;
    }

    const hint =
      typeof resolveCuratorHandle === "function"
        ? resolveCuratorHandle(cid)
        : null;
    if (hint) {
      setCuratorHandle(hint);
    }

    void (async () => {
      const [curRes, profRes] = await Promise.all([
        supabase
          .from("curators")
          .select("slug, username, name, display_name")
          .eq("user_id", cid)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("id, display_name, username")
          .eq("id", cid)
          .maybeSingle(),
      ]);
      if (cancelled) return;

      const curatorRow =
        curRes.data && !curRes.error ? curRes.data : null;
      const profile =
        profRes.data && !profRes.error ? profRes.data : null;

      setCuratorProfile(profile);
      const handle =
        curatorHandleFromCuratorRow(curatorRow) ||
        curatorHandleFromProfile(profile) ||
        hint ||
        "큐레이터";
      setCuratorHandle(handle);
      setCuratorDisplayName(
        curatorDisplayNameFromCuratorRow(curatorRow) ||
          curatorDisplayNameFromProfile(profile)
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [course?.curator_id, resolveCuratorHandle]);

  useEffect(() => {
    let cancelled = false;
    if (!courseId) {
      setMetricLine(null);
      return undefined;
    }
    void (async () => {
      const m = await getCourseEngagementStatsBatch([courseId]);
      if (cancelled) return;
      const row = m.get(courseId.toLowerCase());
      setMetricLine(pickHomeCourseCompletionMetricLine(row));
      setLikeCount(Math.max(0, Math.floor(Number(row?.like_count) || 0)));
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id || !courseId) {
      setLikedByMe(false);
      return undefined;
    }
    void isCourseLikedByMe(courseId)
      .then((v) => {
        if (!cancelled) setLikedByMe(v);
      })
      .catch(() => {
        if (!cancelled) setLikedByMe(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, courseId]);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id || !courseId) {
      setImportedByMe(false);
      return undefined;
    }
    void isPublicCourseImportedByMe(courseId)
      .then((v) => {
        if (!cancelled) setImportedByMe(v);
      })
      .catch(() => {
        if (!cancelled) setImportedByMe(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, courseId]);

  const handleToggleLike = useCallback(async () => {
    if (!courseId) return;
    if (!user?.id) {
      showToast("로그인한 뒤 좋아요를 눌러 주세요.", "info", 3200);
      return;
    }
    setLikeBusy(true);
    try {
      const r = await toggleCuratorCourseLike(courseId);
      setLikedByMe(r.liked);
      setLikeCount(r.likeCount);
    } catch (e) {
      showToast(e?.message || "좋아요를 처리하지 못했어요.", "warning", 3200);
    } finally {
      setLikeBusy(false);
    }
  }, [courseId, user?.id, showToast]);

  const handleShare = useCallback(async () => {
    const title = String(course?.title || "").trim() || "코스";
    try {
      const r = await shareOrCopyCourseLink({
        url: shareUrl,
        title,
        text: `${title} — ${PAGE_TITLE_APP}`,
      });
      if (r === "clipboard") {
        showToast("링크를 복사했어요.", "success", 2500);
      }
    } catch {
      if (shareUrl) {
        window.prompt("아래 링크를 복사해 주세요.", shareUrl);
      }
    }
  }, [course?.title, shareUrl, showToast]);

  const handleImport = useCallback(async () => {
    if (!courseId) return;
    if (!user?.id) {
      showToast("로그인한 뒤 코스를 스크랩할 수 있어요.", "info", 3200);
      return;
    }
    setImportBusy(true);
    try {
      await importPublicCuratorCourseSnapshot(courseId);
      setImportedByMe(true);
      showToast(
        "코스를 스크랩했어요. 읽기 전용으로 저장되며 수정·공개는 할 수 없어요.",
        "success",
        2800
      );
    } catch (e) {
      showToast(e?.message || "코스 스크랩을 처리하지 못했어요.", "warning", 3200);
    } finally {
      setImportBusy(false);
    }
  }, [courseId, user?.id, showToast]);

  const handleDeleteImport = useCallback(async () => {
    if (!courseId) return;
    if (!user?.id) {
      showToast("로그인이 필요해요.", "info", 3200);
      return;
    }
    if (
      !window.confirm(
        "스크랩한 코스를 삭제할까요? 내 목록에서만 지워지고 원본 코스는 그대로예요."
      )
    ) {
      return;
    }
    setImportBusy(true);
    try {
      await removeImportedCuratorCourseBySource(courseId);
      setImportedByMe(false);
      showToast("스크랩한 코스를 삭제했어요.", "success", 2400);
    } catch (e) {
      showToast(e?.message || "삭제하지 못했어요.", "warning", 3200);
    } finally {
      setImportBusy(false);
    }
  }, [courseId, user?.id, showToast]);

  const handleOwnerEdit = useCallback(() => {
    if (!courseId) return;
    onEditCourse?.(courseId);
  }, [courseId, onEditCourse]);

  const handleOwnerDelete = useCallback(async () => {
    if (!courseId) return;
    if (
      !window.confirm("이 코스를 삭제할까요? 삭제하면 되돌릴 수 없어요.")
    ) {
      return;
    }
    setOwnerDeleteBusy(true);
    try {
      await onDeleteCourse?.(courseId);
    } catch (e) {
      showToast(e?.message || "코스를 삭제하지 못했어요.", "warning", 3200);
    } finally {
      setOwnerDeleteBusy(false);
    }
  }, [courseId, onDeleteCourse, showToast]);

  if (loading) {
    return (
      <div style={styles.root} aria-busy="true">
        <div style={styles.stateBox}>코스 불러오는 중…</div>
      </div>
    );
  }

  if (!course) return null;

  const places = Array.isArray(course.places) ? course.places : [];
  const baseThumbSteps = Array.isArray(course.thumb_steps)
    ? course.thumb_steps
    : places.slice(0, 6).map((p, i) => ({
        place_id: p.place_id,
        name: p.name,
        category: p.category,
        image_url: p.image_url,
        step_image_url: p.image_url,
        order: i + 1,
        label: p.step_label || `${i + 1}차`,
      }));
  const thumbSteps = baseThumbSteps.map((s, i) => ({
    ...s,
    place_id: String(s.place_id || places[i]?.place_id || "").trim(),
    memo: places[i]?.memo || s.memo,
    stay_minutes: places[i]?.stay_minutes ?? s.stay_minutes,
    booking_status: places[i]?.booking_status || s.booking_status,
    booking_url: places[i]?.booking_url || s.booking_url,
    booking_phone: places[i]?.booking_phone || s.booking_phone,
    crowd_note: places[i]?.crowd_note || s.crowd_note,
    name: places[i]?.name || s.name,
    orderLabel: places[i]?.step_label || s.label || `${i + 1}차`,
  }));
  const scheduleSteps = places.length > 0 ? places.map((p, i) => ({
    ...p,
    key: p.place_id || `p-${i}`,
    orderLabel: p.step_label || `${i + 1}차`,
  })) : thumbSteps;
  const cover = pickCourseDisplayCoverUrl({ ...course, thumb_steps: thumbSteps });
  const metaRest = [
    course.area,
    thumbSteps.length > 0
      ? `${thumbSteps.length}곳`
      : places.length > 0
        ? `${places.length}곳`
        : null,
  ].filter(Boolean);
  const curatorId = String(course?.curator_id || "").trim();
  const canOpenCuratorProfile =
    Boolean(curatorId) && typeof onOpenCurator === "function";
  const isImportedCourse = Boolean(
    String(course?.imported_from_course_id || "").trim()
  );
  const isOwnerCourse =
    Boolean(user?.id) && curatorId === String(user.id) && !isImportedCourse;

  const handleCuratorClick = () => {
    if (!canOpenCuratorProfile) return;
    const handleBare = String(curatorHandle || "")
      .trim()
      .replace(/^@/, "");
    onOpenCurator({
      curatorId,
      name: curatorDisplayName,
      profile: {
        ...(curatorProfile && typeof curatorProfile === "object"
          ? curatorProfile
          : {}),
        username: handleBare || curatorProfile?.username || "",
      },
    });
  };

  return (
    <div style={styles.root} aria-label="코스 상세">
      <div style={styles.topBar}>
        <button type="button" style={styles.backBtn} onClick={() => onBack?.()}>
          ← 목록
        </button>
        <p style={styles.topTitle}>코스 미리보기</p>
        {typeof onSheetCollapse === "function" ? (
          <button
            type="button"
            style={styles.collapseBtn}
            onClick={() => onSheetCollapse()}
            aria-label="시트 접기"
            title="아래로 접기"
          >
            ∨ 접기
          </button>
        ) : null}
      </div>

      <div style={styles.scroll}>
        {cover ? (
          <img src={cover} alt="" style={styles.cover} loading="lazy" />
        ) : (
          <div style={styles.coverPlaceholder}>커버 없음</div>
        )}

        <div>
          <h2 style={styles.h1}>{course.title}</h2>
          {course.description ? (
            <p style={styles.desc}>{course.description}</p>
          ) : null}
          <div style={styles.meta}>
            {[
              canOpenCuratorProfile ? (
                <button
                  key="curator"
                  type="button"
                  style={styles.curatorBtn}
                  onClick={handleCuratorClick}
                  aria-label={`${curatorHandle} 큐레이터 프로필`}
                >
                  {curatorHandle}
                </button>
              ) : curatorHandle ? (
                <span key="curator">{curatorHandle}</span>
              ) : null,
              ...metaRest.map((bit, i) => (
                <span key={`meta-${i}-${bit}`}>{bit}</span>
              )),
            ]
              .filter(Boolean)
              .map((node, i) => (
                <Fragment key={i}>
                  {i > 0 ? (
                    <span style={styles.metaSep} aria-hidden>
                      ·
                    </span>
                  ) : null}
                  {node}
                </Fragment>
              ))}
          </div>
          {metricLine ? (
            <p style={styles.metric}>
              {metricLine.emoji} {metricLine.text}
            </p>
          ) : null}
          {thumbSteps.length > 0 ? (
            <div style={{ marginTop: 10 }}>
              <p style={styles.sectionLabel}>코스 장소</p>
              {user?.id && !courseCompleted ? (
                <p style={styles.stampGuide}>{HOME_COURSE_PREVIEW_STAMP_GUIDE}</p>
              ) : null}
              <CoursePreviewPlaceStampRow
                steps={thumbSteps}
                courseId={courseId}
                courseDescription={course.description}
                stampEnabled={Boolean(user?.id) && !courseCompleted}
                following={followingThisPreview}
                stampedPlaceIds={stampedSet}
                guideStepIndex={guideStepIndex}
                courseCompleted={courseCompleted}
                user={user}
                followBusy={followBusy || stampStateLoading}
                onStartFollow={onStartFollow}
                onStampStateRefresh={handleStampRefresh}
                replayBusy={replayBusy}
                onReplayStamps={onReplayStamps}
                stampStateVersion={stampStateVersion}
              />
              <CourseStepScheduleList
                steps={scheduleSteps}
                startClock={scheduleStartClock}
                onStartClockChange={setScheduleStartClock}
              />
            </div>
          ) : null}
          <div style={styles.actionRow}>
            <button
              type="button"
              style={{
                ...styles.actionBtn(likedByMe),
                ...(likeBusy ? styles.actionBtnDisabled : null),
              }}
              disabled={likeBusy}
              aria-pressed={likedByMe}
              onClick={() => void handleToggleLike()}
            >
              {likeBusy
                ? "…"
                : `${likedByMe ? "♥" : "♡"} ${
                    likeCount > 0 ? likeCount : "좋아요"
                  }`}
            </button>
            <button
              type="button"
              style={styles.actionBtn(false)}
              onClick={() => void handleShare()}
            >
              공유
            </button>
            {importedByMe ? (
              <>
                <button
                  type="button"
                  style={{
                    ...styles.actionBtn(true),
                    ...(importBusy ? styles.actionBtnDisabled : null),
                  }}
                  disabled
                  aria-pressed
                  title="코스를 스크랩한 상태"
                >
                  {COURSE_SCRAPED_LABEL}
                </button>
                <button
                  type="button"
                  style={{
                    ...styles.actionBtn(false),
                    color: "#e11d48",
                    borderColor: "rgba(225,29,72,0.35)",
                    ...(importBusy || !user?.id
                      ? styles.actionBtnDisabled
                      : null),
                  }}
                  disabled={importBusy || !user?.id}
                  title="스크랩한 코스 삭제"
                  onClick={() => void handleDeleteImport()}
                >
                  {importBusy ? "…" : "삭제"}
                </button>
              </>
            ) : (
              <button
                type="button"
                style={{
                  ...styles.actionBtn(false),
                  ...(importBusy || !user?.id
                    ? styles.actionBtnDisabled
                    : null),
                }}
                disabled={importBusy || !user?.id}
                title={!user?.id ? "로그인이 필요해요" : "코스 스크랩"}
                onClick={() => void handleImport()}
              >
                {importBusy ? "…" : COURSE_SCRAP_LABEL_SHORT}
              </button>
            )}
          </div>
        </div>

        {course.theme_tags?.length > 0 ? (
          <div style={styles.tags}>
            {course.theme_tags.map((t) => (
              <span key={t} style={styles.tag}>
                #{t}
              </span>
            ))}
          </div>
        ) : null}

        {isOwnerCourse ? (
          <div style={styles.ownerRow}>
            <button
              type="button"
              style={styles.ownerEditBtn}
              onClick={handleOwnerEdit}
              title="스튜디오 잔코스 수정 시트로 이동"
            >
              ✏️ 수정
            </button>
            <button
              type="button"
              style={{
                ...styles.ownerDeleteBtn,
                ...(ownerDeleteBusy
                  ? { opacity: 0.55, cursor: "wait" }
                  : null),
              }}
              disabled={ownerDeleteBusy}
              onClick={() => void handleOwnerDelete()}
            >
              {ownerDeleteBusy ? "삭제 중…" : "🗑 삭제"}
            </button>
          </div>
        ) : null}

      </div>
    </div>
  );
}
