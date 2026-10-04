import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Branded launch splash — plays the PillarPath World tour video
 * full-screen on every cold start, then fades into the app.
 * Tap to skip. Falls back to the logo if the video can't load.
 */
export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [fading, setFading] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const doneRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setFading(true);
    timerRef.current = setTimeout(onDone, 600);
  }, [onDone]);

  useEffect(() => {
    // Hard cap: never trap the user longer than 18s.
    const cap = setTimeout(dismiss, 18000);
    // If the video failed, show the logo briefly then dismiss.
    let fallback: ReturnType<typeof setTimeout> | null = null;
    if (videoFailed) fallback = setTimeout(dismiss, 2200);
    return () => {
      clearTimeout(cap);
      if (fallback) clearTimeout(fallback);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [dismiss, videoFailed]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#070312] transition-opacity duration-500",
        fading ? "pointer-events-none opacity-0" : "opacity-100",
      )}
      onClick={dismiss}
      aria-label="PillarPath intro — tap to skip"
    >
      {!videoFailed ? (
        <video
          className="h-full w-full object-cover"
          src="/splash-brand.mp4"
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={dismiss}
          onError={() => setVideoFailed(true)}
        />
      ) : (
        <div className="flex flex-col items-center gap-4 px-8 text-center">
          <img src="/logo.png" alt="PillarPath" className="size-20" />
          <p className="font-display text-2xl font-semibold text-white">PillarPath</p>
          <p className="text-sm text-white/60">Better than yesterday.</p>
        </div>
      )}
      {!fading && (
        <p className="absolute bottom-8 text-[11px] tracking-wide text-white/40">
          tap to skip
        </p>
      )}
    </div>
  );
}
