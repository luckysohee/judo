import normalizeText from "./normalizeText";

export function levenshteinDistance(a = "", b = "") {
  const s = normalizeText(a);
  const t = normalizeText(b);

  if (!s && !t) return 0;
  if (!s) return t.length;
  if (!t) return s.length;

  const rows = s.length + 1;
  const cols = t.length + 1;

  const dp = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) dp[i][0] = i;
  for (let j = 0; j < cols; j += 1) dp[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;

      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[s.length][t.length];
}

export function isFuzzyMatch(query = "", target = "") {
  const q = normalizeText(query);
  const t = normalizeText(target);

  if (!q || !t) return false;

  if (t.includes(q) || q.includes(t)) return true;

  const distance = levenshteinDistance(q, t);

  if (q.length <= 4) return distance <= 1;
  return distance <= 2;
}