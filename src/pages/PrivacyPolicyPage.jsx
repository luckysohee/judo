import LegalDocumentLayout from "../components/Legal/LegalDocumentLayout";
import {
  PRIVACY_POLICY_META,
  PRIVACY_POLICY_SECTIONS,
} from "./legal/privacyPolicySections";

export default function PrivacyPolicyPage() {
  return (
    <LegalDocumentLayout
      title={PRIVACY_POLICY_META.title}
      subtitle={PRIVACY_POLICY_META.subtitle}
      effectiveDate={PRIVACY_POLICY_META.effectiveDate}
      operatorName={PRIVACY_POLICY_META.operatorName}
      sections={PRIVACY_POLICY_SECTIONS}
      relatedLinks={[{ to: "/terms", label: "이용약관" }]}
      footerNote="본 문서는 개인정보 처리에 관한 안내입니다. 서비스 이용 조건은 이용약관을 따릅니다."
    />
  );
}
