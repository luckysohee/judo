import { useEffect, useState } from "react";

const FRAMES = [".", "..", "..."];

/**
 * AI 검색 중일 때만 350ms 간격으로 "." → ".." → "..."을 회전.
 * 멈추면 즉시 "."으로 리셋.
 */
export function useAiSearchLoadingDots(isLoading) {
  const [dots, setDots] = useState(".");

  useEffect(() => {
    if (!isLoading) return undefined;
    let index = 0;
    const timer = setInterval(() => {
      index = (index + 1) % FRAMES.length;
      setDots(FRAMES[index]);
    }, 350);
    return () => {
      clearInterval(timer);
      setDots(".");
    };
  }, [isLoading]);

  return dots;
}
