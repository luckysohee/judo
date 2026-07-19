import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  createCuratorList,
  fetchCuratorListById,
  fetchCuratorListPlaces,
  publishCuratorList,
  saveCuratorListPlaces,
  updateCuratorList,
} from "../../api/curatorLists";
import {
  searchPlacesForCourse,
  mapPlaceRowForCourse,
  mergeCourseSearchWithKakao,
} from "../../api/places";
import { supabase } from "../../api/client";
import { ensurePlaceUuidForPick } from "../../utils/resolvePlaceUuidForPick";
import { isAcceptableRasterImageFile } from "../../utils/prepareImageFileForUpload";
import { uploadCuratorListPlaceImageFile } from "../../utils/curatorPlacePhotos";
import CourseMapPreview from "../../components/Course/CourseMapPreview";
import StudioPlaceMapSearchPanel from "../../components/Studio/StudioPlaceMapSearchPanel";
import StudioMapSearchSuggestions from "../../components/Studio/StudioMapSearchSuggestions";
import StudioScrollLayout from "../../components/Studio/StudioScrollLayout";
import useMobileLayout from "../../hooks/useMobileLayout";
import {
  studioCoursesInner,
  studioCoursesTopRow,
  studioCoursesH1,
  studioCoursesBtnPrimary,
  studioCoursesBtnGhost,
  studioCoursesMeta,
  studioCoursesLabel,
  studioCoursesInput,
  studioCoursesHint,
  studioCoursesCoverBox,
  studioCoursesCoverThumb,
  studioCoursesCoverPickBtn,
  studioCoursesPlaceRowCompact,
  studioCoursesPlaceOrderBadge,
  studioCoursesStickyBtn,
  studioCoursesScrollMain,
} from "./studioCoursesSharedStyles";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LIST_PLACE_MAX = 24;

const fieldStyle = {
  ...studioCoursesInput,
  marginTop: 6,
  marginBottom: 12,
};

