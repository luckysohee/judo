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
      footerNote="본 문서는 「개인정보 보호법」 등 관련 법령에 따른 개인정보 처리방침입니다. 서비스 이용 조건은 「이용약관」을 함께 확인해 주세요."
      relatedLinks={[{ to: "/terms", label: "이용약관 보기" }]}
    />
  );
}
