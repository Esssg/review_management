import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CapacitorAndroidBackHandler } from "@/components/native/capacitor-android-back-handler";
import { BottomMenu } from "@/components/navigation/bottom-menu";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "리뷰 매니저",
  description: "쿠팡 리뷰 구매 장부 및 자동화",
};

/** WebView·모바일에서 layout viewport가 넓게 잡히면 `md` 이상 브레이크포인트로 빠져 카드·섹션 스크롤이 안 먹는 경우가 있음 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <CapacitorAndroidBackHandler />
        <div className="flex min-h-full flex-1 flex-col pb-16">{children}</div>
        <BottomMenu />
      </body>
    </html>
  );
}
