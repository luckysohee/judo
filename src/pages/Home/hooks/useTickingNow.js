import { useEffect, useState } from "react";

/**
 * 일정 주기로 갱신되는 Date 객체. judo 운영 모드 / 하루 카운트다운 등
 * "지금"이 자동으로 흘러가야 하는 곳에 사용.
 */
export function useTickingNow(periodMs = 1000) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(new Date());
    }, periodMs);
    return () => window.clearInterval(id);
  }, [periodMs]);

  return now;
}
