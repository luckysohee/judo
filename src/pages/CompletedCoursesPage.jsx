import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchMyCompletedCourseLogs } from "../api/completedCourseLogs";
import { resetCourseStampsForReplay } from "../api/coursePlaceStamps";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast/ToastProvider";
import { studioCoursesShell, studioCoursesInner, studioCoursesBtnGhost } from "./Studio/studioCoursesSharedStyles";

function formatWhen(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

export default function CompletedCoursesPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [phase, setPhase] = useState("loading");
  const [replayBusyId, setReplayBusyId] = useState("");

  const handleReplay = useCallback(
    async (courseId) => {
      const cid = String(courseId || "").trim();
      if (!cid || replayBusyId) return;
      if (
        !window.confirm(
          "도장을 모두 지우고 처음부터 다시 모을까요? 완주 기록은 그대로 남아요."
        )
      ) {
        return;
      }
      setReplayBusyId(cid);
      try {
        const r = await resetCourseStampsForReplay(cid);
        if (!r?.ok) {
          const msg =
            r?.reason === "delete_blocked"
              ? "도장을 지울 수 없어요. DB에 삭제 권한 마이그레이션을 적용했는지 확인해 주세요."
              : "다시 모으기에 실패했어요.";
          showToast(msg, "warning", 3200);
          return;
        }
        showToast("도장을 다시 모을 수 있어요.", "success", 2800);
      } catch {
        showToast("다시 모으기에 실패했어요.", "warning", 2800);
      } finally {
        setReplayBusyId("");
      }
    },
    [replayBusyId, showToast]
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      setRows([]);
      setPhase("need_login");
      return;
    }
    let cancelled = false;
    setPhase("loading");
    void fetchMyCompletedCourseLogs({ limit: 50 })
      .then((list) => {
        if (!cancelled) {
          setRows(Array.isArray(list) ? list : []);
          setPhase("ok");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
          setPhase("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id]);

  return (
    <div style={studioCoursesShell}>
      <div
        style={{
          ...studioCoursesInner,
          maxWidth: "min(560px, 100%)",
          paddingBottom: "36px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "18px",
            gap: "10px",
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

        <h1
          style={{
            fontSize: "clamp(20px, 4.5vw, 24px)",
            fontWeight: 800,
            margin: "0 0 6px",
            letterSpacing: "-0.03em",
          }}
        >
          완주 기록
        </h1>
        <p
          style={{
            margin: "0 0 22px",
            fontSize: "13px",
            color: "rgba(255,255,255,0.5)",
            lineHeight: 1.5,
          }}
        >
          한 코스씩 끝까지 따라간 기록이에요.
        </p>

        {phase === "need_login" ? (
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.55)" }}>
            로그인하면 완주 기록을 볼 수 있어요.
          </p>
        ) : null}
        {phase === "loading" ? (
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.55)" }}>
            불러오는 중…
          </p>
        ) : null}
        {phase === "error" ? (
          <p style={{ fontSize: "14px", color: "rgba(248,113,113,0.9)" }}>
            기록을 불러오지 못했어요.
          </p>
        ) : null}
        {phase === "ok" && rows.length === 0 ? (
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.55)" }}>
            아직 완주 기록이 없어요. 공개 코스를 따라가 볼까요?
          </p>
        ) : null}

        {rows.map((r) => {
          const cid = String(r.course_id || "").trim();
          const title = String(r.course_title || "").trim() || "코스";
          const cover = String(r.course_cover_image_url || "").trim();
          const curator = String(r.curator_display_name || "").trim() || "큐레이터";
          return (
            <div
              key={String(r.id)}
              style={{
                display: "flex",
                gap: "10px",
                alignItems: "stretch",
                marginBottom: "12px",
                padding: "12px 12px",
                borderRadius: "14px",
                backgroundColor: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <Link
                to={cid ? `/courses/${encodeURIComponent(cid)}` : "/"}
                style={{
                  display: "flex",
                  gap: "14px",
                  alignItems: "stretch",
                  flex: 1,
                  minWidth: 0,
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div
                  style={{
                    width: "72px",
                    height: "72px",
                    borderRadius: "12px",
                    flexShrink: 0,
                    overflow: "hidden",
                    backgroundColor: "rgba(30,41,59,0.6)",
                  }}
                >
                  {cover ? (
                    <img
                      src={cover}
                      alt=""
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  ) : null}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: "15px",
                      fontWeight: 800,
                      letterSpacing: "-0.02em",
                      marginBottom: "4px",
                      lineHeight: 1.3,
                    }}
                  >
                    {title}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "rgba(255,255,255,0.45)",
                      marginBottom: "4px",
                    }}
                  >
                    {curator} · {Number(r.place_count) || 0}곳
                  </div>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.38)" }}>
                    {formatWhen(r.completed_at)}
                  </div>
                </div>
              </Link>
              {cid ? (
                <button
                  type="button"
                  onClick={() => void handleReplay(cid)}
                  disabled={replayBusyId === cid}
                  style={{
                    alignSelf: "center",
                    flexShrink: 0,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: "rgba(255,255,255,0.06)",
                    color: "rgba(255,255,255,0.82)",
                    borderRadius: "10px",
                    padding: "8px 10px",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {replayBusyId === cid ? "…" : "다시 모으기"}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
