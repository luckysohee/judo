import { useCallback, useEffect, useState } from "react";
import {
  emptyUserWallet,
  exchangeDropsForAiCredit,
  fetchUserWallet,
} from "../api/userWallet.js";

/**
 * 일반 유저 Drop · AI Credit 잔액
 * @param {string|null|undefined} userId
 */
export function useUserWallet(userId) {
  const [wallet, setWallet] = useState(emptyUserWallet);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const uid = String(userId || "").trim();
    if (!uid) {
      setWallet(emptyUserWallet());
      return emptyUserWallet();
    }
    setLoading(true);
    try {
      const w = await fetchUserWallet(uid);
      setWallet(w);
      return w;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const exchangeForCredit = useCallback(async () => {
    const uid = String(userId || "").trim();
    if (!uid) return { ok: false, message: "로그인이 필요해요." };
    const res = await exchangeDropsForAiCredit(uid);
    if (res.wallet) setWallet(res.wallet);
    else if (res.ok) await refresh();
    return res;
  }, [refresh, userId]);

  /** UI 미리보기 — 로컬만 (적립 API 연동 전) */
  const previewAddDrops = useCallback((amount) => {
    const delta = Math.max(0, Math.floor(Number(amount) || 0));
    if (!delta) return;
    setWallet((prev) => {
      const drops = prev.drops + delta;
      const per = prev.dropsPerAiCredit;
      return {
        ...prev,
        drops,
        progressDrops: drops % per,
        canExchange: drops >= per,
      };
    });
  }, []);

  return {
    wallet,
    loading,
    refresh,
    exchangeForCredit,
    previewAddDrops,
  };
}
