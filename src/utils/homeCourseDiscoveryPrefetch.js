import {
  fetchMyCuratorCourses,
  fetchPublicCuratorCourses,
} from "../api/curatorCourses";
import { getCourseEngagementStatsBatch } from "../api/courseCompletionStats";
import { supabase } from "../lib/supabase";
import { HOME_COURSE_DISCOVERY_FETCH_LIMIT } from "./homeCourseDiscoveryLists";

const CACHE_TTL_MS = 5 * 60 * 1000;

/** @typedef {{ rows: object[], statsByCourseId: Map<string, object>, nameByCurator: Map<string, string>, at: number }} DiscoveryBundle */

function curatorLabelFromProfile(p) {
  if (!p || typeof p !== "object") return "큐레이터";
  const dn = String(p.display_name || "").trim();
  if (dn) return dn;
  const un = String(p.username || "").trim();
  if (un) return un.startsWith("@") ? un : `@${un}`;
  return "큐레이터";
}

async function curatorNameMapForCourses(courses) {
  const ids = [
    ...new Set(
      (Array.isArray(courses) ? courses : [])
        .map((c) => String(c.curator_id || "").trim())
        .filter(Boolean)
    ),
  ];
  if (!ids.length) return new Map();
  const { data: profs, error } = await supabase
    .from("profiles")
    .select("id, display_name, username")
    .in("id", ids);
  const m = new Map();
  if (!error && Array.isArray(profs)) {
    for (const p of profs) {
      if (p?.id) m.set(String(p.id), curatorLabelFromProfile(p));
    }
  }
  return m;
}

/**
 * @param {object[]} courses
 * @returns {Promise<DiscoveryBundle>}
 */
async function buildTrendingBundle(courses) {
  const rows = Array.isArray(courses) ? courses : [];
  const courseIds = rows
    .map((c) => String(c.id || "").trim())
    .filter(Boolean);
  const statsByCourseId = courseIds.length
    ? await getCourseEngagementStatsBatch(courseIds)
    : new Map();
  const nameByCurator = await curatorNameMapForCourses(rows);
  return {
    rows,
    statsByCourseId,
    nameByCurator,
    at: Date.now(),
  };
}

/** @type {DiscoveryBundle|null} */
let trendingCache = null;
/** @type {Promise<DiscoveryBundle|null>|null} */
let trendingInflight = null;

/** @type {Map<string, DiscoveryBundle>} */
const myCoursesCache = new Map();
/** @type {Map<string, Promise<DiscoveryBundle|null>>} */
const myCoursesInflight = new Map();

function isFresh(bundle) {
  return Boolean(bundle && Date.now() - bundle.at < CACHE_TTL_MS);
}

/** @returns {DiscoveryBundle|null} */
export function readHomeCourseDiscoveryTrendingCache() {
  return isFresh(trendingCache) ? trendingCache : null;
}

/** @param {string} userId */
export function readHomeCourseDiscoveryMyCache(userId) {
  const id = String(userId || "").trim();
  if (!id) return null;
  const bundle = myCoursesCache.get(id);
  return isFresh(bundle) ? bundle : null;
}

function writeTrendingCache(bundle) {
  trendingCache = bundle;
}

/** @param {string} userId @param {DiscoveryBundle} bundle */
function writeMyCache(userId, bundle) {
  myCoursesCache.set(String(userId).trim(), bundle);
}

/**
 * 홈 지도 idle 시 미리 불러와 칩 탭 직후 목록 즉시 표시.
 * @returns {Promise<DiscoveryBundle|null>}
 */
export function prefetchHomeCourseDiscoveryTrending() {
  const cached = readHomeCourseDiscoveryTrendingCache();
  if (cached) return Promise.resolve(cached);
  if (trendingInflight) return trendingInflight;

  trendingInflight = (async () => {
    try {
      const list = await fetchPublicCuratorCourses({
        limit: HOME_COURSE_DISCOVERY_FETCH_LIMIT,
      });
      const bundle = await buildTrendingBundle(list);
      writeTrendingCache(bundle);
      return bundle;
    } catch (e) {
      console.warn("[homeCourseDiscoveryPrefetch] trending", e);
      return null;
    } finally {
      trendingInflight = null;
    }
  })();

  return trendingInflight;
}

/**
 * @param {string} userId
 * @returns {Promise<DiscoveryBundle|null>}
 */
export function prefetchHomeCourseDiscoveryMy(userId) {
  const id = String(userId || "").trim();
  if (!id) return Promise.resolve(null);
  const cached = readHomeCourseDiscoveryMyCache(id);
  if (cached) return Promise.resolve(cached);
  const inflight = myCoursesInflight.get(id);
  if (inflight) return inflight;

  const p = (async () => {
    try {
      const list = await fetchMyCuratorCourses(id, { limit: 100 });
      const bundle = {
        rows: Array.isArray(list) ? list : [],
        statsByCourseId: new Map(),
        nameByCurator: new Map(),
        at: Date.now(),
      };
      writeMyCache(id, bundle);
      return bundle;
    } catch (e) {
      console.warn("[homeCourseDiscoveryPrefetch] my", e);
      return null;
    } finally {
      myCoursesInflight.delete(id);
    }
  })();

  myCoursesInflight.set(id, p);
  return p;
}

/** @param {DiscoveryBundle} bundle */
export function commitHomeCourseDiscoveryTrendingCache(bundle) {
  if (!bundle?.rows) return;
  writeTrendingCache({ ...bundle, at: Date.now() });
}

/** @param {string} userId @param {DiscoveryBundle} bundle */
export function commitHomeCourseDiscoveryMyCache(userId, bundle) {
  const id = String(userId || "").trim();
  if (!id || !bundle?.rows) return;
  writeMyCache(id, { ...bundle, at: Date.now() });
}

/** 내 코스 삭제·저장 후 캐시 무효화 */
export function invalidateHomeCourseDiscoveryMyCache(userId) {
  const id = String(userId || "").trim();
  if (!id) return;
  myCoursesCache.delete(id);
}
