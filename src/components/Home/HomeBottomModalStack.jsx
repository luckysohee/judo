import SavedPlaces from "../SavedPlaces/SavedPlaces";
import AddPlaceForm from "../AddPlaceForm/AddPlaceForm";
import SaveFolderModal from "../SaveFolderModal/SaveFolderModal";
import UserCard from "../UserCard/UserCard";

/**
 * Home 하단에 깔리는 4개 모달의 마운트 묶음.
 * - 폴더 저장 / 장소 추가 / 폴더 선택 모달 / UserCard
 *
 * 각 모달은 자기 open 플래그로 자체 표시 여부를 결정한다.
 * Home 본체에서 props가 흩어지는 걸 줄이기 위해 그룹만 분리.
 */
export default function HomeBottomModalStack({
  user,
  savedPlacesOpen,
  folders,
  savedPlacesByFolder,
  onCloseSavedPlaces,
  getUserRole,
  addPlaceOpen,
  curators,
  onCloseAddPlace,
  onAddPlaceAdded,
  saveTargetPlace,
  savedFolderIds,
  onCloseSaveFolder,
  onFoldersUpdated,
  onSaveToFolder,
  showUserCard,
  onCloseUserCard,
  onPublicProfileSaved,
  onTastePreferencesSaved,
}) {
  return (
    <>
      <SavedPlaces
        open={savedPlacesOpen}
        folders={folders}
        savedPlacesByFolder={savedPlacesByFolder}
        onClose={onCloseSavedPlaces}
        getUserRole={getUserRole}
      />

      <AddPlaceForm
        open={addPlaceOpen}
        curators={curators}
        onClose={onCloseAddPlace}
        onAdded={onAddPlaceAdded}
      />

      <SaveFolderModal
        open={!!saveTargetPlace}
        place={saveTargetPlace}
        folders={folders}
        savedFolderIds={savedFolderIds}
        onClose={onCloseSaveFolder}
        onFoldersUpdated={onFoldersUpdated}
        onSaveToFolder={onSaveToFolder}
      />

      <UserCard
        user={user}
        isVisible={showUserCard}
        onClose={onCloseUserCard}
        onPublicProfileSaved={onPublicProfileSaved}
        onTastePreferencesSaved={onTastePreferencesSaved}
      />
    </>
  );
}
