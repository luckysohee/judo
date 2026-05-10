import React from "react";
import {
  isDeletableUserSavedFolderKey,
  SAVED_FOLDER_EDIT_COLOR_OPTIONS,
} from "../studioHomeModule";
import { listSavedFolderStyles } from "./studioListStyles";

/**
 * 스튜디오 「잔 리스트」 탭 — 카카오 저장 폴더 패널 + 검색·필터 + 장소 카드 목록.
 * 상태는 부모(StudioHome + useStudioSavedFolders)가 소유한다.
 */
export default function StudioListSection({ sectionInnerStyle, folders, places }) {
  const {
    savedByFolder,
    savedFoldersLoadError,
    savedFoldersLoading,
    savedFolderKey,
    setSavedFolderKey,
    savedShowNewFolder,
    setSavedShowNewFolder,
    savedNewFolderName,
    setSavedNewFolderName,
    savedFolderSaving,
    savedFoldersEditMode,
    setSavedFoldersEditMode,
    savedFolderMetaDeletingKey,
    savedFolderEditName,
    setSavedFolderEditName,
    savedFolderEditColor,
    setSavedFolderEditColor,
    savedFolderEditIcon,
    setSavedFolderEditIcon,
    savedFolderMetaSaving,
    savedFoldersListExpanded,
    setSavedFoldersListExpanded,
    sortedSavedFolders,
    hasDeletableSavedFolders,
    handleDeleteSavedFolder,
    handleSaveSavedFolderMeta,
    savedFolderPlaceIdSet,
    handleAddSavedFolder,
  } = folders;

  const {
    myPlaces,
    listSearchQuery,
    setListSearchQuery,
    filterType,
    setFilterType,
    handleEditPlace,
    handleDeletePlace,
    handleTogglePublic,
  } = places;

  return (
    <div style={sectionInnerStyle}>
      <div style={{ marginBottom: "6px", textAlign: "left" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
            marginBottom: savedFoldersListExpanded ? "8px" : "4px",
            maxWidth: "320px",
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setSavedFoldersListExpanded((open) => {
                if (open) {
                  setSavedFoldersEditMode(false);
                  setSavedShowNewFolder(false);
                  setSavedNewFolderName("");
                }
                return !open;
              });
            }}
            aria-expanded={savedFoldersListExpanded}
            style={listSavedFolderStyles.savedFoldersCollapseTrigger}
          >
            <span
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "rgba(255,255,255,0.75)",
              }}
            >
              내 저장 폴더
            </span>
            <span style={listSavedFolderStyles.savedFoldersChevron}>
              {savedFoldersListExpanded ? "▲" : "▼"}
            </span>
          </button>
          {savedFoldersListExpanded ? (
            <button
              type="button"
              disabled={savedFoldersLoading}
              aria-pressed={savedFoldersEditMode}
              onClick={() => {
                if (savedFoldersEditMode) {
                  setSavedFoldersEditMode(false);
                } else {
                  setSavedFoldersEditMode(true);
                }
              }}
              style={listSavedFolderStyles.editToggleBtn}
            >
              {savedFoldersEditMode ? "완료" : "편집"}
            </button>
          ) : null}
        </div>
        {!savedFoldersListExpanded && savedFoldersLoading ? (
          <div
            style={{
              color: "rgba(255,255,255,0.45)",
              fontSize: "11px",
              marginBottom: "6px",
              maxWidth: "320px",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            폴더 불러오는 중…
          </div>
        ) : null}
        {!savedFoldersListExpanded && savedFoldersLoadError ? (
          <div
            style={{
              color: "#e74c3c",
              fontSize: "12px",
              marginBottom: "8px",
              maxWidth: "320px",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            {savedFoldersLoadError}
          </div>
        ) : null}
        {savedFoldersListExpanded && savedFoldersLoadError ? (
          <div
            style={{
              color: "#e74c3c",
              fontSize: "12px",
              marginBottom: "8px",
            }}
          >
            {savedFoldersLoadError}
          </div>
        ) : null}
        {savedFoldersListExpanded && savedFoldersLoading ? (
          <div
            style={{
              color: "rgba(255,255,255,0.45)",
              fontSize: "12px",
              marginBottom: "8px",
            }}
          >
            폴더 불러오는 중…
          </div>
        ) : null}
        {savedFoldersListExpanded && !savedFoldersLoading ? (
          <>
            <div style={listSavedFolderStyles.grid}>
              {sortedSavedFolders.map((f) => {
                const list = savedByFolder[f.key] || [];
                const n = list.length;
                const active = savedFolderKey === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() =>
                      setSavedFolderKey((k) => (k === f.key ? null : f.key))
                    }
                    style={{
                      ...listSavedFolderStyles.folderBtn,
                      borderColor: f.color,
                      borderWidth: 2,
                      backgroundColor: active
                        ? f.color
                        : "rgba(255, 255, 255, 0.05)",
                      ...(active ? listSavedFolderStyles.folderBtnActive : {}),
                    }}
                  >
                    <span style={listSavedFolderStyles.fIcon}>{f.icon}</span>
                    <span
                      style={{
                        ...listSavedFolderStyles.fLabel,
                        color: active ? "#fff" : f.color,
                      }}
                    >
                      {f.name}{" "}
                      <span style={listSavedFolderStyles.fCountInline}>
                        ({n})
                      </span>
                    </span>
                  </button>
                );
              })}
              {!savedShowNewFolder ? (
                <button
                  type="button"
                  onClick={() => setSavedShowNewFolder(true)}
                  style={listSavedFolderStyles.addBtn}
                >
                  <span style={listSavedFolderStyles.addIcon}>+</span>
                  <span style={listSavedFolderStyles.addTextInline}>
                    새 폴더
                  </span>
                </button>
              ) : null}
            </div>
            {savedShowNewFolder ? (
              <div style={listSavedFolderStyles.newFolderBox}>
                <input
                  type="text"
                  value={savedNewFolderName}
                  onChange={(e) => setSavedNewFolderName(e.target.value)}
                  placeholder="폴더 이름"
                  style={listSavedFolderStyles.newFolderInput}
                  autoFocus
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    !savedFolderSaving &&
                    handleAddSavedFolder()
                  }
                />
                <div style={listSavedFolderStyles.newFolderActions}>
                  <button
                    type="button"
                    disabled={savedFolderSaving}
                    onClick={handleAddSavedFolder}
                    style={listSavedFolderStyles.newFolderOk}
                  >
                    {savedFolderSaving ? "…" : "✓"}
                  </button>
                  <button
                    type="button"
                    disabled={savedFolderSaving}
                    onClick={() => {
                      setSavedShowNewFolder(false);
                      setSavedNewFolderName("");
                    }}
                    style={listSavedFolderStyles.newFolderCancel}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ) : null}
            {savedFoldersEditMode &&
            !savedFoldersLoading &&
            savedFolderKey &&
            isDeletableUserSavedFolderKey(savedFolderKey) ? (
              <>
                <div style={listSavedFolderStyles.folderEditWrap}>
                  <div style={listSavedFolderStyles.folderEditTitle}>
                    폴더 수정
                  </div>
                  <div style={listSavedFolderStyles.folderEditRow}>
                    <input
                      type="text"
                      value={savedFolderEditIcon}
                      onChange={(e) =>
                        setSavedFolderEditIcon(e.target.value.slice(0, 4))
                      }
                      placeholder="📁"
                      title="아이콘(이모지)"
                      aria-label="폴더 아이콘"
                      style={listSavedFolderStyles.folderEditIconInput}
                    />
                    <input
                      type="text"
                      value={savedFolderEditName}
                      onChange={(e) => setSavedFolderEditName(e.target.value)}
                      placeholder="폴더 이름"
                      aria-label="폴더 이름"
                      style={listSavedFolderStyles.folderEditNameInput}
                      onKeyDown={(e) =>
                        e.key === "Enter" &&
                        !savedFolderMetaSaving &&
                        handleSaveSavedFolderMeta()
                      }
                    />
                  </div>
                  <div
                    style={listSavedFolderStyles.folderEditColorRow}
                    role="group"
                    aria-label="폴더 색"
                  >
                    {SAVED_FOLDER_EDIT_COLOR_OPTIONS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSavedFolderEditColor(c)}
                        style={{
                          ...listSavedFolderStyles.folderEditColorBtn,
                          backgroundColor: c,
                          outline:
                            savedFolderEditColor === c
                              ? "2px solid #fff"
                              : "none",
                        }}
                        aria-label={`색 ${c}`}
                        aria-pressed={savedFolderEditColor === c}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={
                      savedFolderMetaSaving ||
                      savedFolderMetaDeletingKey === savedFolderKey
                    }
                    onClick={handleSaveSavedFolderMeta}
                    style={listSavedFolderStyles.folderEditSaveBtn}
                  >
                    {savedFolderMetaSaving ? "저장 중…" : "변경 저장"}
                  </button>
                </div>
                <div style={listSavedFolderStyles.folderDeleteBarWrap}>
                  <button
                    type="button"
                    disabled={
                      savedFolderMetaDeletingKey === savedFolderKey ||
                      savedFolderMetaSaving
                    }
                    onClick={() => handleDeleteSavedFolder(savedFolderKey)}
                    style={listSavedFolderStyles.folderDeleteBarBtn}
                  >
                    {savedFolderMetaDeletingKey === savedFolderKey
                      ? "삭제 중…"
                      : `「${
                          sortedSavedFolders.find(
                            (x) => x.key === savedFolderKey
                          )?.name ?? "폴더"
                        }」 삭제`}
                  </button>
                </div>
              </>
            ) : null}
            {savedFoldersEditMode &&
            !savedFoldersLoading &&
            !(
              savedFolderKey &&
              isDeletableUserSavedFolderKey(savedFolderKey)
            ) ? (
              <div style={listSavedFolderStyles.editPanel}>
                {savedFolderKey &&
                !isDeletableUserSavedFolderKey(savedFolderKey) ? (
                  <p style={listSavedFolderStyles.editHint}>
                    기본 폴더 7개는 삭제가 불가해요.
                  </p>
                ) : !hasDeletableSavedFolders ? (
                  <p style={listSavedFolderStyles.editHint}>
                    지금 목록에는 고정 7개 폴더만 있어요. 「새 폴더」로 추가한 뒤에는 편집
                    중에 그 폴더를 탭해 선택하면 목록 맨 아래 「…삭제」버튼이 나와요.
                  </p>
                ) : (
                  <p style={listSavedFolderStyles.editHint}>
                    고정 7개를 제외한 폴더를 탭해 선택하면 아래에 이름·색·아이콘을 바꿀 수
                    있어요. 「변경 저장」 후 필요하면 「…삭제」로 폴더를 지울 수 있어요.
                    다시 탭하면 선택이 풀려요.
                  </p>
                )}
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <div
        style={{
          width: "100%",
          height: 1,
          backgroundColor: "rgba(255,255,255,0.12)",
          margin: "16px 0 14px",
        }}
        aria-hidden
      />

      {savedFolderKey &&
      !isDeletableUserSavedFolderKey(savedFolderKey) ? (
        <p
          style={{
            margin: "0 0 10px 0",
            fontSize: "11px",
            color: "rgba(255,255,255,0.5)",
            lineHeight: 1.4,
            textAlign: "left",
          }}
        >
          아래 목록은「
          {sortedSavedFolders.find((x) => x.key === savedFolderKey)?.name}
          」폴더에 넣은 장소만 보여요. 폴더를 다시 누르면 전체 잔으로 돌아갑니다.
        </p>
      ) : null}

      <div
        style={{
          position: "relative",
          marginBottom: "14px",
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          boxSizing: "border-box",
        }}
      >
        <input
          type="text"
          value={listSearchQuery}
          onChange={(e) => setListSearchQuery(e.target.value)}
          placeholder={
            savedFolderKey
              ? "이 폴더 안 잔만 검색 (장소명/카테고리/주소)"
              : "잔리스트 검색 (장소명/카테고리/주소)"
          }
          style={{
            display: "block",
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            boxSizing: "border-box",
            padding: "10px 12px",
            paddingRight: listSearchQuery.trim() ? "38px" : "12px",
            borderRadius: "8px",
            border: "1px solid #3a3a3a",
            backgroundColor: "#1f1f1f",
            color: "#fff",
            fontSize: "14px",
            outline: "none",
          }}
        />
        {listSearchQuery.trim() ? (
          <button
            type="button"
            aria-label="검색어 지우기"
            title="검색어 지우기"
            onClick={() => setListSearchQuery("")}
            style={{
              position: "absolute",
              right: "6px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "28px",
              height: "28px",
              padding: 0,
              margin: 0,
              border: "none",
              borderRadius: "6px",
              background: "rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.85)",
              fontSize: "18px",
              lineHeight: 1,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            ×
          </button>
        ) : null}
      </div>

      <div style={{
        display: "flex",
        gap: "8px",
        marginBottom: "12px",
        flexWrap: "wrap"
      }}>
        <button
          type="button"
          onClick={() => setFilterType("all")}
          style={{
            padding: "6px 12px",
            backgroundColor: filterType === "all" ? "#2ECC71" : "#444",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: 600,
          }}
        >
          전체
        </button>
        <button
          type="button"
          onClick={() => setFilterType("public")}
          style={{
            padding: "6px 12px",
            backgroundColor: filterType === "public" ? "#2ECC71" : "#444",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: 600,
          }}
        >
          공개
        </button>
        <button
          type="button"
          onClick={() => setFilterType("private")}
          style={{
            padding: "6px 12px",
            backgroundColor: filterType === "private" ? "#2ECC71" : "#444",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: 600,
          }}
        >
          비공개
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {(() => {
          let filteredPlaces = myPlaces;
          const normalizedQuery = listSearchQuery.trim().toLowerCase();

          if (filterType === "public") {
            filteredPlaces = myPlaces.filter(
              (place) => place.is_public !== false
            );
          } else if (filterType === "private") {
            filteredPlaces = myPlaces.filter(
              (place) => place.is_public === false
            );
          }

          if (savedFolderKey && savedFolderPlaceIdSet) {
            filteredPlaces = filteredPlaces.filter((place) =>
              savedFolderPlaceIdSet.has(String(place.id))
            );
          }

          if (normalizedQuery) {
            filteredPlaces = filteredPlaces.filter((place) => {
              const name = (place?.name || "").toLowerCase();
              const category = (place?.category || "").toLowerCase();
              const address = (place?.address || "").toLowerCase();
              return (
                name.includes(normalizedQuery) ||
                category.includes(normalizedQuery) ||
                address.includes(normalizedQuery)
              );
            });
          }

          const folderFilteredEmpty =
            Boolean(savedFolderKey) &&
            myPlaces.length > 0 &&
            filteredPlaces.length === 0;

          return filteredPlaces.length === 0 ? (
            <div style={{
              backgroundColor: "#222",
              padding: "24px 16px",
              borderRadius: "8px",
              textAlign: "center",
              color: "#666",
              fontSize: "13px",
            }}>
              {folderFilteredEmpty ? (
                <div style={{ color: "#e0c896", lineHeight: 1.55 }}>
                  「내 저장」폴더가 선택된 상태입니다. 이 모드에서는 그 폴더에 넣은 장소만 보입니다.
                  <br />
                  <strong style={{ color: "#fff" }}>임포트·추천 잔 전체</strong>를 보려면 상단 폴더 칩을 다시 눌러 선택을 해제하세요.
                </div>
              ) : savedFolderKey
                ? filterType === "public"
                  ? "이 폴더에 속한 공개 잔이 없습니다."
                  : filterType === "private"
                    ? "이 폴더에 속한 비공개 잔이 없습니다."
                    : "이 폴더에 넣은 장소가 없거나, 아직 내 잔에 올리지 않았어요."
                : filterType === "public"
                  ? "공개 장소가 없습니다."
                  : filterType === "private"
                    ? "비공개 장소가 없습니다."
                    : "저장된 장소가 없습니다."}
            </div>
          ) : (
            filteredPlaces.map(place => (
              <div key={place.id} style={{
                backgroundColor: "#222",
                padding: "12px 14px",
                borderRadius: "8px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: "bold" }}>
                    {place.name}
                  </h3>
                  <p style={{ margin: "0 0 4px 0", color: "#888", fontSize: "12px" }}>
                    {place.category} • {place.created_at}
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => handleEditPlace(place)}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: "#3498DB",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px"
                    }}
                  >
                    수정
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeletePlace(place.id)}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: "#E74C3C",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px"
                    }}
                  >
                    삭제
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTogglePublic(place.id)}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: place.is_public ? "#2ECC71" : "#E74C3C",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: "600",
                      minWidth: "50px"
                    }}
                  >
                    {place.is_public ? "공개" : "비공개"}
                  </button>
                </div>
              </div>
            ))
          );
        })()}
      </div>
    </div>
  );
}
