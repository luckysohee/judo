export default function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[_\s-]+/g, "")
    .trim();
}