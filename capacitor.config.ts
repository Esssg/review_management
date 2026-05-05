import type { CapacitorConfig } from "@capacitor/cli";

/**
 * 내장형: `next build` 산출물(`out/`)을 WebView에 넣습니다.
 * API·인증은 런타임에 Supabase(온라인)로만 나갑니다.
 */
const config: CapacitorConfig = {
  appId: "com.reviewmanager.app",
  appName: "리뷰매니저",
  webDir: "out",
  // WebView origin을 http://localhost로 띄워 외부 평문 HTTP 서버 호출 시 Mixed Content를 피합니다.
  // (AndroidManifest의 usesCleartextTraffic=true와 함께 작동)
  server: {
    androidScheme: "http",
  },
};

export default config;
