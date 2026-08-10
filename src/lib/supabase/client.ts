import { createBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (key: string) => m.get(key) ?? null,
    setItem: (key: string, value: string) => {
      m.set(key, value);
    },
    removeItem: (key: string) => {
      m.delete(key);
    },
  };
}

let browserSingleton: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * 브라우저 세션은 Supabase SSR cookie 저장 방식으로 유지합니다.
 * 서버에서 같은 세션을 읽을 수 있도록 브라우저와 서버가 같은 쿠키를 사용합니다.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url?.trim() || !anonKey?.trim()) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 필요합니다.");
  }

  // client component의 서버 사전 렌더링에서는 브라우저 쿠키 API를 사용할 수 없습니다.
  if (typeof window === "undefined") {
    return createSupabaseClient<Database>(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storage: memoryStorage(),
      },
    });
  }

  if (!browserSingleton) {
    browserSingleton = createBrowserClient<Database>(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storage: window.localStorage,
      },
    });
  }
  return browserSingleton;
}
