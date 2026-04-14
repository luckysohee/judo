import { useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { isCourseQuery } from "../utils/isCourseQuery";
import { parseCourseQuery } from "../utils/parseCourseQuery";
import { normalizePlaces } from "../utils/normalizePlace";
import {
  generateCourseOptions,
  courseOptionsToMapPlaces,
  courseVenuePairKey,
} from "../utils/generateCourseOptions.js";
import { regenerateSecondStep } from "../utils/regenerateSecondStep.js";

function appendSeenFromCourses(courses = []) {
  const keys = courses.map((c) => c.key).filter(Boolean);
  const pairs = courses
    .map((c) => courseVenuePairKey(c))
    .filter(Boolean);
  return { keys, pairs };
}

export function useCourseSearch() {
  const [courseOptions, setCourseOptions] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [courseQueryParsed, setCourseQueryParsed] = useState(null);
  const [coursePlaces, setCoursePlaces] = useState([]);
  const [altSecondCourses, setAltSecondCourses] = useState([]);
  const [seenCourseKeys, setSeenCourseKeys] = useState([]);
  const [seenVenuePairKeys, setSeenVenuePairKeys] = useState([]);
  const [courseError, setCourseError] = useState("");
  const [isCourseMode, setIsCourseMode] = useState(false);
  const [isLoadingCourse, setIsLoadingCourse] = useState(false);
  const [isRegeneratingSecond, setIsRegeneratingSecond] = useState(false);
  const [isRefreshingCourses, setIsRefreshingCourses] = useState(false);

  const resetCourseSearch = useCallback(() => {
    setCourseOptions([]);
    setSelectedCourse(null);
    setCourseQueryParsed(null);
    setCoursePlaces([]);
    setAltSecondCourses([]);
    setSeenCourseKeys([]);
    setSeenVenuePairKeys([]);
    setCourseError("");
    setIsCourseMode(false);
    setIsLoadingCourse(false);
    setIsRegeneratingSecond(false);
    setIsRefreshingCourses(false);
  }, []);

  const chooseCourse = useCallback((course) => {
    setSelectedCourse(course);
    setAltSecondCourses([]);
  }, []);

  const applyAlternativeSecond = useCallback((course) => {
    setSelectedCourse(course);
    setAltSecondCourses([]);
  }, []);

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

        setAltSecondCourses(results);

        if (!results.length) {
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

  const rerunDifferentCourses = useCallback(async () => {
    if (!courseQueryParsed) return [];

    setIsRefreshingCourses(true);
    setCourseError("");
    setAltSecondCourses([]);

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

  return {
    courseOptions,
    selectedCourse,
    setSelectedCourse,
    altSecondCourses,
    coursePlaces,
    courseQueryParsed,
    courseQuery: courseQueryParsed,
    seenCourseKeys,
    courseError,
    isCourseMode,
    isLoadingCourse,
    isRegeneratingSecond,
    isRefreshingCourses,
    runCourseSearch,
    resetCourseSearch,
    chooseCourse,
    regenerateSelectedCourseSecond,
    rerunDifferentCourses,
    applyAlternativeSecond,
    clearAlternativeSecond,
  };
}
