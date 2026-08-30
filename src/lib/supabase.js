import { createClient } from "@supabase/supabase-js";
import {
  clearSupabaseAuthLocalStorage,
  createAuthMemoryStorage,
  isAuthDevFreshLoginEnabled,
} from "./authDevFreshLogin.js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const authDevFreshLogin = isAuthDevFreshLoginEnabled();

if (authDevFreshLogin) {
  clearSupabaseAuthLocalStorage(supabaseUrl);
  if (import.meta.env.DEV) {
    console.info(
      "[auth] DEV fresh login: 세션 저장 안 함 · OAuth 계정 선택 강제"
    );
  }
}

console.log("SUPABASE URL:", supabaseUrl);
console.log("SUPABASE KEY EXISTS:", !!supabaseAnonKey);

// Mock Supabase client — used when VITE_SUPABASE_URL/ANON_KEY are absent
// (e.g. local/Cloud dev without credentials). It implements a chainable,
// thenable query builder so arbitrary `.from().select().eq()...` chains
// resolve to empty results instead of throwing, and a full auth surface so
// AuthProvider hydrates cleanly into a logged-out state and the app renders.
const NOT_CONFIGURED = () => new Error("Supabase not configured");

function createMockQueryBuilder(result = { data: [], error: null }) {
  const promise = Promise.resolve(result);
  const proxy = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") return promise.then.bind(promise);
        if (prop === "catch") return promise.catch.bind(promise);
        if (prop === "finally") return promise.finally.bind(promise);
        // Terminal single-row helpers resolve to a null row, not an array.
        if (prop === "single" || prop === "maybeSingle") {
          return () => createMockQueryBuilder({ data: null, error: null });
        }
        // Any other query method (select/eq/in/order/limit/...) keeps chaining.
        return () => proxy;
      },
    }
  );
  return proxy;
}

function createMockChannel() {
  const channel = {
    on: () => channel,
    subscribe: (cb) => {
      if (typeof cb === "function") cb("SUBSCRIBED");
      return channel;
    },
    unsubscribe: () => Promise.resolve({ error: null }),
    send: () => Promise.resolve("ok"),
    track: () => Promise.resolve("ok"),
    untrack: () => Promise.resolve("ok"),
  };
  return channel;
}

const mockClient = {
  from: () => createMockQueryBuilder(),
  rpc: () => createMockQueryBuilder({ data: null, error: null }),
  storage: {
    from: () => ({
      upload: () =>
        Promise.resolve({ data: null, error: NOT_CONFIGURED() }),
      remove: () => Promise.resolve({ data: null, error: null }),
      list: () => Promise.resolve({ data: [], error: null }),
      createSignedUrl: () =>
        Promise.resolve({ data: null, error: NOT_CONFIGURED() }),
      getPublicUrl: () => ({ data: { publicUrl: "" } }),
    }),
  },
  channel: () => createMockChannel(),
  removeChannel: () => Promise.resolve({ error: null }),
  removeAllChannels: () => Promise.resolve({ error: null }),
  functions: {
    invoke: () => Promise.resolve({ data: null, error: NOT_CONFIGURED() }),
  },
  auth: {
    getUser: () =>
      Promise.resolve({ data: { user: null }, error: null }),
    getSession: () =>
      Promise.resolve({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({
      data: { subscription: { unsubscribe: () => {} } },
    }),
    signInWithOAuth: () =>
      Promise.resolve({ data: null, error: NOT_CONFIGURED() }),
    signOut: () => Promise.resolve({ error: null }),
  },
};

// Supabase 설정이 있으면 실제 client, 없으면 mock client 사용
// auth: React Strict Mode·초기 마운트 시 다수 요청이 동시에 세션 락을 잡으면
// Navigator Lock steal/recovery 경고가 난다. 직렬 lock으로 우회한다.
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: !authDevFreshLogin,
        autoRefreshToken: !authDevFreshLogin,
        detectSessionInUrl: true,
        ...(authDevFreshLogin
          ? { storage: createAuthMemoryStorage() }
          : {}),
        lockAcquireTimeout: 20000,
        lock: async (_name, _acquireTimeout, fn) => fn(),
      },
    })
  : mockClient;