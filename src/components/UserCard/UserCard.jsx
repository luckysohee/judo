import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from '../../lib/supabase';
import { uploadUserProfileAvatarFile } from "../../utils/curatorPlacePhotos";
import { isAcceptableRasterImageFile } from "../../utils/prepareImageFileForUpload";
import {
  formatAuthProviderForUi,
  getAuthProviderLabel,
} from "../../lib/syncAuthProviderToProfile";
import { isUsernameChangeCooldownError } from "../../utils/usernameCooldown";
import {
  insertSystemFolderRow,
  selectSystemFoldersOrdered,
} from "../../utils/systemFoldersSupabase";
import { useAuth } from "../../context/AuthContext";
import { readStudioDrafts, writeStudioDrafts } from "../../utils/studioDraftsLocal";
import { fetchUserPickedPlaces } from "../../api/placePicks";
import { fetchUserHanjanHistory } from "../../api/userHanjan";
import PlacePickButton from "../PlacePick/PlacePickButton";
import {
  fetchStudioFollowingEnriched,
  fetchStudioFollowersEnriched,
} from "../../utils/studioFollowersFetch";
import { unfollowUser } from "../../utils/userProfileFollows";
import UserTastePreferencesSection from "../Onboarding/UserTastePreferencesSection";
import {
  studioCoursesBtnGhost,
  studioCoursesBtnPrimary,
  studioCoursesInput,
} from "../../pages/Studio/studioCoursesSharedStyles";

/** StudioHome / studioCourses 와 동일 톤 */
const STUDIO_PROFILE = {
  shell: "#111111",
  card: "#1a1a1a",
  cell: "#222222",
  border: "rgba(255,255,255,0.1)",
  borderSubtle: "rgba(255,255,255,0.07)",
  textMuted: "rgba(255,255,255,0.55)",
  textSoft: "rgba(255,255,255,0.65)",
  textHint: "#bdbdbd",
  accent: "#2ECC71",
  accentBg: "rgba(46, 204, 113, 0.18)",
  accentBorder: "rgba(46, 204, 113, 0.45)",
  glassBar: "rgba(255,255,255,0.06)",
  font:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

const PUBLIC_HANDLE_RE = /^[a-z0-9_]{3,20}$/;

function normalizePublicHandleInput(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20);
}

// CSS 애니메이션 추가
const style = document.createElement('style');
style.textContent = `
  @keyframes slideUp {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }
`;
document.head.appendChild(style);

/**
 * 스튜디오와 동일 — #111 베이스, #1a1a1a 카드, 그린 액센트 탭.
 */
const userCardGlass = {
  overlay: {
    backgroundColor: "rgba(0, 0, 0, 0.52)",
  },
  sheet: {
    backgroundColor: STUDIO_PROFILE.shell,
    color: "#ffffff",
    fontFamily: STUDIO_PROFILE.font,
    border: "1px solid rgba(255,255,255,0.1)",
    borderBottom: "none",
    boxShadow: "0 -8px 32px rgba(0, 0, 0, 0.45)",
  },
  hairline: {
    borderColor: "rgba(255,255,255,0.08)",
  },
  panel: {
    backgroundColor: STUDIO_PROFILE.card,
    border: `1px solid ${STUDIO_PROFILE.border}`,
    borderRadius: "12px",
    boxShadow: "none",
  },
  insetCard: {
    margin: "8px 10px 0",
    padding: "12px 14px",
    backgroundColor: STUDIO_PROFILE.card,
    border: `1px solid ${STUDIO_PROFILE.border}`,
    borderRadius: "12px",
    boxSizing: "border-box",
  },
};

// 팔로우 큐레이터 컴팩트 스타일
const curatorCardStyles = {
  card: {
    backgroundColor: STUDIO_PROFILE.card,
    border: `1px solid ${STUDIO_PROFILE.border}`,
    borderRadius: "12px",
    padding: "8px 10px",
    cursor: "pointer",
    transition: "background-color 0.2s ease",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  info: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  details: {
    flex: 1,
    minWidth: 0
  },
  name: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '1px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  meta: {
    fontSize: '10px',
    color: STUDIO_PROFILE.textMuted,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  unfollowButton: {
    padding: "4px 8px",
    backgroundColor: "rgba(231, 76, 60, 0.5)",
    color: "white",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: "8px",
    fontSize: "10px",
    fontWeight: "600",
    cursor: "pointer",
    flexShrink: 0,
  },
};

const generalProfileStyles = {
  roleChip: {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 11px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
    color: "rgba(255,255,255,0.9)",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.16)",
    letterSpacing: "-0.01em",
  },
  closeBtn: {
    ...studioCoursesBtnGhost,
    width: 36,
    height: 36,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    borderRadius: 8,
    fontSize: 20,
    lineHeight: 1,
  },
  memberBadge: {
    display: "inline-block",
    marginTop: 10,
    padding: "3px 10px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 750,
    color: "rgba(255,255,255,0.72)",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
    marginBottom: 4,
  },
  statCell: {
    padding: "10px 8px",
    borderRadius: 12,
    textAlign: "center",
    backgroundColor: STUDIO_PROFILE.cell,
    border: `1px solid ${STUDIO_PROFILE.border}`,
  },
  statNum: {
    fontSize: 18,
    fontWeight: 850,
    color: "#fff",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.1,
  },
  statLbl: {
    marginTop: 3,
    fontSize: 10,
    fontWeight: 650,
    color: "rgba(255,255,255,0.48)",
  },
  bioBox: {
    fontSize: 13,
    color: "rgba(255,255,255,0.84)",
    lineHeight: 1.45,
    marginTop: 12,
    marginBottom: 4,
    padding: "11px 12px",
    borderRadius: 12,
    backgroundColor: STUDIO_PROFILE.cell,
    border: `1px solid ${STUDIO_PROFILE.border}`,
    textAlign: "left",
  },
  fullProfileLink: {
    ...studioCoursesBtnGhost,
    width: "100%",
    marginTop: 12,
    padding: "11px 14px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 750,
    color: STUDIO_PROFILE.accent,
    border: `1px solid ${STUDIO_PROFILE.accentBorder}`,
    backgroundColor: STUDIO_PROFILE.accentBg,
  },
  listTitle: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 13,
    fontWeight: 800,
    margin: "0 0 10px",
    letterSpacing: "-0.01em",
  },
  emptyList: {
    textAlign: "center",
    padding: "20px 12px",
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    borderRadius: 12,
    border: "1px dashed rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.02)",
  },
  placeRow: {
    padding: "10px 12px",
    borderRadius: 12,
    backgroundColor: STUDIO_PROFILE.cell,
    border: `1px solid ${STUDIO_PROFILE.border}`,
  },
  placeName: {
    fontSize: 13,
    fontWeight: 700,
    color: "#fff",
    marginBottom: 3,
  },
  placeAddr: {
    fontSize: 11,
    color: "rgba(255,255,255,0.52)",
    lineHeight: 1.35,
  },
};

/** 프로필 시트 — StudioHome topBarWrap 스타일 탭 */
const profileTabRail = {
  display: "flex",
  flexWrap: "nowrap",
  alignItems: "stretch",
  gap: 3,
  margin: "0 10px 8px",
  padding: "5px 4px",
  width: "auto",
  boxSizing: "border-box",
  backgroundColor: STUDIO_PROFILE.glassBar,
  borderRadius: "10px",
  border: `1px solid ${STUDIO_PROFILE.border}`,
  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.12)",
};

function profileTabBtn(active) {
  return {
    flex: "1 1 0",
    minWidth: 0,
    minHeight: 32,
    padding: "5px 2px",
    borderRadius: 7,
    border: active
      ? `1px solid ${STUDIO_PROFILE.accentBorder}`
      : "1px solid rgba(255,255,255,0.14)",
    background: active
      ? STUDIO_PROFILE.accentBg
      : "rgba(255,255,255,0.07)",
    color: active ? "#ffffff" : "rgba(255,255,255,0.88)",
    fontSize: "clamp(9px, 2.45vw, 11px)",
    fontWeight: 700,
    letterSpacing: "-0.03em",
    lineHeight: 1.15,
    cursor: "pointer",
    transition:
      "background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    textAlign: "center",
    boxShadow: active ? "inset 0 1px 0 rgba(255,255,255,0.12)" : "none",
  };
}

const profileTabSearchChip = {
  backgroundColor: "rgba(255, 255, 255, 0.08)",
  border: "1px solid rgba(255, 255, 255, 0.14)",
  color: "rgba(255,255,255,0.88)",
  borderRadius: 6,
  padding: "2px 5px",
  fontSize: 10,
  cursor: "pointer",
  lineHeight: 1,
  flexShrink: 0,
};

// SaveModal 스타일 동일하게 적용
const modalStyles = {
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  folderGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
    justifyContent: 'center'
  },
  folderButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '8px 4px',
    border: `1.5px solid ${STUDIO_PROFILE.border}`,
    borderRadius: '10px',
    backgroundColor: STUDIO_PROFILE.cell,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    minHeight: '36px',
    boxShadow: 'none',
    position: 'relative',
    zIndex: 10
  },
  addFolderButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '8px 4px',
    border: '1.5px dashed rgba(255, 255, 255, 0.22)',
    borderRadius: '10px',
    backgroundColor: STUDIO_PROFILE.card,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    minHeight: '36px',
    color: 'rgba(255, 255, 255, 0.6)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    position: 'relative',
    zIndex: 10
  },
  newFolderInline: {
    marginTop: "10px",
    padding: "10px",
    borderRadius: "10px",
    border: "2px solid rgba(52, 152, 219, 0.55)",
    backgroundColor: "rgba(0,0,0,0.25)",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  newFolderInput: {
    width: "100%",
    boxSizing: "border-box",
    padding: "8px 10px",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.2)",
    backgroundColor: "rgba(0,0,0,0.35)",
    color: "#fff",
    fontSize: "13px",
    outline: "none",
  },
  newFolderActions: {
    display: "flex",
    gap: "8px",
    justifyContent: "flex-end",
  },
  newFolderOk: {
    backgroundColor: "#3498DB",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "6px 14px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  newFolderCancel: {
    backgroundColor: "rgba(231, 76, 60, 0.85)",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "6px 14px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
  },
};

/** 스튜디오 초안(localStorage) 폴더명 → key (시스템 7개만) */
const UCARD_DRAFT_FOLDER_ROWS = [
  { key: "after_party", name: "2차", color: "#FF8C42", icon: "🍺" },
  { key: "date", name: "데이트", color: "#FF69B4", icon: "💘" },
  { key: "hangover", name: "해장", color: "#87CEEB", icon: "🥣" },
  { key: "solo", name: "혼술", color: "#9B59B6", icon: "👤" },
  { key: "group", name: "회식", color: "#F1C40F", icon: "👥" },
  { key: "must_go", name: "찐맛집", color: "#27AE60", icon: "🌟" },
  { key: "terrace", name: "야외/뷰", color: "#5DADE2", icon: "🌅" },
];

