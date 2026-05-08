import { useEffect, useState } from "react";

/**
 * 60초마다 1씩 증가하는 정수. 자체 의존이 시간(분 단위)인
 * useMemo의 강제 재계산용 trigger. 값 자체에 의미는 없음.
 */
export function useMinuteTick() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTick((n) => n + 1);
    }, 60000);
    return () => window.clearInterval(id);
  }, []);

  return tick;
}
