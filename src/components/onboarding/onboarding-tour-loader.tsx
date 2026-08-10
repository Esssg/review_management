"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const LazyOnboardingTour = dynamic(
  () => import("@/components/onboarding/onboarding-tour").then((module) => module.OnboardingTour),
  { ssr: false },
);

export function OnboardingTourLoader() {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const timerId = window.setTimeout(() => setShouldLoad(true), 0);
    return () => window.clearTimeout(timerId);
  }, []);

  return shouldLoad ? <LazyOnboardingTour /> : null;
}
