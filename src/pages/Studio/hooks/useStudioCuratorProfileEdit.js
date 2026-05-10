import { supabase } from "../../../lib/supabase";
import { uploadCuratorProfileAvatarFile } from "../../../utils/curatorPlacePhotos";
import { isAcceptableRasterImageFile } from "../../../utils/prepareImageFileForUpload";
import { isUsernameChangeCooldownError } from "../../../utils/usernameCooldown";
import {
  devLog,
  persistCuratorProfileImageToSupabase,
} from "../studioHomeModule.js";

const validateUsername = (username) => /^[a-z0-9_]+$/.test(username);

const generateUsername = (name) => {
  const baseName = name
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 10);
  const randomNum = Math.floor(Math.random() * 1000);
  return `${baseName}_${randomNum}`;
};

/**
 * 큐레이터 프로필 편집 핸들러 묶음 — 보기/편집 토글, 저장(supabase upsert),
 * 핸들 자동생성/수동입력 검증, 아바타 업로드(스토리지 + curators.image + auth metadata).
 */
export function useStudioCuratorProfileEdit({
  user,
  showToast,
  curatorProfile,
  setCuratorProfile,
  editProfile,
  setEditProfile,
  setIsEditingProfile,
  setUsernameError,
}) {
  const handleEditProfile = () => {
    setIsEditingProfile(true);
    setEditProfile({
      name: curatorProfile.displayName || curatorProfile.username,
      username: curatorProfile.username,
      displayName: curatorProfile.displayName,
      bio: curatorProfile.bio || "",
      image: curatorProfile.image || "",
    });
    setUsernameError("");
  };

  const handleSaveProfile = async () => {
    try {
      if (!user?.id) {
        alert("로그인이 필요합니다.");
        return;
      }

      if (editProfile.username !== curatorProfile.username) {
        devLog("username 중복 확인 필요:", editProfile.username);
      }

      const profileData = {
        user_id: user.id,
        username: editProfile.username,
        slug: editProfile.username,
        name: editProfile.displayName || editProfile.username,
        display_name: editProfile.displayName,
        bio: editProfile.bio,
        image: editProfile.image || null,
        updated_at: new Date().toISOString(),
      };

      devLog("📝 프로필 DB 저장:", profileData);

      const { data, error } = await supabase
        .from("curators")
        .upsert([profileData], { onConflict: "user_id" })
        .select("username_changed_at");

      if (error) {
        console.error("❌ 프로필 저장 오류:", error);
        if (isUsernameChangeCooldownError(error)) {
          alert(
            error.message ||
              "핸들(@고유이름)은 14일에 한 번만 바꿀 수 있습니다."
          );
        } else {
          alert("프로필 저장에 실패했습니다: " + error.message);
        }
        return;
      }

      devLog("✅ 프로필 DB 저장 성공:", data);

      setCuratorProfile((prev) => ({
        ...prev,
        name: editProfile.displayName || editProfile.username,
        username: editProfile.username,
        displayName: editProfile.displayName,
        bio: editProfile.bio,
        image: editProfile.image,
        username_changed_at:
          data?.[0]?.username_changed_at ?? prev.username_changed_at,
      }));

      setIsEditingProfile(false);
      setUsernameError("");
      devLog("프로필 업데이트 완료:", editProfile);
      alert("프로필이 성공적으로 저장되었습니다!");
    } catch (error) {
      console.error("❌ 프로필 저장 오류:", error);
      alert("프로필 저장에 실패했습니다: " + error.message);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingProfile(false);
    setEditProfile({
      name: "",
      username: "",
      displayName: "",
      bio: "",
      image: "",
    });
    setUsernameError("");
  };

  const handleUsernameChange = (value) => {
    const cleanUsername = value.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setEditProfile((prev) => ({ ...prev, username: cleanUsername }));

    if (cleanUsername && !validateUsername(cleanUsername)) {
      setUsernameError("영문 소문자, 숫자, 언더스코어만 사용 가능합니다.");
    } else if (cleanUsername && cleanUsername.length < 3) {
      setUsernameError("최소 3자 이상 입력해주세요.");
    } else if (cleanUsername && cleanUsername.length > 20) {
      setUsernameError("최대 20자까지 가능합니다.");
    } else {
      setUsernameError("");
    }
  };

  const handleUpdateUsername = () => {
    const base =
      curatorProfile.displayName ||
      curatorProfile.username ||
      curatorProfile.name ||
      "curator";
    const newUsername = generateUsername(base);
    setEditProfile((prev) => ({ ...prev, username: newUsername }));
    setUsernameError("");
    devLog("자동 username 생성:", newUsername);
  };

  const handleProfileEditAvatarFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!isAcceptableRasterImageFile(file)) {
      showToast("이미지 파일만 업로드할 수 있어요.", "info", 3200);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast("파일은 5MB 이하 이미지만 업로드할 수 있어요.", "info", 3200);
      return;
    }
    try {
      if (!user?.id) {
        showToast("로그인이 필요합니다.", "info", 3000);
        return;
      }
      const publicUrl = await uploadCuratorProfileAvatarFile(file, user.id);
      const { ok, error: saveErr } = await persistCuratorProfileImageToSupabase(
        supabase,
        user.id,
        publicUrl
      );
      if (!ok) {
        console.error("프로필 사진 저장 오류:", saveErr);
        showToast(
          "사진 주소 저장에 실패했습니다: " +
            (saveErr?.message || "알 수 없는 오류"),
          "info",
          4000
        );
        return;
      }
      await supabase.auth
        .updateUser({
          data: {
            image: publicUrl,
            avatar_url: publicUrl,
            picture: publicUrl,
          },
        })
        .catch(() => {});
      setEditProfile((prev) => ({ ...prev, image: publicUrl }));
      setCuratorProfile((prev) =>
        prev ? { ...prev, image: publicUrl } : prev
      );
      showToast("프로필 사진을 저장했어요.", "success", 2500);
    } catch (err) {
      console.error(err);
      showToast(err?.message || "사진 저장 중 오류가 났어요.", "info", 4000);
    }
  };

  return {
    handleEditProfile,
    handleSaveProfile,
    handleCancelEdit,
    handleUsernameChange,
    handleUpdateUsername,
    handleProfileEditAvatarFile,
  };
}
