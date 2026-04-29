import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  fetchPickSummary,
  fetchPlaceRecentPickers,
} from "../../api/placePicks";
import { resolvePlaceUuidForPick } from "../../utils/resolvePlaceUuidForPick";

function initials(displayName) {
  const s = String(displayName ?? "").trim();
  if (!s) return "?";
  const ch = s[0];
  return ch === ch.toUpperCase() ? ch : ch.toUpperCase();
}

function PickerAvatar({ row, size, fallbackStyle, ring }) {
  const [imgBroken, setImgBroken] = useState(false);
  const url = row.avatar_url && String(row.avatar_url).trim();
  const showImg = Boolean(url) && !imgBroken;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "999px",
        overflow: "hidden",
        border: ring,
        backgroundColor: fallbackStyle.backgroundColor,
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      {showImg ? (
        <img
          src={url}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
          onError={() => setImgBroken(true)}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: showImg ? "none" : "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size > 32 ? 14 : 13,
          fontWeight: 800,
          color: fallbackStyle.color,
        }}
      >
        {initials(row.display_name)}
      </div>
    </div>
  );
}

const PALETTE = {
  dark: {
    sectionTitle: {
      margin: "0 0 6px",
      fontSize: "13px",
      fontWeight: 800,
      color: "rgba(255,255,255,0.88)",
      letterSpacing: "-0.02em",
    },
    totalLine: {
      margin: "0 0 4px",
      fontSize: "12px",
      fontWeight: 600,
      color: "rgba(255,255,255,0.55)",
    },
    /** 카드 한 줄 전용 — 박스 없이 가볍게 */
    cardStripLine: {
      margin: "4px 0 2px",
      fontSize: "11px",
      fontWeight: 600,
      color: "rgba(255,255,255,0.5)",
      lineHeight: 1.35,
    },
    breakdown: {
      margin: "0 0 10px",
      fontSize: "13px",
      fontWeight: 600,
      lineHeight: 1.45,
    },
    curatorPart: {
      color: "#fde68a",
      fontWeight: 800,
    },
    userPart: {
      color: "rgba(255,255,255,0.72)",
      fontWeight: 600,
    },
    emptyMuted: {
      margin: 0,
      fontSize: "12px",
      color: "rgba(255,255,255,0.42)",
    },
    avatarRingUser: "2px solid rgba(255,255,255,0.35)",
    avatarRingCurator: "2px solid rgba(234, 179, 8, 0.55)",
    avatarFallbackBg: "rgba(255,255,255,0.12)",
    avatarFallbackColor: "rgba(255,255,255,0.85)",
    badgeBg: "rgba(180, 83, 9, 0.92)",
    badgeColor: "#fffbeb",
    stackWrap: { display: "flex", flexDirection: "row", alignItems: "center" },
  },
  light: {
    sectionTitle: {
      margin: "0 0 6px",
      fontSize: "13px",
      fontWeight: 800,
      color: "rgb(23 23 23)",
      letterSpacing: "-0.02em",
    },
    totalLine: {
      margin: "0 0 4px",
      fontSize: "12px",
      fontWeight: 600,
      color: "rgb(113 113 122)",
    },
    cardStripLine: {
      margin: "4px 0 2px",
      fontSize: "11px",
      fontWeight: 600,
      color: "rgb(113 113 122)",
      lineHeight: 1.35,
    },
    breakdown: {
      margin: "0 0 10px",
      fontSize: "13px",
      fontWeight: 600,
      lineHeight: 1.45,
    },
    curatorPart: {
      color: "rgb(146 64 14)",
      fontWeight: 800,
    },
    userPart: {
      color: "rgb(63 63 70)",
      fontWeight: 600,
    },
    emptyMuted: {
      margin: 0,
      fontSize: "12px",
      color: "rgb(161 161 170)",
    },
    avatarRingUser: "2px solid rgb(228 228 231)",
    avatarRingCurator: "2px solid rgba(202, 138, 4, 0.65)",
    avatarFallbackBg: "rgb(244 244 245)",
    avatarFallbackColor: "rgb(63 63 70)",
    badgeBg: "rgba(180, 83, 9, 0.88)",
    badgeColor: "#fffbeb",
    stackWrap: { display: "flex", flexDirection: "row", alignItems: "center" },
  },
};

