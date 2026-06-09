/**
 * 지도 bbox·줌에 맞는 그리드 셀 크기(도 단위).
 * @param {number} level Kakao map level (클수록 줌 아웃)
 */
export function computeDensityGridCellSize(level, south, west, north, east) {
  const latSpan = Math.abs(north - south);
  const lngSpan = Math.abs(east - west);
  const lv = Number.isFinite(level) ? Math.floor(level) : 8;
  const span = Math.max(latSpan, lngSpan, 0.004);

  const targetSide =
    lv >= 11 ? 3.8 : lv >= 10 ? 4.2 : lv >= 9 ? 4.8 : lv >= 8 ? 5.4 : lv >= 7 ? 6.0 : lv >= 6 ? 6.8 : 7.5;

  let cell = span / targetSide;

  const minByLevel =
    lv >= 11
      ? 0.04
      : lv >= 10
        ? 0.028
        : lv >= 9
          ? 0.018
          : lv >= 8
            ? 0.011
            : lv >= 7
              ? 0.007
              : lv >= 6
                ? 0.0045
                : 0.003;

  const maxByLevel = lv >= 10 ? 0.14 : lv >= 8 ? 0.09 : 0.06;

  cell = Math.max(minByLevel, Math.min(maxByLevel, cell));
  return cell;
}
