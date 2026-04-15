import { useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { isCourseQuery } from "../utils/isCourseQuery";
import { parseCourseQuery } from "../utils/parseCourseQuery";
import { normalizePlaces } from "../utils/normalizePlace";
import {
  generateCourseOptions,
  courseOptionsToMapPlaces,
  courseVenuePairKey,
  placeId,
} from "../utils/generateCourseOptions.js";
import { haversineMeters, resolvePlaceWgs84 } from "../utils/placeCoords.js";
import { regenerateSecondStep } from "../utils/regenerateSecondStep.js";
import { regenerateFirstStep } from "../utils/regenerateFirstStep.js";

function appendSeenFromCourses(courses = []) {
  const keys = courses.map((c) => c.key).filter(Boolean);
  const pairs = courses
    .map((c) => courseVenuePairKey(c))
    .filter(Boolean);
  return { keys, pairs };
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

  const runCourseSearch = useCallback(async (query) => {
    const q = String(query || "").trim();
    if (!isCourseQuery(q)) {
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

    const parsed = parseCourseQuery(q);
    setCourseQueryParsed(parsed);

    try {
      let { data, error } = await supabase
        .from("places")
        .select("*")
        .eq("is_archived", false);

      if (error) {
        const retry = await supabase.from("places").select("*");
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        console.error("course search places:", error);
        setCourseError("코스 추천용 장소를 불러오지 못했어요.");
        setCourseOptions([]);
        setCoursePlaces([]);
        setSelectedCourse(null);
        return { handled: true, options: [], mapPlaces: [], parsed };
      }

      const normalizedPlaces = normalizePlaces(data || []);
      setCoursePlaces(normalizedPlaces);

      const options = generateCourseOptions({
        parsedQuery: parsed,
        places: normalizedPlaces,
        maxOptions: 3,
        excludeCourseKeys: [],
        excludeVenuePairKeys: [],
      });

      if (!options.length) {
        setCourseError(
          parsed.area
            ? "조건에 맞는 코스를 찾지 못했어요. 지역·태그 데이터를 더 넣으면 좋아져요."
            : "조건에 맞는 코스를 찾지 못했어요. 검색에 지역(예: 을지로)을 넣어 보세요."
        );
      }

      setCourseOptions(options);
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

  const regenerateSelectedCourseSecond = useCallback(
    async (variant = "same") => {
      if (!selectedCourse || !courseQueryParsed) return [];

      const slotKey = selectedCourse.key;
      setAltFirstCourses([]);
      setIsRegeneratingSecond(true);
      setCourseError("");

      try {
        let places = coursePlaces;

        if (!places.length) {
          let { data, error } = await supabase
            .from("places")
            .select("*")
            .eq("is_archived", false);

          if (error) {
            const retry = await supabase.from("places").select("*");
            data = retry.data;
            error = retry.error;
          }

          if (error) {
            console.error("regenerate second places:", error);
            setCourseError("2차 재추천용 장소를 불러오지 못했어요.");
            setAltSecondCourses([]);
            return [];
          }

          places = normalizePlaces(data || []);
          setCoursePlaces(places);
        }

        const results = regenerateSecondStep({
          selectedCourse,
          parsedQuery: courseQueryParsed,
          places,
          variant,
        });

        if (results.length) {
          const picked = results[0];
          setCourseOptions((prev) =>
            replaceCourseOptionsSlot(prev, slotKey, picked)
          );
          setSelectedCourse(picked);
          setAltSecondCourses(results.slice(1));
        } else {
          setAltSecondCourses([]);
          setCourseError("바꿔볼 만한 2차 후보를 찾지 못했어요.");
        }

        return results;
      } catch (e) {
        console.error(e);
        setCourseError("2차 재추천 중 문제가 생겼어요.");
        setAltSecondCourses([]);
        return [];
      } finally {
        setIsRegeneratingSecond(false);
      }
    },
    [selectedCourse, courseQueryParsed, coursePlaces]
  );

  const regenerateSelectedCourseFirst = useCallback(async () => {
    if (!selectedCourse || !courseQueryParsed) return [];

    const slotKey = selectedCourse.key;
    setAltSecondCourses([]);
    setIsRegeneratingFirst(true);
    setCourseError("");

    try {
      let places = coursePlaces;

      if (!places.length) {
        let { data, error } = await supabase
          .from("places")
          .select("*")
          .eq("is_archived", false);

        if (error) {
          const retry = await supabase.from("places").select("*");
          data = retry.data;
          error = retry.error;
        }

        if (error) {
          console.error("regenerate first places:", error);
          setCourseError("1차 재추천용 장소를 불러오지 못했어요.");
          setAltFirstCourses([]);
          return [];
        }

        places = normalizePlaces(data || []);
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
        let { data, error } = await supabase
          .from("places")
          .select("*")
          .eq("is_archived", false);

        if (error) {
          const retry = await supabase.from("places").select("*");
          data = retry.data;
          error = retry.error;
        }

        if (error) {
          console.error("rerun course places:", error);
          setCourseError("코스용 장소를 불러오지 못했어요.");
          return [];
        }

        places = normalizePlaces(data || []);
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

      setCourseOptions(results);
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

  /** 지도 미리보기에서 고른 장소를 현재 선택 코스의 1차로 넣음 (2차는 유지, 도보 거리만 갱신) */
  const applyMapPickAsFirstStep = useCallback((place) => {
    if (!selectedCourse) return false;
    const steps = selectedCourse.steps || [];
    if (steps.length < 2) return false;
    const slotKey = selectedCourse.key;
    const st0 = steps[0];
    const st1 = steps[1];
    const w = resolvePlaceWgs84(place);
    if (!w) return false;

    const mergedPlace = {
      ...(st0?.place && typeof st0.place === "object" ? st0.place : {}),
      ...place,
      lat: w.lat,
      lng: w.lng,
      x: String(w.lng),
      y: String(w.lat),
    };

    const w1 = resolvePlaceWgs84(st1.place);
    let walkM = st1.walkDistanceMeters;
    if (w1 && Number.isFinite(w1.lat) && Number.isFinite(w1.lng)) {
      walkM = Math.round(haversineMeters(w.lat, w.lng, w1.lat, w1.lng));
    }

    const newStep0 = { ...st0, step: 1, place: mergedPlace };
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
    return true;
  }, [selectedCourse]);

  /** 1차만·2차만에서 각각 고른 코스의 1차·2차를 한 코스로 합침 */
  const applyComposedCourseFromPicks = useCallback(
    (pick1Course, pick2Course) => {
      if (!selectedCourse || !pick1Course || !pick2Course) return false;
      const slotKey = selectedCourse.key;
      const st0 = pick1Course.steps?.[0];
      const st1 = pick2Course.steps?.[1];
      if (!st0?.place || !st1?.place) return false;

      const w0 = resolvePlaceWgs84(st0.place);
      const w1 = resolvePlaceWgs84(st1.place);
      if (!w0 || !w1) return false;
      const d = haversineMeters(w0.lat, w0.lng, w1.lat, w1.lng);
      if (!Number.isFinite(d)) return false;

      const idPart = `${placeId(st0.place) ?? "p0"}-${placeId(st1.place) ?? "p1"}`;
      const newCourse = {
        key: `${slotKey}-compose-${idPart}`,
        profileKey: selectedCourse.profileKey,
        profileTitle: selectedCourse.profileTitle,
        profileDescription: [selectedCourse.profileDescription, "직접 조합"]
          .filter(Boolean)
          .join(" · "),
        totalScore: selectedCourse.totalScore,
        composedFromPicks: true,
        steps: [
          {
            ...st0,
            step: 1,
            label: st0.label ?? "1차",
            place: st0.place,
          },
          {
            ...st1,
            step: 2,
            label: st1.label ?? "2차",
            place: st1.place,
            walkDistanceMeters: Math.round(d),
          },
        ],
      };

      setCourseOptions((prev) => replaceCourseOptionsSlot(prev, slotKey, newCourse));
      setSelectedCourse(newCourse);
      setAltFirstCourses([]);
      setAltSecondCourses([]);
      return true;
    },
    [selectedCourse]
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
    resetCourseSearch,
    chooseCourse,
    regenerateSelectedCourseSecond,
    regenerateSelectedCourseFirst,
    rerunDifferentCourses,
    applyAlternativeSecond,
    applyAlternativeFirst,
    applyComposedCourseFromPicks,
    applyMapPickAsFirstStep,
    clearAlternativeSecond,
  };
}
