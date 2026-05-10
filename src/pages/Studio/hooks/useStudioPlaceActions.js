import { supabase } from "../../../lib/supabase";
import { uploadCuratorPlacePhoto } from "../../../utils/curatorPlacePhotos";
import {
  isAcceptableRasterImageFile,
  prepareImageFileForUpload,
} from "../../../utils/prepareImageFileForUpload";
import { filterPlaceTagsForDisplay } from "../../../utils/placeUiTags";
import { normalizeStudioPlaceCategory } from "../../../utils/placeTaxonomy.js";
import { readStudioDrafts, writeStudioDrafts } from "../../../utils/studioDraftsLocal";
import {
  devLog,
  devWarn,
  parseDbStringArray,
  upsertCuratorPlaceForStudio,
} from "../studioHomeModule.js";

/**
 * 스튜디오 「잔 올리기 / 수정 / 삭제 / 공개·비공개 토글」 핸들러 묶음.
 *
 * deps 객체로 부모 state/setter/외부 훅 결과를 받는다. 핸들러들은 부모 컴포넌트가
 * 직접 정의했을 때와 동일하게 매 렌더 새 함수로 만들어진다 (메모이제이션 X).
 */
export function useStudioPlaceActions({
  user,
  showToast,
  formData,
  setFormData,
  editingDraftId,
  setEditingDraftId,
  editingPlaceId,
  setEditingPlaceId,
  skipAddSectionResetRef,
  myPlaces,
  setMyPlaces,
  setDrafts,
  addPlaceSelectedFolders,
  setAddPlaceSelectedFolders,
  addPlacePhotoFiles,
  setAddPlacePhotoFiles,
  setAddPlaceShowNewFolder,
  setAddPlaceNewFolderName,
  setSearchedPlaces,
  setMapCenter,
  setActiveSection,
  setHasUnsavedChanges,
  setOriginalPlaceBeforeChange,
  loadCuratorStats,
  loadSavedFolders,
  persistUserSavedPlaceFolders,
}) {
  const checkDuplicatePlace = (placeName) => {
    const currentEditingId =
      editingPlaceId || localStorage.getItem("editing_place_id");
    if (currentEditingId) {
      devLog("✏️ 수정 모드: 중복 확인 건너뛰기", {
        editingPlaceId,
        localStorageId: localStorage.getItem("editing_place_id"),
      });
      return false;
    }

    const duplicate = myPlaces.find(
      (place) =>
        place.name.toLowerCase().trim() === placeName.toLowerCase().trim()
    );

    if (duplicate) {
      devLog("⚠️ 중복된 장소 (내 장소):", duplicate.name);
      alert("이미 저장된 장소입니다.");
      return true;
    }

    return false;
  };

  const handleAddPlace = async (isDraft = false) => {
    try {
      const draftIdPublishedFrom = editingDraftId;
      const removePublishedDraft = () => {
        if (!draftIdPublishedFrom) return;
        try {
          const draftOwnerId = user?.id ?? null;
          const existingDrafts = readStudioDrafts(draftOwnerId);
          const nextDrafts = existingDrafts.filter(
            (d) => String(d.id) !== String(draftIdPublishedFrom)
          );
          writeStudioDrafts(draftOwnerId, nextDrafts);
          setDrafts(nextDrafts);
        } catch (e) {
          devWarn("studio_drafts 정리(잔 올리기 저장 후):", e);
        }
        setEditingDraftId(null);
      };

      if (!formData.name_address || !formData.latitude || !formData.longitude) {
        alert("장소 이름과 위치를 선택해주세요.");
        return;
      }

      const duplicateCheck = checkDuplicatePlace(formData.name_address);
      if (duplicateCheck) {
        return;
      }

      devLog("🔍 StudioHome 저장 시작:", { ...formData, isDraft });

      if (!isDraft) {
        devLog("📝 새 장소 저장 모드 (다른 큐레이터 장소도 저장 가능)");
        if (!user) {
          alert("로그인이 필요합니다.");
          return;
        }

        const effectiveEditPlaceId =
          editingPlaceId ||
          (typeof localStorage !== "undefined"
            ? localStorage.getItem("editing_place_id")
            : null);

        if (!effectiveEditPlaceId && addPlaceSelectedFolders.length === 0) {
          alert("내 저장 폴더를 1개 이상 선택해주세요.");
          return;
        }

        if (effectiveEditPlaceId) {
          const updateData = {
            name: formData.name_address,
            address: formData.name_address,
            lat: formData.latitude,
            lng: formData.longitude,
            category:
              normalizeStudioPlaceCategory(formData.category || "") ||
              "미분류",
            kakao_place_id: formData.kakao_place_id || null,
          };

          const updatePayload = { ...updateData };
          const editKakaoId = formData.kakao_place_id
            ? String(formData.kakao_place_id).trim()
            : "";
          if (editKakaoId) {
            const { data: kakaoConflict, error: kakaoConflictErr } =
              await supabase
                .from("places")
                .select("id, name")
                .eq("kakao_place_id", editKakaoId)
                .neq("id", effectiveEditPlaceId)
                .limit(1);
            if (kakaoConflictErr) {
              devWarn("kakao_place_id 충돌 조회:", kakaoConflictErr);
            } else if (kakaoConflict?.length) {
              const other = kakaoConflict[0];
              delete updatePayload.kakao_place_id;
              showToast(
                `카카오 ID(${editKakaoId})는 다른 장소「${other.name || "이름 없음"}」에서 쓰는 값이라, 이번 저장에서는 카카오 필드만 빼고 나머지를 반영할게요.`,
                "info",
                6200
              );
            }
          }

          devLog("📝 수정할 데이터:", updatePayload);

          let { data, error } = await supabase
            .from("places")
            .update(updatePayload)
            .eq("id", effectiveEditPlaceId)
            .select();

          const dupKakao =
            error &&
            (error.code === "23505" ||
              String(error.message || "").includes("unique_kakao_place_id"));
          if (error && dupKakao && "kakao_place_id" in updatePayload) {
            const retryPayload = { ...updatePayload };
            delete retryPayload.kakao_place_id;
            const second = await supabase
              .from("places")
              .update(retryPayload)
              .eq("id", effectiveEditPlaceId)
              .select();
            data = second.data;
            error = second.error;
            if (!error) {
              showToast(
                "카카오 장소 ID는 DB에서 겹쳐 저장하지 못했어요. 이름·위치·분류 등 나머지는 저장했어요.",
                "info",
                5500
              );
            }
          }

          if (error) {
            console.error("❌ 장소 수정 오류:", error);
            console.error("❌ 에러 상세:", error.message, error.code, error.details);
            alert(`장소 수정에 실패했습니다: ${error.message}`);
            return;
          }

          devLog("✅ 장소 수정 성공:", data);

          const savedRow = Array.isArray(data) && data[0] ? data[0] : null;
          const basisForList = savedRow
            ? {
                name: savedRow.name,
                address: savedRow.address,
                lat: savedRow.lat,
                lng: savedRow.lng,
                latitude: savedRow.lat,
                longitude: savedRow.lng,
                category: savedRow.category,
                kakao_place_id: savedRow.kakao_place_id ?? null,
              }
            : {
                ...updatePayload,
                latitude: updatePayload.lat,
                longitude: updatePayload.lng,
                kakao_place_id: updatePayload.kakao_place_id ?? null,
              };

          const { error: cpMergeErr } = await upsertCuratorPlaceForStudio(
            supabase,
            user.id,
            effectiveEditPlaceId,
            {
              display_name:
                user.display_name || user.nickname || user.email,
              one_line_reason: formData.menu_reason || "",
              tags: formData.tags || [],
              alcohol_types: formData.alcohol_type
                ? [formData.alcohol_type]
                : [],
              moods: formData.atmosphere ? [formData.atmosphere] : [],
            }
          );
          if (cpMergeErr) {
            devWarn("curator_places 정리(수정 저장):", cpMergeErr);
          } else if (user?.id) {
            void loadCuratorStats(user.id);
          }

          const folderRes = await persistUserSavedPlaceFolders(
            effectiveEditPlaceId,
            addPlaceSelectedFolders
          );
          if (folderRes.ok) {
            void loadSavedFolders().catch((e) =>
              devWarn("loadSavedFolders(수정 후):", e)
            );
          }

          setMyPlaces((prev) =>
            prev.map((place) =>
              String(place.id) === String(effectiveEditPlaceId)
                ? {
                    ...place,
                    ...basisForList,
                    tags: formData.tags || [],
                    alcohol_type: formData.alcohol_type || "",
                    atmosphere: formData.atmosphere || "",
                    menu_reason: formData.menu_reason || "",
                  }
                : place
            )
          );

          removePublishedDraft();

          alert(
            folderRes.ok
              ? "장소가 성공적으로 수정되었습니다!"
              : `장소는 수정되었습니다. 내 저장 폴더 연결: ${folderRes.message || "실패"}`
          );

          setEditingPlaceId(null);
          try {
            localStorage.removeItem("editing_place_id");
          } catch {
            /* ignore */
          }

          setHasUnsavedChanges(false);
          setOriginalPlaceBeforeChange(null);
          setActiveSection("list");
        } else {
          const kid = formData.kakao_place_id
            ? String(formData.kakao_place_id).trim()
            : "";

          let placeRow = null;

          if (kid) {
            const { data: existingPlace, error: exErr } = await supabase
              .from("places")
              .select("*")
              .eq("kakao_place_id", kid)
              .maybeSingle();

            if (exErr) {
              devWarn("기존 장소(kakao_place_id) 조회:", exErr.message);
            } else if (existingPlace) {
              const { data: updated, error: updErr } = await supabase
                .from("places")
                .update({
                  name: formData.name_address,
                  address: formData.name_address,
                  lat: formData.latitude,
                  lng: formData.longitude,
                  category:
                    normalizeStudioPlaceCategory(
                      formData.category || existingPlace.category || ""
                    ) || "미분류",
                  kakao_place_id: kid,
                })
                .eq("id", existingPlace.id)
                .select()
                .single();

              placeRow = updErr ? existingPlace : updated;
              devLog("✅ 기존 places 행 재사용 (kakao_place_id):", kid);
            }
          }

          if (!placeRow) {
            const newPlaceData = {
              name: formData.name_address,
              address: formData.name_address,
              lat: formData.latitude,
              lng: formData.longitude,
              category:
                normalizeStudioPlaceCategory(formData.category || "") ||
                "미분류",
              kakao_place_id: kid || null,
            };

            devLog("📝 새 places INSERT:", newPlaceData);
            const { data: newPlace, error: placeError } = await supabase
              .from("places")
              .insert([newPlaceData])
              .select();

            if (placeError) {
              if (placeError.code === "23505" && kid) {
                const { data: racePlace, error: raceErr } = await supabase
                  .from("places")
                  .select("*")
                  .eq("kakao_place_id", kid)
                  .maybeSingle();
                if (!raceErr && racePlace) {
                  placeRow = racePlace;
                  devLog("✅ INSERT 충돌 후 기존 행 사용:", kid);
                }
              }
              if (!placeRow) {
                console.error("❌ 장소 저장 오류:", placeError);
                alert(`장소 저장에 실패했습니다: ${placeError.message}`);
                return;
              }
            } else {
              placeRow = newPlace?.[0] ?? null;
            }
          }

          const placeData = { data: placeRow ? [placeRow] : null };

          devLog("✅ 장소 마스터 준비 완료:", placeData);

          if (placeData && placeData.data && placeData.data[0]) {
            const curatorFields = {
              display_name: user.display_name || user.nickname || user.email,
              one_line_reason: formData.menu_reason || "",
              tags: formData.tags || [],
              alcohol_types: formData.alcohol_type ? [formData.alcohol_type] : [],
              moods: formData.atmosphere ? [formData.atmosphere] : [],
            };
            devLog("📝 저장할 curator_places 필드:", curatorFields);

            const { data: curatorData, error: curatorError } =
              await upsertCuratorPlaceForStudio(
                supabase,
                user.id,
                placeData.data[0].id,
                curatorFields
              );

            if (curatorError) {
              console.error("❌ curator_places 저장 오류:", curatorError);
              alert(`큐레이터 추천 저장에 실패했습니다: ${curatorError.message}`);
              return;
            }
            if (!curatorData?.[0]?.id) {
              console.error("❌ curator_places 저장 후 행 없음");
              alert("큐레이터 추천 저장에 실패했습니다.");
              return;
            }

            devLog("✅ curator_places 저장 성공:", curatorData);

            const insertedRow = placeData.data[0];
            const insertedPlaceUuid = insertedRow?.id;

            const folderRes = await persistUserSavedPlaceFolders(
              insertedPlaceUuid,
              addPlaceSelectedFolders
            );
            if (folderRes.ok) {
              void loadSavedFolders().catch((e) =>
                devWarn("loadSavedFolders(신규 저장 후):", e)
              );
            } else {
              alert(
                `잔은 올라갔지만 내 저장 폴더 연결에 실패했습니다: ${folderRes.message || ""}`
              );
            }
            const kakaoForPhotos =
              insertedRow?.kakao_place_id || formData.kakao_place_id || null;
            const photoFilesSnapshot = addPlacePhotoFiles.slice();
            setAddPlacePhotoFiles([]);
            const curatorUserId = user?.id;
            if (
              insertedPlaceUuid &&
              photoFilesSnapshot.length > 0 &&
              curatorUserId
            ) {
              void (async () => {
                let photoFail = 0;
                for (const file of photoFilesSnapshot) {
                  try {
                    if (!isAcceptableRasterImageFile(file)) continue;
                    const fileToUpload = await prepareImageFileForUpload(file);
                    await uploadCuratorPlacePhoto({
                      file: fileToUpload,
                      curatorId: curatorUserId,
                      kakaoPlaceId: kakaoForPhotos,
                      placeId: insertedPlaceUuid,
                    });
                  } catch (photoErr) {
                    photoFail += 1;
                    console.error("큐레이터 사진 업로드 실패:", photoErr);
                  }
                }
                if (photoFail > 0) {
                  showToast(
                    `사진 ${photoFail}장 업로드 실패 — 콘솔·Supabase Storage/RLS 확인`,
                    "error",
                    6000
                  );
                } else {
                  showToast(
                    `사진 ${photoFilesSnapshot.length}장을 등록했습니다.`,
                    "success"
                  );
                }
              })();
            }

            const newPlaceForList = {
              id: placeData.data[0].id,
              curator_place_id: curatorData[0].id,
              place_id: placeData.data[0].id,
              name: formData.name_address,
              address: formData.name_address,
              latitude: formData.latitude,
              longitude: formData.longitude,
              category:
                normalizeStudioPlaceCategory(formData.category || "") ||
                "미분류",
              alcohol_type: formData.alcohol_type || "",
              atmosphere: formData.atmosphere || "",
              recommended_menu: formData.recommended_menu || "",
              menu_reason: formData.menu_reason || "",
              tags: formData.tags || [],
              is_public: true,
              is_archived: false,
              created_at: new Date().toISOString().split("T")[0],
              places: placeData.data[0],
            };

            devLog("📝 myPlaces에 추가할 데이터:", newPlaceForList);
            setMyPlaces((prev) => {
              const withoutDup = prev.filter((p) => p.id !== newPlaceForList.id);
              const updated = [newPlaceForList, ...withoutDup];
              devLog("✅ myPlaces 업데이트 완료:", updated.length, "개");
              return updated;
            });

            removePublishedDraft();
          }

          setFormData({
            name_address: "",
            category: "",
            alcohol_type: "",
            atmosphere: "",
            recommended_menu: "",
            menu_reason: "",
            tags: [],
            latitude: null,
            longitude: null,
            kakao_place_id: null,
            is_public: true,
          });
          setAddPlacePhotoFiles([]);
          setAddPlaceSelectedFolders([]);
          setAddPlaceShowNewFolder(false);
          setAddPlaceNewFolderName("");

          setSearchedPlaces([]);
          setMapCenter({ lat: 37.5665, lng: 126.9780 });
          setEditingPlaceId(null);

          setHasUnsavedChanges(false);
          setOriginalPlaceBeforeChange(null);

          setActiveSection("list");
        }
      } else {
        const draftRowId = editingDraftId || `${Date.now()}`;
        const draftData = {
          id: draftRowId,
          basicInfo: {
            name_address: formData.name_address,
            category: formData.category,
          },
          alcohol_type: formData.alcohol_type,
          atmosphere: formData.atmosphere,
          recommended_menu: formData.recommended_menu,
          menu_reason: formData.menu_reason,
          tags: formData.tags,
          latitude: formData.latitude,
          longitude: formData.longitude,
          publishInfo: {
            is_public: formData.is_public,
            is_featured: false,
          },
          createdAt: new Date().toISOString().split("T")[0],
        };

        const draftOwnerId = user?.id ?? null;
        const existingDrafts = readStudioDrafts(draftOwnerId);
        let updatedDrafts;

        if (editingDraftId) {
          updatedDrafts = existingDrafts.map((draft) =>
            draft.id === editingDraftId ? draftData : draft
          );
          devLog("📝 임시저장 업데이트:", editingDraftId);
          setEditingDraftId(null);
        } else {
          updatedDrafts = [...existingDrafts, draftData];
          devLog("📝 새 임시저장 추가:", draftData.id);
        }

        writeStudioDrafts(draftOwnerId, updatedDrafts);

        setDrafts(updatedDrafts);
        devLog("✅ 임시저장 완료 (localStorage):", draftData);

        const currentEditingId =
          editingPlaceId || localStorage.getItem("editing_place_id");
        if (currentEditingId) {
          devLog("🗑️ 수정 후 임시저장: 원본 장소 제거", currentEditingId);
          setMyPlaces((prev) =>
            prev.filter((place) => place.id !== currentEditingId)
          );

          setEditingPlaceId(null);
          localStorage.removeItem("editing_place_id");
        }

        alert("초안이 임시저장되었습니다.");

        setActiveSection("drafts");
      }
    } catch (error) {
      console.error("❌ 저장 오류:", error);
      alert("저장 중 오류가 발생했습니다: " + error.message);
    }
  };

  const handleTogglePublic = async (placeId) => {
    try {
      devLog("🔄 공개/비공개 토글:", placeId);

      const originalPlace = myPlaces.find((p) => p.id === placeId);
      if (originalPlace) {
        setOriginalPlaceBeforeChange(JSON.parse(JSON.stringify(originalPlace)));
        devLog("💾 변경 전 원본 데이터 저장:", originalPlace);
      }

      setMyPlaces((prevPlaces) =>
        prevPlaces.map((place) =>
          place.id === placeId
            ? { ...place, is_public: !place.is_public }
            : place
        )
      );

      setHasUnsavedChanges(true);
      devLog("⚠️ 공개/비공개 상태 변경 - hasUnsavedChanges 설정");

      devLog("✅ 공개/비공개 상태가 로컬에서 변경되었습니다.");
    } catch (error) {
      console.error("❌ 토글 오류:", error);
    }
  };

  const handleDeletePlace = async (placeId) => {
    try {
      const confirmed = window.confirm("정말로 이 장소를 삭제하시겠습니까?");
      if (!confirmed) return;

      devLog("🗑️ 장소 삭제:", placeId);

      const { error } = await supabase
        .from("places")
        .delete()
        .eq("id", placeId);

      if (error) {
        console.error("❌ 장소 삭제 오류:", error);
        alert("장소 삭제에 실패했습니다: " + error.message);
        return;
      }

      setMyPlaces((prevPlaces) =>
        prevPlaces.filter((place) => place.id !== placeId)
      );

      setDrafts((prevDrafts) =>
        prevDrafts.filter((draft) => draft.id !== placeId)
      );

      devLog("✅ 장소 삭제 성공");
      alert("장소가 삭제되었습니다.");
    } catch (error) {
      console.error("❌ 삭제 오류:", error);
      alert("삭제 중 오류가 발생했습니다: " + error.message);
    }
  };

  const handleEditPlace = (place) => {
    try {
      devLog("✏️ 장소 수정:", place);

      setEditingDraftId(null);

      setEditingPlaceId(place.id);
      localStorage.setItem("editing_place_id", place.id);

      skipAddSectionResetRef.current = true;

      const alcoholFromCp =
        Array.isArray(place.alcohol_types) && place.alcohol_types.length
          ? place.alcohol_types[0]
          : place.alcohol_type || "";
      const moodFromCp =
        Array.isArray(place.moods) && place.moods.length
          ? place.moods[0]
          : place.atmosphere || "";

      setFormData({
        name_address: place.name,
        category: normalizeStudioPlaceCategory(place.category || "") || "",
        alcohol_type: alcoholFromCp,
        atmosphere: moodFromCp,
        recommended_menu: place.recommended_menu || "",
        menu_reason: place.menu_reason || "",
        tags: filterPlaceTagsForDisplay(parseDbStringArray(place.tags)),
        latitude: place.latitude,
        longitude: place.longitude,
        kakao_place_id: place.kakao_place_id ?? null,
        is_public: place.is_public,
      });

      setMapCenter({ lat: place.latitude, lng: place.longitude });

      setActiveSection("add");

      devLog("📝 폼 데이터 설정 완료:", {
        name: place.name,
        category: place.category,
        alcohol_type: alcoholFromCp,
        atmosphere: moodFromCp,
        tags: place.tags,
      });

      alert("장소 정보를 수정할 수 있습니다. 수정 후 다시 저장해주세요.");
    } catch (error) {
      console.error("❌ 장소 수정 오류:", error);
      alert("장소 수정에 실패했습니다: " + error.message);
    }
  };

  return {
    handleAddPlace,
    handleEditPlace,
    handleDeletePlace,
    handleTogglePublic,
  };
}
