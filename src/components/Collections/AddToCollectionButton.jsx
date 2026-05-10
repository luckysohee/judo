import { useCallback, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../Toast/ToastProvider";
import AddToCollectionSheet from "./AddToCollectionSheet";

/**
 * 장소 카드/상세에 다는 "컬렉션에 추가" 버튼.
 *
 * 카드 등 다양한 자리에 들어갈 수 있도록 모양은 prop 으로 갈아끼울 수 있고,
 * 시트 자체는 클릭 시점에 마운트해 초기 비용을 줄인다.
 *
 * @param {{
 *   place: object,
 *   variant?: 'pill' | 'darkRow' | 'iconText',
 *   className?: string,
 *   style?: object,
 *   label?: string,
 * }} props
 */
export default function AddToCollectionButton({
  place,
  variant = "pill",
  className,
  style,
  label = "컬렉션에 추가",
}) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);

  const handleClick = useCallback(
    (e) => {
      e?.stopPropagation?.();
      if (!place || typeof place !== "object") {
        showToast("장소 정보를 확인할 수 없어요.", "error", 3000);
        return;
      }
      if (!user?.id) {
        showToast("컬렉션에 담으려면 로그인해주세요.", "info", 3000);
        return;
      }
      setOpen(true);
    },
    [place, user?.id, showToast],
  );

  const baseStyle = VARIANT_STYLES[variant] || VARIANT_STYLES.pill;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={className}
        style={{ ...baseStyle, ...style }}
        aria-label={label}
        title={label}
      >
        <span aria-hidden="true" style={iconStyle}>＋</span>
        {label}
      </button>
      {open ? (
        <AddToCollectionSheet
          place={place}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

const iconStyle = {
  display: "inline-block",
  marginRight: 6,
  fontWeight: 800,
  transform: "translateY(-0.5px)",
};

const VARIANT_STYLES = {
  pill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
    border: "1px solid rgba(46,204,113,0.45)",
    background: "rgba(46,204,113,0.12)",
    color: "#9ad3a4",
    borderRadius: 999,
    padding: "8px 14px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  darkRow: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    minHeight: 44,
    border: "1px solid rgba(46,204,113,0.45)",
    background: "rgba(46,204,113,0.12)",
    color: "#9ad3a4",
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  iconText: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    background: "transparent",
    color: "#9ad3a4",
    padding: "6px 8px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
};
