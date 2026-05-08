/**
 * 홈 첫 진입 시 지도 정중앙에 잠깐 떴다 사라지는 "오늘은 어디서 한잔?" 인트로.
 * - 표시 조건은 `visible` 한 개로 외부에서 통제.
 * - 애니메이션 1회 끝나면 `onAnimationEnd`로 부모가 dismiss 플래그를 세션에 저장.
 * - 탭/엔터 입력 시 `onTapToAnswer`로 검색창에 포커스를 보낸다.
 */
const KEYFRAMES = `
@keyframes homeDustIntroCycle {
  0% {
    opacity: 0;
    filter: blur(14px);
    transform: scale(0.9);
    letter-spacing: -0.06em;
  }
  16% {
    opacity: 1;
    filter: blur(0px);
    transform: scale(1);
    letter-spacing: -0.03em;
  }
  44% {
    opacity: 1;
    filter: blur(0px);
    transform: scale(1);
    letter-spacing: -0.03em;
  }
  100% {
    opacity: 0;
    filter: blur(26px);
    transform: scale(1.18);
    letter-spacing: 0.14em;
  }
}
`;

export default function HomeDustIntroOverlay({
  visible,
  onTapToAnswer,
  onAnimationEnd,
  styleMap,
}) {
  if (!visible) return null;
  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        style={styleMap?.homeDustIntroOverlay}
        aria-hidden={false}
        role="button"
        tabIndex={0}
        aria-label="검색창에서 답하기"
        onClick={onTapToAnswer}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onTapToAnswer?.();
          }
        }}
      >
        <div
          style={styleMap?.homeDustIntroInner}
          onAnimationEnd={onAnimationEnd}
        >
          <p style={styleMap?.homeDustIntroTitle}>오늘은 어디서 한잔?</p>
          <p style={styleMap?.homeDustIntroSub}>
            예: 합정 1차 어디로 — 탭하면 검색에 써 보세요
          </p>
        </div>
      </div>
    </>
  );
}
