import { LEGAL } from "../../config/legal";

/**
 * 로그인 전 약관 동의 체크박스.
 */
export default function LegalConsentCheckbox({
  checked,
  onChange,
  id = "legal-consent",
  style,
}) {
  return (
    <label
      htmlFor={id}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        textAlign: "left",
        cursor: "pointer",
        userSelect: "none",
        ...style,
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(e) => onChange?.(e.target.checked)}
        style={{
          marginTop: 3,
          width: 18,
          height: 18,
          flexShrink: 0,
          accentColor: "#7CFF6B",
          cursor: "pointer",
        }}
      />
      <span
        style={{
          fontSize: 12,
          lineHeight: 1.5,
          color: "rgba(255,255,255,0.62)",
        }}
      >
        <a
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ color: "rgba(255,255,255,0.88)", textDecoration: "underline" }}
        >
          이용약관
        </a>
        에 동의합니다. (콘텐츠 신고·차단·운영 삭제 정책 포함)
        {LEGAL.contactEmail ? (
          <>
            {" "}
            문의:{" "}
            <a
              href={`mailto:${LEGAL.contactEmail}`}
              style={{ color: "rgba(255,255,255,0.75)" }}
            >
              {LEGAL.contactEmail}
            </a>
          </>
        ) : null}
      </span>
    </label>
  );
}
