import { useCallback, useState } from "react";

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
      return;
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
        return;
      }
      if (!data.ok) {
        setRecommendation(null);
        setError(data.message || "추천을 불러올 수 없어요");
        return;
      }
      setRecommendation(data);
    } catch (e) {
      setRecommendation(null);
      setError(e?.message || "네트워크 오류");
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
