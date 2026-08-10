import { Suspense } from "react";

import { HomePage } from "@/components/pages/home-page";
import { fetchHomeInitialData } from "@/lib/home-data";
import { createClient as createServerClient } from "@/lib/supabase/server";
import type { HomeInitialData } from "@/types/home";

export default async function Home() {
  let initialData: HomeInitialData | null = null;

  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      try {
        const homeData = await fetchHomeInitialData(supabase, user.id);
        initialData = {
          user: {
            id: user.id,
            email: user.email ?? user.id,
          },
          ...homeData,
        };
      } catch {
        // 서버 첫 조회가 실패하면 기존 클라이언트 조회가 오류를 표시하도록 넘깁니다.
      }
    }
  } catch {
    // 환경변수가 없거나 쿠키 세션이 없으면 기존 게스트·환경변수 화면을 사용합니다.
  }

  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-[1440px] px-4 py-5 text-sm text-muted-foreground">불러오는 중…</div>}>
      <HomePage initialData={initialData} />
    </Suspense>
  );
}
