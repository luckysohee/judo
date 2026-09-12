import LegalDocumentLayout from "../components/Legal/LegalDocumentLayout";
import {
  TERMS_OF_SERVICE_META,
  TERMS_OF_SERVICE_SECTIONS,
} from "./legal/termsOfServiceSections";

export default function TermsOfServicePage() {
  return (
    <LegalDocumentLayout
      title={TERMS_OF_SERVICE_META.title}
      subtitle={TERMS_OF_SERVICE_META.subtitle}
      effectiveDate={TERMS_OF_SERVICE_META.effectiveDate}
      operatorName={TERMS_OF_SERVICE_META.operatorName}
      sections={TERMS_OF_SERVICE_SECTIONS}
      footerNote="본 문서는 서비스 이용을 위한 기본 약관입니다. 개인정보 처리에 관한 상세 내용은 「개인정보 처리방침」을 확인해 주세요."
      relatedLinks={[{ to: "/privacy", label: "개인정보 처리방침 보기" }]}
    />
  );
}
