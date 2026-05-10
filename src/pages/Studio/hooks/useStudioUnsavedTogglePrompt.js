import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { devLog } from "../studioHomeModule.js";

/**
 * 「잔 리스트」에서 공개/비공개 토글을 누르면 변경된 행이 메모리에만 반영된다.
 * 다른 섹션으로 이동할 때 미저장 변경이 있으면 confirm으로 저장 여부를 묻고,
 * 「확인」이면 `curator_places.is_archived`에 반영, 「취소」면 원본 `is_public`으로 되돌린다.
 *
 * setter 두 개(`setHasUnsavedChanges`, `setOriginalPlaceBeforeChange`)는 잔 리스트 토글
 * 플로우(`useStudioPlaceActions.handleTogglePublic`)에서도 호출하므로 외부로 노출한다.
 */
export function useStudioUnsavedTogglePrompt({
  user,
  activeSection,
  myPlaces,
  setMyPlaces,
}) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [previousSection, setPreviousSection] = useState("archive");
  const [originalPlaceBeforeChange, setOriginalPlaceBeforeChange] =
    useState(null);

  useEffect(() => {
    const saveToDatabase = async (updatedPlace) => {
      try {
        if (!user?.id) {
          alert("로그인이 필요합니다.");
          return;
        }
        devLog("💾 curator_places 테이블 업데이트 시도:", updatedPlace.id);

        const isArchived = !updatedPlace.is_public;

        const { error } = await supabase
          .from("curator_places")
          .update({ is_archived: isArchived })
          .eq("place_id", updatedPlace.id)
          .eq("curator_id", user.id);

        if (error) {
          console.error("❌ curator_places 저장 오류:", error);
          alert("저장에 실패했습니다: " + error.message);
        } else {
          devLog("✅ curator_places 저장 성공:", {
            placeId: updatedPlace.id,
            is_archived: isArchived,
          });
          alert("공개/비공개 상태가 저장되었습니다!");
        }
      } catch (error) {
        console.error("❌ 저장 중 오류:", error);
        alert("저장에 실패했습니다: " + error.message);
      }
    };

    const handleSectionChange = async () => {
      if (activeSection !== previousSection && hasUnsavedChanges) {
        const shouldSave = window.confirm(
          "공개/비공개 상태 변경사항이 있습니다. 저장하시겠습니까?\n\n확인: 저장하기\n취소: 저장하지 않음"
        );

        if (shouldSave) {
          devLog("✅ 저장 선택 - DB 저장 시작");
          if (originalPlaceBeforeChange) {
            const updatedPlace = myPlaces.find(
              (p) => p.id === originalPlaceBeforeChange.id
            );
            if (updatedPlace) {
              await saveToDatabase(updatedPlace);
              devLog("✅ 저장 완료 - 상태 초기화");
            }
          }
        } else {
          devLog("❌ 저장 안 함 선택 - 원상복구");
          if (originalPlaceBeforeChange) {
            setMyPlaces((prevPlaces) =>
              prevPlaces.map((place) =>
                place.id === originalPlaceBeforeChange.id
                  ? { ...place, is_public: originalPlaceBeforeChange.is_public }
                  : place
              )
            );
            devLog("🔄 원상복구 완료:", originalPlaceBeforeChange);
          }
        }

        setHasUnsavedChanges(false);
        setOriginalPlaceBeforeChange(null);
      }

      setPreviousSection(activeSection);
    };

    handleSectionChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- myPlaces/saveToDatabase 넣으면 저장 플로우 중 무한 재실행 위험
  }, [activeSection, hasUnsavedChanges, previousSection, originalPlaceBeforeChange]);

  return {
    setHasUnsavedChanges,
    setOriginalPlaceBeforeChange,
  };
}
