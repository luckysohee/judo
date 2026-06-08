import OnboardingQuestions from "./OnboardingQuestions";

/**
 * 로그인 후 취향 설문 미완료 시 전면 모달
 */
export default function TasteOnboardingGate({
  open = false,
  onComplete,
  onSkip,
}) {
  if (!open) return null;

  return (
    <OnboardingQuestions
      onComplete={(answers) => onComplete?.(answers, { skipped: false })}
      onSkip={() => onSkip?.()}
    />
  );
}
