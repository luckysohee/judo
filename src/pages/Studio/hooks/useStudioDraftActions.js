import { filterPlaceTagsForDisplay } from "../../../utils/placeUiTags";
import {
  readStudioDrafts,
  writeStudioDrafts,
} from "../../../utils/studioDraftsLocal";
import { devLog } from "../studioHomeModule.js";

/**
 * 「잔 채우기」 임시저장(localStorage `studio_drafts`) 카드의 수정·삭제 핸들러.
 *
 * `handleEditDraft`은 잔 올리기 폼으로 이동해 임시저장 내용을 채워 넣는다 — 잔 리스트에서
 * 연 「장소 수정」 상태가 남아 있으면 임시저장 시 잘못된 행이 지워지거나 중복 저장되므로
 * `editingPlaceId`를 함께 비운다.
 */
export function useStudioDraftActions({
  user,
  setMapCenter,
  setActiveSection,
  setEditingPlaceId,
  setEditingDraftId,
  setFormData,
  setDrafts,
}) {
  const handleEditDraft = (draft) => {
    devLog("Edit draft:", draft);
    devLog("🔍 임시저장된 데이터 상세:", {
      name_address: draft.basicInfo?.name_address,
      category: draft.basicInfo?.category,
      alcohol_type: draft.alcohol_type,
      atmosphere: draft.atmosphere,
      latitude: draft.latitude,
      longitude: draft.longitude,
      is_public: draft.publishInfo?.is_public,
    });

    if (draft.latitude && draft.longitude) {
      setMapCenter({ lat: draft.latitude, lng: draft.longitude });
      devLog("🗺️ 지도 중심 설정:", {
        lat: draft.latitude,
        lng: draft.longitude,
      });
    }

    setActiveSection("add");

    setEditingPlaceId(null);
    try {
      localStorage.removeItem("editing_place_id");
    } catch {
      /* ignore */
    }

    setEditingDraftId(draft.id);

    setTimeout(() => {
      const nameInput = document.querySelector('input[type="text"]');
      const categorySelect = document.querySelector("select");
      const alcoholSelect = document.querySelectorAll("select")[1];
      const atmosphereSelect = document.querySelectorAll("select")[2];
      const reasonTextarea = document.querySelector("textarea");

      if (nameInput) nameInput.value = draft.basicInfo?.name_address || "";
      if (categorySelect) categorySelect.value = draft.basicInfo?.category || "";
      if (alcoholSelect) alcoholSelect.value = draft.alcohol_type || "";
      if (atmosphereSelect) atmosphereSelect.value = draft.atmosphere || "";
      if (reasonTextarea) reasonTextarea.value = draft.menu_reason || "";

      setFormData({
        name_address: draft.basicInfo?.name_address || "",
        category: draft.basicInfo?.category || "",
        alcohol_type: draft.alcohol_type || "",
        atmosphere: draft.atmosphere || "",
        recommended_menu: draft.recommended_menu || "",
        menu_reason: draft.menu_reason || "",
        tags: filterPlaceTagsForDisplay(draft.tags || []),
        latitude: draft.latitude || null,
        longitude: draft.longitude || null,
        is_public: draft.publishInfo?.is_public || true,
      });

      devLog("✅ 직접 폼 필드에 값 설정 완료");
    }, 200);
  };

  const handleDeleteDraft = (draftId) => {
    devLog("Delete draft:", draftId);

    const draftOwnerId = user?.id ?? null;
    const existingDrafts = readStudioDrafts(draftOwnerId);
    const updatedDrafts = existingDrafts.filter(
      (draft) => draft.id !== draftId
    );
    writeStudioDrafts(draftOwnerId, updatedDrafts);

    setDrafts((prev) => prev.filter((draft) => draft.id !== draftId));
    devLog("🗑️ 임시저장 삭제 완료 (localStorage):", draftId);
  };

  return { handleEditDraft, handleDeleteDraft };
}
