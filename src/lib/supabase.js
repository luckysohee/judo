import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

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
// 기본 5s Navigator Lock 타임아웃으로 steal/recovery 경고가 난다. 여유를 둔다.
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        lockAcquireTimeout: 20000,
      },
    })
  : mockClient;