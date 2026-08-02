// components/Map/MarkerLegend.jsx

import { useEffect, useState } from "react";

export default function MarkerLegend({
  savedOnly,
  onToggleSavedOnly,
  onSelectCategory,
  activeCategory,
  closeSignal,
  /** Home에서 지도 빈 곳 클릭 시 증가 → 패널 닫기(0이면 초기 마운트에서 무시) */
  mapCloseTick = 0,
  /** "seongsu" | "my_location" — 재방문 시 홈 지도 시작점 */
  mapStartMode = "seongsu",
  onMapStartModeChange,
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!closeSignal) return;
    setOpen(false);
  }, [closeSignal]);

  useEffect(() => {
    if (mapCloseTick === 0) return;
    setOpen(false);
  }, [mapCloseTick]);

  const items = [
    { key: "basic", label: "단일 추천", color: "#16a34a" },
    { key: "hot", label: "공동 추천", color: "#ea580c" },
    { key: "premium", label: "프리미엄 스팟", color: "#7c3aed" },
  ];

  return (
    <div style={styles.wrap}>
      <button
        type="button"
        onClick={onToggleSavedOnly}
        style={styles.savedOnlyButton}
        aria-label={
          savedOnly
            ? "내가 저장한 장소 마커 숨기기"
            : "내가 저장한 장소만 표시"
        }
        title={
          savedOnly
            ? "내가 저장한 장소 마커 숨기기"
            : "내가 저장한 장소만 표시"
        }
      >
        <span
          style={savedOnly ? styles.savedOnlyStarOn : styles.savedOnlyStarOff}
          aria-hidden
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </span>
      </button>

      {!open ? (
        <button
          type="button"
          style={styles.collapsedButton}
          onClick={() => setOpen(true)}
          aria-label="마커 안내 열기"
          title="마커 안내"
        >
          <div style={styles.collapsedDots}>
            {items.map((item) => (
              <span
                key={item.label}
                style={{
                  ...styles.collapsedDot,
                  backgroundColor: item.color,
                }}
              />
            ))}
          </div>
        </button>
      ) : (
        <div style={styles.container}>
          <div style={styles.headerRow}>
            <div style={styles.title}>마커 안내</div>
            <button
              type="button"
              style={styles.closeButton}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
              aria-label="마커 안내 닫기"
              title="닫기"
            >
              ✕
            </button>
          </div>

          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              title={
                item.key === "basic"
                  ? "다른 큐레이터 1명이 추천한 장소"
                  : item.key === "hot"
                    ? "큐레이터 2명이 겹치는 공동 추천"
                    : "큐레이터 3명 이상 겹치는 프리미엄"
              }
              style={{
                ...styles.rowButton,
                ...(activeCategory === item.key ? styles.rowButtonActive : null),
              }}
              onClick={() => onSelectCategory?.(item.key)}
            >
              <span style={{ ...styles.dot, backgroundColor: item.color }}></span>
              <span style={styles.label}>{item.label}</span>
            </button>
          ))}

          {typeof onMapStartModeChange === "function" ? (
            <div style={styles.startSection}>
              <div style={styles.startTitle}>시작 지도</div>
              <button
                type="button"
                style={{
                  ...styles.rowButton,
                  ...(mapStartMode === "seongsu"
                    ? styles.rowButtonActive
                    : null),
                }}
                title="앱을 열면 성수 지도를 보여줍니다"
                onClick={() => onMapStartModeChange("seongsu")}
              >
                <span style={styles.label}>성수</span>
              </button>
              <button
                type="button"
                style={{
                  ...styles.rowButton,
                  marginBottom: 0,
                  ...(mapStartMode === "my_location"
                    ? styles.rowButtonActive
                    : null),
                }}
                title="두 번째 방문부터 내 위치 지도를 기본으로 엽니다"
                onClick={() => onMapStartModeChange("my_location")}
              >
                <span style={styles.label}>내 위치</span>
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** 지도 위 맑은 유리(glass) 표면 — blur·밝기·inset 하이라이트 */
const MARKER_LEGEND_GLASS = {
  blur: "blur(34px) saturate(190%) brightness(1.08)",
  surface:
    "linear-gradient(155deg, rgba(255, 255, 255, 0.36) 0%, rgba(255, 255, 255, 0.18) 48%, rgba(255, 255, 255, 0.1) 100%)",
  surfaceSoft:
    "linear-gradient(160deg, rgba(255, 255, 255, 0.28) 0%, rgba(255, 255, 255, 0.12) 100%)",
  border: "1px solid rgba(255, 255, 255, 0.48)",
  borderSoft: "1px solid rgba(255, 255, 255, 0.38)",
  shadow:
    "0 8px 22px rgba(0, 0, 0, 0.07), inset 0 1px 0 rgba(255, 255, 255, 0.78), inset 0 -1px 0 rgba(255, 255, 255, 0.16)",
  shadowSoft:
    "0 6px 16px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.62)",
  ink: "rgba(18, 20, 26, 0.88)",
  inkMuted: "rgba(30, 34, 42, 0.72)",
};

const styles = {
  wrap: {
    pointerEvents: "auto",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    width: "100%",
    gap: "8px",
  },
  savedOnlyButton: {
    width: "100%",
    maxWidth: "100%",
    height: "28px",
    borderRadius: "999px",
    border: MARKER_LEGEND_GLASS.borderSoft,
    background: MARKER_LEGEND_GLASS.surfaceSoft,
    color: MARKER_LEGEND_GLASS.ink,
    backdropFilter: MARKER_LEGEND_GLASS.blur,
    WebkitBackdropFilter: MARKER_LEGEND_GLASS.blur,
    boxShadow: MARKER_LEGEND_GLASS.shadowSoft,
    cursor: "pointer",
    padding: 0,
    fontSize: "14px",
    fontWeight: 900,
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition:
      "color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease",
  },
  savedOnlyStarOff: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "rgba(255, 255, 255, 0.96)",
    filter:
      "drop-shadow(0 0 0.5px rgba(0,0,0,0.22)) drop-shadow(0 1px 2px rgba(0,0,0,0.14))",
  },
  savedOnlyStarOn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#EAB308",
    filter: "drop-shadow(0 0 5px rgba(234, 179, 8, 0.55))",
  },
  collapsedButton: {
    width: "100%",
    maxWidth: "100%",
    height: "58px",
    borderRadius: "999px",
    border: MARKER_LEGEND_GLASS.borderSoft,
    background: MARKER_LEGEND_GLASS.surfaceSoft,
    color: MARKER_LEGEND_GLASS.ink,
    backdropFilter: MARKER_LEGEND_GLASS.blur,
    WebkitBackdropFilter: MARKER_LEGEND_GLASS.blur,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: MARKER_LEGEND_GLASS.shadowSoft,
    cursor: "pointer",
    padding: 0,
  },
  collapsedDots: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    alignItems: "center",
    justifyContent: "center",
  },
  collapsedDot: {
    width: "7px",
    height: "7px",
    borderRadius: "999px",
    boxShadow:
      "0 0 0 1px rgba(255,255,255,0.55), 0 1px 3px rgba(0,0,0,0.12)",
  },
  container: {
    alignSelf: "flex-end",
    padding: "6px 7px",
    background: MARKER_LEGEND_GLASS.surface,
    backdropFilter: MARKER_LEGEND_GLASS.blur,
    WebkitBackdropFilter: MARKER_LEGEND_GLASS.blur,
    border: MARKER_LEGEND_GLASS.border,
    borderRadius: "12px",
    color: MARKER_LEGEND_GLASS.ink,
    fontSize: "10px",
    width: "104px",
    maxWidth:
      "min(104px, calc(100vw - 32px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)))",
    boxSizing: "border-box",
    boxShadow: MARKER_LEGEND_GLASS.shadow,
  },
  startSection: {
    marginTop: "6px",
    paddingTop: "6px",
    borderTop: "1px solid rgba(255,255,255,0.36)",
  },
  startTitle: {
    fontWeight: 700,
    fontSize: "9px",
    color: MARKER_LEGEND_GLASS.inkMuted,
    letterSpacing: "-0.02em",
    marginBottom: "2px",
    paddingLeft: "2px",
    textShadow: "0 1px 0 rgba(255,255,255,0.55)",
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "4px",
    marginBottom: "4px",
  },
  title: {
    fontWeight: 700,
    fontSize: "9px",
    color: MARKER_LEGEND_GLASS.inkMuted,
    letterSpacing: "-0.02em",
    textShadow: "0 1px 0 rgba(255,255,255,0.55)",
  },
  closeButton: {
    width: "18px",
    height: "18px",
    borderRadius: "999px",
    border: "1px solid rgba(255,255,255,0.42)",
    background: "rgba(255,255,255,0.28)",
    backdropFilter: MARKER_LEGEND_GLASS.blur,
    WebkitBackdropFilter: MARKER_LEGEND_GLASS.blur,
    color: MARKER_LEGEND_GLASS.ink,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "9px",
    flexShrink: 0,
    padding: 0,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55)",
  },
  rowButton: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "4px",
    marginBottom: "2px",
    border: "none",
    backgroundColor: "transparent",
    padding: "3px 2px",
    borderRadius: "6px",
    cursor: "pointer",
    textAlign: "left",
  },
  rowButtonActive: {
    background:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.52) 0%, rgba(255, 255, 255, 0.28) 100%)",
    backdropFilter: "blur(12px) saturate(160%)",
    WebkitBackdropFilter: "blur(12px) saturate(160%)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.72)",
  },
  dot: { width: "6px", height: "6px", borderRadius: "50%", flexShrink: 0 },
  label: {
    color: MARKER_LEGEND_GLASS.ink,
    fontSize: "9px",
    lineHeight: 1.2,
    fontWeight: 600,
    textShadow: "0 1px 0 rgba(255,255,255,0.45)",
  },
};