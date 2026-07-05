import { supabase } from "../lib/supabase";

/** 스튜디오 프로필 「별명」 — curators.name → display_name */
export function curatorNicknameFromCuratorRow(c) {
  if (!c || typeof c !== "object") return "";
  return String(c.name || c.display_name || "").trim();
}

export function curatorSearchLabelFromCuratorRow(c) {
  if (!c || typeof c !== "object") return "큐레이터";
  const nick = curatorNicknameFromCuratorRow(c);
  const handle = String(c.slug || c.username || "")
    .trim()
    .replace(/^@+/, "");
  if (nick && handle) return `${nick} @${handle}`;
  if (nick) return nick;
  if (handle) return `@${handle}`;
  return "큐레이터";
}

export function curatorMapsFromRows(curatorRows) {
  const nameByCurator = new Map();
  const nicknameByCurator = new Map();
  if (!Array.isArray(curatorRows)) {
    return { nameByCurator, nicknameByCurator };
  }
  for (const row of curatorRows) {
    const uid = String(row?.user_id || "").trim();
    if (!uid) continue;
    nameByCurator.set(uid, curatorSearchLabelFromCuratorRow(row));
    const nickname = curatorNicknameFromCuratorRow(row);
    if (nickname) nicknameByCurator.set(uid, nickname);
  }
  return { nameByCurator, nicknameByCurator };
}

/** @param {string[]} userIds — course.curator_id (auth user uuid) */
export async function fetchCuratorMapsForUserIds(userIds) {
  const ids = [
    ...new Set(
      (Array.isArray(userIds) ? userIds : [])
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    ),
  ];
  if (!ids.length) {
    return { nameByCurator: new Map(), nicknameByCurator: new Map() };
  }
  const { data, error } = await supabase
    .from("curators")
    .select("user_id, name, display_name, slug, username")
    .in("user_id", ids);
  if (error || !Array.isArray(data)) {
    return { nameByCurator: new Map(), nicknameByCurator: new Map() };
  }
  return curatorMapsFromRows(data);
}

/** @param {object[]} courses */
export async function fetchCuratorMapsForCourses(courses) {
  const ids = [
    ...new Set(
      (Array.isArray(courses) ? courses : [])
        .map((c) => String(c.curator_id || "").trim())
        .filter(Boolean)
    ),
  ];
  return fetchCuratorMapsForUserIds(ids);
}
