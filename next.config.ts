import type { NextConfig } from "next";

/**
 * LAN IP(예: http://192.168.x.x:3000)로 `next dev` 접속 시,
 * Next 16이 내부 개발 자산(`/__nextjs_font/*`, `/_next/*` 등)에 대해 Origin 검사를 해서
 * 403 Forbidden 이 나는 경우가 있음 → 허용 호스트(Origin의 hostname)를 등록.
 *
 * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
 */
const extraAllowedDevOrigins =
  process.env.NEXT_DEV_ALLOWED_ORIGINS?.split(",").map((h) => h.trim()).filter(Boolean) ?? [];

// Capacitor APK 빌드는 정적 export(`out/`)가 필요하고, Vercel 같은 웹 호스팅은
// 서버 라우트(`/api/...`)를 써야 하므로 BUILD_TARGET 환경변수로 빌드 모드를 분리합니다.
const isApkBuild = process.env.BUILD_TARGET === "apk";

const nextConfig: NextConfig = {
  ...(isApkBuild ? { output: "export" as const } : {}),
  allowedDevOrigins: [
    "192.168.*.*",
    "10.*.*.*",
    ...extraAllowedDevOrigins,
  ],
};

export default nextConfig;
