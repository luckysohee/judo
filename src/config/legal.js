/**
 * 법적 고지 — 화면에 노출되는 운영·문의 정보.
 *
 * 현재는 사업자등록 전 개인 운영 기준으로 표기합니다.
 * 법인/사업자 전환 시 operatorName·privacyOfficer·business* 필드를 갱신하세요.
 */
export const LEGAL = {
  serviceName: "주도",
  serviceNameEn: "JUDO",

  /** 서비스 운영 주체 (사업자등록 전: 개인 운영자명) */
  operatorName: "장소희",

  /** 고객·개인정보·UGC 신고 문의 */
  contactEmail: "lucky.sohee.jang@gmail.com",

  /** 개인정보 보호책임자 */
  privacyOfficer: "장소희",

  /** 이용약관 시행일 (표시용) */
  termsEffectiveDate: "2026년 7월 4일",

  /** 약관 버전 — profiles.terms_version / 동의 기록에 저장 */
  termsVersion: "2026-07-04",

  /** 개인정보 처리방침 시행일 (표시용) */
  privacyEffectiveDate: "2026년 8월 30일",

  /** 서비스 제공 지역 */
  serviceRegion: "대한민국",

  /**
   * 사업자등록번호 (없으면 화면에 표시하지 않음)
   * 예: "000-00-00000"
   */
  businessRegistrationNumber: "",

  /**
   * 사업장 주소 (없으면 화면에 표시하지 않음)
   */
  businessAddress: "",
};
