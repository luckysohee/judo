const FOLDERS_KEY = "judo_folders";
const SAVED_KEY = "judo_saved_places";
const FOLLOWED_CURATORS_KEY = "judo_followed_curators";

function notifyStorageUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("judo_storage_updated"));
}

function migrateLegacyDefaultFoldersIfNeeded(folders) {
  if (!Array.isArray(folders) || folders.length === 0) return folders;

  const legacyIds = new Set(["folder_wish", "folder_date", "folder_second"]);
  const legacyNames = new Set(["가고싶다", "데이트", "2차"]);

  const hasLegacy = folders.some(
    (f) => legacyIds.has(f?.id) || legacyNames.has(f?.name)
  );
  if (!hasLegacy) return folders;

  const next = folders.filter(
    (f) => !(legacyIds.has(f?.id) || legacyNames.has(f?.name))
  );
  saveFolders(next);
  return next;
}

export function getFolders() {
  const raw = localStorage.getItem(FOLDERS_KEY);

  if (!raw) {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify([]));
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return migrateLegacyDefaultFoldersIfNeeded(parsed);
    }
    localStorage.setItem(FOLDERS_KEY, JSON.stringify([]));
    return [];
  } catch {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify([]));
    return [];
  }
}

export function saveFolders(folders) {
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  notifyStorageUpdated();
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

export function updateFolder(folderId, updates) {
  const folders = getFolders();
  const idx = folders.findIndex((f) => f?.id === folderId);
  if (idx === -1) {
    throw new Error("수정할 폴더를 찾을 수 없습니다.");
  }

  const nextNameRaw = typeof updates?.name === "string" ? updates.name : folders[idx].name;
  const nextName = nextNameRaw.trim();
  if (!nextName) {
    throw new Error("폴더 이름을 입력해 주세요.");
  }

  const nameConflict = folders.some(
    (f, i) => i !== idx && typeof f?.name === "string" && f.name === nextName
  );
  if (nameConflict) {
    throw new Error("같은 이름의 폴더가 이미 있습니다.");
  }

  const nextFolder = {
    ...folders[idx],
    name: nextName,
    color: updates?.color ?? folders[idx].color,
  };

  const nextFolders = [...folders];
  nextFolders[idx] = nextFolder;
  saveFolders(nextFolders);
  return nextFolder;
}

export function deleteFolder(folderId) {
  const folders = getFolders();
  const nextFolders = folders.filter((f) => f?.id !== folderId);
  saveFolders(nextFolders);

  const savedMap = getSavedPlacesMap();
  let changed = false;

  Object.keys(savedMap).forEach((placeId) => {
    const ids = Array.isArray(savedMap[placeId]) ? savedMap[placeId] : [];
    if (!ids.includes(folderId)) return;

    const nextIds = ids.filter((id) => id !== folderId);
    if (nextIds.length === 0) {
      delete savedMap[placeId];
    } else {
      savedMap[placeId] = nextIds;
    }
    changed = true;
  });

  if (changed) {
    localStorage.setItem(SAVED_KEY, JSON.stringify(savedMap));
    notifyStorageUpdated();
  }
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
    notifyStorageUpdated();
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