"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { SPLASH_IMAGE_PATH } from "@/components/loading/frame-sequence";

const SPLASH_DURATION_MS = 1200;

export function SplashScreen() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setVisible(false),
      SPLASH_DURATION_MS,
    );

    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      data-slot="app-splash"
      className="review-manager-splash fixed inset-0 z-[240] overflow-hidden bg-[#123bd0] lg:hidden"
      role="status"
      aria-label="리뷰 매니저를 준비하는 중입니다."
      style={{ animationDuration: `${SPLASH_DURATION_MS}ms` }}
    >
      <Image
        src={SPLASH_IMAGE_PATH}
        alt=""
        fill
        sizes="100vw"
        loading="eager"
        unoptimized
        className="object-cover"
        aria-hidden="true"
      />
      <span className="sr-only">리뷰 매니저를 준비하는 중입니다.</span>
    </div>
  );
}
