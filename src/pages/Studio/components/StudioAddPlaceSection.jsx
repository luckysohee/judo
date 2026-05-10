import React from "react";
import MapView from "../../../components/Map/MapView";
import {
  STUDIO_ATMOSPHERE_OPTIONS,
  STUDIO_LIQUOR_TYPE_OPTIONS,
  STUDIO_PLACE_CATEGORY_OPTIONS,
} from "../../../utils/placeTaxonomy.js";
import { isAcceptableRasterImageFile } from "../../../utils/prepareImageFileForUpload";
import { addPlaceFolderPickerStyles } from "./studioAddPlaceStyles";

/**
 * 스튜디오 「잔 올리기」 탭. 검색·지도·카테고리·태그·저장 폴더·사진을 한 화면에서 다룬다.
 * 상태/핸들러는 부모(StudioHome)가 모두 소유하고, 그룹 props 객체로 받는다.
 */
export default function StudioAddPlaceSection({
  sectionInnerStyle,
  mapRef,
  activeSection,
  defaultPlaces,
  place,
  search,
  tags,
  folders,
  photos,
  onSubmit,
}) {
  const { formData, setFormData, mapCenter, searchedPlaces } = place;
  const {
    searchSuggestions,
    showSuggestions,
    setShowSuggestions,
    selectedSuggestionIndex,
    setSelectedSuggestionIndex,
    setSearchSuggestions,
    handleInputChange,
    handleKeyDown,
    handleSearch,
    handleSuggestionClick,
    fetchSuggestions,
  } = search;
  const {
    frequentTags,
    allTags,
    allTagsList,
    removeTag,
    tagInputValue,
    setTagInputValue,
    tagSuggestions,
    setTagSuggestions,
    showAllTags,
    setShowAllTags,
    handleTagInputChange,
    handleTagSuggestionClick,
  } = tags;
  const {
    savedFoldersLoading,
    savedFoldersLoadError,
    sortedSavedFolders,
    addPlaceSelectedFolders,
    toggleAddPlaceFolder,
    addPlaceShowNewFolder,
    setAddPlaceShowNewFolder,
    addPlaceNewFolderName,
    setAddPlaceNewFolderName,
    addPlaceNewFolderSaving,
    handleAddPlaceCustomFolder,
  } = folders;
  const { addPlacePhotoFiles, setAddPlacePhotoFiles } = photos;

  return (
    <div style={sectionInnerStyle}>
      <div style={{ marginBottom: "12px" }}>
        <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: "12px" }}>장소 또는 주소 검색</label>
        <div style={{ position: "relative", zIndex: 1000 }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <input
                type="text"
                value={formData.name_address}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  if (formData.name_address.trim()) {
                    fetchSuggestions(formData.name_address);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => {
                    setShowSuggestions(false);
                    setSelectedSuggestionIndex(-1);
                  }, 200);
                }}
                style={{
                  width: "100%",
                  padding: "10px 35px 10px 10px",
                  border: "1px solid #333",
                  borderRadius: "6px",
                  backgroundColor: "#222",
                  color: "white",
                  fontSize: "14px",
                  zIndex: 1001,
                  boxSizing: "border-box"
                }}
                placeholder="장소 이름 또는 주소를 입력하세요"
                tabIndex={1}
              />
              {formData.name_address && (
                <button
                  onClick={() => {
                    setFormData(prev => ({ ...prev, name_address: "" }));
                    setSearchSuggestions([]);
                    setShowSuggestions(false);
                    setSelectedSuggestionIndex(-1);
                  }}
                  style={{
                    position: "absolute",
                    right: "6px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "#666",
                    cursor: "pointer",
                    fontSize: "16px",
                    padding: "2px",
                    zIndex: 1002
                  }}
                >
                  ✕
                </button>
              )}
            </div>
            <button
              onClick={handleSearch}
              style={{
                padding: "10px 16px",
                backgroundColor: "#2ECC71",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: "600",
                whiteSpace: "nowrap",
                zIndex: 1001,
                flexShrink: 0
              }}
              tabIndex={2}
            >
              🔍 검색
            </button>
          </div>

          {showSuggestions && (
            <div style={{
              position: "absolute",
              top: "100%",
              left: "0",
              right: "0",
              backgroundColor: "#333",
              border: "1px solid #444",
              borderTop: "none",
              borderRadius: "0 0 6px 6px",
              maxHeight: "180px",
              overflowY: "auto",
              zIndex: 1000,
              marginTop: "1px"
            }}>
              {searchSuggestions.map((suggestion, index) => (
                <div
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  style={{
                    padding: "8px 10px",
                    cursor: "pointer",
                    backgroundColor: index === selectedSuggestionIndex ? "#444" : "transparent",
                    color: index === selectedSuggestionIndex ? "#2ECC71" : "white",
                    fontSize: "13px",
                    transition: "background-color 0.2s ease"
                  }}
                  onMouseEnter={() => setSelectedSuggestionIndex(index)}
                  onMouseLeave={() => setSelectedSuggestionIndex(-1)}
                >
                  <div style={{ fontWeight: "bold", marginBottom: "2px" }}>
                    🔍 {suggestion.place_name}
                  </div>
                  {suggestion.address_name && (
                    <div style={{ fontSize: "11px", color: "#999" }}>
                      {suggestion.address_name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: "12px" }}>위치 선택 (지도를 클릭하세요)</label>
        <div style={{
          height: "400px",
          width: "100%",
          borderRadius: "8px",
          overflow: "hidden",
          border: "1px solid #333",
          backgroundColor: "#f0f0f0"
        }}>
          <MapView
            key={`map-${activeSection}`}
            ref={mapRef}
            places={searchedPlaces.length > 0 ? searchedPlaces.map(p => ({
              id: p.kakao_place_id || `studio-${p.place_name}-${p.y}-${p.x}`,
              name: p.place_name,
              address: p.address_name,
              latitude: parseFloat(p.y),
              longitude: parseFloat(p.x),
              category: "",
              is_public: true,
              created_at: new Date().toISOString().split('T')[0]
            })) : defaultPlaces}
            center={mapCenter}
            style={{
              width: "100%",
              height: "100%",
              display: "block"
            }}
          />
        </div>
        {formData.latitude && formData.longitude && (
          <div style={{ marginTop: "10px", color: "#666", fontSize: "12px" }}>
            선택된 좌표: {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
          </div>
        )}
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: "12px" }}>카테고리</label>
        <select
          value={formData.category}
          onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
          style={{
            width: "100%",
            padding: "8px 10px",
            border: "1px solid #333",
            borderRadius: "6px",
            backgroundColor: "#222",
            color: "white",
            fontSize: "14px",
            outline: "none",
            boxSizing: "border-box"
          }}
          tabIndex={3}
        >
          <option value="">선택하세요</option>
          {STUDIO_PLACE_CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          {formData.category &&
          !STUDIO_PLACE_CATEGORY_OPTIONS.includes(formData.category) ? (
            <option value={formData.category}>{formData.category}</option>
          ) : null}
        </select>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: "12px" }}>술종류</label>
        <select
          value={formData.alcohol_type}
          onChange={(e) => setFormData(prev => ({ ...prev, alcohol_type: e.target.value }))}
          style={{
            width: "100%",
            padding: "8px 10px",
            border: "1px solid #333",
            borderRadius: "6px",
            backgroundColor: "#222",
            color: "white",
            fontSize: "14px",
            outline: "none",
            boxSizing: "border-box"
          }}
          tabIndex={4}
        >
          <option value="">선택하세요</option>
          {STUDIO_LIQUOR_TYPE_OPTIONS.map((a) => (
            <option key={`alc-opt-${a}`} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: "12px" }}>분위기</label>
        <select
          value={formData.atmosphere}
          onChange={(e) => setFormData(prev => ({ ...prev, atmosphere: e.target.value }))}
          style={{
            width: "100%",
            padding: "8px 10px",
            border: "1px solid #333",
            borderRadius: "6px",
            backgroundColor: "#222",
            color: "white",
            fontSize: "14px",
            outline: "none",
            boxSizing: "border-box"
          }}
          tabIndex={5}
        >
          <option value="">선택하세요</option>
          {STUDIO_ATMOSPHERE_OPTIONS.map((m) => (
            <option key={`atm-opt-${m}`} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: "12px" }}>추천이유</label>
        <textarea
          value={formData.menu_reason}
          onChange={(e) => setFormData(prev => ({ ...prev, menu_reason: e.target.value }))}
          style={{
            width: "100%",
            padding: "8px 10px",
            border: "1px solid #333",
            borderRadius: "6px",
            backgroundColor: "#222",
            color: "white",
            fontSize: "14px",
            minHeight: "64px",
            resize: "vertical",
            outline: "none",
            boxSizing: "border-box"
          }}
          placeholder="추천하는 이유를 알려주세요"
          tabIndex={6}
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: "12px" }}>해시태그</label>

        <div style={{ marginBottom: "15px" }}>
          <div style={{ fontSize: "12px", color: "#999", marginBottom: "8px" }}>⭐ 자주 쓰는 태그</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
            {frequentTags.map(tag => (
              <button
                key={tag}
                onClick={() => {
                  if (!formData.tags.includes(tag)) {
                    setFormData(prev => ({ ...prev, tags: [...prev.tags, tag] }));
                  }
                }}
                style={{
                  padding: "4px 8px",
                  fontSize: "12px",
                  backgroundColor: formData.tags.includes(tag) ? "#3498DB" : "#444",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {!showAllTags ? (
          <button
            onClick={() => setShowAllTags(true)}
            style={{
              padding: "6px 12px",
              backgroundColor: "#666",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
              marginBottom: "15px"
            }}
          >
            📂 전체 태그 보기
          </button>
        ) : (
          <div style={{ marginBottom: "15px" }}>
            {Object.entries(allTags).map(([category, tagList]) => (
              <div key={category} style={{ marginBottom: "10px" }}>
                <div style={{ fontSize: "12px", color: "#999", marginBottom: "8px" }}>{category}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                  {tagList.map(tag => (
                    <button
                      key={tag}
                      onClick={() => {
                        if (!formData.tags.includes(tag)) {
                          setFormData(prev => ({ ...prev, tags: [...prev.tags, tag] }));
                        }
                      }}
                      style={{
                        padding: "4px 8px",
                        fontSize: "12px",
                        backgroundColor: formData.tags.includes(tag) ? "#3498DB" : "#444",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer"
                      }}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button
              onClick={() => setShowAllTags(false)}
              style={{
                padding: "6px 12px",
                backgroundColor: "#666",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "12px",
                marginTop: "5px"
              }}
            >
              ▼ 접기
            </button>
          </div>
        )}

        <div style={{ position: "relative" }}>
          <input
            type="text"
            value={tagInputValue}
            onChange={(e) => handleTagInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              if (e.nativeEvent?.isComposing || e.keyCode === 229) return;
              e.preventDefault();
              const trimmedValue = String(
                e.currentTarget?.value ?? ""
              ).trim();
              if (!trimmedValue) return;

              const existingTag = allTagsList.find(
                (tag) =>
                  tag.toLowerCase() === trimmedValue.toLowerCase()
              );
              const tagToAdd = existingTag || trimmedValue;

              setFormData((prev) => {
                if (prev.tags.includes(tagToAdd)) return prev;
                return { ...prev, tags: [...prev.tags, tagToAdd] };
              });
              setTagInputValue("");
              setTagSuggestions([]);
            }}
            style={{
              width: "100%",
              padding: "12px",
              border: "1px solid #333",
              borderRadius: "8px",
              backgroundColor: "#222",
              color: "white",
              fontSize: "16px",
              outline: "none",
              boxSizing: "border-box"
            }}
            placeholder="태그 검색 또는 직접 입력 (엔터로 추가)"
            tabIndex={7}
          />

          {tagSuggestions.length > 0 && (
            <div style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              backgroundColor: "#333",
              border: "1px solid #444",
              borderTop: "none",
              borderRadius: "0 0 8px 8px",
              maxHeight: "150px",
              overflowY: "auto",
              zIndex: 10
            }}>
              {tagSuggestions.map((tag, index) => (
                <div
                  key={index}
                  onClick={() => handleTagSuggestionClick(tag)}
                  style={{
                    padding: "8px 12px",
                    cursor: "pointer",
                    borderBottom: "1px solid #444",
                    fontSize: "14px",
                    color: "#ccc"
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = "#444"}
                  onMouseLeave={(e) => e.target.style.backgroundColor = "#333"}
                >
                  {tag}
                </div>
              ))}
            </div>
          )}
        </div>

        {formData.tags.length > 0 && (
          <div style={{
            marginTop: "10px",
            display: "flex",
            flexWrap: "wrap",
            gap: "8px"
          }}>
            {formData.tags.map((tag, index) => (
              <div
                key={index}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "4px 8px",
                  backgroundColor: "#444",
                  borderRadius: "12px",
                  fontSize: "12px",
                  color: "white",
                  border: "1px solid #555"
                }}
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  style={{
                    marginLeft: "4px",
                    background: "none",
                    border: "none",
                    color: "#999",
                    cursor: "pointer",
                    fontSize: "10px",
                    padding: "0",
                    lineHeight: "1"
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginBottom: "14px" }}>
        <label
          style={{
            display: "block",
            marginBottom: "6px",
            fontWeight: "600",
            fontSize: "12px",
          }}
        >
          내 저장 폴더
        </label>
        <p
          style={{
            margin: "0 0 8px 0",
            fontSize: "11px",
            color: "rgba(255,255,255,0.45)",
            lineHeight: 1.35,
          }}
        >
          실제 저장 시 카카오 「저장」 목록에도 같은 폴더로 들어갑니다. 1개 이상 선택하세요.
        </p>
        {savedFoldersLoading ? (
          <div
            style={{
              fontSize: "12px",
              color: "rgba(255,255,255,0.45)",
              marginBottom: "8px",
            }}
          >
            폴더 불러오는 중…
          </div>
        ) : null}
        {savedFoldersLoadError ? (
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
        <div style={addPlaceFolderPickerStyles.grid}>
          {sortedSavedFolders.map((f) => {
            const selected = addPlaceSelectedFolders.includes(f.key);
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => toggleAddPlaceFolder(f.key)}
                style={{
                  ...addPlaceFolderPickerStyles.btnBase,
                  borderColor: f.color,
                  backgroundColor: selected
                    ? f.color
                    : "rgba(255, 255, 255, 0.05)",
                  ...(selected ? addPlaceFolderPickerStyles.btnSelected : {}),
                }}
              >
                <span style={addPlaceFolderPickerStyles.fIcon}>{f.icon}</span>
                <span
                  style={{
                    ...addPlaceFolderPickerStyles.fName,
                    color: selected ? "#fff" : f.color,
                  }}
                >
                  {f.name}
                </span>
              </button>
            );
          })}
          {!addPlaceShowNewFolder ? (
            <button
              type="button"
              onClick={() => setAddPlaceShowNewFolder(true)}
              style={addPlaceFolderPickerStyles.addBtn}
            >
              <span style={addPlaceFolderPickerStyles.addIcon}>+</span>
              <span style={addPlaceFolderPickerStyles.addText}>새 폴더</span>
            </button>
          ) : null}
        </div>
        {addPlaceShowNewFolder ? (
          <div style={addPlaceFolderPickerStyles.newFolderBox}>
            <input
              type="text"
              value={addPlaceNewFolderName}
              onChange={(e) => setAddPlaceNewFolderName(e.target.value)}
              placeholder="폴더 이름"
              style={addPlaceFolderPickerStyles.newFolderInput}
              autoFocus
              onKeyDown={(e) =>
                e.key === "Enter" &&
                !addPlaceNewFolderSaving &&
                handleAddPlaceCustomFolder()
              }
            />
            <div style={addPlaceFolderPickerStyles.newFolderActions}>
              <button
                type="button"
                disabled={addPlaceNewFolderSaving}
                onClick={handleAddPlaceCustomFolder}
                style={addPlaceFolderPickerStyles.newFolderOk}
              >
                {addPlaceNewFolderSaving ? "…" : "✓"}
              </button>
              <button
                type="button"
                disabled={addPlaceNewFolderSaving}
                onClick={() => {
                  setAddPlaceShowNewFolder(false);
                  setAddPlaceNewFolderName("");
                }}
                style={addPlaceFolderPickerStyles.newFolderCancel}
              >
                ✕
              </button>
            </div>
          </div>
        ) : null}
        {addPlaceSelectedFolders.length > 0 ? (
          <div
            style={{
              marginTop: "8px",
              fontSize: "11px",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            {addPlaceSelectedFolders.length}개 폴더 선택됨
          </div>
        ) : null}
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: "12px" }}>
          장소 사진 (선택, 최대 8장)
        </label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
          multiple
          onChange={(e) => {
            const picked = Array.from(e.target.files || []).filter((f) =>
              isAcceptableRasterImageFile(f)
            );
            setAddPlacePhotoFiles((prev) =>
              [...prev, ...picked].slice(0, 8)
            );
            e.target.value = "";
          }}
          style={{ color: "#ccc", fontSize: "13px", maxWidth: "100%" }}
        />
        {addPlacePhotoFiles.length > 0 ? (
          <ul
            style={{
              fontSize: "12px",
              color: "#aaa",
              margin: "10px 0 0 0",
              paddingLeft: "18px",
              listStyle: "disc",
            }}
          >
            {addPlacePhotoFiles.map((f, i) => (
              <li
                key={`${f.name}-${i}-${f.size}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "4px",
                }}
              >
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {f.name}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setAddPlacePhotoFiles((p) => p.filter((_, j) => j !== i))
                  }
                  style={{
                    background: "#444",
                    border: "none",
                    color: "#fff",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "11px",
                    padding: "2px 8px",
                  }}
                >
                  제거
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <p style={{ fontSize: "11px", color: "#888", marginTop: "8px", marginBottom: 0 }}>
          「저장」 시 함께 올라갑니다. 검색으로 고른 카카오 장소면 같은 ID로 지도 카드에서도 보입니다.
        </p>
      </div>

      <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" }}>
        <button
          onClick={() => onSubmit(true)}
          style={{
            padding: "9px 18px",
            backgroundColor: "#666",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 600,
          }}
          tabIndex={8}
        >
          임시저장
        </button>
        <button
          onClick={() => onSubmit(false)}
          style={{
            padding: "9px 18px",
            backgroundColor: "#2ECC71",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 600,
          }}
          tabIndex={9}
        >
          저장
        </button>
      </div>
    </div>
  );
}
