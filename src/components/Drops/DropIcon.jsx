/**
 * Drop 재화 — amber 술방울 SVG (💧 이모지 대체)
 * @param {{ size?: number, title?: string, className?: string, style?: object }} props
 */
export default function DropIcon({
  size = 16,
  title = "Drop",
  className,
  style,
}) {
  const h = Math.round(size * 1.12);
  const gradId = `judoDropGrad-${size}`;

  return (
    <svg
      width={size}
      height={h}
      viewBox="0 0 20 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={className}
      style={{ display: "block", flexShrink: 0, ...style }}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={gradId} x1="6" y1="2" x2="16" y2="22">
          <stop offset="0%" stopColor="#FFE08A" />
          <stop offset="45%" stopColor="#F5A623" />
          <stop offset="100%" stopColor="#C97A12" />
        </linearGradient>
      </defs>
      <path
        d="M10 2.2C10 2.2 4.5 11.2 4.5 15.8c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5C15.5 11.2 10 2.2 10 2.2z"
        fill={`url(#${gradId})`}
      />
      <ellipse cx="7.6" cy="9.2" rx="1.5" ry="2.2" fill="rgba(255,255,255,0.55)" />
    </svg>
  );
}
