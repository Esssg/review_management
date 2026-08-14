import Image from "next/image";

import { cn } from "@/lib/utils";

export const SPLASH_IMAGE_PATH = "/loading/splash/splash-01.png";

export const PENDING_FRAME_PATHS = [
  "/loading/pending/pending-01.png",
  "/loading/pending/pending-02.png",
  "/loading/pending/pending-03.png",
  "/loading/pending/pending-04.png",
  "/loading/pending/pending-05.png",
  "/loading/pending/pending-06.png",
  "/loading/pending/pending-07.png",
  "/loading/pending/pending-08.png",
  "/loading/pending/pending-09.png",
  "/loading/pending/pending-10.png",
] as const;

type FrameSequenceProps = {
  frames: readonly string[];
  frameDurationMs: number;
  sizes: string;
  className?: string;
  imageClassName?: string;
};

export function FrameSequence({
  frames,
  frameDurationMs,
  sizes,
  className,
  imageClassName,
}: FrameSequenceProps) {
  const animationName = `review-manager-frame-${frames.length}`;
  const animationDuration = `${frameDurationMs * frames.length}ms`;

  return (
    <div className={cn("review-frame-sequence", className)} aria-hidden="true">
      {frames.map((frame, index) => (
        <Image
          key={frame}
          src={frame}
          alt=""
          fill
          sizes={sizes}
          loading="eager"
          className={cn("review-frame-sequence__frame", imageClassName)}
          style={{
            animationName,
            animationDuration,
            animationDelay: `-${(frames.length - index) * frameDurationMs}ms`,
          }}
        />
      ))}
    </div>
  );
}

export function PendingFrameAnimation({ className }: { className?: string }) {
  return (
    <FrameSequence
      frames={PENDING_FRAME_PATHS}
      frameDurationMs={120}
      sizes="112px"
      className={cn("h-16 w-16 shrink-0", className)}
      imageClassName="object-contain"
    />
  );
}
