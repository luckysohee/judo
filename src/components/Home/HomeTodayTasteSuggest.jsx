import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { pickTodayTastePlaces, tasteProfileHasSignals } from "../../utils/userTasteProfile";
import {
  hideTodayTasteSuggestForDay,
  isTodayTasteSuggestHiddenForDay,
  markTodayTasteSuggestAutoShownThisSession,
  wasTodayTasteSuggestAutoShownThisSession,
} from "../../utils/todayTasteSuggestDismiss";

/**
 * 홈 지도 우측 — 코스 칩 아래 「오늘 여기 어때요?」 재진입 칩.
 */
export function HomeTodayTasteEntryChip({
  visible = false,
  onOpen,
  title = "오늘 여기 어때요?",
  buttonStyle = {},
  labelStyle = {},
}) {
  if (!visible || typeof onOpen !== "function") return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={title}
      title={title}
      style={buttonStyle}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 0,
          fontSize: 11,
        }}
        aria-hidden
      >
        ✨
      </span>
      <span style={labelStyle}>오늘</span>
    </button>
  );
}

/**
 * 홈 유휴 시 — 설문 취향 기반 「오늘 여기 어때요?」 팝업 (룰만, GPT 없음)
 * - 첫 진입 시 자동 1회 (세션·오늘 안보기 제외)
 * - 장소 클릭 시 미리보기만 열고, 닫으면 나머지 추천 팝업 다시
 * - 명시적으로 닫으면 코스 칩 아래 작은 칩으로 다시 열기
 */
