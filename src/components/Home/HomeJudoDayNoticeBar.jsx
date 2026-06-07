import { useLayoutEffect, useRef } from "react";

import { styles } from "../../pages/Home/homeStyles";

const BASE_FONT_PX = 11.5;
const MIN_FONT_PX = 7.75;

function fitCopyFont(copyEl) {
  if (!copyEl) return;
  let px = BASE_FONT_PX;
  copyEl.style.fontSize = `${px}px`;
  const maxW = copyEl.clientWidth;
  if (!maxW) return;
  while (px > MIN_FONT_PX && copyEl.scrollWidth > maxW + 1) {
    px -= 0.25;
    copyEl.style.fontSize = `${px}px`;
  }
}

/**
 * 낮 모드 상단 안내 — 한 줄 전체 문구 + 우측 카운트다운 (잘림 없이 폭에 맞춰 글자 축소).
 */
export default function HomeJudoDayNoticeBar({ clock, title }) {
  const copyRef = useRef(null);

  useLayoutEffect(() => {
    const el = copyRef.current;
    if (!el) return;

    const run = () => fitCopyFont(el);
    run();

    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(run)
        : null;
    ro?.observe(el);
    window.addEventListener("resize", run);

    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", run);
    };
  }, [clock]);

  return (
    <div
      style={styles.judoDayNoticeFixedBar}
      role="status"
      aria-live="polite"
      title={title}
    >
      <p ref={copyRef} style={styles.judoDayNoticeCopy}>
        <span style={styles.judoDayNoticeMuted}>지금은 </span>
        <span style={styles.judoDayNoticeEm}>미리 픽</span>
        <span style={styles.judoDayNoticeMuted}>하는 시간. </span>
        <span style={styles.judoDayNoticeEm}>오후 4시</span>
        <span style={styles.judoDayNoticeMuted}>. 한잔(</span>
        <span style={styles.judoDayNoticeLiveTag}>live check in</span>
        <span style={styles.judoDayNoticeMuted}>) 가능 시간</span>
      </p>
      <span style={styles.judoDayNoticeTimer} aria-label="오픈까지">
        {clock}
      </span>
    </div>
  );
}
