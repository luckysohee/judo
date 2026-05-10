import { useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { fetchCuratorPlacesMergedWithPlaces } from "../../../utils/supabasePlaces";
import { normalizeStudioPlaceCategory } from "../../../utils/placeTaxonomy.js";
import { readStudioDrafts } from "../../../utils/studioDraftsLocal";
import {
  dedupeCuratorPlacesByPlaceId,
  devLog,
  mapCuratorJoinRowsToMyPlaces,
} from "../studioHomeModule.js";

/**
 * 인증 직후 1회 실행되는 스튜디오 초기 로드 — 큐레이터 프로필 + 내 잔(curator_places ⨝ places) +
 * 「잔 채우기」 임시저장(localStorage)을 한꺼번에 채운다. 폴더(useStudioSavedFolders)와는 별 단계.
 */
export function useStudioInitialLoad({
  user,
  authLoading,
  setLoading,
  setMyPlaces,
  setDrafts,
  setIsCurator,
  setCuratorProfile,
}) {
  useEffect(() => {
    if (authLoading) return;

    const loadCuratorActivity = async (userId) => {
      try {
        const { data: placeCuratorsData, error: placesError } = await supabase
          .from("curator_places")
          .select("place_id")
          .eq("curator_id", userId);

        if (placesError) {
          console.error("places load error:", placesError);
          return;
        }

        const totalPlaces = placeCuratorsData?.length || 0;
        const totalLikes = 0;

        await supabase
          .from("curators")
          .update({
            total_places: totalPlaces,
            total_likes: totalLikes,
            last_activity_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        setCuratorProfile((prev) => ({
          ...prev,
          total_places: totalPlaces,
          total_likes: totalLikes,
        }));
      } catch (error) {
        console.error("activity load error:", error);
      }
    };

    const loadStudioData = async () => {
      try {
        setLoading(true);
        if (!user?.id) {
          devLog("인증된 사용자 없음, 기본 프로필 사용");
          const defaultUser = {
            username: "nopokiller",
            display_name: "노포킬러",
            bio: "안녕하세요! 맛집 탐험을 좋아하는 큐레이터입니다.",
            image: null,
          };

          setCuratorProfile((prev) => ({
            ...prev,
            username: defaultUser.username,
            displayName: defaultUser.display_name,
            bio: defaultUser.bio,
            image: defaultUser.image,
          }));
        } else {
          devLog("✅ 인증된 사용자:", user.id);

          const { data: profileData, error: profileError } = await supabase
            .from("curators")
            .select("*")
            .eq("user_id", user.id)
            .single();

          if (profileError && profileError.code !== "PGRST116") {
            devLog("프로필 데이터 없음, 기본값 사용:", profileError);
          }

          const isUserCurator = profileData && !profileError;
          setIsCurator(isUserCurator);
          devLog("🎭 큐레이터 여부:", isUserCurator);

          const currentUser = profileData || {
            user_id: user.id,
            slug:
              user.user_metadata?.username || user.email?.split("@")[0],
            username:
              user.user_metadata?.username || user.email?.split("@")[0],
            name: user.user_metadata?.display_name || "큐레이터",
            display_name: user.user_metadata?.display_name || "큐레이터",
            bio: "안녕하세요! 맛집 탐험을 좋아하는 큐레이터입니다.",
            image: null,
            grade: "bronze",
            status: "active",
            total_places: 0,
            total_likes: 0,
            warning_count: 0,
          };

          devLog("📂 프로필 데이터 로드:", currentUser);

          setCuratorProfile((prev) => ({
            ...prev,
            id: currentUser.id,
            user_id: currentUser.user_id || user.id,
            username: String(currentUser.slug || currentUser.username || "").trim(),
            displayName:
              String(
                currentUser.name ||
                  currentUser.display_name ||
                  currentUser.slug ||
                  currentUser.username ||
                  ""
              ).trim() || "큐레이터",
            bio: currentUser.bio,
            image:
              currentUser.avatar_url ??
              currentUser.avatar ??
              currentUser.image ??
              null,
            grade: currentUser.grade || "bronze",
            status: currentUser.status || "active",
            total_places: currentUser.total_places || 0,
            total_likes: currentUser.total_likes || 0,
            warning_count: currentUser.warning_count || 0,
            created_at: currentUser.created_at || prev.created_at,
            username_changed_at: currentUser.username_changed_at ?? null,
          }));

          await loadCuratorActivity(user.id);
        }

        devLog("📂 스튜디오 데이터 로딩 시작...");
        devLog("🔍 현재 사용자 ID:", user?.id);

        if (!user?.id) {
          setMyPlaces([]);
          const savedDraftsGuest = readStudioDrafts(null);
          setDrafts(savedDraftsGuest);
          setLoading(false);
          return;
        }

        let curatorPlacesRaw = [];
        let placesError = null;
        try {
          curatorPlacesRaw = await fetchCuratorPlacesMergedWithPlaces(
            supabase,
            user.id
          );
        } catch (e) {
          placesError = e;
        }

        const curatorPlacesData = dedupeCuratorPlacesByPlaceId(curatorPlacesRaw);

        const placesData =
          curatorPlacesData?.map((cp) => cp.places).filter(Boolean) || [];

        devLog("🔍 큐레이터 추천 쿼리 결과:", {
          data: curatorPlacesData,
          error: placesError,
        });

        if (!placesData || placesData.length === 0) {
          devLog("⚠️ 다대다 방식으로 장소 없음, 기존 방식으로 확인 중...");

          const { data: oldWayData } = await supabase
            .from("places")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

          if (oldWayData && oldWayData.length > 0) {
            devLog("✅ 기존 방식으로 장소 발견:", oldWayData.length, "개");

            const formattedPlaces = oldWayData.map((place) => ({
              id: place.id,
              name: place.name,
              address: place.address || place.name,
              latitude: place.lat,
              longitude: place.lng,
              category:
                normalizeStudioPlaceCategory(place.category || "") || "미분류",
              alcohol_type: place.alcohol_type || "",
              atmosphere: place.atmosphere || "",
              recommended_menu: place.recommended_menu || "",
              menu_reason: place.menu_reason || "",
              tags: place.tags || [],
              is_public: place.is_public,
              created_at: place.created_at
                ? new Date(place.created_at).toISOString().split("T")[0]
                : new Date().toISOString().split("T")[0],
            }));

            setMyPlaces(formattedPlaces);
            devLog("✅ myPlaces 업데이트 완료 (기존 방식):", formattedPlaces);
            setLoading(false);
            return;
          }

          devLog("🔍 모든 장소 확인 중...");
          const { data: allPlaces } = await supabase
            .from("places")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(10);

          devLog("🔍 모든 장소 데이터:", allPlaces);
          devLog(
            "🔍 모든 장소 user_id:",
            allPlaces?.map((p) => ({
              id: p.id,
              name: p.name,
              user_id: p.user_id,
            }))
          );
        }

        if (placesError) {
          console.error("❌ 장소 로딩 오류:", placesError);
        } else {
          devLog("✅ 불러온 장소 데이터:", placesData);

          const formattedPlaces = mapCuratorJoinRowsToMyPlaces(curatorPlacesData);

          setMyPlaces(formattedPlaces);
          devLog("✅ myPlaces 업데이트 완료:", formattedPlaces);

          const savedDrafts = readStudioDrafts(user.id);
          setDrafts(savedDrafts);
          devLog(
            "📝 localStorage에서 임시저장 데이터 불러옴:",
            savedDrafts.length,
            "개"
          );
        }

        setLoading(false);
      } catch (error) {
        console.error("❌ Studio data loading error:", error);
        setLoading(false);
      }
    };

    void loadStudioData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auth/user만 반응, 내부 함수 deps는 의도적으로 제외
  }, [authLoading, user?.id]);
}
