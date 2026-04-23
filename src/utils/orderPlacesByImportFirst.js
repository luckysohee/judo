function norm(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase();
}

function nameMatch(a, b) {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

/**
 * 카카오 등 지도 후보를 `place_import_tmp` /recommend `places` 순서에 맞춤.
 * import 이름과 매칭되는 항목을 앞으로, 나머지는 뒤에 유지.
 */
export function orderPlacesByImportFirst(mapPlaces, importPlaces) {
  if (!Array.isArray(mapPlaces) || mapPlaces.length === 0) return mapPlaces;
  if (!Array.isArray(importPlaces) || importPlaces.length === 0) {
    return mapPlaces;
  }
  const out = [];
  const used = new Set();
  for (const ip of importPlaces) {
    const inm = String(ip?.name || ip?.place_name || "").trim();
    if (!inm) continue;
    const hit = mapPlaces.find((sp) => {
      const id = String(sp?.id ?? "");
      if (!id || used.has(id)) return false;
      return nameMatch(sp?.name || sp?.place_name, inm);
    });
    if (hit) {
      out.push(hit);
      used.add(String(hit.id));
    }
  }
  for (const sp of mapPlaces) {
    const id = String(sp?.id ?? "");
    if (!id || used.has(id)) continue;
    out.push(sp);
  }
  return out.length > 0 ? out : mapPlaces;
}
