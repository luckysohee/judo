import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { listBlockedUserIds } from "../api/userBlocks";

/**
 * 현재 사용자가 차단한 user id 집합.
 * @returns {{ blockedIds: Set<string>, reload: () => Promise<void> }}
 */
export function useBlockedUserIds() {
  const { user } = useAuth();
  const [blockedIds, setBlockedIds] = useState(() => new Set());

  const reload = useCallback(async () => {
    if (!user?.id) {
      setBlockedIds(new Set());
      return;
    }
    const ids = await listBlockedUserIds(user.id);
    setBlockedIds(new Set(ids));
  }, [user?.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { blockedIds, reload };
}
