import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../Toast/ToastProvider";
import {
  listBlockedUsersDetailed,
  unblockUser,
} from "../../api/userBlocks";

/**
 * 차단한 사용자 목록 · 해제.
 */
export default function BlockedUsersPanel({ style }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const reload = useCallback(async () => {
    if (!user?.id) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const list = await listBlockedUsersDetailed(user.id);
      setRows(list);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!user?.id) {
    return (
      <div style={style}>
        <h3
          style={{
            margin: "0 0 8px",
            fontSize: 15,
            fontWeight: 800,
            color: "#fff",
          }}
        >
          차단한 사용자
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "rgba(255,255,255,0.5)",
            lineHeight: 1.45,
          }}
        >
          로그인하면 차단한 사용자를 확인하고 해제할 수 있어요.
        </p>
      </div>
    );
  }

  const handleUnblock = async (blockedId) => {
    setBusyId(blockedId);
    try {
      await unblockUser(user.id, blockedId);
      showToast("차단을 해제했어요.", "success", 2200);
      await reload();
    } catch (e) {
      showToast(e?.message || "해제에 실패했어요.", "warning", 2800);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={style}>
      <h3
        style={{
          margin: "0 0 8px",
          fontSize: 15,
          fontWeight: 800,
          color: "#fff",
        }}
      >
        차단한 사용자
      </h3>
      <p
        style={{
          margin: "0 0 12px",
          fontSize: 12,
          color: "rgba(255,255,255,0.5)",
          lineHeight: 1.45,
        }}
      >
        차단한 사용자의 코스·장소·프로필이 목록에서 숨겨집니다.
      </p>
      {loading ? (
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
          차단한 사용자가 없어요.
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {rows.map((r) => (
            <li
              key={r.blocked_id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "10px 0",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>
                {r.display_name || "사용자"}
              </span>
              <button
                type="button"
                disabled={busyId === r.blocked_id}
                onClick={() => void handleUnblock(r.blocked_id)}
                style={{
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "transparent",
                  color: "rgba(255,255,255,0.8)",
                  borderRadius: 8,
                  padding: "6px 10px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {busyId === r.blocked_id ? "…" : "차단 해제"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
