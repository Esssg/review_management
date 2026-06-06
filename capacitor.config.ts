import type { CapacitorConfig } from "@capacitor/cli";

/**
 * 내장형: `next build` 산출물(`out/`)을 WebView에 넣습니다.
 * API·인증은 런타임에 Supabase(온라인)로만 나갑니다.
 */
const config: CapacitorConfig = {
  appId: "com.reviewmanager.app",
  appName: "리뷰매니저",
  webDir: "out",
};

export default config;
