import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { BottomMenu } from "@/components/navigation/bottom-menu";
import { DesktopSidebar } from "@/components/navigation/desktop-sidebar";
import { GlobalCommandPalette } from "@/components/navigation/global-command-palette";
import { SplashScreen } from "@/components/loading/splash-screen";
import { OnboardingTourLoader } from "@/components/onboarding/onboarding-tour-loader";
import { NotificationProvider } from "@/components/notifications/notification-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "리뷰 매니저",
  description: "쿠팡 리뷰 구매 장부 및 자동화",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { url: "/icons/review-manager-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/review-manager-180.png", sizes: "180x180", type: "image/png" }],
  },
};

/** 모바일 브라우저에서 노치와 하단 안전 영역을 고려해 화면 너비를 사용합니다. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0075de",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        <SplashScreen />
        <Suspense fallback={null}>
          <DesktopSidebar />
          <GlobalCommandPalette />
        </Suspense>
        <Suspense fallback={null}>
          <NotificationProvider>
            <div className="flex min-h-full flex-1 flex-col pb-16 lg:pl-60 lg:pb-0">{children}</div>
          </NotificationProvider>
        </Suspense>
        <BottomMenu />
        <OnboardingTourLoader />
      </body>
    </html>
  );
}
