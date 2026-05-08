import CuratorApplicationButton from "../CuratorApplicationButton/CuratorApplicationButton";

/**
 * SearchBar 우측 슬롯에 들어가는 인증·역할별 액션 묶음.
 * - 로그인 + 일반 유저: 큐레이터 신청 버튼 + 프로필 버튼 + 로그아웃
 * - 로그인 + 큐레이터/관리자: 프로필 버튼(이동 위치 다름) + 로그아웃
 * - 비로그인: Google / Kakao 로그인 버튼 두 개
 *
 * `onProfileClick`은 역할별 분기를 부모가 정한다(Home에서 admin은 /admin, curator는 /studio,
 * 일반 유저는 UserCard 노출). 본 컴포넌트는 마크업 + 클릭 위임만 담당.
 */
export default function HomeSearchAuthSlot({
  authLoading,
  isLoggedIn,
  userRole,
  compact,
  profileButtonHint,
  profilePhotoUrl,
  profilePhotoFailed,
  onProfilePhotoError,
  profileInitial,
  onProfileClick,
  onSignOut,
  onGoogleLogin,
  onKakaoLogin,
  styleMap,
}) {
  const showCuratorApply =
    !authLoading && isLoggedIn && userRole === "user";

  return (
    <div
      style={{
        ...styleMap?.authRowInline,
        ...(compact ? styleMap?.authRowInlineNarrow : {}),
      }}
    >
      {showCuratorApply && <CuratorApplicationButton compact={compact} />}

      {authLoading ? null : isLoggedIn ? (
        <>
          <button
            type="button"
            title={profileButtonHint?.title}
            aria-label={profileButtonHint?.aria}
            style={{
              ...(userRole === "admin"
                ? styleMap?.adminInlineButton
                : userRole === "curator"
                  ? styleMap?.curatorInlineButton
                  : styleMap?.userInlineButton),
              ...styleMap?.searchBarProfileButton,
              ...(compact ? styleMap?.searchBarProfileButtonNarrow : {}),
            }}
            onClick={onProfileClick}
          >
            {profilePhotoUrl && !profilePhotoFailed ? (
              <img
                src={profilePhotoUrl}
                alt=""
                style={styleMap?.searchBarProfileImg}
                onError={onProfilePhotoError}
              />
            ) : (
              <span style={styleMap?.searchBarProfileInitial}>
                {profileInitial}
              </span>
            )}
          </button>
          <button
            type="button"
            style={{
              ...styleMap?.authInlineButton,
              ...(compact ? styleMap?.authInlineButtonNarrow : {}),
            }}
            title="로그아웃"
            onClick={onSignOut}
          >
            {compact ? "나가기" : "로그아웃"}
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            style={{
              ...styleMap?.authIconButton,
              ...styleMap?.googleButton,
            }}
            onClick={onGoogleLogin}
            aria-label="Google 로그인"
            title="Google 로그인"
          >
            <span style={styleMap?.googleG}>G</span>
          </button>
          <button
            type="button"
            style={{
              ...styleMap?.authIconButton,
              ...styleMap?.kakaoButton,
            }}
            onClick={onKakaoLogin}
            aria-label="Kakao 로그인"
            title="Kakao 로그인"
          >
            <span style={styleMap?.kakaoK}>K</span>
          </button>
        </>
      )}
    </div>
  );
}
