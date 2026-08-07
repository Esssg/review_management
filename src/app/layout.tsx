import type { Metadata, Viewport } from "next";
import { BottomMenu } from "@/components/navigation/bottom-menu";
import "./globals.css";

export const metadata: Metadata = {
  title: "리뷰 매니저",
  description: "쿠팡 리뷰 구매 장부 및 자동화",
};

/** 모바일 브라우저에서 노치와 하단 안전 영역을 고려해 화면 너비를 사용합니다. */
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
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        <div className="flex min-h-full flex-1 flex-col pb-16">{children}</div>
        <BottomMenu />
      </body>
    </html>
  );
}
