import FeatureLoginPrompt from "../LoginPrompt/FeatureLoginPrompt";

/**
 * 비로그인 사용자가 보호 기능에 접근 시 노출되는 로그인 유도 모달의 게이트 래퍼.
 * `useLoginRequired()`의 상태와 외부 로그인 트리거를 받아 표시 여부만 책임진다.
 */
export default function HomeLoginPromptGate({
  open,
  feature,
  onClose,
  onLoginRequest,
}) {
  if (!open) return null;
  return (
    <FeatureLoginPrompt
      feature={feature}
      onClose={onClose}
      onLogin={() => {
        onClose?.();
        onLoginRequest?.();
      }}
    />
  );
}