export default function HomeTodayTasteSuggest({
  eligible = false,
  profile,
  places = [],
  onPickPlace,
  /** 취향 팝업에서 고른 장소 미리보기가 열려 있는지 */
  tastePreviewOpen = false,
  /** 재진입 칩 — 부모(지도 범례 스택)에 렌더 */
  onEntryChipChange,
}) {
  const [open, setOpen] = useState(false);
  const [hideForDay, setHideForDay] = useState(false);
  const [hiddenForDay, setHiddenForDay] = useState(isTodayTasteSuggestHiddenForDay);
  const [userDismissedModal, setUserDismissedModal] = useState(false);
  const [pickedKeys, setPickedKeys] = useState(() => new Set());

  const hasProfile = tasteProfileHasSignals(profile);
  const picks = useMemo(() => {
    if (!hasProfile) return [];
    return pickTodayTastePlaces(places, profile, { limit: 3 });
  }, [hasProfile, places, profile]);

  const placeKey = useCallback((place) => {
    const id = place?.id ?? place?.place_id ?? place?.kakao_place_id;
    if (id != null && String(id).trim() !== "") return String(id);
    return String(place?.name || place?.place_name || "").trim();
  }, []);

  const unpicked = useMemo(
    () => picks.filter((p) => !pickedKeys.has(placeKey(p))),
    [picks, pickedKeys, placeKey]
  );

  const canOffer = eligible && hasProfile && picks.length > 0;

  const closePopup = useCallback(
    (opts = {}) => {
      const { persistHideForDay = false, explicitDismiss = true } = opts;
      if (persistHideForDay || hideForDay) {
        hideTodayTasteSuggestForDay();
        setHiddenForDay(true);
      } else if (explicitDismiss) {
        setUserDismissedModal(true);
      }
      setOpen(false);
      setHideForDay(false);
    },
    [hideForDay]
  );

  useEffect(() => {
    if (!canOffer) {
      setOpen(false);
      return;
    }
    if (hiddenForDay) return;
    if (pickedKeys.size > 0) return;
    if (wasTodayTasteSuggestAutoShownThisSession()) return;
    setOpen(true);
    markTodayTasteSuggestAutoShownThisSession();
  }, [canOffer, hiddenForDay, pickedKeys.size]);

  /** 취향 팝업에서 골랐다가 미리보기만 닫았을 때 — 나머지 장소 팝업 다시 */
  useEffect(() => {
    if (tastePreviewOpen) return;
    if (!canOffer || hiddenForDay || userDismissedModal) return;
    if (pickedKeys.size === 0 || unpicked.length === 0) return;
    setOpen(true);
  }, [
    tastePreviewOpen,
    canOffer,
    hiddenForDay,
    userDismissedModal,
    pickedKeys.size,
    unpicked.length,
  ]);

  const showEntryChip =
    canOffer &&
    !open &&
    !hiddenForDay &&
    userDismissedModal &&
    unpicked.length > 0;

  const handlePick = useCallback(
    (place) => {
      const key = placeKey(place);
      if (key) {
        setPickedKeys((prev) => {
          const next = new Set(prev);
          next.add(key);
          return next;
        });
      }
      setOpen(false);
      onPickPlace?.(place);
    },
    [onPickPlace, placeKey]
  );

  const openEntryModal = useCallback(() => {
    setUserDismissedModal(false);
    setOpen(true);
  }, []);

  useEffect(() => {
    if (typeof onEntryChipChange !== "function") return;
    onEntryChipChange(
      showEntryChip
        ? { visible: true, onOpen: openEntryModal }
        : { visible: false, onOpen: openEntryModal }
    );
  }, [showEntryChip, openEntryModal, onEntryChipChange]);

  useEffect(() => {
    if (typeof onEntryChipChange !== "function") return;
    return () => {
      onEntryChipChange({ visible: false, onOpen: () => {} });
    };
  }, [onEntryChipChange]);

  const listPlaces = unpicked.length > 0 ? unpicked : picks;
  const hasMoreAfterPick = pickedKeys.size > 0 && unpicked.length > 0;

  if (!canOffer && !open && !showEntryChip) return null;

  const modal =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            role="presentation"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 24800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px 16px",
              boxSizing: "border-box",
              backgroundColor: "rgba(0, 0, 0, 0.52)",
            }}
            onClick={() => closePopup({ persistHideForDay: hideForDay })}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="taste-today-title"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "min(400px, 100%)",
                maxHeight: "min(78vh, 520px)",
                overflowY: "auto",
                borderRadius: 20,
                padding: "20px 18px 16px",
                background: "linear-gradient(180deg, #f7f7f7 0%, #fff 100%)",
                border: "1px solid rgba(17, 17, 17, 0.12)",
                boxShadow: "0 24px 64px rgba(0, 0, 0, 0.28)",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 6,
                }}
              >
                <div>
                  <h2
                    id="taste-today-title"
                    style={{
                      margin: 0,
                      fontSize: 17,
                      fontWeight: 800,
                      color: "#111",
                      letterSpacing: "-0.03em",
                    }}
                  >
                    오늘 여기 어때요?
                  </h2>
                  <p
                    style={{
                      margin: "6px 0 0",
                      fontSize: 12,
                      color: "#6b7280",
                      lineHeight: 1.45,
                    }}
                  >
                    설문에 담은 취향으로 골랐어요.
                    {hasMoreAfterPick
                      ? ` · ${unpicked.length}곳 더`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="닫기"
                  onClick={() => closePopup({ persistHideForDay: hideForDay })}
                  style={{
                    flexShrink: 0,
                    width: 32,
                    height: 32,
                    border: "none",
                    borderRadius: 10,
                    background: "rgba(17, 17, 17, 0.08)",
                    color: "#111",
                    fontSize: 18,
                    lineHeight: 1,
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  margin: "14px 0 16px",
                }}
              >
                {listPlaces.map((place) => {
                  const name = String(
                    place?.name || place?.place_name || "장소"
                  ).trim();
                  return (
                    <button
                      key={String(place?.id ?? name)}
                      type="button"
                      onClick={() => handlePick(place)}
                      style={{
                        width: "100%",
                        padding: "12px 14px",
                        borderRadius: 14,
                        border: "1px solid rgba(17, 17, 17, 0.1)",
                        background: "#fff",
                        cursor: "pointer",
                        textAlign: "left",
                        boxSizing: "border-box",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#111",
                        }}
                      >
                        {name}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#6b7280",
                          marginTop: 3,
                          lineHeight: 1.35,
                        }}
                      >
                        {place?.address_name ||
                          place?.address ||
                          place?.category_name ||
                          "내 취향에 맞는 곳"}
                      </div>
                    </button>
                  );
                })}
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  color: "#4b5563",
                  cursor: "pointer",
                  marginBottom: 12,
                  userSelect: "none",
                }}
              >
                <input
                  type="checkbox"
                  checked={hideForDay}
                  onChange={(e) => setHideForDay(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "#111" }}
                />
                오늘 하루 안 보기
              </label>

              <button
                type="button"
                onClick={() => closePopup({ persistHideForDay: hideForDay })}
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  borderRadius: 12,
                  border: "none",
                  background: "#111",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                닫기
              </button>
            </div>
          </div>,
          document.body
        )
      : null;

  return modal;
}
