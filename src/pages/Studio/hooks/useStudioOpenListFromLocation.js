import { useEffect } from "react";

/**
 * 다른 페이지에서 `navigate("/studio", { state: { openStudioList: true } })`로 들어왔을 때
 * 자동으로 「잔 리스트」 탭을 열어주고, state는 즉시 비워서 뒤로가기 시 재발동되지 않게 한다.
 */
export function useStudioOpenListFromLocation({
  location,
  navigate,
  setActiveSection,
}) {
  useEffect(() => {
    if (location.state?.openStudioList) {
      setActiveSection("list");
      navigate("/studio", { replace: true, state: {} });
    }
  }, [location.state?.openStudioList, navigate, setActiveSection]);
}
