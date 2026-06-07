import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "../../../lib/supabase";
import { runWhenIdle } from "../../../utils/runWhenIdle";
import { curatorRowProfileImage } from "../homeModule.js";

/**
 * Home의 인증/역할(`isAdmin`, `isCurator`) + 큐레이터 프로필/카탈로그 + 일반 사용자 공개 프로필을
 * 한 묶음으로 관리하는 hook.
 *
 * 인증 로딩 종료 + user 변화 시:
 *  - profiles.role 로 admin 판정 (DEV 환경에서는 VITE_ADMIN_USER_ID로 단축)
 *  - curators 테이블로 큐레이터 판정 → 환영 alert + 반려 신청 alert
 *  - 전체 큐레이터 목록 fetch → `curatorAttachRowsRef`에 원본 보관 + UI용 포맷으로 `dbCurators`
 *
 * 큐레이터로 판정되면 한 번 더 curators row를 가져와 `curatorProfile`을 갱신.
 *
 * `mapUserProfile`은 user.id 변화 시 자동 갱신, 외부에서 `refreshMapUserProfile()`로도 트리거 가능.
 *
 * @param {{ user: any, authLoading: boolean, curatorAttachRowsRef: React.MutableRefObject<any[]> }} args
 */
export function useAuthRoleAndCurators({
  user,
  authLoading,
  curatorAttachRowsRef,
}) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCurator, setIsCurator] = useState(false);
  /** auth 세션 후 admin·curator 판정이 끝날 때까지 true — 프로필→스튜디오 오판 방지 */
  const [rolesLoading, setRolesLoading] = useState(true);
  const [curatorProfile, setCuratorProfile] = useState(null);
  const [dbCurators, setDbCurators] = useState([]);
  const [mapUserProfile, setMapUserProfile] = useState(null);

  /** 큐레이터 상태 변화 감지용 — 환영 alert를 한 번만 띄우기 위함 */
  const curatorWelcomeRef = useRef(false);

  const userId = user?.id ?? null;
  const userEmail = user?.email ?? null;

  /** 큐레이터 프로필 / 일반 프로필 갱신 트리거 (외부에서도 호출) */
  const refreshMapUserProfile = useCallback(async () => {
    if (!userId) {
      setMapUserProfile(null);
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("username, display_name, auth_provider, avatar_url")
      .eq("id", userId)
      .maybeSingle();
    if (!error && data) setMapUserProfile(data);
    else setMapUserProfile(null);
  }, [userId]);

  /** 1) admin·curator 판정(병렬) → 2) 환영/반려 · 카탈로그는 비차단 */
  useEffect(() => {
    let cancelled = false;

    const applyCuratorProfile = (data) => {
      if (!data) return;
      const handle = String(data.slug || data.username || "").trim();
      const nick = String(
        data.name || data.display_name || handle || "",
      ).trim();
      setCuratorProfile({
        id: data.id,
        user_id: data.user_id,
        username: handle,
        displayName: nick,
        bio: data.bio,
        image: curatorRowProfileImage(data),
      });
    };

    const checkCuratorSideEffects = (data, isUserCurator) => {
      const wasCuratorBefore = curatorWelcomeRef.current;
      curatorWelcomeRef.current = isUserCurator;

      if (isUserCurator && !wasCuratorBefore) {
        console.log("🎉 새로운 큐레이터 환영 메시지 표시");

        const welcomeKey = `curator_welcome_${userId}`;
        const hasShownWelcome = localStorage.getItem(welcomeKey);

        if (!hasShownWelcome) {
          setTimeout(() => {
            const emailPrefix = userEmail
              ? String(userEmail).split("@")[0]
              : "user";
            alert(
              `🎉 큐레이터가 되신 것을 환영합니다!\n\n이제 스튜디오에서 장소를 등록하고\n팔로워들과 멋진 장소를 공유할 수 있어요!\n\n스튜디오 입장 → @${emailPrefix} 버튼을 눌러서 입장하세요!`,
            );
            localStorage.setItem(welcomeKey, "shown");
          }, 1000);
        }

        applyCuratorProfile(data);
        console.log("✅ 큐레이터 프로필 로드됨");
      } else if (isUserCurator) {
        applyCuratorProfile(data);
      }

    };

    const checkRejectedApplication = async () => {
      if (!userId) return;
      try {
        const { data: rejectedRows, error: rejErr } = await supabase
          .from("curator_applications")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "rejected")
          .order("created_at", { ascending: false })
          .limit(1);
        const rejectedApp = Array.isArray(rejectedRows)
          ? rejectedRows[0]
          : null;

        if (cancelled) return;

        if (rejErr) {
          console.error("반려 신청 확인 오류:", rejErr);
          return;
        }

        if (rejectedApp) {
          const rejectKey = `curator_rejected_${userId}_${rejectedApp.id}`;
          if (localStorage.getItem(rejectKey)) return;

          localStorage.setItem(rejectKey, "shown");

          setTimeout(() => {
            if (cancelled) return;
            const customReason =
              rejectedApp.rejection_reason &&
              String(rejectedApp.rejection_reason).trim();
            const reasonLine = customReason
              ? customReason
              : "검토 결과 큐레이터 신청 기준에 맞지 않아 반려되었습니다.";
            alert(
              `😔 큐레이터 신청이 반려되었습니다.\n\n신청자: ${rejectedApp.name}\n반려 사유: ${reasonLine}\n\n내용을 보완한 뒤 다시 신청하실 수 있습니다.`,
            );
          }, 1500);
        }
      } catch (e) {
        console.error("반려 확인 중 오류:", e);
      }
    };

    const resolveRoles = async () => {
      if (authLoading) {
        setRolesLoading(true);
        return;
      }

      setRolesLoading(true);

      if (!userId) {
        setIsAdmin(false);
        setIsCurator(false);
        setCuratorProfile(null);
        curatorWelcomeRef.current = false;
        setRolesLoading(false);
        return;
      }

      let adminOk = false;
      if (
        import.meta.env.DEV &&
        import.meta.env.VITE_ADMIN_USER_ID === userId
      ) {
        adminOk = true;
      } else {
        const { data, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          console.error("admin check error:", error);
          adminOk = false;
        } else {
          adminOk = data?.role === "admin";
        }
      }

      const { data: curatorRow, error: curatorErr } = await supabase
        .from("curators")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (cancelled) return;

      if (curatorErr) {
        console.error("curator check error:", curatorErr);
        setIsCurator(false);
        setCuratorProfile(null);
        curatorWelcomeRef.current = false;
      } else {
        const isUserCurator = Boolean(curatorRow);
        setIsCurator(isUserCurator);
        if (isUserCurator) {
          checkCuratorSideEffects(curatorRow, true);
        } else {
          setCuratorProfile(null);
          curatorWelcomeRef.current = false;
        }
      }

      setIsAdmin(adminOk);
      setRolesLoading(false);
      console.log("👑 역할 판정 완료:", {
        userId,
        isAdmin: adminOk,
        isCurator: Boolean(curatorRow),
      });

      if (!adminOk && !curatorRow) {
        void checkRejectedApplication();
      }
    };

    const loadCurators = async () => {
      try {
        const { data, error } = await supabase
          .from("curators")
          .select(
            "id, user_id, username, slug, name, display_name, bio, image, avatar_url, grade",
          )
          .order("created_at", { ascending: false });

        if (error) {
          console.error("큐레이터 로드 오류:", error);
          if (curatorAttachRowsRef) curatorAttachRowsRef.current = [];
          setDbCurators([]);
          return;
        }

        if (curatorAttachRowsRef) curatorAttachRowsRef.current = data || [];

        // CuratorFilterBar: 칩 키는 slug(@핸들) → name(별명) → username → display_name → id 순
        const formattedCurators = (data || []).map((curator) => {
          const slug =
            curator.slug != null ? String(curator.slug).trim() : "";
          const u =
            curator.username != null ? String(curator.username).trim() : "";
          const d =
            curator.display_name != null
              ? String(curator.display_name).trim()
              : "";
          const nm =
            curator.name != null ? String(curator.name).trim() : "";
          const pk = curator.id != null ? String(curator.id).trim() : "";
          const cUserId =
            curator.user_id != null ? String(curator.user_id).trim() : "";
          const handle = slug || u;
          const nick = nm || d;
          const filterKey = handle || nick || pk;
          return {
            id: pk || filterKey,
            filterKey,
            name: nick || filterKey,
            slug: slug || null,
            username: handle || null,
            userId: cUserId || null,
            displayName: nick || handle || "큐레이터",
            bio: curator.bio,
            avatar: curatorRowProfileImage(curator),
            grade: curator.grade || "default",
            color: "#2ECC71",
          };
        });

        setDbCurators(formattedCurators);
        console.log("✅ 큐레이터 목록 로드:", formattedCurators.length, "개");
        console.log("📝 큐레이터 데이터:", formattedCurators);
      } catch (e) {
        console.error("큐레이터 로드 실패:", e);
        if (curatorAttachRowsRef) curatorAttachRowsRef.current = [];
        setDbCurators([]);
      }
    };

    let cancelIdle = () => {};
    void resolveRoles().then(() => {
      if (cancelled) return;
      cancelIdle = runWhenIdle(() => {
        if (!cancelled) void loadCurators();
      }, { timeout: 3500 });
    });

    return () => {
      cancelled = true;
      cancelIdle();
    };
    /** userEmail은 환영 alert 안에서만 읽음 — id가 같은 한 reference 변화로 재실행 안 시킴 */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, userId, curatorAttachRowsRef, userEmail]);

  /** 큐레이터로 판정되면 curators row 한 번 더 가져와 프로필 보강 */
  useEffect(() => {
    if (!userId || !isCurator) return;
    let cancelled = false;
    const loadCuratorProfile = async () => {
      try {
        const { data, error } = await supabase
          .from("curators")
          .select("*")
          .eq("user_id", userId)
          .single();

        if (cancelled) return;

        if (error) {
          console.error("큐레이터 프로필 조회 실패:", error);
          return;
        }

        if (data) {
          const handle = String(data.slug || data.username || "").trim();
          const nick = String(
            data.name || data.display_name || handle || "",
          ).trim();
          const profile = {
            id: data.id,
            user_id: data.user_id,
            username: handle,
            displayName: nick,
            bio: data.bio,
            image: curatorRowProfileImage(data),
          };

          setCuratorProfile(profile);
          console.log("🎭 큐레이터 프로필 로드:", profile);
        }
      } catch (e) {
        console.error("큐레이터 프로필 로드 실패:", e);
      }
    };

    loadCuratorProfile();
    return () => {
      cancelled = true;
    };
  }, [userId, isCurator]);

  /** user 변화 시 일반 사용자 공개 프로필 자동 갱신 */
  useEffect(() => {
    refreshMapUserProfile();
  }, [refreshMapUserProfile]);

  return {
    isAdmin,
    isCurator,
    rolesLoading,
    curatorProfile,
    dbCurators,
    mapUserProfile,
    refreshMapUserProfile,
    setCuratorProfile,
  };
}
