import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  deleteCuratorList,
  fetchMyCuratorLists,
  publishCuratorList,
  updateCuratorList,
} from "../../api/curatorLists";
import {
  studioCoursesShell,
  studioCoursesInner,
  studioCoursesTopRow,
  studioCoursesH1,
  studioCoursesCard,
  studioCoursesBtnPrimary,
  studioCoursesBtnGhost,
  studioCoursesBtnDanger,
  studioCoursesEmpty,
  studioCoursesMeta,
} from "./studioCoursesSharedStyles";

function isListPublicListed(list) {
  return (
    String(list?.status || "").trim() === "published" &&
    list?.is_public === true
  );
}

export default function StudioListsPage() {
  return <StudioListsPanel embedded={false} active />;
}

/**
 * @param {{ embedded?: boolean, active?: boolean }} props
 */
export function StudioListsPanel({ embedded = false, active = true }) {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr("");
    try {
      const data = await fetchMyCuratorLists(user.id, { limit: 100 });
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e?.message || "목록을 불러오지 못했습니다.");
      setRows([]);
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

  const handleTogglePublic = useCallback(async (list) => {
    const id = String(list?.id ?? "").trim();
    if (!id) return;
    const listed = isListPublicListed(list);
    const placeN = Math.max(0, Math.floor(Number(list.place_count) || 0));
    if (!listed && placeN < 1) {
      window.alert("공개하려면 장소를 1곳 이상 넣어 주세요.");
      return;
    }
    setBusyId(id);
    try {
      const updated = listed
        ? await updateCuratorList(id, { status: "private", is_public: false })
        : await publishCuratorList(id);
      setRows((prev) =>
        prev.map((r) =>
          String(r.id) === id
            ? { ...r, status: updated.status, is_public: updated.is_public }
            : r
        )
      );
    } catch (e) {
      window.alert(e?.message || "공개 설정을 바꾸지 못했습니다.");
    } finally {
      setBusyId(null);
    }
  }, []);

  const handleDelete = useCallback(async (list) => {
    const id = String(list?.id ?? "").trim();
    if (!id) return;
    if (!window.confirm(`「${list.title || "맛집첩"}」을 삭제할까요?`)) return;
    setBusyId(id);
    try {
      await deleteCuratorList(id);
      setRows((prev) => prev.filter((r) => String(r.id) !== id));
    } catch (e) {
      window.alert(e?.message || "삭제하지 못했습니다.");
    } finally {
      setBusyId(null);
    }
  }, []);

  const body = (
    <div style={embedded ? undefined : studioCoursesInner}>
      <div style={studioCoursesTopRow}>
        <h1 style={studioCoursesH1}>맛집첩</h1>
        <button
          type="button"
          style={studioCoursesBtnPrimary}
          onClick={() => navigate("/studio/lists/new")}
        >
          + 새 맛집첩
        </button>
      </div>
      <p style={{ ...studioCoursesMeta, marginBottom: 14, lineHeight: 1.45 }}>
        동선·도장 없이 동네·테마로 묶은 장소 리스트예요. 홈 「맛집첩」에 공개되면
        지도에 핀으로 펼쳐집니다.
      </p>
      {err ? (
        <div style={{ ...studioCoursesEmpty, color: "#fca5a5" }}>{err}</div>
      ) : null}
      {loading ? (
        <div style={studioCoursesEmpty}>불러오는 중…</div>
      ) : rows.length === 0 ? (
        <div style={studioCoursesEmpty}>
          아직 맛집첩이 없어요. 동네·테마 묶음을 만들어 보세요.
        </div>
      ) : (
        rows.map((list) => {
          const listed = isListPublicListed(list);
          const busy = busyId === String(list.id);
          const n = Math.max(0, Math.floor(Number(list.place_count) || 0));
          return (
            <div key={list.id} style={studioCoursesCard}>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  marginBottom: 6,
                }}
              >
                {list.title || "제목 없음"}
              </div>
              <div style={studioCoursesMeta}>
                {n}곳
                {list.area ? ` · ${list.area}` : ""}
                {" · "}
                {listed ? "공개" : list.status === "draft" ? "초안" : "비공개"}
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  marginTop: 12,
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  style={studioCoursesBtnGhost}
                  disabled={busy}
                  onClick={() => navigate(`/studio/lists/${list.id}/edit`)}
                >
                  수정
                </button>
                <button
                  type="button"
                  style={studioCoursesBtnGhost}
                  disabled={busy}
                  onClick={() => void handleTogglePublic(list)}
                >
                  {listed ? "비공개" : "공개"}
                </button>
                <button
                  type="button"
                  style={studioCoursesBtnDanger}
                  disabled={busy}
                  onClick={() => void handleDelete(list)}
                >
                  삭제
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  if (embedded) return body;

  return (
    <div style={studioCoursesShell}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 12px 0",
        }}
      >
        <button
          type="button"
          style={studioCoursesBtnGhost}
          onClick={() => navigate("/studio")}
        >
          ← 스튜디오
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 12 }}>
        {body}
      </div>
    </div>
  );
}
