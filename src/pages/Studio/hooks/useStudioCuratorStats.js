import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { countStudioFollowingDistinct } from "../../../utils/studioFollowersFetch";
import {
  devLog,
  devWarn,
  normalizeStudioArchiveExtendedInsights,
} from "../studioHomeModule.js";

const INITIAL_STATS = {
  level: 1,
  saveCount: 0,
  followerCount: 0,
  followingCount: 0,
  /** 내 잔(place) 중 다른 큐레이터도 올린 장소 개수 — studio_curator_overlap_place_count RPC */
  overlapSharedPlaceCount: 0,
  /** studio_week_save_insights RPC */
  weekTopReactingPlace: null,
  weekTopReactingSaves: 0,
  weeklyStats: {
    newPlaces: 0,
    newSaves: 0,
    newFollowers: 0,
  },
  lastWeekStats: {
    newPlaces: 0,
    newSaves: 0,
    newFollowers: 0,
  },
};

/**
 * 잔 아카이브 탭 통계: curator_places(주간 신규 잔), 팔로우 카운트,
 * studio_week_save_insights / studio_curator_overlap_* / studio_archive_extended_insights RPC를 합쳐
 * `curatorStats`/`archiveExtInsights`/`overlapSharedPlacesList` 를 갱신한다.
 *
 * 트리거:
 *  - user 또는 myPlaces 길이/큐레이터 프로필 PK 가 바뀔 때마다
 *  - 다른 탭에서 "archive" 탭으로 전환될 때마다 (수정 저장은 길이가 그대로라 첫 트리거가 안 돎)
 *  - 외부에서 명시적으로 `loadCuratorStats(userId)` 호출 시 (잔 수정 저장 직후 등)
 */
