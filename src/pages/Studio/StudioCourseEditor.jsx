import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  createCuratorCourse,
  deleteCuratorCourse,
  fetchCuratorCourseById,
  saveCuratorCoursePlaces,
  updateCuratorCourse,
} from "../../api/curatorCourses";
import {
  mapPlaceRowForCourse,
  mergeCourseSearchWithKakao,
  searchPlacesForCourse,
} from "../../api/places";
import { supabase } from "../../lib/supabase";
import { ensurePlaceUuidForPick } from "../../utils/resolvePlaceUuidForPick";
import { syncCuratorGradeTotalPlaces } from "../../utils/curatorGradeCount";
import {
  resolveCourseCoverFromFirstPlace,
} from "../../utils/courseStepThumb";
import { COURSE_BOOKING_STATUS_OPTIONS } from "../../utils/courseTimeAssurance";
import {
  studioCoursesShell,
  studioCoursesScrollMain,
  studioCoursesInner,
  studioCoursesTopRow,
  studioCoursesH1,
  studioCoursesCard,
  studioCoursesCardTitle,
  studioCoursesLabel,
  studioCoursesInput,
  studioCoursesBtnPrimary,
  studioCoursesBtnGhost,
  studioCoursesBtnDanger,
  studioCoursesRowActions,
  studioCoursesStickyFooter,
  studioCoursesStickyBtn,
  studioCoursesCoverBox,
  studioCoursesCoverThumb,
  studioCoursesCoverPickBtn,
  studioCoursesPlaceRowCompact,
  studioCoursesPlaceOrderBadge,
  studioCoursesPlaceDragHandle,
  studioCoursesIconBtn,
  studioCoursesHint,
  studioCoursesTitleInput,
} from "./studioCoursesSharedStyles";
import CourseMapPreview from "../../components/Course/CourseMapPreview";
import StudioScrollLayout from "../../components/Studio/StudioScrollLayout";
import StudioPlaceMapSearchPanel from "../../components/Studio/StudioPlaceMapSearchPanel";
import StudioMapSearchSuggestions from "../../components/Studio/StudioMapSearchSuggestions";
import useMobileLayout from "../../hooks/useMobileLayout";
import { isAcceptableRasterImageFile } from "../../utils/prepareImageFileForUpload";
import { uploadCuratorCourseCoverFile } from "../../utils/curatorPlacePhotos";
import { removeImportedCuratorCourse } from "../../api/courseImports";
import { isImportedCuratorCourse } from "../../utils/courseImportUi";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeHashtagTag(raw) {
  const t = String(raw || "").trim();
  if (!t) return "";
  const body = t.startsWith("#") ? t.slice(1).trim() : t;
  if (!body) return "";
  return `#${body}`;
}

