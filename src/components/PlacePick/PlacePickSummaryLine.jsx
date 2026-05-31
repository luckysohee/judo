import { useEffect, useState } from "react";
import { fetchPickSummary } from "../../api/placePicks";
import { resolvePlaceUuidForPick } from "../../utils/resolvePlaceUuidForPick";

const TONE_STYLES = {
  light: {
    normal: {
      marginTop: 4,
      marginBottom: 0,
      fontSize: 12,
      fontWeight: 600,
      color: "rgb(82 82 91)",
      lineHeight: 1.35,
    },
    muted: {
      marginTop: 4,
      marginBottom: 0,
      fontSize: 12,
      fontWeight: 500,
      color: "rgb(161 161 170)",
      lineHeight: 1.35,
    },
  },
  dark: {
    normal: {
      marginTop: 6,
      marginBottom: 0,
      fontSize: 12,
      fontWeight: 600,
      color: "rgba(255,255,255,0.62)",
      lineHeight: 1.35,
    },
    muted: {
      marginTop: 6,
      marginBottom: 0,
      fontSize: 12,
      fontWeight: 500,
      color: "rgba(255,255,255,0.38)",
      lineHeight: 1.35,
    },
  },
};

/**
 * @param {{ place: object, theme?: "light" | "dark", className?: string, style?: object }} props
 */
export function PlacePickSummaryLine({
  place,
  theme = "light",
  className = "",
  style = null,
}) {
  const [text, setText] = useState("");
  const [tone, setTone] = useState("muted");

  useEffect(() => {
    let cancelled = false;
    setText("");
    setTone("muted");
    (async () => {
      const uuid = await resolvePlaceUuidForPick(place);
      if (cancelled || !uuid) return;
      try {
        const s = await fetchPickSummary(uuid);
        if (cancelled) return;
        const cc = Number(s.curator_pick_count) || 0;
        const uc = Number(s.user_pick_count) || 0;
        const tot = Number(s.total_count) || 0;
        if (tot <= 0) {
          setText("아직 픽이 없어요");
          setTone("muted");
        } else {
          setText(`큐레이터 ${cc}명 · 유저 ${uc}명이 픽`);
          setTone("normal");
        }
      } catch {
        if (!cancelled) {
          setText("");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    place?.id,
    place?.kakao_place_id,
    place?.place_id,
    place?.kakaoId,
    place?.name,
  ]);

  if (!text) return null;

  const palette = TONE_STYLES[theme] || TONE_STYLES.light;
  const merged = {
    ...(tone === "muted" ? palette.muted : palette.normal),
    ...style,
  };

  return (
    <p className={className} style={merged}>
      {text}
    </p>
  );
}
