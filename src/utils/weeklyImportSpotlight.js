/**
 * 주간 배치 `place_import_tmp` 구간(지역×노포/와인바) — 검색과 분리된 홈 스포트라이트용.
 * 서버 `/recommend?q=…`와 동일 계약.
 */
export const WEEKLY_IMPORT_SPOTLIGHT_CONFIG = [
  { query: "성수 노포", label: "성수 · 노포" },
  { query: "성수 와인바", label: "성수 · 와인바" },
  { query: "합정 노포", label: "합정 · 노포" },
  { query: "합정 와인바", label: "합정 · 와인바" },
  { query: "압구정 노포", label: "압구정 · 노포" },
  { query: "압구정 와인바", label: "압구정 · 와인바" },
  { query: "을지로 노포", label: "을지로 · 노포" },
  { query: "을지로 와인바", label: "을지로 · 와인바" },
];

function cleanStoreNameCandidate(v) {
  const s0 = String(v || "").trim();
  if (!s0) return "";
  return s0
    .replace(/\*\*/g, "")
    .replace(/^["'`]|["'`]$/g, "")
    .replace(/^첫\s*번째(?:는)?\s*/i, "")
    .replace(/^두\s*번째(?:는)?\s*/i, "")
    .replace(/^세\s*번째(?:는)?\s*/i, "")
    .replace(/\s*입니다\.?$/i, "")
    .replace(/\s*이에요\.?$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function looksNarrativeName(s) {
  return /추천|분위기|좋은|가볼만|첫\s*번째|두\s*번째|세\s*번째|입니다|이에요|주세요|찾아|골라|\*\*|좋다면|같다면|한다면|하면|라면|라고|으로|에서|까지/i.test(
    s
  );
}

function isLikelyBusinessName(s) {
  const t = String(s || "").trim();
  if (!t || t.length < 2 || t.length > 28) return false;
  if (/[.!?]/.test(t)) return false;
  if (/(첫\s*번째|두\s*번째|세\s*번째|추천|분위기|좋은\s*곳|가볼만|해요|입니다|이에요)/.test(t)) {
    return false;
  }
  // 조사·접속형 어미로 끝나는 문장 토큰 차단 (상호보다 문장일 확률 높음)
  if (/(다면|하면|같으면|라고|으로|에서|까지|네요|군요)$/.test(t)) {
    return false;
  }
  return true;
}

function extractStoreNameFromReasonText(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  const bold = s.match(/\*\*([^*]{2,40})\*\*/);
  if (bold?.[1]) return cleanStoreNameCandidate(bold[1]);
  const first = s.match(/^([^,.\n]{2,40})(?:[은는이가]\s|[,\.\n]|$)/);
  if (first?.[1]) return cleanStoreNameCandidate(first[1]);
  return "";
}

function pickStrictStoreName(place) {
  if (!place || typeof place !== "object") return "";
  const priorityKeys = [
    "place_name",
    "official_name",
    "business_name",
    "store_name",
    "name",
    "title",
  ];
  const cleaned = priorityKeys
    .map((k) => cleanStoreNameCandidate(place[k]))
    .filter(Boolean);
  if (!cleaned.length) return "";
  const strict = cleaned.find((x) => !looksNarrativeName(x));
  if (strict && isLikelyBusinessName(strict)) return strict;
  const strictAny = cleaned.find((x) => isLikelyBusinessName(x));
  if (strictAny) return strictAny;
  const fromReason = extractStoreNameFromReasonText(
    place.reason || place.reasonShort || ""
  );
  if (fromReason && !looksNarrativeName(fromReason) && isLikelyBusinessName(fromReason)) {
    return fromReason;
  }
  return "";
}

function pickBestSpotlightPlace(places) {
  const arr = Array.isArray(places) ? places : [];
  for (const p of arr) {
    const nm = pickStrictStoreName(p);
    if (!nm) continue;
    const reason = String(p?.reason || "").trim();
    const score =
      (reason.includes(nm) ? 6 : 0) +
      (reason.length >= 10 ? 2 : 0) +
      (String(p?.signals || "").length > 0 ? 1 : 0);
    return { place: p, storeName: nm, score };
  }
  return { place: null, storeName: "", score: 0 };
}

/**
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array<{ label: string, query: string, summary: string, storeName: string, headline: string, subline: string, sourceKey: string, timestamp: string, timestampMs: number, updatedAt: string, updatedAtMs: number, place: object | null }>>}
 */
export async function fetchWeeklyImportSpotlightSlots(signal) {
  const settled = await Promise.all(
    WEEKLY_IMPORT_SPOTLIGHT_CONFIG.map(async ({ query, label }) => {
      try {
        const res = await fetch(
          `/recommend?q=${encodeURIComponent(query)}`,
          { signal }
        );
        let data = null;
        try {
          data = await res.json();
        } catch {
          data = null;
        }
        if (!res.ok || !data?.ok || !Array.isArray(data.places)) return null;
        const best = pickBestSpotlightPlace(data.places);
        const p0 = best.place;
        const storeName = best.storeName;
        if (!storeName) return null;
        const reason = p0 && String(p0.reason || "").trim();
        const sum = String(data.summary || "").trim().replace(/\s+/g, " ");
        const subline = (reason || sum).slice(0, 140);
        const sourceKey = String(
          data.source_key || p0?.source_key || p0?.sourceKey || ""
        ).trim();
        const timestampRaw = String(
          data.timestamp || p0?.timestamp || p0?.collected_at || ""
        ).trim();
        const timestampMs = Date.parse(timestampRaw);
        const updatedAtRaw = String(
          data.updated_at ||
            timestampRaw ||
            p0?.updated_at ||
            p0?.created_at ||
            ""
        ).trim();
        const updatedAtMs = Date.parse(updatedAtRaw);
        return {
          label,
          query,
          summary: sum,
          storeName,
          headline: storeName,
          subline: subline || "이번 주 정리된 한 줄이에요.",
          sourceKey,
          timestamp: timestampRaw,
          timestampMs: Number.isFinite(timestampMs) ? timestampMs : 0,
          updatedAt: updatedAtRaw,
          updatedAtMs: Number.isFinite(updatedAtMs) ? updatedAtMs : 0,
          place: p0 && typeof p0 === "object" ? p0 : null,
        };
      } catch {
        return null;
      }
    })
  );
  return settled.filter(Boolean);
}
