const FOLDERS_KEY = "judo_folders";
const SAVED_KEY = "judo_saved_places";
const FOLLOWED_CURATORS_KEY = "judo_followed_curators";

const DEFAULT_FOLDERS = [
  { id: "folder_wish", name: "가고싶다", color: "#2ECC71" },
  { id: "folder_date", name: "데이트", color: "#FF5A5F" },
  { id: "folder_second", name: "2차", color: "#8E44AD" },
];

export function getFolders() {
  const raw = localStorage.getItem(FOLDERS_KEY);

  if (!raw) {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(DEFAULT_FOLDERS));
    return DEFAULT_FOLDERS;
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(DEFAULT_FOLDERS));
    return DEFAULT_FOLDERS;
  } catch {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(DEFAULT_FOLDERS));
    return DEFAULT_FOLDERS;
  }
}

export function saveFolders(folders) {
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
}

export function createFolder(name, color) {
  const folders = getFolders();
  const trimmed = name.trim();

  if (!trimmed) {
    throw new Error("폴더 이름을 입력해 주세요.");
  }

  const exists = folders.some((folder) => folder.name === trimmed);
  if (exists) {
    throw new Error("같은 이름의 폴더가 이미 있습니다.");
  }

  const newFolder = {
    id: `folder_${Date.now()}`,
    name: trimmed,
    color,
  };

  const nextFolders = [...folders, newFolder];
  saveFolders(nextFolders);

  return newFolder;
}

export function getSavedPlacesMap() {
  const raw = localStorage.getItem(SAVED_KEY);

  if (!raw) {
    localStorage.setItem(SAVED_KEY, JSON.stringify({}));
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
    localStorage.setItem(SAVED_KEY, JSON.stringify({}));
    return {};
  } catch {
    localStorage.setItem(SAVED_KEY, JSON.stringify({}));
    return {};
  }
}

export function savePlaceToFolder(placeId, folderId) {
  const savedMap = getSavedPlacesMap();
  const currentFolderIds = Array.isArray(savedMap[placeId]) ? savedMap[placeId] : [];

  if (!currentFolderIds.includes(folderId)) {
    savedMap[placeId] = [...currentFolderIds, folderId];
    localStorage.setItem(SAVED_KEY, JSON.stringify(savedMap));
  }

  return savedMap;
}

export function isPlaceSaved(placeId) {
  const savedMap = getSavedPlacesMap();
  return Array.isArray(savedMap[placeId]) && savedMap[placeId].length > 0;
}

export function getPlaceFolderIds(placeId) {
  const savedMap = getSavedPlacesMap();
  return Array.isArray(savedMap[placeId]) ? savedMap[placeId] : [];
}

export function getPrimarySavedFolderColor(placeId, folders) {
  const folderIds = getPlaceFolderIds(placeId);
  if (!folderIds.length) return null;

  const matched = folders.find((folder) => folder.id === folderIds[0]);
  return matched ? matched.color : null;
}

/* curator follow */
export function getFollowedCurators() {
  const raw = localStorage.getItem(FOLLOWED_CURATORS_KEY);
  if (!raw) {
    localStorage.setItem(FOLLOWED_CURATORS_KEY, JSON.stringify([]));
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    localStorage.setItem(FOLLOWED_CURATORS_KEY, JSON.stringify([]));
    return [];
  }
}

export function isCuratorFollowed(curatorName) {
  return getFollowedCurators().includes(curatorName);
}

export function toggleFollowCurator(curatorName) {
  const current = getFollowedCurators();

  const next = current.includes(curatorName)
    ? current.filter((name) => name !== curatorName)
    : [...current, curatorName];

  localStorage.setItem(FOLLOWED_CURATORS_KEY, JSON.stringify(next));
  return next;
}