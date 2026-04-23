import { useCallback, useState } from "react";

/**
 * `/recommend` places[].reason 이 비어도 summary(= DB content·또는 refine)에서 한 줄 채움.
 * 서버 매칭 실패·이름 불일치 시에도 UI가 검색 태그 템플릿으로만 가지 않게 함.
 */
function enrichRecommendationFromSummary(data) {
  if (!data || typeof data !== "object" || !data.ok || !Array.isArray(data.places)) {
    return data;
  }
  const summary = String(data.summary || "")
    .replace(/\r\n/g, "\n")
    .trim();
  let parts = summary
    ? summary
        .split(/\n+|(?<=[.!?…])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 6)
    : [];
  if (parts.length === 1 && parts[0].length > 100) {
    const sub = parts[0]
      .split(/(?:\s*[,，]\s*|·\s+)/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);
    if (sub.length > 1) parts = sub;
  }

  const places = data.places.map((p, i) => {
    const r0 = String(p?.reason || "").trim();
    if (r0) return p;
    const name = String(p?.name || p?.place_name || "").trim();
    let line = "";
    if (name && summary) {
      const idx = summary.indexOf(name);
      if (idx >= 0) {
        line = summary
          .slice(idx + name.length)
          .trim()
          .replace(/^[,，、\-—–:]+/, "")
          .replace(/\s+/g, " ")
          .trim();
      }
      if (!line) {
        for (const tok of name.split(/\s+/).filter((t) => t.length >= 2)) {
          const j = summary.indexOf(tok);
          if (j < 0) continue;
          const tail = summary
            .slice(j + tok.length)
            .trim()
            .replace(/^[,，、\-—–:]+/, "")
            .replace(/\s+/g, " ")
            .trim();
          if (tail.length >= 4) {
            line = tail;
            break;
          }
        }
      }
    }
    if (!line && parts.length) {
      line = parts[i % parts.length].slice(0, 72);
    }
    return line ? { ...p, reason: line } : p;
  });

  return { ...data, places };
}

export function useRecommendation() {
  const [query, setQuery] = useState("");
  const [recommendation, setRecommendation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchRecommend = useCallback(async (qOverride) => {
    const q = String(qOverride ?? query).trim();
    setError("");
    if (!q) {
      setRecommendation(null);
      return null;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/recommend?q=${encodeURIComponent(q)}`,
      );
      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (!res.ok || !data) {
        setRecommendation(null);
        setError(
          (data && data.message) ||
            res.statusText ||
            "요청에 실패했어요",
        );
        return null;
      }
      if (!data.ok) {
        setRecommendation(null);
        setError(data.message || "추천을 불러올 수 없어요");
        return null;
      }
      const enriched = enrichRecommendationFromSummary(data);
      setRecommendation(enriched);
      return enriched;
    } catch (e) {
      setRecommendation(null);
      setError(e?.message || "네트워크 오류");
      return null;
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleQueryKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        fetchRecommend();
      }
    },
    [fetchRecommend],
  );

  return {
    query,
    setQuery,
    recommendation,
    setRecommendation,
    loading,
    error,
    fetchRecommend,
    handleQueryKeyDown,
  };
}
