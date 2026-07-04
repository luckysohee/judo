import { Link, useNavigate } from "react-router-dom";

const styles = {
  page: {
    minHeight: "100dvh",
    backgroundColor: "#0e0e0e",
    color: "#e8e8e8",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans KR', sans-serif",
  },
  header: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    backgroundColor: "rgba(14, 14, 14, 0.92)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    borderBottom: "1px solid #222",
    padding:
      "max(12px, env(safe-area-inset-top, 0px)) 16px 12px max(16px, env(safe-area-inset-left, 0px))",
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    border: "1px solid #333",
    background: "#1a1a1a",
    color: "#fff",
    borderRadius: 999,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    flexShrink: 0,
  },
  headerText: { flex: 1, minWidth: 0 },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: "-0.02em",
  },
  subtitle: {
    margin: "4px 0 0",
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    lineHeight: 1.4,
  },
  main: {
    maxWidth: 720,
    margin: "0 auto",
    padding:
      "20px 16px max(32px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-right, 0px))",
    boxSizing: "border-box",
  },
  meta: {
    marginBottom: 20,
    padding: "12px 14px",
    borderRadius: 12,
    background: "#171717",
    border: "1px solid #2a2a2a",
    fontSize: 12,
    lineHeight: 1.55,
    color: "rgba(255,255,255,0.62)",
  },
  section: {
    marginBottom: 22,
  },
  sectionTitle: {
    margin: "0 0 10px",
    fontSize: 15,
    fontWeight: 800,
    color: "#fff",
  },
  p: {
    margin: "0 0 10px",
    fontSize: 14,
    lineHeight: 1.65,
    color: "rgba(255,255,255,0.82)",
  },
  list: {
    margin: "0 0 10px",
    paddingLeft: 18,
    fontSize: 14,
    lineHeight: 1.65,
    color: "rgba(255,255,255,0.82)",
  },
  li: { marginBottom: 6 },
  footer: {
    marginTop: 28,
    paddingTop: 16,
    borderTop: "1px solid #222",
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
    lineHeight: 1.5,
  },
};

/**
 * @param {{
 *   title: string,
 *   subtitle?: string,
 *   effectiveDate?: string,
 *   operatorName?: string,
 *   sections: { title: string, body?: string[], list?: string[] }[],
 * }} props
 */
export default function LegalDocumentLayout({
  title,
  subtitle,
  effectiveDate,
  operatorName,
  sections,
}) {
  const navigate = useNavigate();

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <button
          type="button"
          style={styles.backBtn}
          onClick={() => navigate(-1)}
          aria-label="뒤로"
        >
          ← 뒤로
        </button>
        <div style={styles.headerText}>
          <h1 style={styles.title}>{title}</h1>
          {subtitle ? <p style={styles.subtitle}>{subtitle}</p> : null}
        </div>
      </header>

      <main style={styles.main}>
        {(effectiveDate || operatorName) && (
          <div style={styles.meta}>
            {operatorName ? <div>운영: {operatorName}</div> : null}
            {effectiveDate ? <div>시행일: {effectiveDate}</div> : null}
          </div>
        )}

        {sections.map((section) => (
          <section key={section.title} style={styles.section}>
            <h2 style={styles.sectionTitle}>{section.title}</h2>
            {(section.body || []).map((para) => (
              <p key={para.slice(0, 40)} style={styles.p}>
                {para}
              </p>
            ))}
            {Array.isArray(section.list) && section.list.length > 0 ? (
              <ul style={styles.list}>
                {section.list.map((item) => (
                  <li key={item.slice(0, 48)} style={styles.li}>
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}

        <footer style={styles.footer}>
          본 문서는 서비스 이용을 위한 기본 약관입니다. 개인정보 처리방침은 별도
          공지 시 서비스 내에서 확인할 수 있습니다.
        </footer>
      </main>
    </div>
  );
}

/** @param {{ to?: string, label?: string, style?: object }} props */
export function LegalTermsLink({
  to = "/terms",
  label = "이용약관",
  style = {},
}) {
  return (
    <Link
      to={to}
      style={{
        color: "rgba(255,255,255,0.45)",
        fontSize: 11,
        textDecoration: "underline",
        ...style,
      }}
    >
      {label}
    </Link>
  );
}