function normalizeHashtagTags(raw) {
  const list = Array.isArray(raw)
    ? raw
    : String(raw || "")
        .split(/[,，\s]+/g)
        .map((s) => s.trim())
        .filter(Boolean);
  const out = [];
  const seen = new Set();
  for (const item of list) {
    const tag = normalizeHashtagTag(item);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

function parseRowCoord(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function captureEditorSnapshot({
  title,
  description,
  area,
  themeTags,
  coverImageUrl,
  placeRows,
}) {
  const places = (Array.isArray(placeRows) ? placeRows : [])
    .filter((r) => UUID_RE.test(String(r?.place_id || "").trim()))
    .map((r) => ({
      place_id: String(r.place_id).trim().toLowerCase(),
      memo: String(r.memo ?? "").trim(),
      stay_minutes: String(r.stay_minutes ?? "").trim(),
      booking_status: String(r.booking_status ?? "unknown").trim(),
      booking_url: String(r.booking_url ?? "").trim(),
      booking_phone: String(r.booking_phone ?? "").trim(),
      crowd_note: String(r.crowd_note ?? "").trim(),
    }));
  return JSON.stringify({
    title: String(title ?? "").trim(),
    description: String(description ?? "").trim(),
    area: String(area ?? "").trim(),
    themeTags: normalizeHashtagTags(themeTags)
      .map((t) => t.toLowerCase())
      .sort(),
    coverImageUrl: String(coverImageUrl ?? "").trim(),
    places,
  });
}

function newPlaceRowFromHit(hit) {
  const h = hit && typeof hit === "object" ? hit : {};
  return {
    key: `place-${h.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    place_id: String(h.id || "").trim(),
    place_name: String(h.name || "").trim() || "이름 없음",
    place_address: String(h.address || "").trim(),
    place_category: String(h.category || "").trim(),
    place_lat: parseRowCoord(h.lat),
    place_lng: parseRowCoord(h.lng),
    kakao_place_id: String(h.kakao_place_id || "").trim() || null,
    memo: "",
    stay_minutes: "",
    booking_status: "unknown",
    booking_url: "",
    booking_phone: "",
    crowd_note: "",
  };
}

function getSearchHitDedupeKeys(hit) {
  const keys = [];
  const id = String(hit?.id ?? "").trim();
  if (id) keys.push(id);
  const kakaoId = String(
    hit?.kakao_place_id ?? hit?._kakaoDoc?.id ?? ""
  ).trim();
  if (kakaoId) keys.push(kakaoId);
  return keys;
}

function searchHitIsAlreadyInCourse(hit, coursePlaceKeySet) {
  return getSearchHitDedupeKeys(hit).some((key) => coursePlaceKeySet.has(key));
}

async function enrichPlaceRowKakaoMeta(row) {
  if (!row || typeof row !== "object") return row;
  if (String(row.kakao_place_id || "").trim()) return row;
  const pid = String(row.place_id || "").trim();
  if (!UUID_RE.test(pid)) return row;
  const { data, error } = await supabase
    .from("places")
    .select("kakao_place_id, name, place_name, address, lat, lng")
    .eq("id", pid)
    .maybeSingle();
  if (error || !data) return row;
  const meta = mapPlaceRowForCourse(data);
  return {
    ...row,
    kakao_place_id: meta.kakao_place_id || row.kakao_place_id || null,
    place_name: row.place_name || meta.name,
    place_address: row.place_address || meta.address,
    place_lat: row.place_lat ?? meta.lat,
    place_lng: row.place_lng ?? meta.lng,
  };
}

export default function StudioCourseEditor() {
  const navigate = useNavigate();
  const location = useLocation();
  const { courseId } = useParams();
  const isNew = !courseId;
  const { user, loading: authLoading } = useAuth();
  const seedAppliedRef = useRef(false);

  const [loadingCourse, setLoadingCourse] = useState(!isNew);
  const [loadErr, setLoadErr] = useState("");
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [area, setArea] = useState("");
  const [themeTags, setThemeTags] = useState([]);
  const [tagInputValue, setTagInputValue] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [autoCoverUrl, setAutoCoverUrl] = useState("");
  const autoCoverGenRef = useRef(0);

  const [placeRows, setPlaceRows] = useState([]);
  const [draggingPlaceKey, setDraggingPlaceKey] = useState(null);
  const [dragOverPlaceKey, setDragOverPlaceKey] = useState(null);
  const placeDragRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchHits, setSearchHits] = useState([]);
  const [searchTouched, setSearchTouched] = useState(false);
  const [showSearchSuggest, setShowSearchSuggest] = useState(false);
  const [selectedSearchId, setSelectedSearchId] = useState(null);
  const [searchSuggestDismissing, setSearchSuggestDismissing] = useState(false);
  const [suggestDismissSnapshot, setSuggestDismissSnapshot] = useState(null);
  const [selectedSuggestKey, setSelectedSuggestKey] = useState(null);
  const searchDebounceRef = useRef(null);
  const [resolvePlaceBusy, setResolvePlaceBusy] = useState(false);
  const [manualUuidInput, setManualUuidInput] = useState("");
  const [coverUploading, setCoverUploading] = useState(false);
  const coverInputRef = useRef(null);
  const [importedFromCourseId, setImportedFromCourseId] = useState(null);
  const [importDeleteBusy, setImportDeleteBusy] = useState(false);
  const savedSnapshotRef = useRef(null);

  const isMobile = useMobileLayout();
  const isImportedSnapshot = Boolean(importedFromCourseId);

  const placeCount = useMemo(
    () =>
      placeRows.filter((r) => UUID_RE.test(String(r.place_id || "").trim()))
        .length,
    [placeRows]
  );

  const firstPlaceRow = useMemo(
    () =>
      placeRows.find((r) => UUID_RE.test(String(r.place_id || "").trim())) ||
      null,
    [placeRows]
  );

  const displayCoverUrl = String(coverImageUrl || "").trim() || autoCoverUrl;
  const coverUsesFirstPlacePhoto =
    !String(coverImageUrl || "").trim() && Boolean(autoCoverUrl);

  const currentSnapshot = useMemo(
    () =>
      captureEditorSnapshot({
        title,
        description,
        area,
        themeTags,
        coverImageUrl,
        placeRows,
      }),
    [title, description, area, themeTags, coverImageUrl, placeRows]
  );

  const isDirty = useMemo(() => {
    if (savedSnapshotRef.current == null) return false;
    return currentSnapshot !== savedSnapshotRef.current;
  }, [currentSnapshot]);

  const markSavedSnapshot = useCallback(
    (snapshotState) => {
      savedSnapshotRef.current = captureEditorSnapshot(snapshotState);
    },
    []
  );

  const loadCourse = useCallback(async () => {
    if (!courseId || !user?.id) return;
    setLoadingCourse(true);
    setLoadErr("");
    try {
      const row = await fetchCuratorCourseById(courseId);
      if (!row) {
        setLoadErr("코스를 찾을 수 없습니다.");
        setLoadingCourse(false);
        return;
      }
      if (String(row.curator_id) !== String(user.id)) {
        setLoadErr("이 코스를 수정할 권한이 없습니다.");
        setLoadingCourse(false);
        return;
      }
      setImportedFromCourseId(
        isImportedCuratorCourse(row)
          ? String(row.imported_from_course_id || "").trim() || null
          : null
      );
      setTitle(row.title ?? "");
      setDescription(row.description ?? "");
      setArea(row.area ?? "");
      setThemeTags(normalizeHashtagTags(row.theme_tags));
      setTagInputValue("");
      setCoverImageUrl(row.cover_image_url ?? "");

      const steps = Array.isArray(row.curator_course_places)
        ? [...row.curator_course_places].sort(
            (a, b) => Number(a.order_index) - Number(b.order_index)
          )
        : [];
      let loadedRows = [];
      if (steps.length > 0) {
        loadedRows = await Promise.all(
          steps.map(async (s) => {
            const pl = s.places && typeof s.places === "object" ? s.places : {};
            const meta = mapPlaceRowForCourse({
              id: s.place_id,
              ...pl,
            });
            const row = {
              key: s.id || `loaded-${s.place_id}-${s.order_index}`,
              place_id: String(s.place_id ?? ""),
              place_name: meta.name,
              place_address: meta.address,
              place_category: meta.category,
              place_lat: meta.lat,
              place_lng: meta.lng,
              kakao_place_id: meta.kakao_place_id || pl.kakao_place_id || null,
              memo: s.memo ?? "",
              stay_minutes:
                s.stay_minutes != null && s.stay_minutes !== ""
                  ? String(s.stay_minutes)
                  : "",
              booking_status: String(s.booking_status || "unknown").trim() || "unknown",
              booking_url: String(s.booking_url || "").trim(),
              booking_phone: String(s.booking_phone || "").trim(),
              crowd_note: String(s.crowd_note || "").trim(),
            };
            if (row.place_lat == null || row.place_lng == null) {
              return enrichPlaceRowKakaoMeta(row);
            }
            return row;
          })
        );
      }
      setPlaceRows(loadedRows);
      markSavedSnapshot({
        title: row.title ?? "",
        description: row.description ?? "",
        area: row.area ?? "",
        themeTags: normalizeHashtagTags(row.theme_tags),
        coverImageUrl: row.cover_image_url ?? "",
        placeRows: loadedRows,
      });
    } catch (e) {
      setLoadErr(e?.message || "불러오기 실패");
    } finally {
      setLoadingCourse(false);
    }
  }, [courseId, user?.id, markSavedSnapshot]);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) return;
    if (!isNew) {
      void loadCourse();
      return;
    }
    setLoadingCourse(false);

    const seed = location.state?.studioCourseSeed;
    if (
      !seedAppliedRef.current &&
      seed &&
      typeof seed === "object" &&
      Array.isArray(seed.placeRows) &&
      seed.placeRows.length > 0
    ) {
      seedAppliedRef.current = true;
      const rows = seed.placeRows.map((r, i) => ({
        ...r,
        key:
          r.key ||
          `seed-${String(r.place_id || i)}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      }));
      setTitle(String(seed.title || ""));
      setDescription(String(seed.description || ""));
      setArea(String(seed.area || ""));
      setThemeTags(normalizeHashtagTags(seed.themeTags));
      setTagInputValue("");
      setPlaceRows(rows);
      markSavedSnapshot({
        title: seed.title || "",
        description: seed.description || "",
        area: seed.area || "",
        themeTags: normalizeHashtagTags(seed.themeTags),
        coverImageUrl: "",
        placeRows: rows,
      });
      navigate(location.pathname, { replace: true, state: {} });
      return;
    }

    markSavedSnapshot({
      title: "",
      description: "",
      area: "",
      themeTags: [],
      coverImageUrl: "",
      placeRows: [],
    });
    setTagInputValue("");
  }, [
    authLoading,
    user?.id,
    isNew,
    loadCourse,
    markSavedSnapshot,
    location.pathname,
    location.state,
    navigate,
  ]);

  useEffect(() => {
    if (String(coverImageUrl || "").trim()) {
      setAutoCoverUrl("");
      return undefined;
    }
    if (!firstPlaceRow) {
      setAutoCoverUrl("");
      return undefined;
    }
    const gen = autoCoverGenRef.current + 1;
    autoCoverGenRef.current = gen;
    let cancelled = false;
    void (async () => {
      try {
        const enriched = await enrichPlaceRowKakaoMeta(firstPlaceRow);
        if (cancelled || autoCoverGenRef.current !== gen) return;
        const url = await resolveCourseCoverFromFirstPlace(enriched);
        if (cancelled || autoCoverGenRef.current !== gen) return;
        setAutoCoverUrl(url || "");
      } catch {
        if (!cancelled && autoCoverGenRef.current === gen) setAutoCoverUrl("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [coverImageUrl, firstPlaceRow]);

  const addThemeTag = useCallback((raw) => {
    const tag = normalizeHashtagTag(raw);
    if (!tag) return;
    setThemeTags((prev) => {
      const key = tag.toLowerCase();
      if (prev.some((t) => t.toLowerCase() === key)) return prev;
      return [...prev, tag];
    });
    setTagInputValue("");
  }, []);

  const removeThemeTag = useCallback((tagToRemove) => {
    setThemeTags((prev) => prev.filter((t) => t !== tagToRemove));
  }, []);

  const handleThemeTagKeyDown = (e) => {
    if (e.key !== "Enter") return;
    if (e.nativeEvent?.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    addThemeTag(e.currentTarget.value);
  };

  useEffect(() => {
    if (authLoading || loadingCourse || isNew || !isImportedSnapshot || !courseId) {
      return;
    }
    navigate(`/courses/${encodeURIComponent(String(courseId))}`, {
      replace: true,
    });
  }, [
    authLoading,
    loadingCourse,
    isNew,
    isImportedSnapshot,
    courseId,
    navigate,
  ]);

  const buildPlacePayload = useCallback(() => {
    const cleaned = [];
    const seen = new Set();
    for (let i = 0; i < placeRows.length; i++) {
      const pid = String(placeRows[i].place_id ?? "").trim();
      if (!pid) continue;
      if (!UUID_RE.test(pid)) {
        throw new Error(`장소 ${i + 1}: place_id 가 올바른 UUID 형식이 아닙니다.`);
      }
      if (seen.has(pid)) {
        throw new Error("같은 place_id 는 한 코스에 한 번만 넣을 수 있습니다.");
      }
      seen.add(pid);
      const sm = String(placeRows[i].stay_minutes ?? "").trim();
      let stay = null;
      if (sm !== "") {
        const n = Number(sm);
        if (!Number.isFinite(n) || n < 0) {
          throw new Error(`장소 ${i + 1}: 체류 시간(분)은 0 이상 숫자여야 합니다.`);
        }
        stay = Math.floor(n);
      }
      cleaned.push({
        place_id: pid,
        order_index: cleaned.length,
        memo: String(placeRows[i].memo ?? "").trim() || null,
        image_url: null,
        stay_minutes: stay,
        booking_status: String(placeRows[i].booking_status || "unknown").trim(),
        booking_url: String(placeRows[i].booking_url ?? "").trim() || null,
        booking_phone: String(placeRows[i].booking_phone ?? "").trim() || null,
        crowd_note: String(placeRows[i].crowd_note ?? "").trim() || null,
      });
    }
    if (cleaned.length > 6) {
      throw new Error("장소는 최대 6개까지입니다.");
    }
    return cleaned;
  }, [placeRows]);

  const persistPlaces = useCallback(
    async (cid) => {
      const payload = buildPlacePayload();
      if (payload.length < 1) {
        throw new Error("유효한 장소(place_id)를 1개 이상 입력해 주세요.");
      }
      await saveCuratorCoursePlaces(cid, payload);
    },
    [buildPlacePayload]
  );

  const handleCancel = () => {
    if (isDirty) {
      if (!window.confirm("저장 내용이 있는데 취소할까요?")) return;
    }
    navigate("/studio/courses");
  };

  const handleConfirm = async () => {
    if (isImportedSnapshot) {
      alert("스크랩한 코스는 수정할 수 없습니다.");
      return;
    }
    const t = String(title).trim();
    if (!t) {
      alert("코스 제목을 입력해 주세요.");
      return;
    }
    let payloadPlaces;
    try {
      payloadPlaces = buildPlacePayload();
    } catch (e) {
      alert(e?.message || "장소 입력을 확인해 주세요.");
      return;
    }
    if (payloadPlaces.length < 1) {
      alert("유효한 장소(place_id)를 1개 이상 입력해 주세요.");
      return;
    }

    setSaving(true);
    try {
      if (!user?.id) throw new Error("로그인이 필요합니다.");

      let cid = courseId;
      const tags = normalizeHashtagTags(themeTags);
      let cover = String(coverImageUrl).trim();
      if (!cover && firstPlaceRow) {
        const enriched = await enrichPlaceRowKakaoMeta(firstPlaceRow);
        cover = (await resolveCourseCoverFromFirstPlace(enriched)) || "";
      }
      const meta = {
        title: t,
        description: String(description).trim() || null,
        area: String(area).trim() || null,
        theme_tags: tags,
        cover_image_url: cover || null,
      };
      const snapshotAfterSave = {
        title: t,
        description,
        area,
        themeTags: tags,
        coverImageUrl: cover,
        placeRows,
      };

      if (isNew || !cid) {
        const created = await createCuratorCourse({
          curator_id: user.id,
          ...meta,
          status: "draft",
          is_public: false,
        });
        cid = created?.id;
        if (!cid) throw new Error("코스 생성 후 id 가 없습니다.");
        await persistPlaces(cid);
      } else {
        await updateCuratorCourse(cid, meta);
        await persistPlaces(cid);
      }
      markSavedSnapshot(snapshotAfterSave);
      void syncCuratorGradeTotalPlaces(user.id);
      navigate("/studio/courses");
    } catch (e) {
      alert(e?.message || "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const addPlaceToCourse = useCallback(async (hit) => {
    if (!hit || typeof hit !== "object") return false;

    let resolved = hit;
    const rawId = String(hit.id ?? "").trim();
    if (!UUID_RE.test(rawId)) {
      const doc = hit._kakaoDoc;
      if (!doc || doc.id == null) return false;
      setResolvePlaceBusy(true);
      try {
        const placeForEnsure = {
          id: String(doc.id),
          place_name: doc.place_name,
          road_address_name: doc.road_address_name,
          address_name: doc.address_name,
          category_name: doc.category_name,
          y: doc.y,
          x: doc.x,
          kakao_place_id: String(doc.id),
        };
        const uuid = await ensurePlaceUuidForPick(placeForEnsure, {
          createIfMissing: true,
        });
        if (!uuid) {
          alert(
            "장소를 코스용 DB에 등록하지 못했습니다. 로그인·네트워크·권한을 확인해 주세요."
          );
          return false;
        }
        const { data, error } = await supabase
          .from("places")
          .select(
            "id, name, place_name, address, category, category_name, lat, lng, kakao_place_id"
          )
          .eq("id", uuid)
          .maybeSingle();
        if (!error && data) {
          resolved = mapPlaceRowForCourse(data);
        } else {
          resolved = mapPlaceRowForCourse({
            id: uuid,
            name: hit.name,
            address: hit.address,
            category: hit.category,
            lat: hit.lat,
            lng: hit.lng,
          });
        }
      } finally {
        setResolvePlaceBusy(false);
      }
    }

    const row = newPlaceRowFromHit(resolved);
    if (!UUID_RE.test(row.place_id)) return false;

    let didAdd = false;
    setPlaceRows((prev) => {
      if (prev.some((r) => r.place_id === row.place_id)) {
        return prev;
      }
      const n = prev.filter((r) =>
        UUID_RE.test(String(r.place_id || "").trim())
      ).length;
      if (n >= 6) {
        alert("장소는 최대 6개까지 추가할 수 있습니다.");
        return prev;
      }
      didAdd = true;
      return [...prev, row];
    });
    return didAdd;
  }, []);

  const runCoursePlaceSearch = useCallback(async (q, { maxTotal = 12, kakaoSize = 8 } = {}) => {
    const dbHits = await searchPlacesForCourse(q, { limit: 20 });
    return mergeCourseSearchWithKakao(dbHits, q, { maxTotal, kakaoSize });
  }, []);

  const handleRunSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchHits([]);
      setSearchTouched(true);
      setSelectedSearchId(null);
      setShowSearchSuggest(false);
      return;
    }
    setSearchLoading(true);
    setSearchTouched(true);
    setShowSearchSuggest(true);
    try {
      const hits = await runCoursePlaceSearch(q, { maxTotal: 24, kakaoSize: 12 });
      setSearchHits(hits);
      setSelectedSearchId((cur) =>
        cur && hits.some((h) => h.id === cur) ? cur : null
      );
    } catch (e) {
      console.error("[코스 장소 검색]", e);
      setSearchHits([]);
    } finally {
      setSearchLoading(false);
    }
  }, [runCoursePlaceSearch, searchQuery]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchHits([]);
      setShowSearchSuggest(false);
      setSearchTouched(false);
      setSelectedSearchId(null);
      return undefined;
    }

    setShowSearchSuggest(true);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      void (async () => {
        setSearchLoading(true);
        setSearchTouched(true);
        try {
          const hits = await runCoursePlaceSearch(q);
          setSearchHits(hits);
          setSelectedSearchId((cur) =>
            cur && hits.some((h) => h.id === cur) ? cur : null
          );
        } catch (e) {
          console.error("[코스 장소 자동완성]", e);
          setSearchHits([]);
        } finally {
          setSearchLoading(false);
        }
      })();
    }, 280);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [runCoursePlaceSearch, searchQuery]);

  const handleClearCourseSearch = useCallback(() => {
    setSearchQuery("");
    setSearchHits([]);
    setSearchTouched(false);
    setShowSearchSuggest(false);
    setSelectedSearchId(null);
    setSearchSuggestDismissing(false);
    setSuggestDismissSnapshot(null);
    setSelectedSuggestKey(null);
  }, []);

  const addManualUuid = () => {
    const id = manualUuidInput.trim();
    if (!UUID_RE.test(id)) {
      alert("올바른 UUID 형식이 아닙니다.");
      return;
    }
    addPlaceToCourse({
      id,
      name: "직접 입력",
      address: "",
      category: "",
      lat: null,
      lng: null,
    });
    setManualUuidInput("");
  };

  const handleDeleteCourse = async () => {
    if (!courseId) return;
    if (!window.confirm("이 코스를 삭제할까요? 되돌릴 수 없습니다.")) return;
    setSaving(true);
    try {
      await deleteCuratorCourse(courseId);
      if (user?.id) void syncCuratorGradeTotalPlaces(user.id);
      navigate("/studio/courses");
    } catch (e) {
      alert(e?.message || "삭제에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteImportedCourse = async () => {
    if (!courseId) return;
    if (
      !window.confirm(
        "스크랩한 코스를 삭제할까요? 원본 코스는 그대로 남습니다."
      )
    ) {
      return;
    }
    setImportDeleteBusy(true);
    try {
      await removeImportedCuratorCourse(courseId);
      navigate("/studio/courses");
    } catch (e) {
      alert(e?.message || "삭제에 실패했습니다.");
    } finally {
      setImportDeleteBusy(false);
    }
  };

  const removeRow = (key) => {
    setPlaceRows((prev) => prev.filter((r) => r.key !== key));
  };

  const reorderPlaceRows = (fromKey, toKey) => {
    if (!fromKey || !toKey || fromKey === toKey) return;
    setPlaceRows((prev) => {
      const from = prev.findIndex((r) => r.key === fromKey);
      const to = prev.findIndex((r) => r.key === toKey);
      if (from < 0 || to < 0 || from === to) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const clearPlaceDragState = () => {
    setDraggingPlaceKey(null);
    setDragOverPlaceKey(null);
  };

  const findPlaceRowKeyFromPoint = (_clientX, clientY) => {
    const rows = document.querySelectorAll("[data-place-row-key]");
    for (const rowEl of rows) {
      const rect = rowEl.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) {
        return rowEl.getAttribute("data-place-row-key");
      }
    }
    return null;
  };

  const handlePlaceDragPointerDown = (e, key) => {
    if (saving || e.button !== 0) return;
    e.preventDefault();
    placeDragRef.current = {
      fromKey: key,
      overKey: key,
      pointerId: e.pointerId,
    };
    setDraggingPlaceKey(key);
    setDragOverPlaceKey(key);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePlaceDragPointerMove = (e) => {
    const st = placeDragRef.current;
    if (!st || st.pointerId !== e.pointerId) return;
    const overKey = findPlaceRowKeyFromPoint(e.clientX, e.clientY);
    if (!overKey || overKey === st.overKey) return;
    st.overKey = overKey;
    setDragOverPlaceKey(overKey);
  };

  const finishPlaceDrag = (e) => {
    const st = placeDragRef.current;
    if (!st || st.pointerId !== e.pointerId) return;
    const { fromKey, overKey } = st;
    placeDragRef.current = null;
    if (fromKey && overKey) reorderPlaceRows(fromKey, overKey);
    clearPlaceDragState();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
  };

  const cancelPlaceDrag = (e) => {
    const st = placeDragRef.current;
    if (!st || st.pointerId !== e.pointerId) return;
    placeDragRef.current = null;
    clearPlaceDragState();
  };

  const updateRow = (key, field, value) => {
    setPlaceRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value } : r))
    );
  };

  const handleCoverFilePick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user?.id) return;
    if (!isAcceptableRasterImageFile(file)) {
      alert("이미지 파일만 올릴 수 있어요.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("5MB 이하 이미지만 올려 주세요.");
      return;
    }
    setCoverUploading(true);
    try {
      const publicUrl = await uploadCuratorCourseCoverFile(file, user.id);
      setCoverImageUrl(publicUrl);
    } catch (err) {
      alert(err?.message || "커버 업로드에 실패했습니다.");
    } finally {
      setCoverUploading(false);
    }
  };

  const canAddMore =
    placeRows.filter((r) => UUID_RE.test(String(r.place_id || "").trim()))
      .length < 6;

  const coursePlaceKeySet = useMemo(() => {
    const keys = new Set();
    for (const row of placeRows) {
      const placeId = String(row.place_id || "").trim();
      if (UUID_RE.test(placeId)) keys.add(placeId);
      const kakaoId = String(row.kakao_place_id || "").trim();
      if (kakaoId) keys.add(kakaoId);
    }
    return keys;
  }, [placeRows]);

  const searchSuggestHits = useMemo(
    () =>
      searchHits.filter(
        (hit) => !searchHitIsAlreadyInCourse(hit, coursePlaceKeySet)
      ),
    [coursePlaceKeySet, searchHits]
  );

  const pickSearchHit = useCallback(
    async (hit) => {
      if (!hit || hit.id == null) return;
      if (saving || resolvePlaceBusy || !canAddMore || searchSuggestDismissing) {
        return;
      }
      if (searchHitIsAlreadyInCourse(hit, coursePlaceKeySet)) return;

      setSuggestDismissSnapshot(searchSuggestHits);
      setSelectedSuggestKey(String(hit.id));
      setSearchSuggestDismissing(true);
      await addPlaceToCourse(hit);
    },
    [
      addPlaceToCourse,
      canAddMore,
      coursePlaceKeySet,
      resolvePlaceBusy,
      saving,
      searchSuggestDismissing,
      searchSuggestHits,
    ]
  );

  const handleSuggestDismissEnd = useCallback(() => {
    handleClearCourseSearch();
  }, [handleClearCourseSearch]);

  const handleSearchPinPress = useCallback(
    (hit) => {
      void pickSearchHit(hit);
    },
    [pickSearchHit]
  );

  if (authLoading) {
    return (
      <div style={studioCoursesShell}>
        <div style={{ ...studioCoursesInner, paddingTop: "24px" }}>
          불러오는 중…
        </div>
      </div>
    );
  }

  if (!user?.id) {
    return (
      <div style={studioCoursesShell}>
        <div style={{ ...studioCoursesInner, paddingTop: "24px" }}>
          로그인이 필요합니다.
          <div style={{ marginTop: "12px" }}>
            <button
              type="button"
              style={studioCoursesBtnGhost}
              onClick={() => navigate("/studio")}
            >
              스튜디오로
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isNew && loadingCourse) {
    return (
      <div style={studioCoursesShell}>
        <div style={{ ...studioCoursesInner, paddingTop: "24px" }}>
          코스 불러오는 중…
        </div>
      </div>
    );
  }

  if (!isNew && loadErr) {
    return (
      <div style={studioCoursesShell}>
        <div style={{ ...studioCoursesInner, paddingTop: "24px" }}>
          <div style={{ color: "#ffb4a8", marginBottom: "12px" }}>{loadErr}</div>
          <button
            type="button"
            style={studioCoursesBtnGhost}
            onClick={() => navigate("/studio/courses")}
          >
            목록으로
          </button>
        </div>
      </div>
    );
  }

  if (!isNew && isImportedSnapshot) {
    return (
      <div style={studioCoursesShell}>
        <div style={{ ...studioCoursesInner, paddingTop: "24px", maxWidth: 560 }}>
          <h1 style={studioCoursesH1}>스크랩한 코스</h1>
          <div style={studioCoursesCard}>
            <p style={{ ...studioCoursesHint, marginTop: 0 }}>
              다른 사람 코스를 스크랩해 둔 복사본이에요. 읽기 전용이며 수정·공개는 할 수 없습니다.
            </p>
            <p
              style={{
                fontSize: "18px",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                margin: "12px 0 8px",
              }}
            >
              {title || "제목 없음"}
            </p>
            <div style={studioCoursesRowActions}>
              {importedFromCourseId ? (
                <button
                  type="button"
                  style={studioCoursesBtnPrimary}
                  onClick={() =>
                    navigate(
                      `/courses/${encodeURIComponent(importedFromCourseId)}`
                    )
                  }
                >
                  원본 코스 보기
                </button>
              ) : null}
              <button
                type="button"
                style={studioCoursesBtnGhost}
                onClick={() => navigate("/studio/courses")}
                disabled={importDeleteBusy}
              >
                잔 코스 목록
              </button>
              <button
                type="button"
                style={studioCoursesBtnDanger}
                disabled={importDeleteBusy}
                onClick={() => void handleDeleteImportedCourse()}
              >
                {importDeleteBusy ? "삭제 중…" : "삭제"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <StudioScrollLayout
      shellStyle={{
        ...studioCoursesShell,
      }}
      mainStyle={studioCoursesScrollMain}
      footer={
        isMobile ? (
        <div style={studioCoursesStickyFooter}>
          <button
            type="button"
            style={{
              ...studioCoursesStickyBtn,
              ...studioCoursesBtnGhost,
              backgroundColor: "rgba(255,255,255,0.1)",
            }}
            onClick={handleCancel}
            disabled={saving}
          >
            취소
          </button>
          <button
            type="button"
            style={{
              ...studioCoursesStickyBtn,
              ...studioCoursesBtnPrimary,
            }}
            onClick={() => void handleConfirm()}
            disabled={saving}
          >
            {saving ? "저장 중…" : "확인"}
          </button>
        </div>
        ) : null
      }
    >
      <div style={studioCoursesInner}>
        <div style={studioCoursesTopRow}>
          <h1 style={studioCoursesH1}>{isNew ? "새 코스" : "코스 수정"}</h1>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              style={studioCoursesBtnGhost}
              onClick={handleCancel}
              disabled={saving}
            >
              목록
            </button>
            {!isNew ? (
              <button
                type="button"
                style={studioCoursesBtnDanger}
                onClick={handleDeleteCourse}
                disabled={saving}
              >
                삭제
              </button>
            ) : null}
          </div>
        </div>

        <label style={studioCoursesLabel}>코스 제목</label>
        <input
          style={studioCoursesTitleInput}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 성수 퇴근 2차 코스"
          enterKeyHint="next"
        />

        <div style={studioCoursesCard}>
          <div style={studioCoursesCardTitle}>
            장소 담기 · {placeCount}/6
          </div>
          <p style={studioCoursesHint}>
            가게 이름으로 검색하거나 지도 ＋핀을 눌러 추가하세요. ⠿ 을 드래그해
            순서를 바꿀 수 있어요.
          </p>

          <StudioPlaceMapSearchPanel
            query={searchQuery}
            onQueryChange={setSearchQuery}
            onSearch={() => void handleRunSearch()}
            onClear={handleClearCourseSearch}
            onFocus={() => {
              if (searchQuery.trim().length >= 2) setShowSearchSuggest(true);
            }}
            onBlur={() => {
              setTimeout(() => setShowSearchSuggest(false), 200);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleRunSearch();
              }
            }}
            placeholder="예: 성수 이자카야"
            searchLoading={searchLoading}
            reflectLoadingOnSubmit={false}
            searchDisabled={saving || resolvePlaceBusy}
            isMobile={isMobile}
            interactiveMap
            suggestionsDropdown={
              <StudioMapSearchSuggestions
                open={
                  (showSearchSuggest && searchQuery.trim().length >= 2) ||
                  searchSuggestDismissing
                }
                loading={searchLoading}
                hideLoadingPlaceholder
                dismissing={searchSuggestDismissing}
                onDismissAnimationEnd={handleSuggestDismissEnd}
                selectedItemKey={selectedSuggestKey}
                items={
                  searchSuggestDismissing && suggestDismissSnapshot
                    ? suggestDismissSnapshot
                    : searchSuggestHits
                }
                onSelect={(hit) => {
                  void pickSearchHit(hit);
                }}
                getItemKey={(hit) => String(hit.id)}
                emptyMessage={
                  searchTouched && !searchLoading
                    ? searchSuggestHits.length === 0 &&
                      searchHits.length > 0
                      ? "검색 결과는 모두 코스에 담겨 있어요."
                      : "검색 결과가 없어요."
                    : null
                }
                renderTrailing={(hit) => (
                  <button
                    type="button"
                    style={{
                      ...studioCoursesBtnPrimary,
                      minHeight: "40px",
                      flexShrink: 0,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      void pickSearchHit(hit);
                    }}
                    disabled={saving || !canAddMore || resolvePlaceBusy}
                  >
                    추가
                  </button>
                )}
              />
            }
            mapSlot={
              <CourseMapPreview
                placeRows={placeRows}
                searchHits={searchHits}
                selectedSearchId={selectedSearchId}
                onSearchHitPress={handleSearchPinPress}
                embedded
                interactive
              />
            }
            footerSlot={
              <>
                {searchQuery.trim().length > 0 &&
                searchQuery.trim().length < 2 ? (
                  <div
                    style={{
                      fontSize: "12px",
                      color: "rgba(255,200,120,0.95)",
                      marginTop: "4px",
                    }}
                  >
                    검색어는 2글자 이상 입력해 주세요.
                  </div>
                ) : null}
                {searchHits.some(
                  (h) =>
                    h &&
                    Number.isFinite(Number(h?.lat)) &&
                    Number.isFinite(Number(h?.lng))
                ) ? (
                  <p style={{ ...studioCoursesHint, marginTop: "8px" }}>
                    보라·주황 「＋」핀은 검색 결과입니다. 탭하면 코스에 담습니다. 파란
                    숫자는 이미 담긴 순서예요.
                  </p>
                ) : null}
                {placeRows.length === 0 ? (
                  <p style={{ ...studioCoursesHint, marginTop: "8px" }}>
                    장소를 추가하면 지도에서 동선을 미리 볼 수 있어요.
                  </p>
                ) : null}
              </>
            }
          />
          {!isMobile ? (
            <details
              style={{
                fontSize: "12px",
                color: "rgba(255,255,255,0.5)",
                marginBottom: "12px",
              }}
            >
              <summary style={{ cursor: "pointer", userSelect: "none" }}>
                고급: place_id 직접 입력
              </summary>
              <div
                style={{
                  marginTop: "10px",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                <input
                  style={{ ...studioCoursesInput, flex: "1 1 220px" }}
                  value={manualUuidInput}
                  onChange={(e) => setManualUuidInput(e.target.value)}
                  placeholder="places.id (UUID)"
                />
                <button
                  type="button"
                  style={studioCoursesBtnGhost}
                  onClick={addManualUuid}
                  disabled={saving || !canAddMore}
                >
                  UUID로 추가
                </button>
              </div>
            </details>
          ) : null}

          {placeRows.length === 0 ? (
            <div
              style={{
                fontSize: "13px",
                color: "rgba(255,255,255,0.45)",
                padding: "8px 0 4px",
              }}
            >
              아직 담은 장소가 없어요.
            </div>
          ) : null}

          {placeRows.map((row, idx) => (
            <div
              key={row.key}
              data-place-row-key={row.key}
              style={{
                ...studioCoursesPlaceRowCompact,
                border:
                  dragOverPlaceKey === row.key
                    ? "1px solid rgba(52,152,219,0.65)"
                    : studioCoursesPlaceRowCompact.border,
                backgroundColor:
                  dragOverPlaceKey === row.key
                    ? "rgba(52,152,219,0.08)"
                    : studioCoursesPlaceRowCompact.backgroundColor,
                opacity: draggingPlaceKey === row.key ? 0.55 : 1,
                transition:
                  "border-color 0.12s ease, background-color 0.12s ease, opacity 0.12s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  alignItems: "flex-start",
                }}
              >
                <div
                  title="드래그해서 순서 변경"
                  aria-label="드래그해서 순서 변경"
                  onPointerDown={(e) => handlePlaceDragPointerDown(e, row.key)}
                  onPointerMove={handlePlaceDragPointerMove}
                  onPointerUp={finishPlaceDrag}
                  onPointerCancel={cancelPlaceDrag}
                  style={studioCoursesPlaceDragHandle(
                    draggingPlaceKey === row.key
                  )}
                >
                  ⠿
                </div>
                <div style={studioCoursesPlaceOrderBadge}>{idx + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: "15px",
                      marginBottom: "2px",
                      lineHeight: 1.35,
                    }}
                  >
                    {row.place_name || "이름 없음"}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "rgba(255,255,255,0.52)",
                      lineHeight: 1.4,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {row.place_address || "주소 없음"}
                  </div>
                  <details style={{ marginTop: "8px" }}>
                    <summary
                      style={{
                        fontSize: "12px",
                        color: "rgba(255,255,255,0.45)",
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                    >
                      메모·체류·예약 (선택)
                    </summary>
                    <label style={{ ...studioCoursesLabel, marginTop: "8px" }}>
                      메모
                    </label>
                    <input
                      style={{ ...studioCoursesInput, marginBottom: "8px" }}
                      value={row.memo}
                      onChange={(e) =>
                        updateRow(row.key, "memo", e.target.value)
                      }
                    />
                    <label style={studioCoursesLabel}>체류(분)</label>
                    <input
                      style={{ ...studioCoursesInput, marginBottom: "8px" }}
                      value={row.stay_minutes}
                      onChange={(e) =>
                        updateRow(row.key, "stay_minutes", e.target.value)
                      }
                      inputMode="numeric"
                      placeholder="선택"
                    />
                    <label style={studioCoursesLabel}>예약 상태</label>
                    <select
                      style={{ ...studioCoursesInput, marginBottom: "8px" }}
                      value={row.booking_status || "unknown"}
                      onChange={(e) =>
                        updateRow(row.key, "booking_status", e.target.value)
                      }
                    >
                      {COURSE_BOOKING_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <label style={studioCoursesLabel}>예약 링크 (URL)</label>
                    <input
                      style={{ ...studioCoursesInput, marginBottom: "8px" }}
                      value={row.booking_url || ""}
                      onChange={(e) =>
                        updateRow(row.key, "booking_url", e.target.value)
                      }
                      placeholder="https://…"
                      inputMode="url"
                    />
                    <label style={studioCoursesLabel}>전화 예약</label>
                    <input
                      style={{ ...studioCoursesInput, marginBottom: "8px" }}
                      value={row.booking_phone || ""}
                      onChange={(e) =>
                        updateRow(row.key, "booking_phone", e.target.value)
                      }
                      placeholder="02-…"
                      inputMode="tel"
                    />
                    <label style={studioCoursesLabel}>혼잡·웨이팅 메모</label>
                    <input
                      style={{ ...studioCoursesInput, marginBottom: 0 }}
                      value={row.crowd_note || ""}
                      onChange={(e) =>
                        updateRow(row.key, "crowd_note", e.target.value)
                      }
                      placeholder="예: 금요일 혼잡"
                    />
                  </details>
                </div>
                <button
                  type="button"
                  style={{
                    ...studioCoursesIconBtn(false),
                    color: "#ff8a80",
                    borderColor: "rgba(231,76,60,0.4)",
                    flexShrink: 0,
                  }}
                  onClick={() => removeRow(row.key)}
                  disabled={saving}
                  aria-label="삭제"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ ...studioCoursesCard, marginTop: "12px" }}>
          <div style={studioCoursesCardTitle}>코스 정보 (선택)</div>
          <div>
            <label style={studioCoursesLabel}>설명</label>
            <textarea
              style={{
                ...studioCoursesInput,
                minHeight: "72px",
                resize: "vertical",
                marginBottom: "12px",
              }}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="코스 한 줄 소개"
            />
            <label style={studioCoursesLabel}>지역</label>
            <input
              style={{ ...studioCoursesInput, marginBottom: "12px" }}
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="예: 성수"
            />
            <label style={studioCoursesLabel}>태그</label>
            {themeTags.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  marginBottom: "8px",
                }}
              >
                {themeTags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "4px 8px",
                      borderRadius: "999px",
                      backgroundColor: "rgba(52,152,219,0.18)",
                      border: "1px solid rgba(52,152,219,0.35)",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.92)",
                    }}
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeThemeTag(tag)}
                      disabled={saving}
                      aria-label={`${tag} 태그 삭제`}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "rgba(255,255,255,0.65)",
                        cursor: "pointer",
                        padding: 0,
                        lineHeight: 1,
                        fontSize: "14px",
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <input
              style={{ ...studioCoursesInput, marginBottom: "12px" }}
              value={tagInputValue}
              onChange={(e) => setTagInputValue(e.target.value)}
              onKeyDown={handleThemeTagKeyDown}
              placeholder="태그 입력 후 Enter"
              enterKeyHint="done"
            />
            <label style={studioCoursesLabel}>커버 사진</label>
            {coverUsesFirstPlacePhoto ? (
              <p style={{ ...studioCoursesHint, marginTop: 0, marginBottom: "8px" }}>
                1차 장소 카카오 지도 사진이 커버로 자동 적용돼요.
              </p>
            ) : null}
            <div style={{ ...studioCoursesCoverBox, marginBottom: "12px" }}>
              {displayCoverUrl ? (
                <img
                  src={displayCoverUrl}
                  alt="커버 미리보기"
                  style={studioCoursesCoverThumb}
                />
              ) : (
                <div
                  style={{
                    ...studioCoursesCoverThumb,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "11px",
                    color: "rgba(255,255,255,0.35)",
                  }}
                >
                  없음
                </div>
              )}
              <div
                style={{ display: "flex", flexDirection: "column", gap: "6px" }}
              >
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
                  style={{ display: "none" }}
                  onChange={(e) => void handleCoverFilePick(e)}
                />
                <button
                  type="button"
                  style={studioCoursesCoverPickBtn}
                  onClick={() => coverInputRef.current?.click()}
                  disabled={saving || coverUploading}
                >
                  {coverUploading ? "올리는 중…" : "갤러리에서 고르기"}
                </button>
                {coverImageUrl ? (
                  <button
                    type="button"
                    style={studioCoursesBtnGhost}
                    onClick={() => setCoverImageUrl("")}
                    disabled={saving || coverUploading}
                  >
                    제거
                  </button>
                ) : autoCoverUrl ? (
                  <span
                    style={{
                      fontSize: "11px",
                      color: "rgba(255,255,255,0.42)",
                      lineHeight: 1.4,
                    }}
                  >
                    직접 올리면 자동 사진 대신 쓰여요.
                  </span>
                ) : null}
              </div>
            </div>
            {!isMobile ? (
              <>
                <label style={studioCoursesLabel}>커버 URL (고급)</label>
                <input
                  style={{ ...studioCoursesInput, marginBottom: 0 }}
                  value={coverImageUrl}
                  onChange={(e) => setCoverImageUrl(e.target.value)}
                  placeholder="https://…"
                />
              </>
            ) : null}
          </div>
        </div>

        {!isMobile ? (
          <div style={{ ...studioCoursesRowActions, marginTop: "16px" }}>
            <button
              type="button"
              style={studioCoursesBtnGhost}
              onClick={handleCancel}
              disabled={saving}
            >
              취소
            </button>
            <button
              type="button"
              style={studioCoursesBtnPrimary}
              onClick={() => void handleConfirm()}
              disabled={saving}
            >
              {saving ? "저장 중…" : "확인"}
            </button>
          </div>
        ) : null}
      </div>
    </StudioScrollLayout>
  );
}