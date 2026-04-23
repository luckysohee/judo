import { useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { isCourseQuery } from "../utils/isCourseQuery";
import { parseCourseQuery } from "../utils/parseCourseQuery";
import { findAreaKeywordInQuery } from "../utils/searchParser.js";
import { normalizePlaces } from "../utils/normalizePlace";
import {
  generateCourseOptions,
  courseOptionsToMapPlaces,
  courseVenuePairKey,
  placeId,
} from "../utils/generateCourseOptions.js";
import { haversineMeters, resolvePlaceWgs84 } from "../utils/placeCoords.js";
import { normalizeHangulSearchCompounds } from "../utils/searchParser.js";
import { regenerateSecondStep } from "../utils/regenerateSecondStep.js";
import { regenerateFirstStep } from "../utils/regenerateFirstStep.js";
import {
  fetchKakaoPlacesForCourseSecondAround,
  mergeCoursePlacePoolsWithKakao,
} from "../utils/augmentCourseSecondPlacesWithKakao.js";

function appendSeenFromCourses(courses = []) {
  const keys = courses.map((c) => c.key).filter(Boolean);
  const pairs = courses
    .map((c) => courseVenuePairKey(c))
    .filter(Boolean);
  return { keys, pairs };
}

/**
 * 지도에서 연 장소로「2차 찾기」할 때 넘기는 검색어(예: «합정 데이트 와인바»)는
 * `parseCourseQuery`가 steps=1로 두어 패턴이 null → 후보 0건이 된다.
 * `withTwoStepCourseIntent`로 steps=2로 올린 뒤, 쩜오차 코스면 `includeHalfStep`을 유지한다.
 */
function withTwoStepCourseIntent(parsed) {
  if (!parsed || typeof parsed !== "object") return parsed;
  if (parsed.steps === 2) return parsed;
  return { ...parsed, steps: 2 };
}

/** `places`에 is_archived 컬럼이 없는 DB면 .eq 필터가 400 — select 후 로컬 필터 */
async function fetchCoursePlacesRows(supabaseClient) {
  const { data, error } = await supabaseClient.from("places").select("*");
  if (error) return { rows: [], error };
  const rows = Array.isArray(data) ? data : [];
  return {
    rows: rows.filter((p) => p?.is_archived !== true),
    error: null,
  };
}

/** 지도 「코스 담기」로 처음 만들 때: 1차만 두고, 2차·지도 깜빡임은 「다음 코스」 이후에만 */
function buildBootstrapOneStepCourse(mergedFirst) {
  const key = `map-draft-${Date.now()}`;
  return {
    key,
    profileKey: "normal",
    profileTitle: "지도에서 만든 코스",
    profileDescription: "",
    totalScore: 0,
    steps: [{ step: 1, label: "1차", place: mergedFirst }],
  };
}

/** 가로 코스 카드·시트 본문이 `selectedCourse`와 같이 보이도록, 선택 슬롯만 교체 */
function replaceCourseOptionsSlot(prev, selectedKey, nextCourse) {
  if (!Array.isArray(prev) || !selectedKey || !nextCourse) return prev;
  const idx = prev.findIndex((c) => c?.key === selectedKey);
  if (idx < 0) return prev;
  const out = [...prev];
  out[idx] = nextCourse;
  return out;
}

export function useCourseSearch() {
  const [courseOptions, setCourseOptions] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [courseQueryParsed, setCourseQueryParsed] = useState(null);
  const [coursePlaces, setCoursePlaces] = useState([]);
  const [altSecondCourses, setAltSecondCourses] = useState([]);
  const [altFirstCourses, setAltFirstCourses] = useState([]);
  const [seenCourseKeys, setSeenCourseKeys] = useState([]);
  const [seenVenuePairKeys, setSeenVenuePairKeys] = useState([]);
  const [courseError, setCourseError] = useState("");
  const [isCourseMode, setIsCourseMode] = useState(false);
  const [isLoadingCourse, setIsLoadingCourse] = useState(false);
  const [isRegeneratingSecond, setIsRegeneratingSecond] = useState(false);
  const [isRegeneratingFirst, setIsRegeneratingFirst] = useState(false);
  const [isRefreshingCourses, setIsRefreshingCourses] = useState(false);

  const resetCourseSearch = useCallback(() => {
    setCourseOptions([]);
    setSelectedCourse(null);
    setCourseQueryParsed(null);
    setCoursePlaces([]);
    setAltSecondCourses([]);
    setAltFirstCourses([]);
    setSeenCourseKeys([]);
    setSeenVenuePairKeys([]);
    setCourseError("");
    setIsCourseMode(false);
    setIsLoadingCourse(false);
    setIsRegeneratingSecond(false);
    setIsRegeneratingFirst(false);
    setIsRefreshingCourses(false);
  }, []);

  const chooseCourse = useCallback((course) => {
    setSelectedCourse(course);
    setAltSecondCourses([]);
    setAltFirstCourses([]);
  }, []);

  const applyAlternativeSecond = useCallback((course) => {
    const slotKey = selectedCourse?.key;
    if (slotKey) {
      setCourseOptions((prev) => replaceCourseOptionsSlot(prev, slotKey, course));
    }
    setSelectedCourse(course);
    setAltSecondCourses([]);
    setAltFirstCourses([]);
  }, [selectedCourse]);

  const applyAlternativeFirst = useCallback((course) => {
    const slotKey = selectedCourse?.key;
    if (slotKey) {
      setCourseOptions((prev) => replaceCourseOptionsSlot(prev, slotKey, course));
    }
    setSelectedCourse(course);
    setAltFirstCourses([]);
    setAltSecondCourses([]);
  }, [selectedCourse]);

  const clearAlternativeSecond = useCallback(() => {
    setAltSecondCourses([]);
  }, []);

  /** 코스 검색·홈 「코스」바로가기 공통
   * @param {string} q
   * @param {{ userOrigin?: { lat: number, lng: number }, maxDistanceMeters?: number, strictNearbyOnly?: boolean }} [loadOpts] — 내 주변 코스: GPS·앵커 반경만 쓸 때 strictNearby. 검색어에 지역(`parseCourseQuery.area`)이 있으면 후보는 전역 풀에서 지역 매칭으로 좁힘(반경만 쓰면 DB 좌표 편향으로 0건이 되기 쉬움).
   */
  const loadCourseOptionsFromQuery = useCallback(async (q, loadOpts = {}) => {
    const trimmed = normalizeHangulSearchCompounds(String(q || "")).trim();
    if (!trimmed) {
      return { handled: false, options: [], mapPlaces: [], parsed: null };
    }

    setCourseError("");
    setCourseOptions([]);
    setAltSecondCourses([]);
    setAltFirstCourses([]);
    setSeenCourseKeys([]);
    setSeenVenuePairKeys([]);
    setIsCourseMode(true);
    setIsLoadingCourse(true);

    const parsed = parseCourseQuery(trimmed, {
      includeHalfStep: Boolean(loadOpts?.includeHalfStep),
    });
    setCourseQueryParsed(parsed);

    try {
      const { rows, error } = await fetchCoursePlacesRows(supabase);

      if (error) {
        console.error("course search places:", error);
        setCourseError("코스 추천용 장소를 불러오지 못했어요.");
        setCourseOptions([]);
        setCoursePlaces([]);
        setSelectedCourse(null);
        return { handled: true, options: [], mapPlaces: [], parsed };
      }

      const normalizedPlaces = normalizePlaces(rows);
      if (!normalizedPlaces.length) {
        setCourseError(
          "코스용 장소 목록이 비어 있어요. Supabase `places`에 데이터가 있는지 확인해 주세요."
        );
        setCourseOptions((prev) =>
          (prev || []).filter((c) => c?.profileKey === "my_own")
        );
        setSelectedCourse(null);
        setCoursePlaces([]);
        return { handled: true, options: [], mapPlaces: [], parsed };
      }

      const origin = loadOpts?.userOrigin;
      const strictNearbyOnly = Boolean(loadOpts?.strictNearbyOnly);
      const maxParam = Number(loadOpts?.maxDistanceMeters);
      const maxM =
        Number.isFinite(maxParam) && maxParam > 0
          ? maxParam
          : origin
            ? 3000
            : 9000;
      let placesForCourse = normalizedPlaces;
      if (
        origin &&
        Number.isFinite(Number(origin.lat)) &&
        Number.isFinite(Number(origin.lng))
      ) {
        const olat = Number(origin.lat);
        const olng = Number(origin.lng);
        const near = normalizedPlaces.filter((p) => {
          const c = resolvePlaceWgs84(p);
          if (!c) return false;
          return haversineMeters(c.lat, c.lng, olat, olng) <= maxM;
        });
        const namedAreaCourse = Boolean(parsed?.area);
        /** 지명 코스: 전역 풀 → `generateCourseOptions` 안 `resolveCourseAreaPool`. 반경만이면 비성수 DB에서 0건. */
        if (strictNearbyOnly && !namedAreaCourse) {
          placesForCourse = near;
        } else if (!strictNearbyOnly && !namedAreaCourse && near.length >= 8) {
          placesForCourse = near;
        }
      }

      setCoursePlaces(placesForCourse);

      const options = generateCourseOptions({
        parsedQuery: parsed,
        places: placesForCourse,
        maxOptions: 3,
        excludeCourseKeys: [],
        excludeVenuePairKeys: [],
      });

      if (!options.length) {
        setCourseError(
          strictNearbyOnly && origin
            ? `${Math.round(maxM / 1000)}km 안에서 맞는 코스를 찾지 못했어요. 검색어를 바꾸거나 지역을 넣어 보세요.`
            : parsed.area
              ? "조건에 맞는 코스를 찾지 못했어요. 지역·태그 데이터를 더 넣으면 좋아져요."
              : "조건에 맞는 코스를 찾지 못했어요. 검색에 지역(예: 을지로)을 넣어 보세요."
        );
      }

      setCourseOptions((prev) => {
        const preserved = (prev || []).filter((c) => c?.profileKey === "my_own");
        return [...options, ...preserved];
      });
      setSelectedCourse(options[0] ?? null);
      const { keys, pairs } = appendSeenFromCourses(options);
      setSeenCourseKeys(keys);
      setSeenVenuePairKeys(pairs);

      const mapPlaces = courseOptionsToMapPlaces(options);
      return { handled: true, options, mapPlaces, parsed };
    } finally {
      setIsLoadingCourse(false);
    }
  }, []);

  const runCourseSearch = useCallback(
    async (query, loadOpts) => {
      const q = normalizeHangulSearchCompounds(String(query || "")).trim();
      if (!isCourseQuery(q)) {
        return { handled: false, options: [], mapPlaces: [], parsed: null };
      }
      return loadCourseOptionsFromQuery(q, loadOpts);
    },
    [loadCourseOptionsFromQuery]
  );

  /** 검색 없이 홈에서 바로 코스 UI (조합·추천 동일 시트) */
  const openCourseComposer = useCallback(async () => {
    return loadCourseOptionsFromQuery("코스 짜기");
  }, [loadCourseOptionsFromQuery]);

  /**
   * @param {"same"|"mood"|"closer"|"featured"} variant
   * @param {{ apply?: boolean }} [opts] — `apply: false`면 후보만 계산하고 선택 코스·옵션 슬롯은 바꾸지 않음(지도 펄스용)
   */
  const regenerateSelectedCourseSecond = useCallback(
    async (variant = "same", opts = {}) => {
      const applyPick = opts.apply !== false;
      if (!selectedCourse || !courseQueryParsed) return [];

      const slotKey = selectedCourse.key;
      setAltFirstCourses([]);
      setIsRegeneratingSecond(true);
      setCourseError("");

      try {
        let places = coursePlaces;

        if (!places.length) {
          const { rows, error } = await fetchCoursePlacesRows(supabase);

          if (error) {
            console.error("regenerate second places:", error);
            setCourseError("2차 재추천용 장소를 불러오지 못했어요.");
            if (applyPick) setAltSecondCourses([]);
            return [];
          }

          places = normalizePlaces(rows);
          setCoursePlaces(places);
        }

        const results = regenerateSecondStep({
          selectedCourse,
          parsedQuery: courseQueryParsed,
          places,
          variant,
        });

        if (results.length) {
          if (applyPick) {
            const picked = results[0];
            setCourseOptions((prev) =>
              replaceCourseOptionsSlot(prev, slotKey, picked)
            );
            setSelectedCourse(picked);
            setAltSecondCourses(results.slice(1));
          }
        } else {
          if (applyPick) {
            setAltSecondCourses([]);
            setCourseError("바꿔볼 만한 2차 후보를 찾지 못했어요.");
          }
        }

        return results;
      } catch (e) {
        console.error(e);
        setCourseError("2차 재추천 중 문제가 생겼어요.");
        if (applyPick) setAltSecondCourses([]);
        return [];
      } finally {
        setIsRegeneratingSecond(false);
      }
    },
    [selectedCourse, courseQueryParsed, coursePlaces]
  );

  /**
   * 2차 후보만 계산(슬롯·selectedCourse 미변경). `applyMapPickAsFirstStepAsync` 직후에는
   * 아직 리렌더 전이라 `regenerateSelectedCourseSecond` 대신 인자로 받은 코스·파서를 씀.
   */
  const computeSecondStepCandidatesOnly = useCallback(
    async (course, parsedQuery, variant = "same", opts = {}) => {
      if (!course || !parsedQuery) return [];

      setIsRegeneratingSecond(true);
      setCourseError("");

      try {
        let places = coursePlaces;

        if (!places.length) {
          const { rows, error } = await fetchCoursePlacesRows(supabase);

          if (error) {
            console.error("computeSecondStepCandidatesOnly places:", error);
            setCourseError("2차 재추천용 장소를 불러오지 못했어요.");
            return [];
          }

          places = normalizePlaces(rows);
          setCoursePlaces(places);
        }

        if (opts.augmentPlacesWithKakaoNearFirst && course?.steps?.[0]?.place) {
          try {
            const kakaoNear = await fetchKakaoPlacesForCourseSecondAround(
              course.steps[0].place,
              {
                anjuHints: opts.userSecondPreferences?.anjuHints,
                radius: opts.kakaoSecondSearchRadius ?? 2200,
              }
            );
            if (kakaoNear.length) {
              places = mergeCoursePlacePoolsWithKakao(places, kakaoNear);
            }
          } catch (e) {
            if (import.meta.env.DEV) {
              console.warn("computeSecondStepCandidatesOnly kakao augment:", e);
            }
          }
        }

        return regenerateSecondStep({
          selectedCourse: course,
          parsedQuery,
          places,
          variant,
          userSecondPreferences: opts.userSecondPreferences ?? null,
        });
      } catch (e) {
        console.error(e);
        setCourseError("2차 재추천 중 문제가 생겼어요.");
        return [];
      } finally {
        setIsRegeneratingSecond(false);
      }
    },
    [coursePlaces]
  );

  /** 지도에서 고른 2차 후보 코스를 현재 슬롯에 확정 */
  const applySecondStepPick = useCallback((pickedCourse) => {
    const slotKey = selectedCourse?.key;
    if (!pickedCourse || !slotKey) return false;
    setCourseOptions((prev) =>
      replaceCourseOptionsSlot(prev, slotKey, pickedCourse)
    );
    setSelectedCourse(pickedCourse);
    setAltSecondCourses([]);
    return true;
  }, [selectedCourse]);

  const regenerateSelectedCourseFirst = useCallback(async () => {
    if (!selectedCourse || !courseQueryParsed) return [];

    const slotKey = selectedCourse.key;
    setAltSecondCourses([]);
    setIsRegeneratingFirst(true);
    setCourseError("");

    try {
      let places = coursePlaces;

      if (!places.length) {
        const { rows, error } = await fetchCoursePlacesRows(supabase);

        if (error) {
          console.error("regenerate first places:", error);
          setCourseError("1차 재추천용 장소를 불러오지 못했어요.");
          setAltFirstCourses([]);
          return [];
        }

        places = normalizePlaces(rows);
        setCoursePlaces(places);
      }

      const results = regenerateFirstStep({
        selectedCourse,
        parsedQuery: courseQueryParsed,
        places,
      });

      if (results.length) {
        const picked = results[0];
        setCourseOptions((prev) =>
          replaceCourseOptionsSlot(prev, slotKey, picked)
        );
        setSelectedCourse(picked);
        setAltFirstCourses(results.slice(1));
      } else {
        setAltFirstCourses([]);
        setCourseError("바꿔볼 만한 1차 후보를 찾지 못했어요.");
      }

      return results;
    } catch (e) {
      console.error(e);
      setCourseError("1차 재추천 중 문제가 생겼어요.");
      setAltFirstCourses([]);
      return [];
    } finally {
      setIsRegeneratingFirst(false);
    }
  }, [selectedCourse, courseQueryParsed, coursePlaces]);

  const rerunDifferentCourses = useCallback(async () => {
    if (!courseQueryParsed) return [];

    setIsRefreshingCourses(true);
    setCourseError("");
    setAltSecondCourses([]);
    setAltFirstCourses([]);

    try {
      let places = coursePlaces;

      if (!places.length) {
        const { rows, error } = await fetchCoursePlacesRows(supabase);

        if (error) {
          console.error("rerun course places:", error);
          setCourseError("코스용 장소를 불러오지 못했어요.");
          return [];
        }

        places = normalizePlaces(rows);
        setCoursePlaces(places);
      }

      const results = generateCourseOptions({
        parsedQuery: courseQueryParsed,
        places,
        maxOptions: 3,
        excludeCourseKeys: seenCourseKeys,
        excludeVenuePairKeys: seenVenuePairKeys,
      });

      if (!results.length) {
        setCourseError("더 보여드릴 다른 코스를 찾지 못했어요.");
        return [];
      }

      setCourseOptions((prev) => {
        const preserved = (prev || []).filter((c) => c?.profileKey === "my_own");
        return [...results, ...preserved];
      });
      setSelectedCourse(results[0] ?? null);

      const { keys, pairs } = appendSeenFromCourses(results);
      setSeenCourseKeys((prev) => [...new Set([...prev, ...keys])]);
      setSeenVenuePairKeys((prev) => [...new Set([...prev, ...pairs])]);

      return results;
    } catch (e) {
      console.error(e);
      setCourseError("다른 코스를 다시 추천하는 중 문제가 생겼어요.");
      return [];
    } finally {
      setIsRefreshingCourses(false);
    }
  }, [courseQueryParsed, coursePlaces, seenCourseKeys, seenVenuePairKeys]);

  /**
   * 지도 미리보기에서 고른 장소를 현재 선택 코스의 1차로 넣음.
   * 2단 코스면 2차는 유지하고 도보만 갱신, 1단(지도 부트스트랩)이면 1차만 교체.
   */
  const applyMapPickAsFirstStep = useCallback((place) => {
    if (!selectedCourse) return null;
    const steps = selectedCourse.steps || [];
    if (steps.length < 1) return null;
    const slotKey = selectedCourse.key;
    const st0 = steps[0];
    const w = resolvePlaceWgs84(place);
    if (!w) return null;

    const mergedPlace = {
      ...(st0?.place && typeof st0.place === "object" ? st0.place : {}),
      ...place,
      lat: w.lat,
      lng: w.lng,
      x: String(w.lng),
      y: String(w.lat),
    };

    const newStep0 = { ...st0, step: 1, place: mergedPlace };

    if (steps.length < 2) {
      const newCourse = {
        ...selectedCourse,
        key: `${slotKey}-m1-${Date.now()}`,
        steps: [newStep0],
      };
      setCourseOptions((prev) =>
        replaceCourseOptionsSlot(prev, slotKey, newCourse)
      );
      setSelectedCourse(newCourse);
      setAltFirstCourses([]);
      setAltSecondCourses([]);
      return newCourse;
    }

    if (steps.length >= 3) {
      const st1 = steps[1];
      const st2 = steps[2];
      const w1 = resolvePlaceWgs84(st1.place);
      const w2 = resolvePlaceWgs84(st2.place);
      let walk01 = st1.walkDistanceMeters;
      let walk12 = st2.walkDistanceMeters;
      if (w1 && Number.isFinite(w1.lat) && Number.isFinite(w1.lng)) {
        walk01 = Math.round(haversineMeters(w.lat, w.lng, w1.lat, w1.lng));
      }
      if (
        w1 &&
        w2 &&
        Number.isFinite(w1.lat) &&
        Number.isFinite(w1.lng) &&
        Number.isFinite(w2.lat) &&
        Number.isFinite(w2.lng)
      ) {
        walk12 = Math.round(haversineMeters(w1.lat, w1.lng, w2.lat, w2.lng));
      }
      const newStep1 = {
        ...st1,
        step: 2,
        walkDistanceMeters: Number.isFinite(walk01) ? walk01 : st1.walkDistanceMeters,
      };
      const newStep2 = {
        ...st2,
        step: 3,
        walkDistanceMeters: Number.isFinite(walk12) ? walk12 : st2.walkDistanceMeters,
      };
      const newCourse = {
        ...selectedCourse,
        key: `${slotKey}-m1-${Date.now()}`,
        steps: [newStep0, newStep1, newStep2],
      };
      setCourseOptions((prev) =>
        replaceCourseOptionsSlot(prev, slotKey, newCourse)
      );
      setSelectedCourse(newCourse);
      setAltFirstCourses([]);
      setAltSecondCourses([]);
      return newCourse;
    }

    const st1 = steps[1];
    const w1 = resolvePlaceWgs84(st1.place);
    let walkM = st1.walkDistanceMeters;
    if (w1 && Number.isFinite(w1.lat) && Number.isFinite(w1.lng)) {
      walkM = Math.round(haversineMeters(w.lat, w.lng, w1.lat, w1.lng));
    }

    const newStep1 = {
      ...st1,
      step: 2,
      walkDistanceMeters: Number.isFinite(walkM) ? walkM : st1.walkDistanceMeters,
    };
    const newCourse = {
      ...selectedCourse,
      key: `${slotKey}-m1-${Date.now()}`,
      steps: [newStep0, newStep1],
    };

    setCourseOptions((prev) => replaceCourseOptionsSlot(prev, slotKey, newCourse));
    setSelectedCourse(newCourse);
    setAltFirstCourses([]);
    setAltSecondCourses([]);
    return newCourse;
  }, [selectedCourse]);

  /**
   * 지도 미리보기 1차 반영. 반환값으로 같은 틱에서 2차 후보 계산에 쓸 코스·파서를 넘김(React state 지연 보정).
   */
  const applyMapPickAsFirstStepAsync = useCallback(
    async (place, opts = {}) => {
      const w = resolvePlaceWgs84(place);
      if (!w) return { ok: false };

      const mapSearchHint = String(opts.mapSearchQuery || "").trim();

      const parsedHintOrPlace = (p0) => {
        const hint = String(mapSearchHint || "").trim();
        let p = hint.length >= 2 ? parseCourseQuery(hint) : parseCourseQuery(p0);
        if (!p.area) {
          const blob = [
            place?.address_name,
            place?.road_address_name,
            place?.address,
            place?.place_name,
            place?.name,
            place?.region,
          ]
            .filter(Boolean)
            .join(" ");
          const tail = findAreaKeywordInQuery(blob);
          if (tail) p = parseCourseQuery(`${tail} 코스`);
        }
        return p;
      };

      const existing = selectedCourse;
      const existingSteps = existing?.steps || [];
      if (existing && existingSteps.length >= 1) {
        const next = applyMapPickAsFirstStep(place);
        if (!next) return { ok: false };
        let parsedForSecond =
          courseQueryParsed ?? parseCourseQuery("코스 짜기");
        if (!parsedForSecond.area) {
          parsedForSecond = parsedHintOrPlace("코스 짜기");
        }
        parsedForSecond = withTwoStepCourseIntent(parsedForSecond);
        if (courseQueryParsed?.includeHalfStep) {
          parsedForSecond = {
            ...parsedForSecond,
            includeHalfStep: true,
          };
        }
        return {
          ok: true,
          courseForSecond: next,
          parsedForSecond,
        };
      }

      const mergedPlace = {
        ...place,
        lat: w.lat,
        lng: w.lng,
        x: String(w.lng),
        y: String(w.lat),
      };
      let parsed = withTwoStepCourseIntent(parsedHintOrPlace("코스 짜기"));
      if (courseQueryParsed?.includeHalfStep) {
        parsed = { ...parsed, includeHalfStep: true };
      }
      const baseCourse = buildBootstrapOneStepCourse(mergedPlace);
      setCourseQueryParsed(parsed);
      setIsCourseMode(true);
      setCourseOptions((prev) => {
        const preserved = (prev || []).filter((c) => c?.profileKey === "my_own");
        return [baseCourse, ...preserved];
      });
      setSelectedCourse(baseCourse);
      setAltFirstCourses([]);
      setAltSecondCourses([]);
      return {
        ok: true,
        courseForSecond: baseCourse,
        parsedForSecond: parsed,
      };
    },
    [selectedCourse, applyMapPickAsFirstStep, courseQueryParsed]
  );

  /** 조합으로 담은 두 스텝으로 「나만의 코스」 추가 — 담기 순서가 1차·2차가 됨 */
  const applyComposedCourseFromSteps = useCallback((stepFirst, stepSecond) => {
    if (!stepFirst?.place || !stepSecond?.place) return false;

    const w0 = resolvePlaceWgs84(stepFirst.place);
    const w1 = resolvePlaceWgs84(stepSecond.place);
    if (!w0 || !w1) return false;
    const d = haversineMeters(w0.lat, w0.lng, w1.lat, w1.lng);
    if (!Number.isFinite(d)) return false;

    const idPart = `${placeId(stepFirst.place) ?? "p0"}-${placeId(stepSecond.place) ?? "p1"}`;
    const newCourse = {
      key: `my-own-${Date.now()}-${idPart}`,
      profileKey: "my_own",
      profileTitle: "나만의 코스",
      profileDescription: `${stepFirst.place?.name ?? "1차"} → ${stepSecond.place?.name ?? "2차"}`,
      totalScore: 0,
      composedFromPicks: true,
      isMyOwnCourse: true,
      steps: [
        {
          ...stepFirst,
          step: 1,
          label: "1차",
          place: stepFirst.place,
        },
        {
          ...stepSecond,
          step: 2,
          label: "2차",
          place: stepSecond.place,
          walkDistanceMeters: Math.round(d),
        },
      ],
    };

    setCourseOptions((prev) => [...(prev || []), newCourse]);
    setSelectedCourse(newCourse);
    setAltFirstCourses([]);
    setAltSecondCourses([]);
    return true;
  }, []);

  /** 레거시: 코스 카드 전체를 1·2번 소스로 쓸 때 */
  const applyComposedCourseFromPicks = useCallback(
    (pick1Course, pick2Course) => {
      if (!pick1Course || !pick2Course) return false;
      const st0 = pick1Course.steps?.[0];
      const p2 = pick2Course.steps || [];
      const st1 =
        p2.length >= 2 ? p2[p2.length - 1] : pick2Course.steps?.[1];
      return applyComposedCourseFromSteps(st0, st1);
    },
    [applyComposedCourseFromSteps]
  );

  return {
    courseOptions,
    selectedCourse,
    setSelectedCourse,
    altSecondCourses,
    altFirstCourses,
    coursePlaces,
    courseQueryParsed,
    courseQuery: courseQueryParsed,
    seenCourseKeys,
    courseError,
    isCourseMode,
    isLoadingCourse,
    isRegeneratingSecond,
    isRegeneratingFirst,
    isRefreshingCourses,
    runCourseSearch,
    openCourseComposer,
    resetCourseSearch,
    chooseCourse,
    regenerateSelectedCourseSecond,
    regenerateSelectedCourseFirst,
    rerunDifferentCourses,
    applyAlternativeSecond,
    applyAlternativeFirst,
    applyComposedCourseFromPicks,
    applyComposedCourseFromSteps,
    applyMapPickAsFirstStep,
    applyMapPickAsFirstStepAsync,
    computeSecondStepCandidatesOnly,
    applySecondStepPick,
    clearAlternativeSecond,
  };
}
