const HEIC_MIMES = new Set(["image/heic", "image/heif"]);

/**
 * 큐레이터 사진 등: 브라우저·img 호환을 위해 HEIC/HEIF는 JPEG로 바꿔 업로드한다.
 * iOS 등에서 MIME이 비어 있어도 확장자로 판별한다.
 */
export function isAcceptableRasterImageFile(file) {
  if (!file) return false;
  const t = (file.type || "").toLowerCase();
  if (t.startsWith("image/")) return true;
  const n = (file.name || "").toLowerCase();
  return n.endsWith(".heic") || n.endsWith(".heif");
}

function isHeicLike(file) {
  const t = (file.type || "").toLowerCase();
  if (HEIC_MIMES.has(t)) return true;
  const n = (file.name || "").toLowerCase();
  return n.endsWith(".heic") || n.endsWith(".heif");
}

export async function prepareImageFileForUpload(file) {
  if (!isHeicLike(file)) return file;
  const { default: heic2any } = await import("heic2any");
  let result;
  try {
    result = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.92,
    });
  } catch (e) {
    throw new Error(
      e?.message ||
        "HEIC 사진을 변환하지 못했습니다. JPEG 또는 PNG로 올려 주세요."
    );
  }
  const blob = Array.isArray(result) ? result[0] : result;
  if (!blob) {
    throw new Error("HEIC 변환 결과가 없습니다.");
  }
  const stem = (file.name || "photo").replace(/\.(heic|heif)$/i, "");
  return new File([blob], `${stem}.jpg`, { type: "image/jpeg" });
}