/** Supabase `places (*)` 조인은 `places`, 스튜디오 드래프트 형태는 `place` */
function getSavedPlaceDisplayFields(item) {
  if (!item || typeof item !== "object") {
    return { name: "", address: "" };
  }
  const row = item.places ?? item.place;
  const name =
    row?.name ??
    row?.place_name ??
    row?.title ??
    item.place_name ??
    item.name ??
    "";
  const address =
    row?.address ??
    row?.road_address ??
    row?.road_address_name ??
    row?.address_name ??
    item.address ??
    "";
  return {
    name: String(name || "").trim() || "이름 없음",
    address: String(address || "").trim(),
  };
}

/** `PlacePickButton` / `resolvePlaceUuidForPick` — 저장 행·드래프트 행 */
function savedItemToPickPlace(item) {
  if (!item || typeof item !== "object") return {};
  const pl = item.places;
  if (pl && typeof pl === "object") {
    return {
      ...pl,
      id: pl.id ?? item.place_id,
      kakao_place_id: pl.kakao_place_id ?? item.kakao_place_id,
    };
  }
  const inner = item.place;
  if (inner && typeof inner === "object") {
    return {
      ...inner,
      id: inner.id ?? item.place_id,
      kakao_place_id: inner.kakao_place_id ?? item.kakao_place_id,
    };
  }
  return {
    id: item.place_id,
    kakao_place_id: item.kakao_place_id,
    name: item.place?.name,
  };
}

/** curators 행: Studio·DB와 동일하게 avatar_url → avatar → image */
function curatorProfileImageUrl(curator) {
  if (!curator || typeof curator !== "object") return "";
  return String(
    curator.avatar_url || curator.avatar || curator.image || ""
  ).trim();
}