function parseCoord(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function extractKakaoId(hit) {
  const fromDoc = hit?._kakaoDoc?.id;
  if (fromDoc != null && /^\d+$/.test(String(fromDoc))) return String(fromDoc);
  const kid = String(hit?.kakao_place_id || "").trim();
  if (/^\d+$/.test(kid)) return kid;
  const id = String(hit?.id || "").trim();
  const m =
    /^kakao_(\d+)$/i.exec(id) || /^pending-kakao-(\d+)$/i.exec(id);
  if (m) return m[1];
  if (/^\d+$/.test(id)) return id;
  return "";
}

function formatSaveError(err) {
  if (!err) return "저장에 실패했어요.";
  if (typeof err === "string") return err;
  const msg = String(err.message || err.error_description || "").trim();
  const details = String(err.details || "").trim();
  const code = String(err.code || "").trim();
  const lower = `${msg} ${details}`.toLowerCase();
  if (
    lower.includes("curator_lists") &&
    (lower.includes("does not exist") || lower.includes("schema cache"))
  ) {
    return "맛집첩 테이블이 아직 DB에 없어요. supabase 마이그레이션(curator_lists)을 적용해 주세요.";
  }
  if (
    lower.includes("image_url") &&
    (code === "42703" || lower.includes("column") || lower.includes("schema"))
  ) {
    return "맛집첩 사진 컬럼(image_url) 마이그레이션이 필요해요. 20260719130000_curator_list_places_image_url.sql 을 적용해 주세요.";
  }
  if (lower.includes("foreign key") || code === "23503") {
    return "장소 또는 큐레이터 정보가 DB와 맞지 않아요. 장소를 다시 추가한 뒤 저장해 주세요.";
  }
  if (lower.includes("row-level security") || code === "42501") {
    return "저장 권한이 없어요. 큐레이터 계정으로 로그인했는지 확인해 주세요.";
  }
  return msg || details || "저장에 실패했어요.";
}

function newListPlaceRow({
  placeId,
  name,
  address,
  lat,
  lng,
  kakaoId,
  pendingResolve = false,
}) {
  return {
    key: `list-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    place_id: placeId,
    place_name: name || "이름 없음",
    place_address: address || "",
    place_lat: parseCoord(lat),
    place_lng: parseCoord(lng),
    kakao_place_id: kakaoId || null,
    memo: "",
    image_url: "",
    pendingResolve: Boolean(pendingResolve),
    _kakaoDoc: null,
  };
}

async function resolveHitToUuid(hit) {
  const rawId = String(hit?.id || "").trim();
  if (UUID_RE.test(rawId)) return rawId;

  const doc =
    hit?._kakaoDoc && typeof hit._kakaoDoc === "object" ? hit._kakaoDoc : null;
  const kakaoId = extractKakaoId(hit);
  if (!kakaoId && !doc?.id) return null;

  const placeForEnsure = {
    id: String(doc?.id || kakaoId),
    place_name: doc?.place_name || hit?.name || hit?.place_name || "",
    road_address_name: doc?.road_address_name || hit?.address || "",
    address_name: doc?.address_name || hit?.address_name || hit?.address || "",
    category_name: doc?.category_name || hit?.category || "",
    y: doc?.y ?? hit?.lat,
    x: doc?.x ?? hit?.lng,
    kakao_place_id: String(doc?.id || kakaoId),
  };

  return ensurePlaceUuidForPick(placeForEnsure, { createIfMissing: true });
}

export default function StudioListEditor() {
  const navigate = useNavigate();
  const { listId: listIdParam } = useParams();
  const isNew = !listIdParam || listIdParam === "new";
  const { user, loading: authLoading } = useAuth();
  const isMobile = useMobileLayout();

  const [title, setTitle] = useState("");
  const [area, setArea] = useState("");
  const [description, setDescription] = useState("");
  const [placeRows, setPlaceRows] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchHits, setSearchHits] = useState([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [selectedSearchId, setSelectedSearchId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveBanner, setSaveBanner] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [listId, setListId] = useState(isNew ? "" : String(listIdParam));
  const [uploadingKey, setUploadingKey] = useState(null);
  const photoInputRefs = useRef({});
  const placeRowsRef = useRef(placeRows);
  const addLockRef = useRef(false);
  const savingRef = useRef(false);
  const listSectionRef = useRef(null);
  const titleRef = useRef(title);
  const areaRef = useRef(area);
  const descriptionRef = useRef(description);
  const listIdRef = useRef(listId);
  placeRowsRef.current = placeRows;
  titleRef.current = title;
  areaRef.current = area;
  descriptionRef.current = description;
  listIdRef.current = listId;

  useEffect(() => {
    savingRef.current = false;
    setSaving(false);
  }, []);

  useEffect(() => {
    if (isNew || !listIdParam) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [meta, places] = await Promise.all([
          fetchCuratorListById(listIdParam),
          fetchCuratorListPlaces(listIdParam),
        ]);
        if (cancelled) return;
        if (!meta) {
          alert("맛집첩을 찾을 수 없어요.");
          navigate("/studio/lists");
          return;
        }
        setListId(String(meta.id));
        setTitle(String(meta.title || ""));
        setArea(String(meta.area || ""));
        setDescription(String(meta.description || ""));
        setPlaceRows(
          (places || []).map((p, i) => ({
            key: `loaded-${p.place_id || i}`,
            place_id: String(p.place_id || ""),
            place_name: p.place_name || "이름 없음",
            place_address: p.place_address || "",
            place_lat: parseCoord(p.lat),
            place_lng: parseCoord(p.lng),
            kakao_place_id: p.kakao_place_id || null,
            memo: p.memo || "",
            image_url: p.image_url || "",
            pendingResolve: false,
            _kakaoDoc: null,
          }))
        );
      } catch (e) {
        if (!cancelled) {
          alert(e?.message || "불러오지 못했어요.");
          navigate("/studio/lists");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isNew, listIdParam, navigate]);

  const canAddMore = placeRows.length < LIST_PLACE_MAX;

  const clearSearchUi = useCallback(() => {
    setSearchHits([]);
    setSearchQuery("");
    setShowSuggest(false);
    setSelectedSearchId(null);
  }, []);

  /**
   * 추가 버튼 → 담은 장소 리스트에 즉시 쌓기.
   * UUID 확보는 백그라운드(실패해도 리스트에는 남기고 저장 때 재시도).
   */
  const addHit = useCallback(
    async (hit) => {
      if (!hit || addLockRef.current) return;
      const prev = placeRowsRef.current;
      if (prev.length >= LIST_PLACE_MAX) {
        alert(`맛집첩 장소는 최대 ${LIST_PLACE_MAX}곳까지예요.`);
        return;
      }

      const name = String(hit.name || hit.place_name || "").trim() || "이름 없음";
      const address = String(
        hit.address || hit.address_name || hit.road_address_name || ""
      ).trim();
      let lat = parseCoord(hit.lat ?? hit._kakaoDoc?.y);
      let lng = parseCoord(hit.lng ?? hit._kakaoDoc?.x);
      const kakaoId = extractKakaoId(hit);
      let placeId = String(hit.id || "").trim();
      const kakaoDoc =
        hit._kakaoDoc && typeof hit._kakaoDoc === "object" ? hit._kakaoDoc : null;

      const dup = prev.some((r) => {
        if (UUID_RE.test(placeId) && r.place_id === placeId) return true;
        if (kakaoId && String(r.kakao_place_id || "") === kakaoId) return true;
        return (
          r.place_name === name &&
          r.place_address === address &&
          address.length > 0
        );
      });
      if (dup) {
        alert("이미 넣은 장소예요.");
        return;
      }

      addLockRef.current = true;
      try {
        /** 1) 화면에는 바로 쌓기 (검색 UI 먼저 비움) */
        const provisionalId = UUID_RE.test(placeId)
          ? placeId
          : kakaoId
            ? `pending-kakao-${kakaoId}`
            : `pending-${Date.now()}`;

        const row = newListPlaceRow({
          placeId: provisionalId,
          name,
          address,
          lat,
          lng,
          kakaoId: kakaoId || null,
          pendingResolve: !UUID_RE.test(provisionalId),
        });
        row._kakaoDoc = kakaoDoc;

        setPlaceRows((p) => {
          if (p.length >= LIST_PLACE_MAX) return p;
          if (
            p.some(
              (r) =>
                r.place_id === provisionalId ||
                (kakaoId && String(r.kakao_place_id || "") === kakaoId)
            )
          ) {
            return p;
          }
          return [...p, row];
        });
        clearSearchUi();

        requestAnimationFrame(() => {
          listSectionRef.current?.scrollIntoView?.({
            behavior: "smooth",
            block: "nearest",
          });
        });

        /** 2) UUID 백그라운드 확보 → 행 패치 */
        if (!UUID_RE.test(provisionalId)) {
          try {
            const uuid = await resolveHitToUuid(hit);
            if (uuid && UUID_RE.test(uuid)) {
              const { data } = await supabase
                .from("places")
                .select(
                  "id, name, place_name, address, lat, lng, kakao_place_id"
                )
                .eq("id", uuid)
                .maybeSingle();
              const mapped = data ? mapPlaceRowForCourse(data) : null;
              setPlaceRows((p) =>
                p.map((r) =>
                  r.key === row.key
                    ? {
                        ...r,
                        place_id: uuid,
                        place_name: mapped?.name || r.place_name,
                        place_address: mapped?.address || r.place_address,
                        place_lat: parseCoord(mapped?.lat) ?? r.place_lat,
                        place_lng: parseCoord(mapped?.lng) ?? r.place_lng,
                        kakao_place_id:
                          mapped?.kakao_place_id || r.kakao_place_id,
                        pendingResolve: false,
                        _kakaoDoc: null,
                      }
                    : r
                )
              );
            }
          } catch (e) {
            console.warn("[맛집첩] UUID 확보 보류 — 저장 시 재시도", e);
          }
        } else if (lat == null || lng == null) {
          try {
            const { data } = await supabase
              .from("places")
              .select(
                "id, name, place_name, address, lat, lng, kakao_place_id"
              )
              .eq("id", provisionalId)
              .maybeSingle();
            if (data) {
              const mapped = mapPlaceRowForCourse(data);
              setPlaceRows((p) =>
                p.map((r) =>
                  r.key === row.key
                    ? {
                        ...r,
                        place_name: mapped?.name || r.place_name,
                        place_address: mapped?.address || r.place_address,
                        place_lat: parseCoord(mapped?.lat) ?? r.place_lat,
                        place_lng: parseCoord(mapped?.lng) ?? r.place_lng,
                        kakao_place_id:
                          mapped?.kakao_place_id || r.kakao_place_id,
                      }
                    : r
                )
              );
            }
          } catch {
            /* ignore */
          }
        }
      } finally {
        addLockRef.current = false;
      }
    },
    [clearSearchUi]
  );

  const runSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchHits([]);
      setShowSuggest(false);
      return;
    }
    setSearchBusy(true);
    setShowSuggest(true);
    try {
      const dbHits = await searchPlacesForCourse(q, { limit: 20 });
      const merged = await mergeCourseSearchWithKakao(dbHits, q, {
        maxTotal: 12,
        kakaoSize: 8,
      });
      setSearchHits(merged);
      setSelectedSearchId(merged[0]?.id ? String(merged[0].id) : null);
    } catch (e) {
      console.warn("[맛집첩 검색]", e);
      setSearchHits([]);
    } finally {
      setSearchBusy(false);
    }
  }, [searchQuery]);

  const updateRow = useCallback((key, patch) => {
    setPlaceRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r))
    );
  }, []);

  const removeRow = useCallback((key) => {
    setPlaceRows((prev) => prev.filter((r) => r.key !== key));
  }, []);

  const moveRow = useCallback((key, dir) => {
    setPlaceRows((prev) => {
      const idx = prev.findIndex((r) => r.key === key);
      if (idx < 0) return prev;
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(next, 0, item);
      return copy;
    });
  }, []);

  const handlePlacePhotoPick = useCallback(
    async (key, e) => {
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
      setUploadingKey(key);
      try {
        const url = await uploadCuratorListPlaceImageFile(file, user.id);
        updateRow(key, { image_url: url });
      } catch (err) {
        alert(err?.message || "사진 업로드에 실패했어요.");
      } finally {
        setUploadingKey(null);
      }
    },
    [user?.id, updateRow]
  );

  const showSaveBanner = useCallback((type, text) => {
    setSaveBanner({ type, text: String(text || "") });
  }, []);

  const persist = useCallback(
    async ({ andPublish }) => {
      if (savingRef.current) {
        showSaveBanner("info", "이미 저장 중이에요. 잠시만 기다려 주세요.");
        return;
      }
      if (!user?.id) {
        showSaveBanner("error", "로그인이 필요해요.");
        return;
      }
      const t = String(titleRef.current || "").trim();
      if (!t) {
        showSaveBanner("error", "제목을 입력해 주세요.");
        return;
      }
      const rowsNow = placeRowsRef.current;
      if (!Array.isArray(rowsNow) || rowsNow.length < 1) {
        showSaveBanner(
          "error",
          "장소를 1곳 이상 담은 뒤 저장해 주세요. (담은 장소 0곳)"
        );
        return;
      }

      savingRef.current = true;
      setSaving(true);
      showSaveBanner("info", andPublish ? "공개 저장 중…" : "초안 저장 중…");
      try {
        const resolvedRows = [];
        for (const r of rowsNow) {
          let pid = String(r.place_id || "").trim();
          if (!UUID_RE.test(pid)) {
            const uuid = await resolveHitToUuid({
              id: pid,
              name: r.place_name,
              place_name: r.place_name,
              address: r.place_address,
              lat: r.place_lat,
              lng: r.place_lng,
              kakao_place_id: r.kakao_place_id,
              _kakaoDoc: r._kakaoDoc,
            });
            if (!uuid || !UUID_RE.test(uuid)) {
              throw new Error(
                `「${r.place_name}」 장소를 DB에 등록하지 못했어요. 네트워크·권한을 확인해 주세요.`
              );
            }
            pid = uuid;
          }
          resolvedRows.push({
            ...r,
            place_id: pid,
            pendingResolve: false,
            _kakaoDoc: null,
          });
        }

        setPlaceRows(resolvedRows);

        const meta = {
          title: t,
          area: String(areaRef.current || "").trim() || null,
          description: String(descriptionRef.current || "").trim() || null,
        };
        let id = String(listIdRef.current || "").trim();
        if (!id) {
          const created = await createCuratorList({
            curator_id: user.id,
            ...meta,
            status: "draft",
            is_public: false,
          });
          id = String(created?.id || "").trim();
          if (!id) {
            throw new Error("맛집첩 생성 후 id를 받지 못했어요.");
          }
          listIdRef.current = id;
          setListId(id);
        } else {
          await updateCuratorList(id, meta);
        }

        await saveCuratorListPlaces(
          id,
          resolvedRows.map((r, i) => ({
            place_id: r.place_id,
            order_index: i,
            memo: r.memo || null,
            image_url: r.image_url || null,
          }))
        );

        if (andPublish) {
          await publishCuratorList(id, { skipPlaceCheck: true });
        }

        showSaveBanner(
          "ok",
          andPublish ? "공개 저장했어요. 목록으로 이동합니다." : "초안을 저장했어요."
        );
        window.setTimeout(() => {
          navigate("/studio/lists");
        }, 450);
      } catch (e) {
        console.error("[맛집첩 저장]", e);
        showSaveBanner("error", formatSaveError(e));
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [user?.id, navigate, showSaveBanner]
  );

  const saveBarPortal =
    typeof document !== "undefined"
      ? createPortal(
          <div
            data-judo-list-save-bar
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 2147483000,
              pointerEvents: "auto",
              padding:
                "10px 12px max(12px, env(safe-area-inset-bottom, 0px))",
              borderTop: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(17,17,17,0.98)",
              boxShadow: "0 -8px 28px rgba(0,0,0,0.45)",
              boxSizing: "border-box",
            }}
          >
            {saveBanner?.text ? (
              <div
                role="status"
                style={{
                  marginBottom: 8,
                  padding: "8px 10px",
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 700,
                  lineHeight: 1.4,
                  color:
                    saveBanner.type === "error"
                      ? "#fecaca"
                      : saveBanner.type === "ok"
                        ? "#bbf7d0"
                        : "rgba(255,255,255,0.85)",
                  background:
                    saveBanner.type === "error"
                      ? "rgba(239,68,68,0.18)"
                      : saveBanner.type === "ok"
                        ? "rgba(46,204,113,0.16)"
                        : "rgba(255,255,255,0.08)",
                  border:
                    saveBanner.type === "error"
                      ? "1px solid rgba(248,113,113,0.45)"
                      : saveBanner.type === "ok"
                        ? "1px solid rgba(46,204,113,0.4)"
                        : "1px solid rgba(255,255,255,0.12)",
                }}
              >
                {saveBanner.text}
              </div>
            ) : null}
            <div style={{ display: "flex", gap: 8, width: "100%" }}>
              <button
                type="button"
                style={{
                  ...studioCoursesStickyBtn,
                  background: "rgba(255,255,255,0.08)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.14)",
                  opacity: saving ? 0.65 : 1,
                }}
                disabled={saving}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void persist({ andPublish: false });
                }}
              >
                {saving ? "저장 중…" : "초안 저장"}
              </button>
              <button
                type="button"
                style={{
                  ...studioCoursesStickyBtn,
                  background: "#2ECC71",
                  color: "#fff",
                  opacity: saving ? 0.65 : 1,
                }}
                disabled={saving}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void persist({ andPublish: true });
                }}
              >
                {saving ? "저장 중…" : "저장하고 공개"}
              </button>
            </div>
          </div>,
          document.body
        )
      : null;

  const mapPlaceRows = useMemo(
    () =>
      placeRows.map((r) => ({
        key: r.key,
        /** 미니맵 모델이 UUID만 쓰던 제한 완화 — key로라도 핀 표시 */
        place_id: UUID_RE.test(String(r.place_id || ""))
          ? r.place_id
          : r.key,
        place_lat: r.place_lat,
        place_lng: r.place_lng,
        allowNonUuid: true,
      })),
    [placeRows]
  );

  if (authLoading || loading) {
    return (
      <StudioScrollLayout>
        <div style={{ padding: 24, ...studioCoursesMeta }}>불러오는 중…</div>
      </StudioScrollLayout>
    );
  }

  return (
    <>
    <StudioScrollLayout
      mainStyle={{
        ...studioCoursesScrollMain,
        paddingBottom: 96,
      }}
      header={
        <div style={{ padding: "12px 12px 0" }}>
          <button
            type="button"
            style={studioCoursesBtnGhost}
            onClick={() => navigate("/studio/lists")}
          >
            ← 맛집첩 목록
          </button>
        </div>
      }
    >
        <div style={studioCoursesInner}>
          <div style={studioCoursesTopRow}>
            <h1 style={studioCoursesH1}>
              {isNew ? "새 맛집첩" : "맛집첩 수정"}
            </h1>
          </div>
          <p style={{ ...studioCoursesMeta, marginBottom: 12, lineHeight: 1.45 }}>
            장소는 최대 {LIST_PLACE_MAX}곳. 동선 없이 핀·카드로 묶어요.
          </p>

          <label style={studioCoursesLabel}>
            제목
            <input
              style={fieldStyle}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 성수 혼술 맛집첩"
              maxLength={80}
            />
          </label>
          <label style={studioCoursesLabel}>
            동네·지역
            <input
              style={fieldStyle}
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="예: 성수"
              maxLength={40}
            />
          </label>
          <label style={studioCoursesLabel}>
            한 줄 소개
            <textarea
              style={{ ...fieldStyle, minHeight: 72, resize: "vertical" }}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="어떤 기준으로 모았는지"
              maxLength={200}
            />
          </label>

          <StudioPlaceMapSearchPanel
            label={`장소 검색 · 담기 (${placeRows.length}/${LIST_PLACE_MAX})`}
            query={searchQuery}
            onQueryChange={(v) => {
              setSearchQuery(v);
              if (String(v || "").trim().length < 2) {
                setShowSuggest(false);
              }
            }}
            onSearch={() => void runSearch()}
            onClear={() => {
              clearSearchUi();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void runSearch();
              }
            }}
            onFocus={() => {
              if (searchHits.length > 0) setShowSuggest(true);
            }}
            placeholder="가게 이름 또는 주소"
            searchLoading={searchBusy}
            searchDisabled={saving || !canAddMore}
            isMobile={isMobile}
            interactiveMap
            suggestionsDropdown={
              <StudioMapSearchSuggestions
                open={showSuggest && searchHits.length > 0}
                loading={searchBusy}
                items={searchHits}
                selectedItemKey={selectedSearchId}
                onSelect={(hit) => void addHit(hit)}
                getItemKey={(hit) => String(hit.id)}
                emptyMessage={
                  !searchBusy && searchQuery.trim().length >= 2
                    ? "검색 결과가 없어요."
                    : null
                }
                renderTrailing={(hit) => (
                  <button
                    type="button"
                    style={{
                      ...studioCoursesBtnPrimary,
                      minHeight: 40,
                      flexShrink: 0,
                      position: "relative",
                      zIndex: 2,
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void addHit(hit);
                    }}
                    disabled={saving || !canAddMore}
                  >
                    추가
                  </button>
                )}
              />
            }
            mapSlot={
              <CourseMapPreview
                placeRows={mapPlaceRows}
                searchHits={searchHits}
                selectedSearchId={selectedSearchId}
                onSearchHitPress={(hit) => void addHit(hit)}
                embedded
                interactive
                showRoute={false}
              />
            }
            footerSlot={
              <>
                {searchQuery.trim().length > 0 &&
                searchQuery.trim().length < 2 ? (
                  <div
                    style={{
                      fontSize: 12,
                      color: "rgba(255,200,120,0.95)",
                      marginTop: 4,
                    }}
                  >
                    검색어는 2글자 이상 입력해 주세요.
                  </div>
                ) : null}
                <p style={{ ...studioCoursesHint, marginTop: 8 }}>
                  「추가」또는 지도 ＋핀을 누르면 아래 담은 장소에 바로 쌓여요.
                </p>
              </>
            }
          />

          <div
            ref={listSectionRef}
            style={{
              ...studioCoursesLabel,
              marginTop: 18,
              marginBottom: 8,
              fontSize: 13,
              fontWeight: 800,
              color: "rgba(255,255,255,0.88)",
            }}
          >
            담은 장소 ({placeRows.length}/{LIST_PLACE_MAX})
          </div>

          {placeRows.length === 0 ? (
            <div
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.45)",
                padding: "8px 0 4px",
              }}
            >
              아직 담은 장소가 없어요. 위에서 검색해 추가해 보세요.
            </div>
          ) : null}

          {placeRows.map((row, idx) => (
            <div key={row.key} style={studioCoursesPlaceRowCompact}>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                }}
              >
                <div style={studioCoursesPlaceOrderBadge}>{idx + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: 15,
                      marginBottom: 2,
                      lineHeight: 1.35,
                    }}
                  >
                    {row.place_name || "이름 없음"}
                    {row.pendingResolve ? (
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          color: "rgba(251,191,36,0.9)",
                        }}
                      >
                        등록 중
                      </span>
                    ) : null}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "rgba(255,255,255,0.52)",
                      lineHeight: 1.4,
                      marginBottom: 10,
                    }}
                  >
                    {row.place_address || "주소 없음"}
                  </div>

                  <label style={studioCoursesLabel}>메모</label>
                  <textarea
                    style={{
                      ...studioCoursesInput,
                      minHeight: 64,
                      resize: "vertical",
                      marginBottom: 10,
                    }}
                    value={row.memo}
                    onChange={(e) =>
                      updateRow(row.key, { memo: e.target.value })
                    }
                    placeholder="이 곳을 고른 이유, 추천 메뉴…"
                    maxLength={300}
                  />

                  <label style={studioCoursesLabel}>사진</label>
                  <div style={{ ...studioCoursesCoverBox, marginBottom: 10 }}>
                    {row.image_url ? (
                      <img
                        src={row.image_url}
                        alt=""
                        style={studioCoursesCoverThumb}
                      />
                    ) : (
                      <div
                        style={{
                          ...studioCoursesCoverThumb,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          color: "rgba(255,255,255,0.35)",
                        }}
                      >
                        없음
                      </div>
                    )}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <input
                        ref={(el) => {
                          photoInputRefs.current[row.key] = el;
                        }}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
                        style={{ display: "none" }}
                        onChange={(e) => void handlePlacePhotoPick(row.key, e)}
                      />
                      <button
                        type="button"
                        style={studioCoursesCoverPickBtn}
                        onClick={() =>
                          photoInputRefs.current[row.key]?.click()
                        }
                        disabled={saving || uploadingKey === row.key}
                      >
                        {uploadingKey === row.key
                          ? "올리는 중…"
                          : row.image_url
                            ? "사진 바꾸기"
                            : "사진 추가"}
                      </button>
                      {row.image_url ? (
                        <button
                          type="button"
                          style={studioCoursesBtnGhost}
                          onClick={() => updateRow(row.key, { image_url: "" })}
                          disabled={saving || uploadingKey === row.key}
                        >
                          사진 제거
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      justifyContent: "flex-end",
                    }}
                  >
                    <button
                      type="button"
                      style={studioCoursesBtnGhost}
                      disabled={idx === 0}
                      onClick={() => moveRow(row.key, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      style={studioCoursesBtnGhost}
                      disabled={idx === placeRows.length - 1}
                      onClick={() => moveRow(row.key, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      style={studioCoursesBtnGhost}
                      onClick={() => removeRow(row.key)}
                    >
                      빼기
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

        </div>
    </StudioScrollLayout>
    {saveBarPortal}
    </>
  );
}
