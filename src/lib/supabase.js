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

// Mock Supabase client
const mockClient = {
  from: () => ({
    select: () => ({
      eq: () => ({
        order: () => Promise.resolve({ data: [], error: null })
      })
    })
  }),
  storage: {
    from: () => ({
      upload: () => Promise.resolve({ data: null, error: new Error('Storage not configured') }),
      getPublicUrl: () => ({ data: { publicUrl: '' } })
    })
  },
  auth: {
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    signInWithOAuth: () => Promise.resolve({ data: null, error: new Error('Auth not configured') })
  }
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