function CuratorFollowAvatar({ curator, sizePx, fontSizePx: fontSizePxProp }) {
  const url = curatorProfileImageUrl(curator);
  const [broken, setBroken] = useState(false);
  const letter =
    curator?.username?.charAt(0)?.toUpperCase() ||
    curator?.display_name?.charAt(0)?.toUpperCase() ||
    "👤";
  const showImg = Boolean(url) && !broken;
  const fontSizePx =
    fontSizePxProp ?? (sizePx <= 28 ? 10 : sizePx <= 44 ? 14 : 24);

  return (
    <div
      style={{
        width: `${sizePx}px`,
        height: `${sizePx}px`,
        borderRadius: "50%",
        backgroundColor: "#3498DB",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: `${fontSizePx}px`,
        color: "white",
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      {showImg ? (
        <img
          src={url}
          alt=""
          decoding="async"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
          onError={() => setBroken(true)}
        />
      ) : (
        letter
      )}
    </div>
  );
}

const SWIPE_CLOSE_PX = 88;
const SWIPE_MAX_DRAG_PX = 280;
/** 홈 지도에서 JUDO 로고 줄만 남기고 시트가 올라갈 수 있는 상단 여백 */
const PROFILE_MAP_TOP_RESERVE_PX = 64;
/** 시트 안 핸들+프로필+탭바+하단 safe(대략, 탭 본문 제외) */
const PROFILE_SHEET_CHROME_PX = 256;

const UserCard = ({
  user,
  onClose,
  isVisible,
  onFolderSelect,
  /** 지도 프로필 저장 후 Home 등에서 profiles 다시 읽기 */
  onPublicProfileSaved = null,
  /** 취향 설문 저장 후 Home 추천 시드 갱신 */
  onTastePreferencesSaved = null,
  /** 관리자: RPC `usercard_saved_rows` — RLS로 타인 저장을 못 읽을 때 주입 */
  embeddedSavedRows = null,
  /** 관리자: RPC `following_curators` — 팔로우 탭 주입 */
  embeddedFollowingCurators = null,
  embeddedAdminReadOnly = false,
  hideFollowingTab = false,
  adminRecommends = null,
  adminSavedUnassigned = null,
  adminEmbedBanner = null,
  adminTallSheet = false,
  layerZIndex = 1000,
  /**
   * 생략 시: 인증 완료 후 `sessionUser.id === user.id` 로 본인 판별.
   * 타인 프로필 시트는 `false` 명시 권장(세션 로딩 중 저장 탭 노출 방지).
   */
  isOwnProfile: explicitIsOwnProfile = null,
}) => {
  const navigate = useNavigate();
  const { user: sessionUser, loading: authLoading } = useAuth();

  const showSavedFoldersTab = useMemo(() => {
    if (embeddedSavedRows != null && Array.isArray(embeddedSavedRows)) {
      return true;
    }
    if (explicitIsOwnProfile === false) return false;
    if (explicitIsOwnProfile === true) return true;
    if (!user?.id) return false;
    if (authLoading) return false;
    return Boolean(sessionUser?.id && sessionUser.id === user.id);
  }, [
    embeddedSavedRows,
    explicitIsOwnProfile,
    user?.id,
    sessionUser?.id,
    authLoading,
  ]);
  const showTastePreferencesSection = useMemo(() => {
    if (embeddedAdminReadOnly) return false;
    if (explicitIsOwnProfile === false) return false;
    if (explicitIsOwnProfile === true) return true;
    if (!user?.id) return false;
    if (authLoading) return false;
    return Boolean(sessionUser?.id && sessionUser.id === user.id);
  }, [
    embeddedAdminReadOnly,
    explicitIsOwnProfile,
    user?.id,
    sessionUser?.id,
    authLoading,
  ]);
  const [profileSubView, setProfileSubView] = useState(null);
  const [activeTab, setActiveTab] = useState('saved');
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [pickedPlaces, setPickedPlaces] = useState([]);
  const [hanjanRows, setHanjanRows] = useState([]);
  const [followingCurators, setFollowingCurators] = useState([]);
  /** 나를 팔로우한 사람 (studio_follower_previews_* 행) */
  const [followerPreviews, setFollowerPreviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedCurator, setSelectedCurator] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(null); // 선택된 폴더 상태
  const [showFolderEditModal, setShowFolderEditModal] = useState(false); // 폴더 수정 모달 상태
  const [editingPlace, setEditingPlace] = useState(null); // 수정 중인 장소
  const [selectedFolders, setSelectedFolders] = useState([]); // 선택된 폴더들
  const [savedTabNewFolderOpen, setSavedTabNewFolderOpen] = useState(false);
  const [savedTabNewFolderName, setSavedTabNewFolderName] = useState("");
  const [savedTabNewFolderSaving, setSavedTabNewFolderSaving] = useState(false);

  const [publicProfileRow, setPublicProfileRow] = useState(null);
  const [profileFormOpen, setProfileFormOpen] = useState(false);
  const [pfDisplayName, setPfDisplayName] = useState("");
  const [pfUsername, setPfUsername] = useState("");
  const [pfSaving, setPfSaving] = useState(false);
  const [pfError, setPfError] = useState("");
  const [pfAvatarUploading, setPfAvatarUploading] = useState(false);
  /** 헤더 즉시 반영 (세션 메타 갱신 전) */
  const [headerDisplayOverride, setHeaderDisplayOverride] = useState(null);

  const profileAvatarInputRef = useRef(null);

  /** 핸들 제외: 프로필·탭바에서 아래로 스와이프 → 닫기 */
  const headerSwipeDownRef = useRef(null);
  const dragHandleRef = useRef(null);
  const tabScrollRef = useRef(null);
  const sheetDragYRef = useRef(0);
  const sheetExpandPxRef = useRef(0);
  const [sheetDragY, setSheetDragY] = useState(0);
  /** 핸들 위로 당겨 탭 영역 확장 (px). 맵에서는 로고 여백까지 */
  const [sheetExpandPx, setSheetExpandPx] = useState(0);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isVisible) {
      sheetDragYRef.current = 0;
      setSheetDragY(0);
      sheetExpandPxRef.current = 0;
      setSheetExpandPx(0);
      setProfileSubView(null);
    }
  }, [isVisible]);

  useEffect(() => {
    sheetExpandPxRef.current = sheetExpandPx;
  }, [sheetExpandPx]);

  const getTabBaseCss = useCallback(() => {
    return adminTallSheet ? "min(58vh, 520px)" : "min(34vh, 168px)";
  }, [adminTallSheet]);

  const getMaxSheetExpandPx = useCallback(() => {
    if (adminTallSheet) return 0;
    if (typeof window === "undefined") return 0;
    const vh = window.innerHeight;
    const baseTab = Math.min(vh * 0.34, 168);
    const maxTabBody =
      vh - PROFILE_MAP_TOP_RESERVE_PX - PROFILE_SHEET_CHROME_PX;
    return Math.max(0, Math.floor(maxTabBody - baseTab));
  }, [adminTallSheet]);

  const attachSwipeDownClose = useCallback((touchEl, scrollContainer) => {
    if (!touchEl) return () => {};
    let startY = null;
    let pulling = false;
    let scrollTopAtStart = 0;

    const touchStart = (e) => {
      if (e.touches.length !== 1) return;
      startY = e.touches[0].clientY;
      pulling = false;
      scrollTopAtStart = scrollContainer?.scrollTop ?? 0;
    };

    const touchMove = (e) => {
      if (startY == null || e.touches.length !== 1) return;
      if (
        scrollContainer != null &&
        (scrollTopAtStart > 0 || scrollContainer.scrollTop > 0)
      ) {
        return;
      }
      const y = e.touches[0].clientY;
      const dy = y - startY;
      if (dy > 12) {
        pulling = true;
        e.preventDefault();
        const next = Math.min(dy, SWIPE_MAX_DRAG_PX);
        sheetDragYRef.current = next;
        setSheetDragY(next);
      }
    };

    const touchEnd = () => {
      if (pulling && sheetDragYRef.current >= SWIPE_CLOSE_PX) {
        onCloseRef.current?.();
      }
      sheetDragYRef.current = 0;
      setSheetDragY(0);
      startY = null;
      pulling = false;
    };

    touchEl.addEventListener("touchstart", touchStart, { passive: true });
    touchEl.addEventListener("touchmove", touchMove, { passive: false });
    touchEl.addEventListener("touchend", touchEnd);
    touchEl.addEventListener("touchcancel", touchEnd);

    return () => {
      touchEl.removeEventListener("touchstart", touchStart);
      touchEl.removeEventListener("touchmove", touchMove);
      touchEl.removeEventListener("touchend", touchEnd);
      touchEl.removeEventListener("touchcancel", touchEnd);
    };
  }, []);

  /** 상단 핸들: 아래로 닫기 + 위로 탭 영역 확장 (맵 로고 여백까지) */
  const attachHandlePull = useCallback(() => {
    const handleEl = dragHandleRef.current;
    if (!handleEl || adminTallSheet) return () => {};
    let startTouchY = null;
    let mode = null;
    let expandAtStart = 0;

    const touchStart = (e) => {
      if (e.touches.length !== 1) return;
      startTouchY = e.touches[0].clientY;
      mode = null;
      expandAtStart = sheetExpandPxRef.current;
    };

    const touchMove = (e) => {
      if (startTouchY == null || e.touches.length !== 1) return;
      const y = e.touches[0].clientY;
      const dy = y - startTouchY;
      if (mode == null) {
        if (dy > 12) mode = "down";
        else if (dy < -12) mode = "up";
        else return;
      }
      if (mode === "down") {
        e.preventDefault();
        const next = Math.min(Math.max(0, dy), SWIPE_MAX_DRAG_PX);
        sheetDragYRef.current = next;
        setSheetDragY(next);
      } else if (mode === "up") {
        e.preventDefault();
        const lift = startTouchY - y;
        const cap = getMaxSheetExpandPx();
        setSheetExpandPx(() =>
          Math.min(cap, Math.max(0, expandAtStart + lift))
        );
      }
    };

    const touchEnd = () => {
      if (mode === "down" && sheetDragYRef.current >= SWIPE_CLOSE_PX) {
        onCloseRef.current?.();
      }
      sheetDragYRef.current = 0;
      setSheetDragY(0);
      startTouchY = null;
      mode = null;
    };

    handleEl.addEventListener("touchstart", touchStart, { passive: true });
    handleEl.addEventListener("touchmove", touchMove, { passive: false });
    handleEl.addEventListener("touchend", touchEnd);
    handleEl.addEventListener("touchcancel", touchEnd);

    return () => {
      handleEl.removeEventListener("touchstart", touchStart);
      handleEl.removeEventListener("touchmove", touchMove);
      handleEl.removeEventListener("touchend", touchEnd);
      handleEl.removeEventListener("touchcancel", touchEnd);
    };
  }, [adminTallSheet, getMaxSheetExpandPx]);

  useEffect(() => {
    if (!isVisible) return undefined;
    const scroll = tabScrollRef.current;
    const headerSwipe = headerSwipeDownRef.current;
    const unbindHandle = attachHandlePull();
    const unbindHeaderDown =
      headerSwipe != null ? attachSwipeDownClose(headerSwipe, null) : () => {};
    const unbindScroll = attachSwipeDownClose(scroll, scroll);
    return () => {
      unbindHandle();
      unbindHeaderDown();
      unbindScroll();
    };
  }, [isVisible, attachSwipeDownClose, attachHandlePull]);

  useEffect(() => {
    if (
      hideFollowingTab &&
      (activeTab === "following" || activeTab === "followers")
    ) {
      setActiveTab(showSavedFoldersTab ? "saved" : "picked");
    }
  }, [hideFollowingTab, activeTab, showSavedFoldersTab]);

  useEffect(() => {
    if (!showSavedFoldersTab && activeTab === "saved") {
      setActiveTab("picked");
    }
  }, [showSavedFoldersTab, activeTab]);

  useEffect(() => {
    if (!showSavedFoldersTab) {
      setSelectedFolder(null);
    }
  }, [showSavedFoldersTab]);

  useEffect(() => {
    console.log('🔄 UserCard useEffect 호출:', { isVisible, user });
    if (isVisible && user) {
      console.log('✅ loadUserData 시작');
      loadUserData();
    }
  }, [
    isVisible,
    user,
    embeddedSavedRows,
    embeddedFollowingCurators,
    showSavedFoldersTab,
  ]);

  useEffect(() => {
    if (!isVisible) {
      setHeaderDisplayOverride(null);
    }
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible || !user?.id || embeddedAdminReadOnly) {
      setPublicProfileRow(null);
      setProfileFormOpen(false);
      setPfError("");
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("username, display_name, auth_provider, username_changed_at, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (!error && data) {
        setPublicProfileRow(data);
        setPfDisplayName((data.display_name || "").trim());
        setPfUsername((data.username || "").trim());
      } else {
        setPublicProfileRow(null);
        setPfDisplayName(
          (user.user_metadata?.display_name || user.user_metadata?.full_name || "").trim()
        );
        setPfUsername((user.user_metadata?.username || "").trim());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isVisible, user?.id, embeddedAdminReadOnly]);

  // 실제 장소 수를 계산하는 함수
  const getTotalPlacesCount = () => {
    return Object.values(savedPlaces).reduce((total, folder) => total + folder.places.length, 0);
  };
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSelectedFolder(null);
    if (tab !== "following" && tab !== "followers") {
      setShowSearch(false);
    }
  };

  // 폴더 클릭 핸들러
  const handleFolderClick = (folderKey, folderData) => {
    // 뒤로 가기 버튼 클릭 시
    if (!folderData) {
      setSelectedFolder(null);
      return;
    }

    console.log('폴더 클릭:', folderData.folderInfo?.name);
    
    // 1. 모달 내부에 상세 리스트를 보여주기 위한 상태 업데이트
    setSelectedFolder({
      key: folderKey,
      info: folderData.folderInfo,
      places: folderData.places
    });

    // 2. 상위 컴포넌트에 알림 -> 지도에 마커 표시 요청
    if (onFolderSelect) {
      onFolderSelect(folderData);
    }
  };

  // 장소 삭제 핸들러
  const handleDeletePlace = async (placeItem) => {
    const delName = getSavedPlaceDisplayFields(placeItem).name;
    if (!window.confirm(`${delName}을(를) 삭제하시겠습니까?`)) {
      return;
    }

    try {
      // localStorage 데이터인지 Supabase 데이터인지 확인
      if (placeItem.isKakaoPlace || placeItem.isDbPlace || placeItem.id?.startsWith('kakao_') || placeItem.id?.startsWith('local_')) {
        // localStorage 데이터 삭제
        const draftOwnerId = sessionUser?.id ?? null;
        const existingDrafts = readStudioDrafts(draftOwnerId);
        let updatedDrafts;
        
        if (placeItem.id?.startsWith('kakao_')) {
          const kakaoPlaceId = placeItem.id.replace('kakao_', '');
          updatedDrafts = existingDrafts.filter(draft => draft.kakao_place_id !== kakaoPlaceId);
        } else if (placeItem.kakao_place_id) {
          // kakao_place_id가 있는 경우
          updatedDrafts = existingDrafts.filter(draft => draft.kakao_place_id !== placeItem.kakao_place_id);
        } else {
          // place_name으로 찾기
          updatedDrafts = existingDrafts.filter(
            (draft) => draft.place_name !== getSavedPlaceDisplayFields(placeItem).name
          );
        }
        
        writeStudioDrafts(draftOwnerId, updatedDrafts);
        console.log("✅ localStorage 장소 삭제 완료:", delName);
      } else if (placeItem.id && !placeItem.id.startsWith('kakao_') && !placeItem.id.startsWith('local_')) {
        // Supabase 데이터 삭제 (UUID 형식인 경우만)
        const { error } = await supabase
          .from('user_saved_places')
          .delete()
          .eq('id', placeItem.id);
          
        if (error) {
          console.error('Supabase 삭제 오류:', error);
          alert('삭제에 실패했습니다.');
          return;
        }
        
        console.log("✅ Supabase 장소 삭제 완료:", delName);
      } else {
        console.warn('알 수 없는 장소 데이터 형식:', placeItem);
        alert('삭제할 수 없는 장소입니다.');
        return;
      }

      // 선택된 폴더에서 해당 장소 제거
      setSelectedFolder(prev => ({
        ...prev,
        places: prev.places.filter(place => place.id !== placeItem.id)
      }));

      // savedPlaces 상태도 업데이트
      setSavedPlaces(prev => {
        const updated = { ...prev };
        if (updated[selectedFolder.key]) {
          updated[selectedFolder.key].places = updated[selectedFolder.key].places.filter(
            place => place.id !== placeItem.id
          );
        }
        return updated;
      });

      alert('삭제되었습니다.');

    } catch (error) {
      console.error('장소 삭제 오류:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  // 장소 수정 핸들러
  const handleEditPlace = (placeItem) => {
    setEditingPlace(placeItem);
    
    // 현재 장소가 속한 폴더들 찾기
    const currentFolders = [];
    Object.entries(savedPlaces).forEach(([folderKey, folderData]) => {
      if (folderData.places.some(place => place.id === placeItem.id)) {
        currentFolders.push({
          key: folderKey,
          name: folderData.folderInfo.name,
          icon: folderData.folderInfo.icon,
          color: folderData.folderInfo.color
        });
      }
    });
    
    setSelectedFolders(currentFolders);
    setShowFolderEditModal(true);
  };

  // 폴더 토글 핸들러
  const toggleFolderSelection = (folderKey, folderInfo) => {
    setSelectedFolders(prev => {
      const isSelected = prev.some(folder => folder.key === folderKey);
      if (isSelected) {
        return prev.filter(folder => folder.key !== folderKey);
      } else {
        return [...prev, { key: folderKey, ...folderInfo }];
      }
    });
  };

  // 폴더 수정 저장 핸들러
  const handleSaveFolderChanges = async () => {
    if (!editingPlace || selectedFolders.length === 0) {
      alert('최소 하나의 폴더를 선택해야 합니다.');
      return;
    }

    try {
      // localStorage 데이터인지 Supabase 데이터인지 확인
      if (editingPlace.isKakaoPlace || editingPlace.isDbPlace) {
        // localStorage 데이터 수정
        const draftOwnerId = sessionUser?.id ?? null;
        const existingDrafts = readStudioDrafts(draftOwnerId);
        const updatedDrafts = existingDrafts.map(draft => {
          if (draft.id === editingPlace.id || 
              (editingPlace.isKakaoPlace && draft.kakao_place_id === editingPlace.id.replace('kakao_', '')) ||
              (draft.place_id === editingPlace.id)) {
            const folderNames = selectedFolders.map(folder => folder.name);
            return { ...draft, folders: folderNames };
          }
          return draft;
        });
        
        writeStudioDrafts(draftOwnerId, updatedDrafts);
        console.log(
          "✅ localStorage 폴더 수정 완료:",
          getSavedPlaceDisplayFields(editingPlace).name
        );
      } else {
        // Supabase 데이터 수정 - 기존 폴더 관계 삭제 후 새로 추가
        const { error: deleteError } = await supabase
          .from('user_saved_place_folders')
          .delete()
          .eq('user_saved_place_id', editingPlace.id);
          
        if (deleteError) {
          console.error('폴더 관계 삭제 오류:', deleteError);
          alert('수정에 실패했습니다.');
          return;
        }

        // 새로운 폴더 관계 추가
        const folderRelations = selectedFolders.map(folder => ({
          user_saved_place_id: editingPlace.id,
          folder_key: folder.key
        }));

        const { error: insertError } = await supabase
          .from('user_saved_place_folders')
          .insert(folderRelations);
          
        if (insertError) {
          console.error('폴더 관계 추가 오류:', insertError);
          alert('수정에 실패했습니다.');
          return;
        }
        
        console.log(
          "✅ Supabase 폴더 수정 완료:",
          getSavedPlaceDisplayFields(editingPlace).name
        );
      }

      // 데이터 다시 로드
      await loadUserData();
      
      // 모달 닫기
      setShowFolderEditModal(false);
      setEditingPlace(null);
      setSelectedFolders([]);
      
      alert('폴더가 수정되었습니다.');

    } catch (error) {
      console.error('폴더 수정 오류:', error);
      alert('수정에 실패했습니다.');
    }
  };

  // 팔로우한 큐레이터 필터링 함수
  const getFilteredCurators = () => {
    if (!searchQuery.trim()) {
      return followingCurators;
    }

    return followingCurators.filter(curator => {
      const username = curator.username?.toLowerCase() || '';
      const displayName = curator.display_name?.toLowerCase() || '';
      const bio = curator.bio?.toLowerCase() || '';
      const searchLower = searchQuery.toLowerCase();
      
      return username.includes(searchLower) || 
             displayName.includes(searchLower) || 
             bio.includes(searchLower);
    });
  };

  const getFilteredFollowers = () => {
    if (!searchQuery.trim()) return followerPreviews;
    const q = searchQuery.toLowerCase();
    return followerPreviews.filter((f) => {
      const a = (f.primaryText || "").toLowerCase();
      const b = (f.secondaryText || "").toLowerCase();
      const c = (f.label || "").toLowerCase();
      return a.includes(q) || b.includes(q) || c.includes(q);
    });
  };

  // 큐레이터 프로필 불러오기
  const loadCuratorProfile = async (curator) => {
    try {
      if (curator && curator.isCurator === false) {
        return;
      }
      const rawHandle = String(
        curator?.slug || curator?.username || ""
      ).replace(/^@+/, "").trim();
      const rawUserId = String(
        curator?.user_id || curator?.following_user_id || curator?.id || ""
      ).trim();
      if (!rawHandle && !rawUserId) return;

      // 큐레이터 상세 정보 불러오기 (핸들 → user_id 순으로 폴백)
      let curatorData = null;
      if (rawHandle) {
        const { data, error } = await supabase
          .from("curators")
          .select("*")
          .or(`slug.eq.${rawHandle},username.eq.${rawHandle}`)
          .maybeSingle();
        if (error) {
          console.error("큐레이터 정보 로드 오류(핸들):", error);
        } else {
          curatorData = data || null;
        }
      }
      if (!curatorData && rawUserId) {
        const { data, error } = await supabase
          .from("curators")
          .select("*")
          .eq("user_id", rawUserId)
          .maybeSingle();
        if (error) {
          console.error("큐레이터 정보 로드 오류(user_id):", error);
        } else {
          curatorData = data || null;
        }
      }
      if (!curatorData) return;

      // user_saved_places.user_id 는 일반적으로 auth.uid() (= curators.user_id). curators.id(PK)와 다름.
      const curatorAuthId = curatorData.user_id ?? curatorData.id;
      const [{ data: savedPlaces, error: placesError }, { count: followerCount }, { count: placeCount }, { count: saveCount }] =
        await Promise.all([
          supabase
            .from("user_saved_places")
            .select(`
          *,
          places (*)
        `)
            .eq("user_id", curatorAuthId)
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("user_profile_follows")
            .select("*", { count: "exact", head: true })
            .eq("following_id", curatorAuthId),
          supabase
            .from("curator_places")
            .select("*", { count: "exact", head: true })
            .eq("curator_id", curatorAuthId),
          supabase
            .from("user_saved_places")
            .select("*", { count: "exact", head: true })
            .eq("user_id", curatorAuthId),
        ]);

      if (placesError) {
        console.error("큐레이터 저장 장소 로드 오류:", placesError);
      }

      setSelectedCurator({
        ...curatorData,
        username: String(
          curatorData.slug || curatorData.username || rawHandle || ""
        ).trim(),
        display_name: String(
          curatorData.name ||
            curatorData.display_name ||
            curatorData.username ||
            rawHandle ||
            "큐레이터"
        ).trim(),
        savedPlaces: savedPlaces || [],
        placeCount: Number(placeCount) || 0,
        stats: {
          ...curatorData.stats,
          followerCount: Number(followerCount) || 0,
          saveCount: Number(saveCount) || 0,
        },
      });

    } catch (error) {
      console.error('큐레이터 프로필 로드 오류:', error);
    }
  };

  const openFollowerPreview = (f) => {
    if (embeddedAdminReadOnly) return;
    const handle = String(f.secondaryText || "")
      .replace(/^@/, "")
      .trim();
    if (f.isCurator && handle) {
      loadCuratorProfile({ username: handle, isCurator: true });
    } else if (f.user_id) {
      navigate(`/u/${f.user_id}`);
    }
  };

  const loadUserData = async () => {
    let picksHanjanPromise = Promise.resolve([[], []]);
    try {
      console.log('🚀 loadUserData 함수 시작');
      setLoading(true);

      picksHanjanPromise =
        user?.id != null
          ? Promise.all([
              fetchUserPickedPlaces(user.id, { limit: 150 }).catch((err) => {
                console.warn("UserCard fetchUserPickedPlaces:", err);
                return [];
              }),
              fetchUserHanjanHistory(user.id, { limit: 80 }).catch((err) => {
                console.warn("UserCard fetchUserHanjanHistory:", err);
                return [];
              }),
            ])
          : Promise.resolve([[], []]);

      const useEmbedded =
        embeddedSavedRows != null && Array.isArray(embeddedSavedRows);

      if (showSavedFoldersTab) {
        let savedData = null;
        let savedError = null;

        if (useEmbedded) {
          savedData = embeddedSavedRows;
        } else {
          const res = await supabase
            .from("user_saved_places")
            .select(
              `
          *,
          places (*), 
          user_saved_place_folders (
            folder_key,
            system_folders (
              name,
              color,
              icon
            )
          )
        `
            )
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(50);
          savedData = res.data;
          savedError = res.error;
        }

        console.log("UserCard - savedData:", savedData);
        console.log("UserCard - savedError:", savedError);

        const localStorageDrafts = useEmbedded
          ? []
          : readStudioDrafts(sessionUser?.id ?? null);
        console.log("🗂️ UserCard - localStorage 데이터:", localStorageDrafts);

        let folderDefsForGrid = UCARD_DRAFT_FOLDER_ROWS.map((f, i) => ({
          key: f.key,
          name: f.name,
          color: f.color,
          icon: f.icon,
          sort_order: i + 1,
        }));

        if (!useEmbedded) {
          const { data: sfRows, error: sfErr } =
            await selectSystemFoldersOrdered(supabase, sessionUser?.id ?? null);
          if (!sfErr && sfRows?.length) {
            folderDefsForGrid = sfRows;
          }
        }

        const groupedByFolder = {};
        folderDefsForGrid.forEach((folder) => {
          groupedByFolder[folder.key] = {
            folderInfo: {
              key: folder.key,
              name: folder.name,
              color: folder.color,
              icon: folder.icon,
            },
            places: [],
          };
        });

        localStorageDrafts.forEach((draft) => {
          const folders = draft.folders || [];
          folders.forEach((folderName) => {
            const folderKey = UCARD_DRAFT_FOLDER_ROWS.find(
              (f) => f.name === folderName
            )?.key;
            if (folderKey && groupedByFolder[folderKey]) {
              const placeData = {
                id:
                  draft.id ||
                  `local_${draft.kakao_place_id || draft.place_name}_${Date.now()}`,
                place: {
                  name: draft.place_name,
                  address: draft.address,
                  category: draft.category,
                  lat: draft.lat,
                  lng: draft.lng,
                },
                created_at: draft.created_at,
                isKakaoPlace: draft.isKakaoPlace || false,
                isDbPlace: draft.isDbPlace || false,
                kakao_place_id: draft.kakao_place_id,
              };
              groupedByFolder[folderKey].places.push(placeData);
              console.log(
                `✅ localStorage 장소 추가: ${folderName} 폴더에 ${draft.place_name}`
              );
            }
          });
        });

        if (savedError) {
          console.error("저장된 장소 로드 오류:", savedError);
        } else if (savedData && savedData.length > 0) {
          savedData.forEach((saved) => {
            if (
              saved.user_saved_place_folders &&
              saved.user_saved_place_folders.length > 0
            ) {
              saved.user_saved_place_folders.forEach((folder) => {
                const folderKey = folder.folder_key;
                const sf = folder.system_folders;
                if (!groupedByFolder[folderKey]) {
                  groupedByFolder[folderKey] = {
                    folderInfo: {
                      key: folderKey,
                      name: sf?.name || folderKey,
                      color: sf?.color || "#3498DB",
                      icon: sf?.icon || "📁",
                    },
                    places: [],
                  };
                }
                groupedByFolder[folderKey].places.push(saved);
              });
            }
          });
        }

        console.log("UserCard - 그룹화된 데이터:", groupedByFolder);

        Object.entries(groupedByFolder).forEach(([folderKey, folderData]) => {
          console.log(
            `📁 ${folderData.folderInfo?.name}: ${folderData.places.length}개 장소`,
            folderData.places.map((p) => getSavedPlaceDisplayFields(p).name)
          );
        });

        const totalPlaces = Object.values(groupedByFolder).reduce(
          (sum, folder) => sum + folder.places.length,
          0
        );
        console.log(
          `📊 전체 장소 수: ${totalPlaces}개 (localStorage: ${localStorageDrafts.length}개, Supabase: ${savedData?.length || 0}개)`
        );

        setSavedPlaces(groupedByFolder);
      } else {
        setSavedPlaces({});
      }

      if (hideFollowingTab) {
        setFollowingCurators([]);
        setFollowerPreviews([]);
      } else if (useEmbedded) {
        setFollowingCurators(
          Array.isArray(embeddedFollowingCurators)
            ? embeddedFollowingCurators
            : []
        );
        setFollowerPreviews([]);
      } else {
        const [rows, followersRaw] = await Promise.all([
          fetchStudioFollowingEnriched(supabase, user.id),
          fetchStudioFollowersEnriched(supabase, user.id, {
            byFollowingUserId: user.id,
          }),
        ]);
        setFollowerPreviews(
          Array.isArray(followersRaw) ? followersRaw : []
        );
        const mapped = (rows || []).map((r) => {
          const uid = r.following_user_id || r.user_id;
          const handleFromSecondary = r.secondaryText
            ? String(r.secondaryText).replace(/^@/, "")
            : "";
          const handle =
            handleFromSecondary ||
            (typeof r.label === "string" && r.label.startsWith("@")
              ? r.label.slice(1)
              : "user");
          return {
            id: uid,
            user_id: uid,
            following_user_id: uid,
            username: handle,
            display_name: r.primaryText,
            displayName: r.primaryText,
            bio: r.isCurator ? null : "사용자",
            avatar_url: r.avatarUrl,
            isCurator: Boolean(r.isCurator),
            stats: { saveCount: 0, followerCount: 0 },
          };
        });
        setFollowingCurators(mapped);
      }

    } catch (error) {
      console.error('사용자 데이터 로드 오류:', error);
    } finally {
      try {
        const [pickedRows, hanjan] = await picksHanjanPromise;
        setPickedPlaces(Array.isArray(pickedRows) ? pickedRows : []);
        setHanjanRows(Array.isArray(hanjan) ? hanjan : []);
      } catch (e) {
        console.warn("UserCard picks/hanjan:", e);
        setPickedPlaces([]);
        setHanjanRows([]);
      }
      setLoading(false);
    }
  };

  const handleCreateSavedTabFolder = async () => {
    if (embeddedAdminReadOnly) return;
    const name = savedTabNewFolderName.trim();
    if (!name) return;
    setSavedTabNewFolderSaving(true);
    try {
      const authUser = sessionUser;
      if (!authUser?.id) {
        alert("로그인이 필요합니다.");
        return;
      }
      const key = `custom_${Date.now()}`;
      const { data: maxRow } = await supabase
        .from("system_folders")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const maxSo =
        maxRow?.sort_order != null ? Number(maxRow.sort_order) : 0;
      const { error } = await insertSystemFolderRow(supabase, {
        key,
        name,
        color: "#3498DB",
        icon: "📁",
        description: "",
        sort_order: maxSo + 1,
        is_active: true,
        created_by: authUser.id,
      });
      if (error) {
        alert(
          error.message ||
            "폴더를 만들지 못했습니다. Supabase INSERT 정책을 확인하세요."
        );
        return;
      }
      setSavedTabNewFolderName("");
      setSavedTabNewFolderOpen(false);
      await loadUserData();
    } finally {
      setSavedTabNewFolderSaving(false);
    }
  };

  const handleRemoveSaved = async (placeId) => {
    try {
      const { error } = await supabase
        .from('user_saved_places')
        .delete()
        .eq('user_id', user.id)
        .eq('place_id', placeId);

      if (error) {
        console.error('저장 삭제 오류:', error);
        alert('저장 삭제에 실패했습니다.');
      } else {
        setSavedPlaces(prev => prev.filter(p => p.place_id !== placeId));
      }
    } catch (error) {
      console.error('저장 삭제 처리 오류:', error);
    }
  };

  const onProfileAvatarFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user?.id || embeddedAdminReadOnly) return;
    if (!isAcceptableRasterImageFile(file)) {
      window.alert("이미지 파일만 올릴 수 있어요.");
      return;
    }
    setPfAvatarUploading(true);
    try {
      const url = await uploadUserProfileAvatarFile(file, user.id);
      const { data: upd, error: upErr } = await supabase
        .from("profiles")
        .update({
          avatar_url: url,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)
        .select("avatar_url");
      if (upErr) throw upErr;
      if (!upd?.length) {
        const { error: insErr } = await supabase.from("profiles").insert({
          id: user.id,
          role: "user",
          avatar_url: url,
          updated_at: new Date().toISOString(),
        });
        if (insErr) throw insErr;
      }
      setPublicProfileRow((prev) => ({ ...(prev || {}), avatar_url: url }));
      await supabase.auth
        .updateUser({
          data: {
            avatar_url: url,
            picture: url,
            image: url,
          },
        })
        .catch(() => {});
      onPublicProfileSaved?.();
    } catch (err) {
      window.alert(err?.message || "프로필 사진을 저장하지 못했습니다.");
    } finally {
      setPfAvatarUploading(false);
    }
  };

  const handleUnfollow = async (followingUserId) => {
    try {
      await unfollowUser(supabase, followingUserId);
      setFollowingCurators((prev) =>
        prev.filter(
          (c) =>
            (c.following_user_id || c.user_id || c.id) !== followingUserId
        )
      );
    } catch (error) {
      console.error("remove 처리 오류:", error);
      alert(error?.message || "remove에 실패했습니다.");
    }
  };

  const savePublicProfile = async () => {
    if (!user?.id || embeddedAdminReadOnly) return;
    const nick = pfDisplayName.trim();
    const raw = pfUsername.trim().toLowerCase();
    setPfError("");
    if (raw && !PUBLIC_HANDLE_RE.test(raw)) {
      setPfError("핸들은 영문 소문자·숫자·_ 만 사용하고, 최소 3자~20자로 입력해 주세요.");
      return;
    }
    if (!nick && !raw) {
      setPfError("닉네임 또는 핸들 중 하나는 입력해 주세요.");
      return;
    }
    setPfSaving(true);
    try {
      if (raw) {
        const { data: taken } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", raw)
          .neq("id", user.id)
          .maybeSingle();
        if (taken?.id) {
          setPfError("이미 사용 중인 핸들이에요.");
          setPfSaving(false);
          return;
        }
      }
      const payload = {
        display_name: nick || null,
        username: raw || null,
        updated_at: new Date().toISOString(),
      };
      const { data: upd, error: upErr } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", user.id)
        .select("id, username_changed_at");
      if (upErr) throw upErr;
      if (!upd?.length) {
        const { data: insRow, error: insErr } = await supabase
          .from("profiles")
          .insert({
            id: user.id,
            role: "user",
            ...payload,
          })
          .select("id, username_changed_at")
          .maybeSingle();
        if (insErr) throw insErr;
        if (insRow) {
          setPublicProfileRow((prev) => ({
            ...(prev || {}),
            ...payload,
            username_changed_at: insRow.username_changed_at,
          }));
        }
      } else {
        setPublicProfileRow((prev) => ({
          ...(prev || {}),
          ...payload,
          username_changed_at: upd[0]?.username_changed_at,
        }));
      }
      await supabase.auth
        .updateUser({
          data: {
            display_name: nick || undefined,
            username: raw || undefined,
            full_name: nick || undefined,
          },
        })
        .catch(() => {});
      setHeaderDisplayOverride({
        display_name: nick,
        username: raw,
      });
      onPublicProfileSaved?.();
      setProfileFormOpen(false);
    } catch (e) {
      if (isUsernameChangeCooldownError(e)) {
        window.alert(
          e?.message ||
            "핸들(@고유이름)은 14일에 한 번만 바꿀 수 있습니다."
        );
      } else {
        setPfError(e?.message || "저장에 실패했습니다.");
      }
    } finally {
      setPfSaving(false);
    }
  };

  if (!isVisible) return null;

  const cardNick =
    (
      headerDisplayOverride?.display_name ||
      publicProfileRow?.display_name ||
      user?.user_metadata?.display_name ||
      user?.user_metadata?.full_name ||
      ""
    ).trim() || null;
  const cardHandle =
    (
      headerDisplayOverride?.username ||
      publicProfileRow?.username ||
      user?.user_metadata?.username ||
      ""
    ).trim() || null;
  const cardAvatarUrl =
    String(publicProfileRow?.avatar_url || "").trim() ||
    String(
      user?.user_metadata?.avatar_url ||
        user?.user_metadata?.picture ||
        user?.user_metadata?.image ||
        ""
    ).trim() ||
    null;
  const loginProviderLabel = formatAuthProviderForUi(
    publicProfileRow?.auth_provider || getAuthProviderLabel(user)
  );

  return (
    <>
      <div
        role={embeddedAdminReadOnly ? "presentation" : undefined}
        onClick={
          embeddedAdminReadOnly
            ? (e) => {
                if (e.target === e.currentTarget) onClose?.();
              }
            : undefined
        }
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          zIndex: layerZIndex,
          padding: 0,
          ...userCardGlass.overlay,
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            borderRadius: "16px 16px 0 0",
            width: "100%",
            maxWidth: "500px",
            maxHeight: `calc(100dvh - ${PROFILE_MAP_TOP_RESERVE_PX}px)`,
            height: "auto",
            overflow: "hidden",
            position: "relative",
            display: "flex",
            flexDirection: "column",
            animation: "slideUp 0.3s ease-out",
            transform:
              sheetDragY > 0 ? `translateY(${sheetDragY}px)` : undefined,
            transition:
              sheetDragY > 0
                ? "none"
                : "transform 0.22s cubic-bezier(0.32, 0.72, 0, 1)",
            touchAction: "pan-y",
            ...userCardGlass.sheet,
          }}
        >
          <div>
            {/* 드래그 핸들 — 위로 당겨 탭 영역 확장 (맵: 로고 줄까지) */}
            <div
              ref={dragHandleRef}
              style={{
                padding: "10px 0 6px",
                margin: "0 auto",
                cursor: "grab",
                touchAction: "none",
                display: "flex",
                justifyContent: "center",
              }}
              aria-label="시트 닫기(아래로) 또는 펼치기(위로)"
            >
              <div
                style={{
                  width: "42px",
                  height: "5px",
                  backgroundColor: "rgba(255, 255, 255, 0.35)",
                  borderRadius: "100px",
                  boxShadow:
                    "0 0 0 1px rgba(255,255,255,0.15), 0 1px 8px rgba(0,0,0,0.2)",
                }}
              />
            </div>

            <div ref={headerSwipeDownRef}>
            {adminEmbedBanner ? (
              <div
                style={{
                  textAlign: "center",
                  fontSize: "11px",
                  color: "rgba(255,255,255,0.7)",
                  padding: "0 14px 6px",
                  lineHeight: 1.35,
                }}
              >
                {adminEmbedBanner}
              </div>
            ) : null}

            {/* 프로필 정보 */}
            <div
            style={{
              ...userCardGlass.insetCard,
              paddingRight: "48px",
              marginBottom: "8px",
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                flexShrink: 0,
                overflow: 'hidden',
                backgroundColor: STUDIO_PROFILE.cell,
                border: `1px solid ${STUDIO_PROFILE.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                fontWeight: 800,
                color: '#fff',
              }}>
                {cardAvatarUrl ? (
                  <img
                    src={cardAvatarUrl}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <span>{(cardNick || cardHandle || "?").charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff', marginBottom: '2px', letterSpacing: '-0.03em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {cardNick || cardHandle || "사용자"}
                </div>
                <div style={{ fontSize: '12px', color: STUDIO_PROFILE.textSoft, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {cardHandle ? `@${cardHandle}` : "핸들 미설정 · 아래에서 추가"}
                </div>
                {user.user_metadata?.bio && (
                  <div style={{ fontSize: '11px', color: STUDIO_PROFILE.textMuted, lineHeight: '1.3', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.user_metadata.bio}
                  </div>
                )}
              </div>
            </div>
          </div>

          {!embeddedAdminReadOnly ? (
            <div
              style={{
                ...userCardGlass.insetCard,
                marginBottom: "8px",
              }}
            >
              <div
                style={{
                  fontSize: "10px",
                  color: STUDIO_PROFILE.textMuted,
                  marginBottom: "6px",
                  lineHeight: 1.35,
                }}
              >
                로그인: {loginProviderLabel} · 앱에서 보이는 이름은 카카오/구글 계정과
                별도예요.
              </div>
              {!cardNick || !cardHandle ? (
                <div
                  style={{
                    fontSize: "11px",
                    color: "rgba(255, 193, 7, 0.9)",
                    marginBottom: "8px",
                  }}
                >
                  큐레이터에게 팔로우 알림으로 이름이 갈 때 쓰여요. 부담 없이 한 번만
                  설정해 주세요.
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setProfileFormOpen((o) => !o);
                  setPfError("");
                }}
                style={{
                  ...studioCoursesBtnGhost,
                  width: "100%",
                }}
              >
                {profileFormOpen ? "접기" : "닉네임 · @핸들 설정"}
              </button>
              {profileFormOpen ? (
                <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div>
                    <div style={{ fontSize: "11px", color: "#bbb", marginBottom: "6px" }}>
                      프로필 사진
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          width: "56px",
                          height: "56px",
                          borderRadius: "50%",
                          overflow: "hidden",
                          flexShrink: 0,
                          background:
                            "linear-gradient(145deg, rgba(36,36,42,0.95), rgba(20,20,24,0.85))",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "1px solid rgba(255,255,255,0.2)",
                        }}
                      >
                        {cardAvatarUrl ? (
                          <img
                            src={cardAvatarUrl}
                            alt=""
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          <span style={{ fontSize: "22px" }}>👤</span>
                        )}
                      </div>
                      <div style={{ flex: "1 1 140px", minWidth: 0 }}>
                        <input
                          ref={profileAvatarInputRef}
                          type="file"
                          accept="image/*"
                          style={{ display: "none" }}
                          onChange={onProfileAvatarFile}
                        />
                        <button
                          type="button"
                          disabled={pfAvatarUploading}
                          onClick={() => profileAvatarInputRef.current?.click()}
                          style={{
                            ...studioCoursesBtnGhost,
                            cursor: pfAvatarUploading ? "wait" : "pointer",
                            opacity: pfAvatarUploading ? 0.7 : 1,
                          }}
                        >
                          {pfAvatarUploading ? "올리는 중…" : "사진 올리기 · 바꾸기"}
                        </button>
                        <div
                          style={{
                            fontSize: "10px",
                            color: "rgba(255,255,255,0.42)",
                            marginTop: "6px",
                            lineHeight: 1.35,
                          }}
                        >
                          5MB 이하 · JPG·PNG·WebP 등
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: "#bbb", marginBottom: "4px" }}>
                      닉네임 (다른 사람에게 보이는 이름)
                    </div>
                    <input
                      type="text"
                      value={pfDisplayName}
                      onChange={(e) => setPfDisplayName(e.target.value)}
                      placeholder="예: 을지로호프"
                      maxLength={40}
                      style={studioCoursesInput}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: STUDIO_PROFILE.textSoft, marginBottom: "4px" }}>
                      핸들 (앱 전용 ID, @ 없이 영문·숫자·_ 최소 3자~20자)
                    </div>
                    <input
                      type="text"
                      lang="en"
                      inputMode="text"
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                      value={pfUsername}
                      onChange={(e) => {
                        if (e.nativeEvent?.isComposing) {
                          setPfUsername(e.target.value);
                          return;
                        }
                        setPfUsername(normalizePublicHandleInput(e.target.value));
                      }}
                      onCompositionEnd={(e) => {
                        setPfUsername(normalizePublicHandleInput(e.currentTarget.value));
                      }}
                      placeholder="예: judo_sips"
                      maxLength={20}
                      style={studioCoursesInput}
                    />
                    <div
                      style={{
                        fontSize: "10px",
                        color: "rgba(255,255,255,0.45)",
                        marginTop: "4px",
                        lineHeight: 1.35,
                      }}
                    >
                      한글 키보드면 <span style={{ color: "rgba(255,200,120,0.95)" }}>한/영</span> 전환 후 입력.
                    </div>
                  </div>
                  {pfError ? (
                    <div style={{ fontSize: "11px", color: "#ff8a8a" }}>{pfError}</div>
                  ) : null}
                  <button
                    type="button"
                    onClick={savePublicProfile}
                    disabled={pfSaving}
                    style={{
                      ...studioCoursesBtnPrimary,
                      width: "100%",
                      cursor: pfSaving ? "wait" : "pointer",
                      opacity: pfSaving ? 0.7 : 1,
                    }}
                  >
                    {pfSaving ? "저장 중…" : "저장"}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {showTastePreferencesSection && profileSubView !== "taste" ? (
            <UserTastePreferencesSection
              userId={user?.id}
              authLoading={authLoading}
              variant="card"
              summaryOnly
              onNavigateToDetail={() => setProfileSubView("taste")}
              onSaved={(message, kind) => {
                if (kind === "success") onTastePreferencesSaved?.();
              }}
            />
          ) : null}

          {profileSubView === "taste" && showTastePreferencesSection ? (
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                overflowY: "auto",
                WebkitOverflowScrolling: "touch",
                maxHeight: `calc(100dvh - ${PROFILE_MAP_TOP_RESERVE_PX}px - ${PROFILE_SHEET_CHROME_PX}px)`,
              }}
            >
              <UserTastePreferencesSection
                userId={user?.id}
                authLoading={authLoading}
                variant="card"
                fullPage
                onBack={() => setProfileSubView(null)}
                onSaved={(message, kind) => {
                  if (kind === "success") onTastePreferencesSaved?.();
                }}
              />
            </div>
          ) : null}

          {/* 닫기 버튼 — 스와이프 영역 밖 (탭·검색 클릭과 분리) */}
          <button
            type="button"
            onClick={onClose}
            style={{
              position: "absolute",
              top: "10px",
              right: "10px",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              ...studioCoursesBtnGhost,
              borderRadius: "8px",
              padding: 0,
              fontSize: "18px",
              lineHeight: 1,
              zIndex: 10,
            }}
          >
            ×
          </button>

          {profileSubView !== "taste" ? (
          <>
          {Array.isArray(adminRecommends) && adminRecommends.length > 0 ? (
            <div
              style={{
                padding: "8px 12px 6px",
                borderBottom: `1px solid ${userCardGlass.hairline.borderColor}`,
                backgroundColor: "rgba(0, 0, 0, 0.22)",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.85)",
                  marginBottom: "6px",
                }}
              >
                추천 등록 (스튜디오·큐레이터 연결)
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  maxHeight: "min(28vh, 200px)",
                  overflowY: "auto",
                }}
              >
                {adminRecommends.map((row, idx) => (
                  <div
                    key={`adm-rec-${row.at}-${idx}`}
                    style={{
                      padding: "6px 8px",
                      borderRadius: "8px",
                      backgroundColor: "rgba(46, 204, 113, 0.12)",
                      border: "1px solid rgba(46, 204, 113, 0.25)",
                    }}
                  >
                    <div
                      style={{
                        color: "#fff",
                        fontSize: "12px",
                        fontWeight: 700,
                      }}
                    >
                      {row.place_name || "(이름 없음)"}
                    </div>
                    {row.address ? (
                      <div
                        style={{
                          color: "#aaa",
                          fontSize: "10px",
                          marginTop: "2px",
                        }}
                      >
                        {row.address}
                      </div>
                    ) : null}
                    <div style={{ color: "#777", fontSize: "10px", marginTop: "2px" }}>
                      {row.at
                        ? new Date(row.at).toLocaleString("ko-KR")
                        : "-"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* 탭: 픽한 가게 → 한잔함 → 저장 폴더 → picked / pick */}
          <div style={profileTabRail}>
            <button
              type="button"
              title="픽한 가게"
              onClick={() => handleTabChange("picked")}
              style={profileTabBtn(activeTab === "picked")}
            >
              픽 {pickedPlaces.length}
            </button>
            <button
              type="button"
              title="한잔함"
              onClick={() => handleTabChange("hanjan")}
              style={profileTabBtn(activeTab === "hanjan")}
            >
              한잔 {hanjanRows.length}
            </button>
            {showSavedFoldersTab ? (
              <button
                type="button"
                title="저장 폴더"
                onClick={() => handleTabChange("saved")}
                style={profileTabBtn(activeTab === "saved")}
              >
                저장 {getTotalPlacesCount()}
              </button>
            ) : null}
            {hideFollowingTab ? null : (
              <>
                <button
                  type="button"
                  title="받은 픽"
                  onClick={() => handleTabChange("followers")}
                  style={{
                    ...profileTabBtn(activeTab === "followers"),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 3,
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                    받픽 {followerPreviews.length}
                  </span>
                  {activeTab === "followers" && !embeddedAdminReadOnly ? (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="검색"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSearch(!showSearch);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowSearch(!showSearch);
                        }
                      }}
                      style={{
                        ...profileTabSearchChip,
                        backgroundColor: showSearch
                          ? "rgba(255, 255, 255, 0.14)"
                          : profileTabSearchChip.backgroundColor,
                      }}
                    >
                      🔍
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  title="내 픽"
                  onClick={() => handleTabChange("following")}
                  style={{
                    ...profileTabBtn(activeTab === "following"),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 3,
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                    내픽 {followingCurators.length}
                  </span>
                  {activeTab === "following" && !embeddedAdminReadOnly ? (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="검색"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSearch(!showSearch);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowSearch(!showSearch);
                        }
                      }}
                      style={{
                        ...profileTabSearchChip,
                        backgroundColor: showSearch
                          ? "rgba(255, 255, 255, 0.14)"
                          : profileTabSearchChip.backgroundColor,
                      }}
                    >
                      🔍
                    </span>
                  ) : null}
                </button>
              </>
            )}
          </div>

          {/* 탭 내용 */}
          <div
            ref={tabScrollRef}
            style={{
              padding: "10px 12px 14px",
              boxSizing: "border-box",
              ...(adminTallSheet
                ? {
                    height: "min(58vh, 520px)",
                    minHeight: "min(58vh, 520px)",
                    maxHeight: "min(58vh, 520px)",
                  }
                : {
                    height: `calc(${getTabBaseCss()} + ${sheetExpandPx}px)`,
                    minHeight: `calc(${getTabBaseCss()} + ${sheetExpandPx}px)`,
                    maxHeight: `calc(100dvh - ${PROFILE_MAP_TOP_RESERVE_PX}px - ${PROFILE_SHEET_CHROME_PX}px)`,
                  }),
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              flexShrink: 0,
              backgroundColor: STUDIO_PROFILE.shell,
            }}
          >
            {loading ? (
              <div style={{ textAlign: 'center', padding: '14px', color: STUDIO_PROFILE.textMuted, fontSize: '13px' }}>
                로딩 중...
              </div>
            ) : activeTab === "picked" ? (
              pickedPlaces.length === 0 ? (
                <div style={{ textAlign: "center", padding: "14px", color: "#999", fontSize: "13px" }}>
                  아직 픽한 가게가 없어요.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {pickedPlaces.map((row) => {
                    const { name: placeName, address: placeAddress } =
                      getSavedPlaceDisplayFields({ places: row.places });
                    return (
                      <div
                        key={row.id}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "10px",
                          ...userCardGlass.panel,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: "8px",
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                color: "white",
                                fontSize: "13px",
                                fontWeight: "bold",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {placeName}
                            </div>
                            {placeAddress ? (
                              <div
                                style={{
                                  color: "#999",
                                  fontSize: "11px",
                                  marginTop: "2px",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {placeAddress}
                              </div>
                            ) : null}
                            {row.is_curator ? (
                              <div
                                style={{
                                  marginTop: "4px",
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  color: "#f9a8d4",
                                }}
                              >
                                큐레이터 픽
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : activeTab === "hanjan" ? (
              hanjanRows.length === 0 ? (
                <div style={{ textAlign: "center", padding: "14px", color: "#999", fontSize: "13px" }}>
                  한잔 기록이 없어요.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {hanjanRows.map((row) => (
                    <div
                      key={row.id}
                      style={{
                        padding: "8px 10px",
                        borderRadius: "10px",
                        ...userCardGlass.panel,
                      }}
                    >
                      <div
                        style={{
                          color: "white",
                          fontSize: "13px",
                          fontWeight: "bold",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row.place_name || "이름 없음"}
                      </div>
                      {row.place_address ? (
                        <div
                          style={{
                            color: "#999",
                            fontSize: "11px",
                            marginTop: "2px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {row.place_address}
                        </div>
                      ) : null}
                      <div
                        style={{
                          color: "#777",
                          fontSize: "10px",
                          marginTop: "4px",
                        }}
                      >
                        {row.created_at
                          ? new Date(row.created_at).toLocaleString("ko-KR")
                          : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : activeTab === 'saved' ? (
              !showSavedFoldersTab ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "14px",
                    color: "#999",
                    fontSize: "13px",
                  }}
                >
                  저장 폴더는 프로필 주인만 볼 수 있어요.
                </div>
              ) : Object.keys(savedPlaces).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '14px', color: '#999', fontSize: '13px' }}>
                  아직 저장한 장소가 없습니다.
                </div>
              ) : (
                selectedFolder ? (
                  // 선택된 폴더의 상세 리스트 UI
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ 
                      display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px',
                      paddingBottom: '6px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                      <button 
                        onClick={() => handleFolderClick(null, null)}
                        style={{ 
                          background: 'none', border: 'none', color: '#3498DB', 
                          cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' 
                        }}
                      > 
                        ← 뒤로 
                      </button>
                      <span style={{ fontSize: '14px' }}>{selectedFolder.info?.icon}</span>
                      <span style={{ color: 'white', fontWeight: 'bold' }}>{selectedFolder.info?.name}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {selectedFolder.places.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '10px', color: '#666', fontSize: '12px' }}>
                          이 폴더에 저장된 장소가 없습니다.
                        </div>
                      ) : (
                        selectedFolder.places.map((item, index) => {
                          const { name: placeName, address: placeAddress } =
                            getSavedPlaceDisplayFields(item);
                          return (
                          <div key={item.id || `place-${index}`} style={{
                              padding: '8px 10px',
                              borderRadius: '10px',
                              ...userCardGlass.panel,
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                  color: 'white',
                                  fontSize: '13px',
                                  fontWeight: 'bold',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}>
                                  {placeName}
                                </div>
                                {placeAddress ? (
                                <div style={{
                                  color: '#999',
                                  fontSize: '11px',
                                  marginTop: '2px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}>
                                  {placeAddress}
                                </div>
                                ) : null}
                              </div>
                              {!embeddedAdminReadOnly ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                <PlacePickButton
                                  place={savedItemToPickPlace(item)}
                                  variant="folderChip"
                                />
                              <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                <button
                                  onClick={() => {
                                    // 폴더 수정 기능 (폴더 옮기기, 중첩 저장)
                                    console.log('수정 버튼 클릭:', item);
                                    handleEditPlace(item);
                                  }}
                                  style={{
                                    backgroundColor: 'rgba(52, 152, 219, 0.55)',
                                    color: 'white',
                                    border: '1px solid rgba(255,255,255,0.22)',
                                    borderRadius: '8px',
                                    padding: '4px 8px',
                                    fontSize: '10px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
                                  }}
                                >
                                  수정
                                </button>
                                <button
                                  onClick={() => {
                                    // TODO: 장소 삭제 기능
                                    console.log('삭제 버튼 클릭:', item);
                                    handleDeletePlace(item);
                                  }}
                                  style={{
                                    backgroundColor: 'rgba(231, 76, 60, 0.55)',
                                    color: 'white',
                                    border: '1px solid rgba(255,255,255,0.18)',
                                    borderRadius: '8px',
                                    padding: '4px 8px',
                                    fontSize: '10px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                                  }}
                                >
                                  삭제
                                </button>
                              </div>
                              </div>
                              ) : null}
                            </div>
                          </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={modalStyles.section}>
                    {/* 폴더 그리드 - 2층으로 배치 */}
                    <div style={modalStyles.folderGrid}>
                      {Object.entries(savedPlaces).map(([folderKey, folderData]) => (
                        <button
                          key={folderKey}
                          onClick={() => handleFolderClick(folderKey, folderData)}
                          style={{
                            ...modalStyles.folderButton,
                            borderColor: folderData.folderInfo?.color || '#666',
                            backgroundColor: folderData.places.length > 0 ? 
                              `${folderData.folderInfo?.color}20` : 'transparent'
                          }}
                        >
                          <span style={{ fontSize: '12px', marginBottom: '1px' }}>
                            {folderData.folderInfo?.icon}
                          </span>
                          <span style={{ 
                            fontSize: '10px', 
                            fontWeight: 'bold',
                            color: folderData.places.length > 0 ? 
                              folderData.folderInfo?.color : '#999',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px'
                          }}>
                            {folderData.folderInfo?.name}
                            <span style={{ 
                              fontSize: '8px', 
                              color: '#666',
                              fontWeight: 'normal'
                            }}>
                              ({folderData.places.length})
                            </span>
                          </span>
                        </button>
                      ))}
                      
                      <button
                        type="button"
                        onClick={() => {
                          if (embeddedAdminReadOnly) return;
                          setSavedTabNewFolderOpen((o) => !o);
                        }}
                        style={modalStyles.addFolderButton}
                      >
                        <span style={{ fontSize: "14px" }}>+</span>
                        <span style={{ fontSize: "10px", fontWeight: "bold" }}>
                          새 폴더
                        </span>
                      </button>
                    </div>
                    {savedTabNewFolderOpen && !embeddedAdminReadOnly ? (
                      <div style={modalStyles.newFolderInline}>
                        <input
                          type="text"
                          value={savedTabNewFolderName}
                          onChange={(e) =>
                            setSavedTabNewFolderName(e.target.value)
                          }
                          placeholder="새 폴더 이름"
                          style={modalStyles.newFolderInput}
                          autoFocus
                          onKeyDown={(e) =>
                            e.key === "Enter" &&
                            !savedTabNewFolderSaving &&
                            handleCreateSavedTabFolder()
                          }
                        />
                        <div style={modalStyles.newFolderActions}>
                          <button
                            type="button"
                            disabled={savedTabNewFolderSaving}
                            onClick={handleCreateSavedTabFolder}
                            style={modalStyles.newFolderOk}
                          >
                            {savedTabNewFolderSaving ? "…" : "만들기"}
                          </button>
                          <button
                            type="button"
                            disabled={savedTabNewFolderSaving}
                            onClick={() => {
                              setSavedTabNewFolderOpen(false);
                              setSavedTabNewFolderName("");
                            }}
                            style={modalStyles.newFolderCancel}
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {embeddedAdminReadOnly &&
                    Array.isArray(adminSavedUnassigned) &&
                    adminSavedUnassigned.length > 0 ? (
                      <div style={{ marginTop: "12px" }}>
                        <div
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            color: "rgba(255, 193, 7, 0.95)",
                            marginBottom: "6px",
                          }}
                        >
                          폴더 미연결 저장 (앱 그리드에는 없음)
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "5px",
                          }}
                        >
                          {adminSavedUnassigned.map((p, idx) => (
                            <div
                              key={`adm-un-${p.at}-${idx}`}
                              style={{
                                padding: "8px 10px",
                                borderRadius: "10px",
                                ...userCardGlass.panel,
                              }}
                            >
                              <div
                                style={{
                                  color: "white",
                                  fontSize: "13px",
                                  fontWeight: "bold",
                                }}
                              >
                                {p.place_name || "(이름 없음)"}
                              </div>
                              {p.address ? (
                                <div
                                  style={{
                                    color: "#999",
                                    fontSize: "11px",
                                    marginTop: "2px",
                                  }}
                                >
                                  {p.address}
                                </div>
                              ) : null}
                              <div
                                style={{
                                  color: "#777",
                                  fontSize: "10px",
                                  marginTop: "4px",
                                }}
                              >
                                {p.at
                                  ? new Date(p.at).toLocaleString("ko-KR")
                                  : "-"}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              )
            ) : activeTab === "followers" ? (
              <div
                style={{ display: "flex", flexDirection: "column", gap: "6px" }}
              >
                {showSearch && (
                  <div
                    style={{
                      paddingBottom: "6px",
                      borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                    }}
                  >
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="picked 검색…"
                      style={studioCoursesInput}
                      autoFocus
                    />
                  </div>
                )}
                <div
                  style={{ display: "flex", flexDirection: "column", gap: "4px" }}
                >
                  {getFilteredFollowers().length === 0 ? (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "10px",
                        color: "#999",
                        fontSize: "12px",
                      }}
                    >
                      {searchQuery
                        ? "검색 결과가 없습니다"
                        : "아직 picked가 없어요."}
                    </div>
                  ) : (
                    getFilteredFollowers().map((f) => (
                      <div
                        key={f.user_id}
                        style={curatorCardStyles.card}
                      >
                        <div style={curatorCardStyles.info}>
                          <CuratorFollowAvatar
                            curator={{
                              username:
                                String(f.secondaryText || "").replace(
                                  /^@/,
                                  ""
                                ) || "user",
                              display_name: f.primaryText,
                              avatar_url: f.avatarUrl,
                            }}
                            sizePx={24}
                          />
                          <div style={curatorCardStyles.details}>
                            <div
                              style={{
                                ...curatorCardStyles.name,
                                cursor: embeddedAdminReadOnly
                                  ? "default"
                                  : "pointer",
                                textDecoration: embeddedAdminReadOnly
                                  ? "none"
                                  : "underline",
                                textDecorationColor:
                                  "rgba(255, 255, 255, 0.3)",
                              }}
                              onClick={() => openFollowerPreview(f)}
                            >
                              {f.primaryText || f.label || "프로필"}
                            </div>
                            <div style={curatorCardStyles.meta}>
                              {f.secondaryText || (f.isCurator ? "@unknown" : "사용자")}
                            </div>
                            <div style={curatorCardStyles.meta}>
                              {f.isCurator ? "큐레이터" : "사용자"}
                              {f.created_at
                                ? ` · ${new Date(f.created_at).toLocaleDateString("ko-KR")}`
                                : ""}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {/* 검색 입력창 */}
                {showSearch && (
                  <div style={{ paddingBottom: '6px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="pick 검색…"
                      style={studioCoursesInput}
                      autoFocus
                    />
                  </div>
                )}
                
                {/* pick 목록 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {getFilteredCurators().length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '10px', color: '#999', fontSize: '12px' }}>
                      {searchQuery ? '검색 결과가 없습니다' : '아직 pick이 없어요.'}
                    </div>
                  ) : (
                    getFilteredCurators().map((curator) => (
                      <div
                        key={curator.following_user_id || curator.user_id || curator.id}
                        style={curatorCardStyles.card}
                      >
                        <div style={curatorCardStyles.info}>
                          <CuratorFollowAvatar curator={curator} sizePx={24} />
                          <div style={curatorCardStyles.details}>
                          <div
                            style={{
                              ...curatorCardStyles.name,
                              cursor: embeddedAdminReadOnly ? "default" : "pointer",
                              textDecoration: embeddedAdminReadOnly
                                ? "none"
                                : "underline",
                              textDecorationColor: "rgba(255, 255, 255, 0.3)",
                            }}
                            onClick={() => {
                              if (!embeddedAdminReadOnly) loadCuratorProfile(curator);
                            }}
                          >
                            {curator.display_name || curator.displayName || "큐레이터"}
                          </div>
                          <div style={curatorCardStyles.meta}>
                            @{curator.username || "unknown"}
                          </div>
                          <div style={curatorCardStyles.meta}>
                            {curator.bio ? `${curator.bio.slice(0, 20)}...` : '큐레이터'} • {curator.stats?.saveCount || 0} 저장
                          </div>
                        </div>
                        </div>
                        {!embeddedAdminReadOnly ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnfollow(
                              curator.following_user_id ||
                                curator.user_id ||
                                curator.id
                            );
                          }}
                          style={curatorCardStyles.unfollowButton}
                        >
                          remove
                        </button>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          </>
          ) : null}
            </div>
          {/* 홈 인디케이터·여백: 반투명 틈 없이 시트로 완전 덮음 */}
          <div
            aria-hidden
            style={{
              width: "100%",
              minHeight: "14px",
              height: "max(14px, env(safe-area-inset-bottom, 0px))",
              flexShrink: 0,
              backgroundColor: STUDIO_PROFILE.shell,
            }}
          />
        </div>
      </div>
      </div>

      {/* 유저/큐레이터 프로필 모달 */}
      {selectedCurator && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 2000,
            background: "rgba(0, 0, 0, 0.72)",
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setSelectedCurator(null)}
        >
          <div
            style={{
              borderRadius: "18px",
              width: "min(420px, calc(100vw - 28px))",
              maxWidth: "100%",
              maxHeight: "80vh",
              overflow: "hidden",
              backgroundColor: STUDIO_PROFILE.shell,
              border: `1px solid ${STUDIO_PROFILE.border}`,
              boxShadow: "0 18px 48px rgba(0,0,0,0.55)",
              fontFamily: STUDIO_PROFILE.font,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const isGeneralUserProfile =
                selectedCurator?.isCurator === false ||
                selectedCurator?.is_curator === false;
              const profileTitle = isGeneralUserProfile
                ? "아는 사람"
                : "큐레이터";
              const nick =
                selectedCurator.display_name ||
                selectedCurator.displayName ||
                selectedCurator.username ||
                "사용자";
              const handle = selectedCurator.username
                ? `@${selectedCurator.username}`
                : "";
              const received =
                selectedCurator.stats?.followerCount ??
                selectedCurator.receivedPickCount ??
                0;
              const outgoing =
                selectedCurator.stats?.followingCount ??
                selectedCurator.outgoingPickCount ??
                0;
              return (
                <>
            {/* 프로필 헤더 */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: "14px 16px",
              borderBottom: `1px solid ${STUDIO_PROFILE.border}`,
              backgroundColor: STUDIO_PROFILE.card,
            }}>
              <span style={generalProfileStyles.roleChip}>
                {profileTitle}
              </span>
              <button
                type="button"
                onClick={() => setSelectedCurator(null)}
                aria-label="닫기"
                style={generalProfileStyles.closeBtn}
              >
                ×
              </button>
            </div>

            {/* 프로필 정보 */}
            <div style={{ padding: "18px 16px 16px" }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 16 }}>
                <CuratorFollowAvatar curator={selectedCurator} sizePx={72} />
                <div style={{ fontSize: '20px', fontWeight: 850, color: '#fff', marginTop: 14, letterSpacing: '-0.02em' }}>
                  {nick}
                </div>
                {handle ? (
                  <div style={{ fontSize: '13px', color: STUDIO_PROFILE.textSoft, fontWeight: 650, marginTop: 4 }}>
                    {handle}
                  </div>
                ) : null}
                {isGeneralUserProfile ? (
                  <span style={generalProfileStyles.memberBadge}>잔 멤버</span>
                ) : null}
              </div>

              <div style={generalProfileStyles.statsGrid}>
                <div style={generalProfileStyles.statCell}>
                  <div style={generalProfileStyles.statNum}>{received}</div>
                  <div style={generalProfileStyles.statLbl}>받은 픽</div>
                </div>
                <div style={generalProfileStyles.statCell}>
                  <div style={generalProfileStyles.statNum}>{outgoing}</div>
                  <div style={generalProfileStyles.statLbl}>내 픽</div>
                </div>
                {!isGeneralUserProfile ? (
                  <>
                    <div style={generalProfileStyles.statCell}>
                      <div style={generalProfileStyles.statNum}>{selectedCurator.placeCount || 0}</div>
                      <div style={generalProfileStyles.statLbl}>추천</div>
                    </div>
                    <div style={generalProfileStyles.statCell}>
                      <div style={generalProfileStyles.statNum}>{selectedCurator.stats?.saveCount || 0}</div>
                      <div style={generalProfileStyles.statLbl}>저장</div>
                    </div>
                  </>
                ) : null}
              </div>

              {selectedCurator.bio && selectedCurator.bio !== "사용자" ? (
                <div style={generalProfileStyles.bioBox}>
                  {selectedCurator.bio}
                </div>
              ) : null}

              {isGeneralUserProfile && selectedCurator.user_id ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCurator(null);
                    navigate(`/u/${selectedCurator.user_id}`);
                  }}
                  style={generalProfileStyles.fullProfileLink}
                >
                  프로필 전체 보기 →
                </button>
              ) : null}

              {/* 저장된 장소 목록 */}
              <div style={{ marginTop: 16 }}>
                <h4 style={generalProfileStyles.listTitle}>
                  {isGeneralUserProfile ? "픽한 가게" : "저장한 장소"}
                  {" "}({selectedCurator.savedPlaces?.length || 0})
                </h4>
                <div style={{ 
                  maxHeight: '240px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  {selectedCurator.savedPlaces?.length === 0 ? (
                    <div style={generalProfileStyles.emptyList}>
                      {isGeneralUserProfile
                        ? "아직 공개 픽이 없어요"
                        : "저장한 장소가 없습니다"}
                    </div>
                  ) : (
                    selectedCurator.savedPlaces.map((saved) => (
                      <div
                        key={saved.id}
                        style={generalProfileStyles.placeRow}
                      >
                        <div style={generalProfileStyles.placeName}>
                          {saved.places?.name || '정보 없음'}
                        </div>
                        <div style={generalProfileStyles.placeAddr}>
                          {saved.places?.address || '주소 정보 없음'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* 폴더 수정 모달 */}
      {showFolderEditModal && editingPlace && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2100,
            ...userCardGlass.overlay,
          }}
        >
          <div
            style={{
              borderRadius: "18px",
              width: "90%",
              maxWidth: "400px",
              maxHeight: "80vh",
              overflow: "auto",
              padding: "20px",
              ...userCardGlass.sheet,
              boxShadow:
                "0 24px 56px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h3 style={{ color: 'white', margin: 0, fontSize: '16px' }}>
                폴더 수정
              </h3>
              <button
                onClick={() => {
                  setShowFolderEditModal(false);
                  setEditingPlace(null);
                  setSelectedFolders([]);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#999',
                  fontSize: '20px',
                  cursor: 'pointer'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: "16px" }}>
              {(() => {
                const { name: editName, address: editAddr } =
                  getSavedPlaceDisplayFields(editingPlace);
                return (
                  <>
                    <div
                      style={{
                        color: "white",
                        fontSize: "14px",
                        fontWeight: "bold",
                        marginBottom: "8px",
                      }}
                    >
                      장소: {editName}
                    </div>
                    {editAddr ? (
                      <div
                        style={{
                          color: "#999",
                          fontSize: "12px",
                          marginBottom: "16px",
                        }}
                      >
                        {editAddr}
                      </div>
                    ) : null}
                  </>
                );
              })()}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ color: 'white', fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>
                폴더 선택 (다중 선택 가능):
              </div>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '8px'
              }}>
                {Object.entries(savedPlaces).map(([folderKey, folderData]) => {
                  const isSelected = selectedFolders.some(folder => folder.key === folderKey);
                  return (
                    <button
                      key={folderKey}
                      onClick={() => toggleFolderSelection(folderKey, folderData.folderInfo)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px',
                        border: `2px solid ${isSelected ? folderData.folderInfo?.color : '#666'}`,
                        borderRadius: '8px',
                        backgroundColor: isSelected ? `${folderData.folderInfo?.color}20` : 'rgba(255, 255, 255, 0.05)',
                        color: isSelected ? folderData.folderInfo?.color : '#999',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <span>{folderData.folderInfo?.icon}</span>
                      <span style={{ fontSize: '12px', fontWeight: 'bold' }}>
                        {folderData.folderInfo?.name}
                      </span>
                      {isSelected && (
                        <span style={{ marginLeft: 'auto', fontSize: '12px' }}>✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowFolderEditModal(false);
                  setEditingPlace(null);
                  setSelectedFolders([]);
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#666',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                취소
              </button>
              <button
                onClick={handleSaveFolderChanges}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#3498DB',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UserCard;
