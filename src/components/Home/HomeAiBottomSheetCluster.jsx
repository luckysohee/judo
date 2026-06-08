import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRecommendSheetPullDismiss } from "../../hooks/useRecommendSheetPullDismiss";
import HomeBlogReviewSection from "./HomeBlogReviewSection";
import { resolvePlaceWgs84 } from "../../utils/placeCoords";
import { buildKakaoStaticMapUrl } from "../../utils/kakaoStaticMapUrl";
import {
  recommendPlaceSubtitle,
  siblingPlaceNamesFromBatch,
} from "../../utils/recommendationPlaceCopy";
import { sanitizeSheetStoryLine, canonicalCuratorChipToken } from "../../pages/Home/homeModule.js";
import { filterPlaceTagsForDisplay } from "../../utils/placeUiTags";
import { pickAiSheetPlaceDisplayName } from "../../utils/aiSheetPlaceDisplayName";

const PULL_COLLAPSE_PX = 36;
const PULL_DISMISS_FROM_COLLAPSED_PX = 72;
const PULL_EXPAND_FROM_COLLAPSED_PX = -20;

/**
 * 맞춤 추천 피크 바 + 펼침 바텀시트, 블로그 리뷰 블록, AI 시트 사진 뷰어 포털.
 */
export default function HomeAiBottomSheetCluster({
  styles,
  forceSheetCollapsed = false,
  onSheetUserExpand,
  onDismissRecommendSheet,
  setAiSheetOpen,
  isAiSearching,
  displayedPlaces,
  setKakaoPlaces,
  preserveMapViewportSituationChip,
  setMapSearchMarkerFitTick,
  aiError,
  aiBottomSheetPlaces,
  loadingDots,
  searchLoadingLabel,
  aiSummary,
  yajangFallbackBanner,
  aiSheetPage,
  setAiSheetPage,
  aiSheetTotalPages,
  aiSheetPageSize,
  aiBottomSheetPagedPlaces,
  getRecommendationListDistanceLabel,
  searchResultSheetExtras,
  curatorImportRecommendation,
  curatorImportPlacesOrPool,
  query,
  useImportRecPlacesForAiSheet,
  handleRecommendPlaceFromList,
  setSelectedPlaceWithAnalytics,
  mapRef,
  topReasonMap,
  aiSheetPlacePreviewKey,
  aiSheetPhotoByKey,
  aiSheetExpandedReasonByKey,
  setAiSheetExpandedReasonByKey,
  aiSheetPhotoViewerSuppressOpenUntilRef,
  aiSheetPhotoViewerItems,
  aiSheetPhotoViewerIndex,
  setAiSheetPhotoViewerIndex,
  setAiSheetPhotoViewerOpen,
  curatorSearchHighlightList,
  setShowAll,
  setSelectedCurators,
  dbCurators,
  blogReviews,
  aiSheetPhotoViewerOpen,
  closeAiSheetPhotoViewer,
}) {
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const handlePullRelease = useCallback(
    ({ dy, dragged }) => {
      if (!dragged) return false;
      if (sheetCollapsed) {
        if (dy <= PULL_EXPAND_FROM_COLLAPSED_PX) {
          setSheetCollapsed(false);
          onSheetUserExpand?.();
          return true;
        }
        if (dy >= PULL_DISMISS_FROM_COLLAPSED_PX) {
          onDismissRecommendSheet?.();
          return true;
        }
        return false;
      }
      if (dy >= PULL_COLLAPSE_PX) {
        setSheetCollapsed(true);
        return true;
      }
      return false;
    },
    [sheetCollapsed, onDismissRecommendSheet, onSheetUserExpand]
  );

  const {
    sheetChromeRef,
    clusterStyle,
    pullDragging,
    consumeHeaderClick,
  } = useRecommendSheetPullDismiss({
    enabled: true,
    onDismiss: onDismissRecommendSheet,
    isAiSearching,
    onPullRelease: handlePullRelease,
  });

  useEffect(() => {
    if (isAiSearching) {
      setSheetCollapsed(false);
      return;
    }
    if (aiBottomSheetPlaces.length <= 0) {
      setSheetCollapsed(false);
    }
  }, [isAiSearching, aiBottomSheetPlaces.length]);

  /** 2차 후보 고르는 중 — 지도 깜빡임이 보이도록 추천 리스트 접기 */
  useEffect(() => {
    if (forceSheetCollapsed) {
      setSheetCollapsed(true);
    }
  }, [forceSheetCollapsed]);

  const syncDisplayedPlacesToMapMarkers = useCallback(() => {
    if (!Array.isArray(displayedPlaces) || displayedPlaces.length === 0) {
      return;
    }
    const kakaoFormattedPlaces = displayedPlaces.map((place) => ({
      ...place,
      lat: parseFloat(place.y ?? place.lat),
      lng: parseFloat(place.x ?? place.lng),
      name: place.name || place.place_name,
      place_name: place.place_name,
      address_name: place.address_name || place.road_address_name,
      category_name: place.category_name,
      phone: place.phone || "",
      id: place.id,
      isExternal: true,
      isLive: true,
      kakao_place_id: place.id,
      isKakaoPlace:
        place.isKakaoPlace ||
        (!place.primaryCurator &&
          (Boolean(place.kakao_place_id) || place.isExternal === true)),
    }));
    setKakaoPlaces(kakaoFormattedPlaces);
    if (!preserveMapViewportSituationChip) {
      setMapSearchMarkerFitTick((x) => x + 1);
    }
  }, [
    displayedPlaces,
    preserveMapViewportSituationChip,
    setKakaoPlaces,
    setMapSearchMarkerFitTick,
  ]);

  const toggleSheetCollapsed = useCallback(() => {
    if (consumeHeaderClick()) return;
    setSheetCollapsed((prev) => {
      const next = !prev;
      if (!next) {
        onSheetUserExpand?.();
        syncDisplayedPlacesToMapMarkers();
      }
      return next;
    });
  }, [consumeHeaderClick, onSheetUserExpand, syncDisplayedPlacesToMapMarkers]);

  return (
            <>
              <div
                style={{
                  ...styles.aiRecommendSheetCluster,
                  ...clusterStyle,
                }}
              >
                <div
                  style={{
                    ...styles.aiRecommendMergedShell,
                    ...(sheetCollapsed
                      ? styles.aiRecommendMergedShellCollapsed
                      : styles.aiRecommendMergedShellExpanded),
                    opacity: isAiSearching ? 0.92 : 1,
                  }}
                >
                  <div
                    ref={sheetChromeRef}
                    style={{
                      ...styles.aiRecommendSheetChrome,
                      ...(pullDragging ? styles.aiRecommendSheetChromeDragging : {}),
                    }}
                  >
                    <div
                      style={styles.aiRecommendSheetPullStrip}
                      aria-hidden
                    >
                      <div style={styles.aiRecommendSheetHandle} />
                    </div>

                    <div style={styles.aiRecommendSheetHeaderRow}>
                      <button
                        type="button"
                        style={styles.aiRecommendSheetHeader}
                        aria-label={
                          sheetCollapsed
                            ? "맞춤 추천 접힘. 탭하면 펼쳐요"
                            : "맞춤 추천. 아래로 당기면 접어요"
                        }
                        onClick={toggleSheetCollapsed}
                      >
                        <div style={styles.aiPeekBarRow}>
                          <div style={styles.aiPeekLeft}>
                            <span style={styles.aiPeekBadge}>맞춤</span>

                            <div style={styles.aiPeekTextWrap}>
                              <div style={styles.aiPeekTitle}>
                                {isAiSearching
                                  ? "추천 리스트 준비 중"
                                  : aiError
                                  ? "추천 결과를 불러오지 못했어요"
                                  : `추천 결과 ${aiBottomSheetPlaces.length}곳`}
                              </div>

                              <div
                                style={{
                                  ...styles.aiPeekSubtitle,
                                  ...(aiError ? styles.aiPeekSubtitleError : {}),
                                }}
                              >
                                {isAiSearching
                                  ? `${searchLoadingLabel || "검색어·거리 기준으로 후보를 골라요"}${loadingDots}`
                                  : aiError
                                  ? "잠시 후 다시 시도해 주세요"
                                  : aiSummary ||
                                    (sheetCollapsed
                                      ? "탭하거나 위로 살짝 밀면 펼쳐요"
                                      : "아래로 살짝 밀면 접을 수 있어요")}
                              </div>
                              {!isAiSearching && !aiError ? (
                                <div style={styles.aiPeekTrustLine}>
                                  검색어·거리·실시간 반응을 함께 반영했어요
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <span style={styles.aiPeekArrow} aria-hidden>
                            {sheetCollapsed ? "▲" : "▼"}
                          </span>
                        </div>
                      </button>

                      {!isAiSearching &&
                      typeof onDismissRecommendSheet === "function" ? (
                        <button
                          type="button"
                          style={styles.courseSearchClearButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDismissRecommendSheet();
                          }}
                          aria-label="추천 결과 닫기"
                          title="추천 결과 닫기"
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                  </div>

              {!sheetCollapsed ? (
              <div style={styles.aiRecommendSheetBody}>
                  {yajangFallbackBanner ? (
                    <div
                      style={{
                        margin: "0 16px 12px",
                        padding: "12px 14px",
                        borderRadius: 12,
                        background: "rgba(46, 204, 113, 0.12)",
                        border: "1px solid rgba(46, 204, 113, 0.35)",
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: "#1a2e22",
                        flexShrink: 0,
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>
                        {yajangFallbackBanner.title}
                      </div>
                      <div>{yajangFallbackBanner.body}</div>
                    </div>
                  ) : null}

                  <div style={styles.aiSheetList}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        flexShrink: 0,
                      }}
                    >
                      {aiBottomSheetPlaces.length > 0 ? (
                        <div
                          style={{
                            ...styles.aiSheetSectionLabel,
                            marginBottom: 0,
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          추천 순서 · 장소
                        </div>
                      ) : (
                        <div style={{ flex: 1, minWidth: 0 }} />
                      )}
                      {aiBottomSheetPlaces.length > aiSheetPageSize ? (
                        <div style={styles.aiSheetPager}>
                          <button
                            type="button"
                            style={styles.aiSheetPagerBtn}
                            disabled={aiSheetPage <= 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              setAiSheetPage((p) => Math.max(0, p - 1));
                            }}
                          >
                            이전
                          </button>
                          <span style={styles.aiSheetPagerLabel}>
                            {aiSheetPage + 1} / {aiSheetTotalPages}
                          </span>
                          <button
                            type="button"
                            style={styles.aiSheetPagerBtn}
                            disabled={aiSheetPage >= aiSheetTotalPages - 1}
                            onClick={(e) => {
                              e.stopPropagation();
                              setAiSheetPage((p) =>
                                Math.min(aiSheetTotalPages - 1, p + 1)
                              );
                            }}
                          >
                            다음
                          </button>
                        </div>
                      ) : null}
                    </div>
                    {aiBottomSheetPagedPlaces.map((place, index) => {
                      const globalIndex = aiSheetPage * aiSheetPageSize + index;
                      const distanceLabel = getRecommendationListDistanceLabel(place);
                      const extras = searchResultSheetExtras.byId.get(String(place.id)) || {
                        matched: [],
                        rep: "",
                        why: "",
                      };
                      const hasRecSummary =
                        Boolean(curatorImportRecommendation?.ok) &&
                        String(
                          curatorImportRecommendation?.summary || "",
                        ).trim().length > 0;
                      const recPlaces = curatorImportRecommendation?.ok
                        ? curatorImportPlacesOrPool
                        : null;
                      const matchedImportPlace =
                        hasRecSummary && Array.isArray(recPlaces)
                          ? recPlaces.find((r) => {
                              const na = String(
                                place?.name || place?.place_name || "",
                              )
                                .trim()
                                .toLowerCase();
                              const nb = String(
                                r?.name || r?.place_name || "",
                              )
                                .trim()
                                .toLowerCase();
                              return (
                                na &&
                                nb &&
                                (na.includes(nb) || nb.includes(na))
                              );
                            })
                          : null;
                      const placeForSubtitle =
                        matchedImportPlace &&
                        String(matchedImportPlace.reason || "").trim()
                          ? {
                              ...place,
                              ...matchedImportPlace,
                              reason: matchedImportPlace.reason,
                              reasonShort:
                                matchedImportPlace.reasonShort ||
                                matchedImportPlace.reason ||
                                place.reasonShort,
                            }
                          : place;
                      const siblingNames = Array.isArray(recPlaces)
                        ? siblingPlaceNamesFromBatch(recPlaces, place)
                        : [];
                      /** `/recommend` summary·reason — 있으면 검색 태그 템플릿(extras.why) 대신 콘텐츠 한 줄 */
                      const subtitleFromPlace = recommendPlaceSubtitle(
                        placeForSubtitle,
                        {
                          ...(hasRecSummary
                            ? { summary: curatorImportRecommendation.summary }
                            : {}),
                          query: String(query || "").trim(),
                          siblingNames,
                        },
                      );
                      const storyLine = useImportRecPlacesForAiSheet
                        ? subtitleFromPlace || null
                        : subtitleFromPlace ||
                          extras.why ||
                          topReasonMap[place.id] ||
                          place.recommendation ||
                          null;
                      const cleanedStoryLine = sanitizeSheetStoryLine(storyLine);
                      const cc =
                        typeof place.curatorCount === "number" &&
                        place.curatorCount > 0
                          ? place.curatorCount
                          : null;
                      const sheetTags = filterPlaceTagsForDisplay(
                        place.tags || []
                      );
                      const sheetPhotoKey = aiSheetPlacePreviewKey(place);
                      const enrichedPhoto = sheetPhotoKey
                        ? String(aiSheetPhotoByKey[sheetPhotoKey] || "").trim()
                        : "";
                      const storyKey = String(
                        place?.id || place?.name || place?.place_name || index
                      );
                      const storySentenceCount = String(cleanedStoryLine || "")
                        .split(/[\n]+|[.!?]+(?=\s|$)/)
                        .map((s) => s.trim())
                        .filter(Boolean).length;
                      const canExpandStory = storySentenceCount >= 2;
                      const isStoryExpanded = Boolean(
                        aiSheetExpandedReasonByKey[storyKey]
                      );
                      const previewImageUrl = [
                        enrichedPhoto,
                        place.thumbnail,
                        place.thumbnail_url,
                        place.image,
                        place.image_url,
                        place.photo,
                        place.photo_url,
                        place.picture,
                      ]
                        .map((v) => String(v || "").trim())
                        .find(
                          (v) => /^https?:\/\//i.test(v) || v.startsWith("/api/")
                        );
                      const wgs = resolvePlaceWgs84(place);
                      const lat = Number(wgs?.lat);
                      const lng = Number(wgs?.lng);
                      const fallbackStaticMapUrl =
                        Number.isFinite(lat) && Number.isFinite(lng)
                          ? buildKakaoStaticMapUrl(lat, lng, {
                              w: 160,
                              h: 120,
                              level: 4,
                            })
                          : null;
                      const sheetPreviewUrl = previewImageUrl || fallbackStaticMapUrl || "";
                      const displayBusinessName = pickAiSheetPlaceDisplayName(place);

                      return (
                      <div
                        key={`${place?.id ?? place?.name ?? "p"}-${globalIndex}`}
                        style={{
                          ...styles.aiSheetItem,
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "stretch",
                          gap: 8,
                          cursor: "default",
                        }}
                      >
                        <button
                          type="button"
                          style={{
                            flex: 1,
                            minWidth: 0,
                            border: "none",
                            background: "transparent",
                            padding: 0,
                            margin: 0,
                            cursor: "pointer",
                            textAlign: "left",
                            font: "inherit",
                            color: "inherit",
                            borderRadius: "inherit",
                          }}
                          onClick={() => {
                            if (useImportRecPlacesForAiSheet) {
                              handleRecommendPlaceFromList(place);
                              setAiSheetOpen(false);
                              return;
                            }
                            setSelectedPlaceWithAnalytics(place, "search_result", {
                              clickedRank: globalIndex + 1,
                              userVisibleCandidateCount:
                                aiBottomSheetPlaces.length,
                            });
                            setAiSheetOpen(false);
                            const lat = parseFloat(place.y ?? place.lat);
                            const lng = parseFloat(place.x ?? place.lng);
                            if (
                              Number.isFinite(lat) &&
                              Number.isFinite(lng) &&
                              mapRef?.current?.moveToLocation
                            ) {
                              mapRef.current.moveToLocation(lat, lng);
                            }
                            const doRelayout = () =>
                              mapRef.current?.relayout?.();
                            requestAnimationFrame(doRelayout);
                            setTimeout(doRelayout, 100);
                            setTimeout(doRelayout, 320);
                          }}
                        >
                        <div style={styles.aiSheetItemTop}>
                          <div style={styles.aiSheetRank}>{globalIndex + 1}</div>

                          <div style={styles.aiSheetMain}>
                            <div style={styles.aiSheetNameRow}>
                              <span style={styles.aiSheetName}>{displayBusinessName}</span>
                            </div>

                            <div style={styles.aiSheetMeta}>
                              {place.address || place.address_name || '주소 정보 없음'}
                            </div>

                            {distanceLabel ? (
                              <div style={styles.aiSheetDistance}>
                                {distanceLabel}
                              </div>
                            ) : null}

                            {cleanedStoryLine ? (
                              <>
                                <div style={styles.aiSheetReasonLabel}>
                                  이 장소를 고른 이유
                                </div>
                                <div
                                  style={{
                                    ...styles.aiSheetWhyRecommended,
                                    ...(isStoryExpanded
                                      ? styles.aiSheetWhyRecommendedExpanded
                                      : {}),
                                  }}
                                >
                                  {cleanedStoryLine}
                                </div>
                                {canExpandStory ? (
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    style={styles.aiSheetWhyExpandButton}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAiSheetExpandedReasonByKey((prev) => ({
                                        ...prev,
                                        [storyKey]: !prev[storyKey],
                                      }));
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key !== "Enter" && e.key !== " ") return;
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setAiSheetExpandedReasonByKey((prev) => ({
                                        ...prev,
                                        [storyKey]: !prev[storyKey],
                                      }));
                                    }}
                                  >
                                    {isStoryExpanded ? "접기" : "펼치기"}
                                  </span>
                                ) : null}
                              </>
                            ) : null}

                            {extras.rep ? (
                              <div style={styles.aiSheetRepTagRow}>
                                <span style={styles.aiSheetRepTag}>대표 · {extras.rep}</span>
                              </div>
                            ) : null}

                            {cc != null ? (
                              <div style={styles.aiSheetCuratorSave}>
                                저장한 큐레이터 {cc}명
                              </div>
                            ) : null}

                            {sheetTags.length > 0 ? (
                              <div style={styles.aiSheetTags}>
                                {sheetTags.slice(0, 4).map((tag) => (
                                  <span key={tag} style={styles.aiSheetTag}>
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          <div
                            style={styles.aiSheetPreviewWrap}
                            role="button"
                            tabIndex={0}
                            aria-label="사진 크게 보기"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (
                                Date.now() <
                                aiSheetPhotoViewerSuppressOpenUntilRef.current
                              ) {
                                return;
                              }
                              const key = aiSheetPlacePreviewKey(place);
                              const idx = aiSheetPhotoViewerItems.findIndex(
                                (it) => it.key === key
                              );
                              if (idx >= 0) {
                                setAiSheetPhotoViewerIndex(idx);
                                setAiSheetPhotoViewerOpen(true);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key !== "Enter" && e.key !== " ") return;
                              e.preventDefault();
                              e.stopPropagation();
                              if (
                                Date.now() <
                                aiSheetPhotoViewerSuppressOpenUntilRef.current
                              ) {
                                return;
                              }
                              const key = aiSheetPlacePreviewKey(place);
                              const idx = aiSheetPhotoViewerItems.findIndex(
                                (it) => it.key === key
                              );
                              if (idx >= 0) {
                                setAiSheetPhotoViewerIndex(idx);
                                setAiSheetPhotoViewerOpen(true);
                              }
                            }}
                          >
                            {sheetPreviewUrl ? (
                              <img
                                src={sheetPreviewUrl}
                                alt=""
                                loading="lazy"
                                style={styles.aiSheetPreviewImage}
                                onError={(e) => {
                                  const next = fallbackStaticMapUrl || "";
                                  if (
                                    next &&
                                    e.currentTarget.getAttribute("src") !== next
                                  ) {
                                    e.currentTarget.src = next;
                                    return;
                                  }
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            ) : (
                              <div style={styles.aiSheetPreviewFallback}>사진 없음</div>
                            )}
                          </div>
                        </div>
                        </button>
                      </div>
                      );
                    })}

                    {curatorSearchHighlightList.length > 0 ? (
                      <>
                        <div style={{ ...styles.aiSheetSectionLabel, marginTop: 14 }}>
                          큐레이터
                        </div>
                        {curatorSearchHighlightList.map((h) => (
                          <button
                            key={h.key}
                            type="button"
                            style={styles.aiCuratorHighlight}
                            onClick={() => {
                              setShowAll(false);
                              setSelectedCurators([
                                canonicalCuratorChipToken(
                                  h.curatorUsername,
                                  dbCurators
                                ),
                              ]);
                              setAiSheetOpen(false);
                            }}
                          >
                            <div style={styles.aiCuratorHighlightHead}>{h.headline}</div>
                            <div style={styles.aiCuratorHighlightSub}>{h.sub}</div>
                          </button>
                        ))}
                      </>
                    ) : null}

                    <HomeBlogReviewSection blogReviews={blogReviews} />
                  </div>
                </div>
              ) : null}
                </div>

              {aiSheetPhotoViewerOpen && aiSheetPhotoViewerItems.length > 0
                ? createPortal(
                    <div
                      role="presentation"
                      style={{
                        ...styles.aiSheetPhotoViewerBackdrop,
                        zIndex: 2147483000,
                      }}
                      onPointerDown={(e) => {
                        if (e.target === e.currentTarget) {
                          e.preventDefault();
                          closeAiSheetPhotoViewer();
                        }
                      }}
                      onClick={(e) => {
                        if (e.target === e.currentTarget) {
                          e.preventDefault();
                          e.stopPropagation();
                          closeAiSheetPhotoViewer();
                        }
                      }}
                    >
                      <button
                        type="button"
                        style={styles.aiSheetPhotoViewerClose}
                        onClick={(e) => {
                          e.stopPropagation();
                          closeAiSheetPhotoViewer();
                        }}
                        aria-label="사진 닫기"
                      >
                        ×
                      </button>
                      {aiSheetPhotoViewerItems.length > 1 ? (
                        <button
                          type="button"
                          style={styles.aiSheetPhotoViewerPrev}
                          onClick={(e) => {
                            e.stopPropagation();
                            setAiSheetPhotoViewerIndex((idx) =>
                              (idx - 1 + aiSheetPhotoViewerItems.length) %
                              aiSheetPhotoViewerItems.length
                            );
                          }}
                          aria-label="이전 사진"
                        >
                          ‹
                        </button>
                      ) : null}
                      <img
                        src={
                          aiSheetPhotoViewerItems[aiSheetPhotoViewerIndex]?.src
                        }
                        alt={
                          aiSheetPhotoViewerItems[aiSheetPhotoViewerIndex]
                            ?.title || ""
                        }
                        style={styles.aiSheetPhotoViewerImage}
                        draggable={false}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      />
                      {aiSheetPhotoViewerItems.length > 1 ? (
                        <button
                          type="button"
                          style={styles.aiSheetPhotoViewerNext}
                          onClick={(e) => {
                            e.stopPropagation();
                            setAiSheetPhotoViewerIndex((idx) =>
                              (idx + 1) % aiSheetPhotoViewerItems.length
                            );
                          }}
                          aria-label="다음 사진"
                        >
                          ›
                        </button>
                      ) : null}
                    </div>,
                    document.body
                  )
                : null}
              </div>
            </>

  );
}
