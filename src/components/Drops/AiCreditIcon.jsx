import { useId } from "react";

/**
 * AI Credit — indigo spark/ticket (Drop과 구분)
 * @param {{ size?: number, title?: string, style?: object }} props
 */
export default function AiCreditIcon({
  size = 14,
  title = "AI Credit",
  style,
}) {
  const gradId = useId().replace(/:/g, "");

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      style={{ display: "block", flexShrink: 0, ...style }}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={gradId} x1="5" y1="2" x2="19" y2="16">
          <stop offset="0%" stopColor="#C4B5FD" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
      </defs>
      <path
        d="M12 2l1.8 5.5L19 9l-5.2 1.5L12 16l-1.8-5.5L5 9l5.2-1.5L12 2z"
        fill={`url(#${gradId})`}
        stroke="rgba(199,210,254,0.9)"
        strokeWidth="0.6"
      />
    </svg>
  );
}
