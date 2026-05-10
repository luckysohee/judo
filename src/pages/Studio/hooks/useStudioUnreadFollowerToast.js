import { useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import {
  fetchStudioFollowersEnriched,
  resolveFollowerPresentation,
} from "../../../utils/studioFollowersFetch";

/**
 * 스튜디오 진입 시 user_profile_follows.is_read=false 행을 한 번 읽고
 * 토스트로 안내한 뒤 같은 트랜잭션에서 읽음 처리.
 * 본 훅은 effect만 수행하며 반환값이 없다.
 */
export function useStudioUnreadFollowerToast({ user, showToast }) {
  useEffect(() => {
    if (!user?.id) return undefined;

    const fetchUnreadFollowers = async () => {
      try {
        const { data: unreadFollows, error: unreadError } = await supabase
          .from("user_profile_follows")
          .select("follower_id, created_at")
          .eq("following_id", user.id)
          .eq("is_read", false)
          .order("created_at", { ascending: false });

        if (unreadError) {
          console.error("읽지 않은 팔로워 조회 실패:", unreadError);
          return;
        }

        if (!unreadFollows?.length) return;

        const enriched = await fetchStudioFollowersEnriched(supabase, user.id, {
          byFollowingUserId: user.id,
        });
        const byUserId = new Map(enriched.map((r) => [r.user_id, r]));

        const followerPromises = unreadFollows.map(async (follow) => {
          const fid = follow.follower_id;
          const row = byUserId.get(fid);
          if (row) {
            const toastLine =
              row.label === "이름 미설정" ? null : row.label;
            return { ...follow, toastLine, toastDetail: null };
          }
          const [profRes, curRes] = await Promise.all([
            supabase
              .from("profiles")
              .select("username, display_name, auth_provider, avatar_url")
              .eq("id", fid)
              .maybeSingle(),
            supabase
              .from("curators")
              .select(
                "user_id, display_name, username, name, avatar_url, avatar, image, grade",
              )
              .eq("user_id", fid)
              .maybeSingle(),
          ]);

          const pres = resolveFollowerPresentation(
            profRes.data || {},
            curRes.data,
          );
          const toastLine =
            pres.label === "이름 미설정" ? null : pres.label;

          return {
            ...follow,
            toastLine,
            toastDetail: null,
          };
        });

        const followersWithData = await Promise.all(followerPromises);
        const count = followersWithData.length;
        const firstFollower = followersWithData[0];

        const singleMsg = (() => {
          const f = firstFollower;
          if (f.toastDetail) {
            return `✨ ${f.toastLine} — ${f.toastDetail}`;
          }
          if (!f.toastLine) {
            return `✨ 새 팔로우가 생겼어요! 👤`;
          }
          return `✨ ${f.toastLine}님이 나를 팔로우했습니다! 👤`;
        })();

        const message =
          count === 1
            ? singleMsg
            : !firstFollower.toastLine
              ? `🚀 새 팔로우 ${count}건이 있어요. 👤`
              : `🚀 ${firstFollower.toastLine}님 외 ${count - 1}명이 나를 팔로우합니다!`;

        showToast(message, "info", 5000);

        await supabase
          .from("user_profile_follows")
          .update({ is_read: true })
          .eq("following_id", user.id)
          .eq("is_read", false);
      } catch (error) {
        console.error("팔로워 알림 처리 오류:", error);
      }
    };

    void fetchUnreadFollowers();
    return undefined;
  }, [user?.id, showToast]);
}
