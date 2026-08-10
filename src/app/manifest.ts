import type { MetadataRoute } from "next";

/** 브라우저와 홈 화면이 같은 리뷰 매니저 아이콘·색상을 사용하도록 PWA 정보를 제공합니다. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "리뷰 매니저",
    short_name: "리뷰 매니저",
    description: "쿠팡 리뷰 구매 내역과 주문 운영을 관리하는 앱",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f6f5f4",
    theme_color: "#0075de",
    icons: [
      {
        src: "/icons/review-manager-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/review-manager-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/review-manager-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
