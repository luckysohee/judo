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
    />
  );
}
