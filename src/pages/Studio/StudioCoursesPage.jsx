import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  fetchMyCuratorCourses,
  updateCuratorCourse,
} from "../../api/curatorCourses";
import {
  getCuratorArchiveStats,
  getCourseEngagementStatsBatch,
  buildCuratorArchiveVibes,
  pickStudioCourseEngagementLines,
} from "../../api/courseCompletionStats";
import {
  studioCoursesShell,
  studioCoursesInner,
  studioCoursesTopRow,
  studioCoursesH1,
  studioCoursesCard,
  studioCoursesBtnPrimary,
  studioCoursesBtnGhost,
  studioCoursesEmpty,
  studioCoursesMeta,
  studioCoursesArchiveBand,
  studioCoursesArchiveWhisper,
  studioCoursesFeaturedCard,
  studioCoursesFeaturedBadge,
  studioCoursesSocialLine,
} from "./studioCoursesSharedStyles";

function formatDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("ko-KR", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(iso);
  }
}

/** 홈 `fetchPublicCuratorCourses` 등에 노출되는 상태 */
function isCoursePublicListed(course) {
  if (!course || typeof course !== "object") return false;
  return (
    String(course.status || "").trim() === "published" &&
    course.is_public === true
  );
}

function CourseStatsLines({ lines }) {
  if (!Array.isArray(lines) || lines.length === 0) return null;
  return (
    <div style={{ marginTop: "8px" }}>
      {lines.map((ln) => (
        <div key={ln.key} style={studioCoursesSocialLine}>
          <span aria-hidden>{ln.emoji}</span> {ln.text}
        </div>
      ))}
    </div>
  );
}

function CourseCardBody({
  c,
  statsByCourseId,
  featured,
  toggleBusy,
  onTogglePublicListed,
}) {
  const navigate = useNavigate();
  const id = String(c.id || "").trim().toLowerCase();
  const st = id ? statsByCourseId.get(id) : null;
  const lines = pickStudioCourseEngagementLines(st);
  const placeN = Math.max(0, Math.floor(Number(c.place_count) || 0));
  const listed = isCoursePublicListed(c);
  const canTurnPublic = placeN >= 2;
  const busy = Boolean(toggleBusy);

  const wrapStyle = featured
    ? studioCoursesFeaturedCard
    : studioCoursesCard;

  const toggleSwitch = (
    <div
      style={{
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "4px",
      }}
    >
      <button
        type="button"
        role="switch"
        aria-checked={listed}
        aria-label={listed ? "공개" : "비공개"}
        disabled={busy || (!listed && !canTurnPublic)}
        title={
          !listed && !canTurnPublic
            ? "공개하려면 장소를 2곳 이상 추가하세요."
            : listed
              ? "비공개로 전환"
              : "공개로 전환"
        }
        onClick={() => onTogglePublicListed?.(c)}
        style={{
          width: "48px",
          height: "28px",
          borderRadius: "14px",
          border: "1px solid rgba(255,255,255,0.2)",
          background: listed
            ? "linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)"
            : "rgba(255,255,255,0.12)",
          cursor:
            busy || (!listed && !canTurnPublic) ? "not-allowed" : "pointer",
          opacity: busy ? 0.55 : !listed && !canTurnPublic ? 0.45 : 1,
          position: "relative",
          transition: "background 0.15s ease",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: "3px",
            left: listed ? "22px" : "3px",
            width: "20px",
            height: "20px",
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
            transition: "left 0.15s ease",
          }}
          aria-hidden
        />
      </button>
      <span
        style={{
          fontSize: "10px",
          fontWeight: 700,
          color: listed ? "#7ddea8" : "rgba(255,255,255,0.45)",
          letterSpacing: "-0.01em",
        }}
      >
        {listed ? "공개" : "비공개"}
      </span>
    </div>
  );

  return (
    <div style={wrapStyle}>
      {featured ? (
        <div style={studioCoursesFeaturedBadge}>대표 믹스테이프</div>
      ) : null}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
          marginBottom: "6px",
        }}
      >
        <div
          style={{
            flex: "1 1 auto",
            minWidth: 0,
            fontSize: featured ? "17px" : "16px",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            lineHeight: 1.3,
          }}
        >
          {c.title || "제목 없음"}
        </div>
        {toggleSwitch}
      </div>
      <div style={studioCoursesMeta}>
        장소 {placeN}곳
        {c.area ? (
          <>
            {" · "}
            지역 {c.area}
          </>
        ) : null}
        {" · "}
        생성 {formatDate(c.created_at)}
      </div>
      <CourseStatsLines lines={lines} />
      {Array.isArray(c.theme_tags) && c.theme_tags.length > 0 ? (
        <div style={{ ...studioCoursesMeta, marginTop: "8px" }}>
          태그: {c.theme_tags.join(", ")}
        </div>
      ) : null}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "4px",
          marginTop: "10px",
        }}
      >
        <button
          type="button"
          style={{
            ...studioCoursesBtnPrimary,
            padding: "5px 10px",
            fontSize: "11px",
            borderRadius: "6px",
          }}
          onClick={() =>
            navigate(`/studio/courses/${encodeURIComponent(c.id)}/edit`)
          }
        >
          수정
        </button>
        <button
          type="button"
          style={{
            ...studioCoursesBtnGhost,
            padding: "5px 8px",
            fontSize: "11px",
            borderRadius: "6px",
          }}
          onClick={() => navigate(`/courses/${encodeURIComponent(c.id)}`)}
        >
          상세 보기
        </button>
      </div>
    </div>
  );
}

