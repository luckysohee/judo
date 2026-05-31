import { useCallback, useEffect, useMemo, useState } from "react";
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

const PAGE_TITLE_APP = "주도";

function curatorLabelFromProfile(p) {
  if (!p || typeof p !== "object") return "큐레이터";
  const dn = String(p.display_name || "").trim();
  if (dn) return dn;
  const un = String(p.username || "").trim();
  if (un) return un.startsWith("@") ? un : `@${un}`;
  return "큐레이터";
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
}) {
  const { showToast } = useToast();
  const [curatorName, setCuratorName] = useState("큐레이터");
  const [metricLine, setMetricLine] = useState(null);
  const [likedByMe, setLikedByMe] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeBusy, setLikeBusy] = useState(false);
  const [importedByMe, setImportedByMe] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [localStampIds, setLocalStampIds] = useState(() => new Set());
  const [localGuideIndex, setLocalGuideIndex] = useState(0);
  const [localCompleted, setLocalCompleted] = useState(false);
  const [stampStateLoading, setStampStateLoading] = useState(false);

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
      setCuratorName("큐레이터");
      return undefined;
    }
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, username")
        .eq("id", cid)
        .maybeSingle();
      if (!cancelled) {
        setCuratorName(curatorLabelFromProfile(data));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [course?.curator_id]);

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

  if (loading) {
    return (
      <div style={styles.root} aria-busy="true">
        <div style={styles.stateBox}>코스 불러오는 중…</div>
      </div>
    );
  }

  if (!course) return null;

  const cover = String(course.cover_image_url || "").trim();
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
  }));
  const metaBits = [
    curatorName,
    course.area,
    thumbSteps.length > 0
      ? `${thumbSteps.length}곳`
      : places.length > 0
        ? `${places.length}곳`
        : null,
  ].filter(Boolean);

  return (
    <div style={styles.root} aria-label="코스 상세">
      <div style={styles.topBar}>
        <button type="button" style={styles.backBtn} onClick={() => onBack?.()}>
          ← 목록
        </button>
        <p style={styles.topTitle}>코스 미리보기</p>
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
          <p style={styles.meta}>{metaBits.join(" · ")}</p>
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

      </div>
    </div>
  );
}
