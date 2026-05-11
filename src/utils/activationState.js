const STORAGE_KEY = "judo_activation_v1";

function nowIso() {
  return new Date().toISOString();
}

function safeGetItem(key) {
  try {
    return window?.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSetItem(key, value) {
  try {
    window?.localStorage?.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function safeRemoveItem(key) {
  try {
    window?.localStorage?.removeItem(key);
  } catch {
    /* ignore */
  }
}

function emitChanged() {
  try {
    window?.dispatchEvent?.(new Event("judo:activation"));
  } catch {
    /* ignore */
  }
}

function makeFreshState() {
  return {
    first_seen_at: nowIso(),
    completed_at: null,
    completed_by: null, // "save" | "follow" | "create" | null
    events: {
      first_home_view: null,
      first_collection_save: null,
      first_follow_curator: null,
      first_collection_create: null,
    },
  };
}

function coerceState(input) {
  if (!input || typeof input !== "object") return null;
  const out = makeFreshState();
  const first = typeof input.first_seen_at === "string" ? input.first_seen_at : "";
  out.first_seen_at = first || out.first_seen_at;

  out.completed_at = typeof input.completed_at === "string" ? input.completed_at : null;
  const by = typeof input.completed_by === "string" ? input.completed_by : null;
  out.completed_by = by === "save" || by === "follow" || by === "create" ? by : null;

  const ev = input.events && typeof input.events === "object" ? input.events : {};
  out.events = {
    first_home_view: typeof ev.first_home_view === "string" ? ev.first_home_view : null,
    first_collection_save: typeof ev.first_collection_save === "string" ? ev.first_collection_save : null,
    first_follow_curator: typeof ev.first_follow_curator === "string" ? ev.first_follow_curator : null,
    first_collection_create: typeof ev.first_collection_create === "string" ? ev.first_collection_create : null,
  };
  return out;
}

/**
 * activation state read. invalid JSON 은 자동 복구(reset 후 새 state 저장).
 */
export function readActivationState() {
  if (typeof window === "undefined") return makeFreshState();
  const raw = safeGetItem(STORAGE_KEY);
  if (!raw) {
    const fresh = makeFreshState();
    safeSetItem(STORAGE_KEY, JSON.stringify(fresh));
    return fresh;
  }
  try {
    const parsed = JSON.parse(raw);
    const coerced = coerceState(parsed);
    if (!coerced) throw new Error("invalid state");
    // coerce 결과를 다시 저장해 스키마 드리프트를 정리
    safeSetItem(STORAGE_KEY, JSON.stringify(coerced));
    return coerced;
  } catch {
    const fresh = makeFreshState();
    safeSetItem(STORAGE_KEY, JSON.stringify(fresh));
    return fresh;
  }
}

export function writeActivationState(next) {
  if (typeof window === "undefined") return;
  const coerced = coerceState(next) || makeFreshState();
  safeSetItem(STORAGE_KEY, JSON.stringify(coerced));
  emitChanged();
}

export function resetActivationState() {
  safeRemoveItem(STORAGE_KEY);
  emitChanged();
}

export function isActivationCompleted(state) {
  return Boolean(state?.completed_at);
}

export function markActivationEvent(eventName) {
  const s = readActivationState();
  const e = s.events || {};
  if (typeof e[eventName] === "string" && e[eventName]) return s;
  const next = {
    ...s,
    events: { ...e, [eventName]: nowIso() },
  };
  writeActivationState(next);
  return next;
}

/**
 * save/follow/create 중 하나로 activation 완료 처리.
 * 이미 완료된 경우엔 no-op.
 */
export function completeActivation(by) {
  const s = readActivationState();
  if (s.completed_at) return s;
  const kind = by === "save" || by === "follow" || by === "create" ? by : null;
  const next = {
    ...s,
    completed_at: nowIso(),
    completed_by: kind,
  };
  writeActivationState(next);
  return next;
}