export function useStudioCuratorStats({
  user,
  myPlacesLength,
  curatorProfileId,
  activeSection,
}) {
  const [curatorStats, setCuratorStats] = useState(INITIAL_STATS);
  const [archiveExtInsights, setArchiveExtInsights] = useState(() =>
    normalizeStudioArchiveExtendedInsights(null),
  );
  const [archiveInsightsError, setArchiveInsightsError] = useState("");
  const [overlapSharedPlacesList, setOverlapSharedPlacesList] = useState([]);
  const [showOverlapPlacesList, setShowOverlapPlacesList] = useState(false);

  const prevActiveSectionForArchiveStatsRef = useRef(null);

  const loadCuratorStats = useCallback(async (userId) => {
    try {
      const statsCpQ = supabase
        .from("curator_places")
        .select(
          `
          place_id,
          created_at,
          places (created_at)
        `,
        )
        .eq("curator_id", userId);
      const { data: statsCpRaw, error: placesError } = await statsCpQ;

      if (placesError) {
        console.error("places load error:", placesError);
        return;
      }

      const byPlace = new Map();
      for (const row of statsCpRaw || []) {
        const pid = row?.place_id;
        if (pid == null) continue;
        byPlace.set(String(pid), row);
      }
      const placeCuratorsData = [...byPlace.values()];

      const totalPlaces = placeCuratorsData?.length || 0;
      const totalLikes = 0; // likes 필드가 없으므로 0으로 설정

      /** 큐레이터가 이 장소를 연결한 시각. 없으면 레거시 폴백으로 places.created_at */
      const linkCreatedAt = (pc) => {
        const a = pc?.created_at;
        if (a) return new Date(a);
        const p = pc?.places?.created_at;
        return p ? new Date(p) : null;
      };

      // 로컬 주(일요일 0시) — 잔 기록·picked(신규 팔로워) 동일 기준
      const now = new Date();
      const thisWeekStart = new Date(now.setDate(now.getDate() - now.getDay()));
      const lastWeekStart = new Date(thisWeekStart);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);

      const thisWeekPlaces =
        placeCuratorsData?.filter((pc) => {
          const t = linkCreatedAt(pc);
          return t && t >= thisWeekStart;
        }).length || 0;

      const lastWeekPlaces =
        placeCuratorsData?.filter((pc) => {
          const t = linkCreatedAt(pc);
          return t && t >= lastWeekStart && t < thisWeekStart;
        }).length || 0;

      let thisWeekNewFollowers = 0;
      let lastWeekNewFollowers = 0;

      // 등급 계산 (실제 장소 수 기반)
      let level = 1;
      if (totalPlaces >= 1000) level = 5; // 다이아몬드
      else if (totalPlaces >= 500) level = 4; // 플래티넘
      else if (totalPlaces >= 200) level = 3; // 골드
      else if (totalPlaces >= 100) level = 2; // 실버
      else if (totalPlaces >= 50) level = 1; // 브론즈

      // 팔로워 수(성장 추이 picked = 주간 신규 팔로워 집계에도 동일 행 사용)
      const [{ data: followersData, error: followersError }, followingCount] =
        await Promise.all([
          supabase
            .from("user_profile_follows")
            .select("id, created_at")
            .eq("following_id", userId),
          countStudioFollowingDistinct(supabase, userId),
        ]);

      devLog("🔍 팔로워 데이터:", { followersData, followersError });
      const followerCount = followersError ? 0 : followersData?.length || 0;
      devLog("🔍 팔로워 / 팔로잉 수:", followerCount, followingCount);

      if (!followersError && followersData?.length) {
        for (const row of followersData) {
          if (!row.created_at) continue;
          const t = new Date(row.created_at);
          if (t >= thisWeekStart) thisWeekNewFollowers += 1;
          else if (t >= lastWeekStart && t < thisWeekStart)
            lastWeekNewFollowers += 1;
        }
      }

      let weekInsight = {
        top_place_name: null,
        top_save_count: 0,
        week_total_saves: 0,
      };
      const [
        { data: insightJson, error: insightErr },
        overlapRpc,
        extRpc,
        overlapPlacesRpc,
      ] = await Promise.all([
        supabase.rpc("studio_week_save_insights", { p_curator_id: userId }),
        supabase.rpc("studio_curator_overlap_place_count", {
          p_curator_id: userId,
        }),
        supabase.rpc("studio_archive_extended_insights", {
          p_curator_id: userId,
        }),
        supabase.rpc("studio_curator_overlap_places", {
          p_curator_id: userId,
        }),
      ]);
      if (!insightErr && insightJson && typeof insightJson === "object") {
        weekInsight = {
          top_place_name: insightJson.top_place_name ?? null,
          top_save_count: Number(insightJson.top_save_count) || 0,
          week_total_saves: Number(insightJson.week_total_saves) || 0,
        };
      } else if (insightErr) {
        devWarn(
          "studio_week_save_insights (Supabase에 마이그레이션 적용 필요):",
          insightErr.message,
        );
      }

      let overlapSharedPlaceCount = 0;
      const { data: overlapRaw, error: overlapErr } = overlapRpc || {};
      if (!overlapErr && overlapRaw != null) {
        overlapSharedPlaceCount = Number(overlapRaw) || 0;
      } else if (overlapErr) {
        devWarn(
          "studio_curator_overlap_place_count (Supabase에 마이그레이션 적용 필요):",
          overlapErr.message,
        );
      }

      const { data: overlapPlacesRaw, error: overlapPlacesErr } =
        overlapPlacesRpc || {};
      if (!overlapPlacesErr && Array.isArray(overlapPlacesRaw)) {
        setOverlapSharedPlacesList(overlapPlacesRaw);
      } else {
        if (overlapPlacesErr) {
          devWarn(
            "studio_curator_overlap_places (Supabase에 마이그레이션 적용 필요):",
            overlapPlacesErr.message,
          );
        }
        setOverlapSharedPlacesList([]);
      }

      const { data: extRaw, error: extErr } = extRpc || {};
      if (!extErr && extRaw != null) {
        setArchiveInsightsError("");
        setArchiveExtInsights(normalizeStudioArchiveExtendedInsights(extRaw));
      } else {
        if (extErr) {
          devWarn(
            "studio_archive_extended_insights (Supabase에 마이그레이션 적용 필요):",
            extErr.message,
          );
          setArchiveInsightsError(extErr.message);
        } else {
          setArchiveInsightsError(
            "내 스타일 분석 응답이 비어 있습니다. Supabase에 최신 마이그레이션을 적용했는지 확인하세요.",
          );
        }
        setArchiveExtInsights(normalizeStudioArchiveExtendedInsights(null));
      }

      const stats = {
        placeCount: totalPlaces,
        saveCount: totalLikes, // likes 필드가 없으므로 0
        followerCount,
        followingCount,
        overlapSharedPlaceCount,
        weekTopReactingPlace: weekInsight.top_place_name,
        weekTopReactingSaves: weekInsight.top_save_count,
        weeklyStats: {
          newPlaces: thisWeekPlaces,
          newSaves: weekInsight.week_total_saves,
          newFollowers: thisWeekNewFollowers,
        },
        lastWeekStats: {
          newPlaces: lastWeekPlaces,
          newSaves: 0,
          newFollowers: lastWeekNewFollowers,
        },
      };

      setCuratorStats((prev) => ({
        ...prev,
        level,
        ...stats,
      }));

      devLog("✅ 실제 통계 데이터 로드 (다대다):", stats);
    } catch (error) {
      console.error("stats load error:", error);
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      void loadCuratorStats(user.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 기존 동작 유지: myPlaces 길이/curatorProfile.id 변동 시 재조회
  }, [user?.id, myPlacesLength, curatorProfileId]);

  useEffect(() => {
    const prev = prevActiveSectionForArchiveStatsRef.current;
    prevActiveSectionForArchiveStatsRef.current = activeSection;
    if (!user?.id) return;
    if (activeSection === "archive" && prev != null && prev !== "archive") {
      void loadCuratorStats(user.id);
    }
  }, [activeSection, user?.id, loadCuratorStats]);

  return {
    curatorStats,
    setCuratorStats,
    archiveExtInsights,
    archiveInsightsError,
    overlapSharedPlacesList,
    showOverlapPlacesList,
    setShowOverlapPlacesList,
    loadCuratorStats,
  };
}
