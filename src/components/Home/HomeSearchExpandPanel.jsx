import { styles } from "../../pages/Home/homeStyles";

/**
 * 검색 결과가 없거나 빈약할 때 노출되는 「조건 완화 제안」 패널.
 *
 * - `data.headline / dataNote / subline`: 패널 헤더 영역
 * - `data.fallbackHints`: 완화 아이디어 리스트
 * - `data.quickBroadenQuery / quickBroadenLabel`: 한 번에 넓게 다시 검색하기 버튼
 * - `data.suggestions`: 칩 형태로 노출되는 추가 제안들
 *
 * 핍하기 / 닫기 시 호출자가 `setSearchExpandUX(null)`로 비우고 필요 시 검색을 재호출.
 *
 * @param {{
 *   data: any,
 *   onPick: (query: string) => void,
 *   onDismiss: () => void,
 * }} props
 */
export default function HomeSearchExpandPanel({ data, onPick, onDismiss }) {
  if (!data) return null;

  const fallbackHints = Array.isArray(data.fallbackHints)
    ? data.fallbackHints
    : [];
  const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];

  return (
    <div style={styles.expandSearchWrap} role="region" aria-label="검색 확장 제안">
      <div style={styles.expandSearchCard}>
        <div style={styles.expandSearchTitle}>{data.headline}</div>
        <p style={styles.expandSearchNote}>{data.dataNote}</p>
        <p style={styles.expandSearchSub}>{data.subline}</p>
        {fallbackHints.length > 0 ? (
          <ul style={styles.expandFallbackHints} aria-label="조건 완화 아이디어">
            {fallbackHints.map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        ) : null}
        {data.quickBroadenQuery ? (
          <button
            type="button"
            style={styles.expandPrimaryBtn}
            onClick={() => onPick(data.quickBroadenQuery)}
          >
            {data.quickBroadenLabel ||
              `한 번에 넓게 «${data.quickBroadenQuery}»로 찾기`}
          </button>
        ) : null}
        <div style={styles.expandChipCol}>
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              style={styles.expandChip}
              onClick={() => onPick(s.query)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          style={styles.expandDismiss}
          onClick={onDismiss}
        >
          닫기
        </button>
      </div>
    </div>
  );
}
