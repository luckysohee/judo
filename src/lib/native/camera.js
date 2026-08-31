import { isNativePlatform } from "./platform";

/**
 * 네이티브 카메라/갤러리 → File 객체 (웹은 null → 호출측 input 사용).
 * @param {'camera'|'photos'} [source]
 * @returns {Promise<File|null>}
 */
export async function pickImageFile(source = "photos") {
  if (!isNativePlatform()) return null;

  try {
    const { Camera, CameraResultType, CameraSource } = await import(
      "@capacitor/camera"
    );
    const photo = await Camera.getPhoto({
      quality: 85,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: source === "camera" ? CameraSource.Camera : CameraSource.Photos,
    });

    const path = photo?.webPath || photo?.path;
    if (!path) return null;

    const res = await fetch(path);
    const blob = await res.blob();
    const ext = (photo.format || "jpeg").replace(/^\./, "") || "jpeg";
    const mime = blob.type || `image/${ext === "jpg" ? "jpeg" : ext}`;
    return new File([blob], `judo-photo-${Date.now()}.${ext}`, { type: mime });
  } catch (e) {
    if (e && /cancel|abort|user/i.test(String(e.message || e))) {
      return null;
    }
    if (import.meta.env.DEV) {
      console.warn("[native/camera]", e);
    }
    return null;
  }
}
