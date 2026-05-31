import { homeSearchOverlayStyles as s } from "./homeSearchOverlayStyles";

/**
 * 검색 히스토리·카카오 제안 행 왼쪽 아이콘 (네이버 지도식).
 * 저장(픽)된 장소: 폴더 색 원 + ★, 그 외: 회색 원 + 📍
 */
export default function HomeSearchListLeadingIcon({
  pickBadge = null,
  defaultPin = true,
}) {
  if (pickBadge?.isSaved) {
    return (
      <span
        style={s.pickBadgeCircle(pickBadge.folderColor)}
        aria-hidden
        title="저장한 장소"
      >
        ★
      </span>
    );
  }

  if (!defaultPin) return null;

  return (
    <span style={s.pinBadgeCircle} aria-hidden>
      📍
    </span>
  );
}