export default function StudioCoursesPage() {
  return <StudioCoursesPanel embedded={false} active />;
}

/**
 * @param {{ embedded?: boolean, active?: boolean }} props
 *   `embedded`: 스튜디오 홈 탭 패널. `active`: 탭이 보일 때만 목록 로드.
 */
export function StudioCoursesPanel({ embedded = false, active = true }) {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState([]);
  const [archiveStats, setArchiveStats] = useState(null);
  const [statsByCourseId, setStatsByCourseId] = useState(() => new Map());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [togglingCourseId, setTogglingCourseId] = useState(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setRows([]);
      setArchiveStats(null);
      setStatsByCourseId(new Map());
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr("");
    try {
      const [data, arch] = await Promise.all([
        fetchMyCuratorCourses(user.id, { limit: 100 }),
        getCuratorArchiveStats(user.id),
      ]);
      const courses = Array.isArray(data) ? data : [];
      setRows(courses);
      setArchiveStats(arch);

      const ids = courses
        .map((row) => String(row.id || "").trim())
        .filter(Boolean);
      const batch = await getCourseEngagementStatsBatch(ids);
      setStatsByCourseId(batch);
    } catch (e) {
      setErr(e?.message || "목록을 불러오지 못했습니다.");
      setRows([]);
      setArchiveStats(null);
      setStatsByCourseId(new Map());
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      setLoading(false);
      return;
    }
    if (embedded && !active) return;
    void load();
  }, [authLoading, user?.id, load, embedded, active]);

  const handleToggleCoursePublicListed = useCallback(async (course) => {
    const id = String(course?.id ?? "").trim();
    if (!id) return;
    const placeN = Math.max(0, Math.floor(Number(course.place_count) || 0));
    const listed = isCoursePublicListed(course);
    if (!listed && placeN < 2) {
      window.alert(
        "공개하려면 장소를 2곳 이상 넣어 주세요. 코스 수정에서 저장한 뒤 다시 시도해 주세요."
      );
      return;
    }
    setTogglingCourseId(id);
    try {
      const patch = listed
        ? { status: "private", is_public: false }
        : { status: "published", is_public: true };
      const updated = await updateCuratorCourse(id, patch);
      setRows((prev) =>
        prev.map((r) =>
          String(r.id) === id
            ? {
                ...r,
                status: updated.status,
                is_public: updated.is_public,
              }
            : r
        )
      );
    } catch (e) {
      window.alert(e?.message || "공개 설정을 바꾸지 못했습니다.");
    } finally {
      setTogglingCourseId(null);
    }
  }, []);

  const vibe = useMemo(
    () => buildCuratorArchiveVibes(archiveStats),
    [archiveStats]
  );

  const { featuredCourse, listCourses } = useMemo(() => {
    const topId = archiveStats?.top_course?.course_id?.toLowerCase() ?? "";
    if (!topId) {
      return { featuredCourse: null, listCourses: rows };
    }
    const featured = rows.find(
      (r) => String(r.id || "").trim().toLowerCase() === topId
    );
    if (!featured) {
      return { featuredCourse: null, listCourses: rows };
    }
    const rest = rows.filter(
      (r) => String(r.id || "").trim().toLowerCase() !== topId
    );
    return { featuredCourse: featured, listCourses: rest };
  }, [rows, archiveStats]);

  const newCourseButton = (
    <button
      type="button"
      aria-label="새 잔 코스"
      title="새 잔 코스"
      style={{
        ...studioCoursesBtnPrimary,
        flexShrink: 0,
        width: "36px",
        height: "36px",
        padding: 0,
        fontSize: "22px",
        fontWeight: 400,
        lineHeight: 1,
        borderRadius: "10px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={() => navigate("/studio/courses/new")}
    >
      +
    </button>
  );

  const archiveBand = (
    <div
      style={{
        ...studioCoursesArchiveBand,
        display: "flex",
        alignItems: "center",
        justifyContent: vibe.whisper ? "space-between" : "flex-end",
        gap: "12px",
      }}
    >
      {vibe.whisper ? (
        <p
          style={{
            ...studioCoursesArchiveWhisper,
            margin: 0,
            flex: "1 1 auto",
            minWidth: 0,
          }}
        >
          {vibe.whisper}
        </p>
      ) : null}
      {newCourseButton}
    </div>
  );

  if (embedded && !active) {
    return null;
  }

  const listBody = (
    <>
      {archiveBand}

      {err ? (
        <div
          style={{
            ...studioCoursesCard,
            borderColor: "rgba(231,76,60,0.5)",
            color: "#ffb4a8",
          }}
        >
          {err}
        </div>
      ) : null}

      {loading ? (
        <div style={{ padding: "20px 0", color: "rgba(255,255,255,0.6)" }}>
          목록 불러오는 중…
        </div>
      ) : rows.length === 0 ? (
        <div style={studioCoursesEmpty}>
          아직 만든 잔 코스가 없어요. 인스타 저장보다 실행하기 쉬운 코스를
          만들어보세요.
        </div>
      ) : (
        <>
          {featuredCourse ? (
            <CourseCardBody
              c={featuredCourse}
              statsByCourseId={statsByCourseId}
              featured
              toggleBusy={togglingCourseId === String(featuredCourse.id)}
              onTogglePublicListed={handleToggleCoursePublicListed}
            />
          ) : null}
          {listCourses.map((c) => (
            <CourseCardBody
              key={c.id}
              c={c}
              statsByCourseId={statsByCourseId}
              featured={false}
              toggleBusy={togglingCourseId === String(c.id)}
              onTogglePublicListed={handleToggleCoursePublicListed}
            />
          ))}
        </>
      )}
    </>
  );

  if (embedded) {
    if (authLoading) {
      return (
        <div style={{ padding: "20px 0", color: "rgba(255,255,255,0.6)" }}>
          불러오는 중…
        </div>
      );
    }
    if (!user?.id) {
      return (
        <div style={{ padding: "12px 0", color: "rgba(255,255,255,0.65)" }}>
          로그인이 필요합니다.
        </div>
      );
    }
    return <div>{listBody}</div>;
  }

  if (authLoading) {
    return (
      <div style={studioCoursesShell}>
        <div style={{ ...studioCoursesInner, paddingTop: "24px" }}>
          불러오는 중…
        </div>
      </div>
    );
  }

  if (!user?.id) {
    return (
      <div style={studioCoursesShell}>
        <div style={{ ...studioCoursesInner, paddingTop: "24px" }}>
          로그인이 필요합니다.
          <div style={{ marginTop: "12px" }}>
            <button
              type="button"
              style={studioCoursesBtnGhost}
              onClick={() => navigate("/studio")}
            >
              스튜디오로
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={studioCoursesShell}>
      <div style={studioCoursesInner}>
        <div style={studioCoursesTopRow}>
          <h1 style={studioCoursesH1}>잔 코스</h1>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              style={studioCoursesBtnGhost}
              onClick={() => navigate("/studio")}
            >
              스튜디오 홈
            </button>
          </div>
        </div>

        {listBody}
      </div>
    </div>
  );
}