/**
 * 픽 집계(+선택 시 최근 픽커 아바타). 추천 점수 가중 없음.
 *
 * @param {{
 *   place: object,
 *   theme?: "dark" | "light",
 *   compact?: boolean,
 *   showAvatars?: boolean,
 * }} props
 * `showAvatars=false`: 카드용 — `fetchPickSummary`만, 총 N명 한 줄, 0명·미등록·로딩 시 null.
 * `showAvatars=true`: 상세/시트 — 아바타 스택 포함, 0명·미등록 시 null.
 */
export function PlacePickDetailSummary({
  place,
  theme = "dark",
  compact = false,
  showAvatars = true,
}) {
  const [loading, setLoading] = useState(true);
  const [placeUuid, setPlaceUuid] = useState(null);
  const [summary, setSummary] = useState(null);
  const [pickerRows, setPickerRows] = useState([]);

  const p = PALETTE[theme] || PALETTE.dark;
  const avatarSize = compact ? 32 : 36;
  const overlap = compact ? -8 : -10;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPlaceUuid(null);
    setSummary(null);
    setPickerRows([]);

    (async () => {
      const uuid = await resolvePlaceUuidForPick(place);
      if (cancelled) return;
      if (!uuid) {
        setPlaceUuid(null);
        setSummary(null);
        setPickerRows([]);
        setLoading(false);
        return;
      }
      setPlaceUuid(uuid);

      try {
        if (!showAvatars) {
          const sum = await fetchPickSummary(uuid);
          if (cancelled) return;
          setSummary(sum);
          setPickerRows([]);
          return;
        }

        const [sum, recent] = await Promise.all([
          fetchPickSummary(uuid),
          fetchPlaceRecentPickers(uuid),
        ]);
        if (cancelled) return;
        setSummary(sum);

        const orderedIds = recent
          .map((r) => r?.user_id)
          .filter((id) => id != null && String(id).trim() !== "");

        if (orderedIds.length === 0) {
          setPickerRows([]);
          return;
        }

        const [{ data: pickRows, error: pickErr }, { data: profRows, error: profErr }] =
          await Promise.all([
            supabase
              .from("place_picks")
              .select("user_id, is_curator")
              .eq("place_id", uuid)
              .in("user_id", orderedIds),
            supabase
              .from("profiles")
              .select("id, avatar_url, display_name")
              .in("id", orderedIds),
          ]);

        if (cancelled) return;

        const curatorByUser = {};
        if (!pickErr && Array.isArray(pickRows)) {
          for (const row of pickRows) {
            if (row?.user_id) curatorByUser[String(row.user_id)] = Boolean(row.is_curator);
          }
        }

        const profileById = {};
        if (!profErr && Array.isArray(profRows)) {
          for (const row of profRows) {
            if (row?.id) profileById[String(row.id)] = row;
          }
        }

        const merged = orderedIds.map((uid) => {
          const prof = profileById[String(uid)] || {};
          return {
            user_id: String(uid),
            avatar_url: String(prof.avatar_url || "").trim(),
            display_name: String(prof.display_name || "").trim(),
            is_curator: Boolean(curatorByUser[String(uid)]),
          };
        });

        setPickerRows(merged);
      } catch {
        if (!cancelled) {
          setSummary(null);
          setPickerRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    showAvatars,
    place?.id,
    place?.kakao_place_id,
    place?.place_id,
    place?.kakaoId,
    place?.name,
  ]);

  if (loading) return null;

  if (!placeUuid) return null;

  const total = summary ? Number(summary.total_count) || 0 : 0;
  const cur = summary ? Number(summary.curator_pick_count) || 0 : 0;
  const usr = summary ? Number(summary.user_pick_count) || 0 : 0;

  if (total <= 0) return null;

  if (!showAvatars) {
    /** 카드·리스트: 큐레이터/추천이유 아래 보조 한 줄 — 칩 크기만 */
    const chip = Boolean(compact);
    const label = `👍 ${total}명 픽`;
    if (chip) {
      return (
        <div
          style={{
            marginTop: 6,
            marginBottom: 2,
            display: "inline-flex",
            alignItems: "center",
            maxWidth: "100%",
          }}
        >
          <span
            style={{
              display: "inline-block",
              padding: "2px 8px",
              borderRadius: 999,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1.35,
              color:
                theme === "light" ? "rgb(82 82 91)" : "rgba(255,255,255,0.52)",
              backgroundColor:
                theme === "light"
                  ? "rgb(244 244 245)"
                  : "rgba(255,255,255,0.06)",
              border:
                theme === "light"
                  ? "1px solid rgb(228 228 231)"
                  : "1px solid rgba(255,255,255,0.1)",
            }}
            aria-label={label}
          >
            {label}
          </span>
        </div>
      );
    }
    return (
      <p style={p.cardStripLine} aria-label={label}>
        {label}
      </p>
    );
  }

  return (
    <div
      style={{
        marginTop: compact ? 8 : 10,
        marginBottom: compact ? 6 : 8,
        padding: compact ? "10px 10px" : "12px 12px",
        borderRadius: "12px",
        backgroundColor:
          theme === "light"
            ? "rgba(250, 250, 250, 0.95)"
            : "rgba(255,255,255,0.05)",
        border:
          theme === "light"
            ? "1px solid rgba(24,24,27,0.08)"
            : "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <h3 style={p.sectionTitle}>이 가게를 픽한 사람들</h3>

      <p style={p.totalLine}>총 {total}명이 픽했어요</p>
      <p style={p.breakdown}>
        <span style={p.curatorPart}>큐레이터 {cur}명</span>
        <span style={p.userPart}> · 유저 {usr}명이 픽</span>
      </p>

      {pickerRows.length > 0 ? (
        <div style={p.stackWrap} aria-label="최근 픽한 사용자">
          {pickerRows.map((row, idx) => (
            <div
              key={row.user_id}
              style={{
                position: "relative",
                marginLeft: idx === 0 ? 0 : overlap,
                zIndex: pickerRows.length - idx,
              }}
              title={
                row.is_curator
                  ? `큐레이터 · ${row.display_name || "닉네임 비공개"}`
                  : row.display_name || "닉네임 비공개"
              }
            >
              <div
                style={{
                  boxShadow:
                    theme === "light"
                      ? "0 1px 4px rgba(0,0,0,0.06)"
                      : "0 2px 8px rgba(0,0,0,0.35)",
                  borderRadius: "999px",
                }}
              >
                <PickerAvatar
                  row={row}
                  size={avatarSize}
                  ring={row.is_curator ? p.avatarRingCurator : p.avatarRingUser}
                  fallbackStyle={{
                    backgroundColor: p.avatarFallbackBg,
                    color: p.avatarFallbackColor,
                  }}
                />
              </div>
              {row.is_curator ? (
                <span
                  style={{
                    position: "absolute",
                    right: -1,
                    bottom: 0,
                    minWidth: "14px",
                    height: "14px",
                    padding: "0 3px",
                    borderRadius: "999px",
                    background: p.badgeBg,
                    color: p.badgeColor,
                    fontSize: "8px",
                    fontWeight: 800,
                    lineHeight: "14px",
                    textAlign: "center",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                    border: "1px solid rgba(255,255,255,0.25)",
                  }}
                  aria-label="큐레이터 픽"
                >
                  큐
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default PlacePickDetailSummary;
