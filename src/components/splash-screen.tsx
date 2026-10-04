import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Branded cinematic splash.
 *
 * - Shows an instant branded placeholder (no black screen, no waiting).
 * - Video crossfades in the moment it can play.
 * - Tries to play WITH sound. Browsers block unmuted autoplay without a
 *   user gesture, so if blocked we start muted with a "tap for sound"
 *   button — one tap unmutes (a real gesture, always allowed).
 * - Tap anywhere else to skip. Logo fallback if the video fails.
 */
export function SplashScreen({ src, onDone }: { src: string; onDone: () => void }) {
  const [fading, setFading] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [canPlay, setCanPlay] = useState(false);
  const [muted, setMuted] = useState(false);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const doneRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const dismiss = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setFading(true);
    timerRef.current = setTimeout(onDone, 600);
  }, [onDone]);

  // Attempt unmuted playback as soon as the video element exists.
  // Works when a user gesture (e.g. tapping the role switch) got us here.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || videoFailed) return;
    v.muted = false;
    const p = v.play();
    if (p) {
      p.then(() => setSoundBlocked(false)).catch(() => {
        // Autoplay with sound blocked — play muted, offer sound on tap.
        v.muted = true;
        setMuted(true);
        setSoundBlocked(true);
        v.play().catch(() => setVideoFailed(true));
      });
    }
  }, [videoFailed, src]);

  const unmute = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const v = videoRef.current;
      if (!v) return;
      v.muted = false;
      setMuted(false);
      setSoundBlocked(false);
      v.play().catch(() => {
        v.muted = true;
        setMuted(true);
        setSoundBlocked(true);
      });
    },
    [],
  );

  useEffect(() => {
    // Hard cap: never trap the user longer than 20s.
    const cap = setTimeout(dismiss, 20000);
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
      {/* Instant branded placeholder — visible immediately, video fades over it */}
      <div
        className={cn(
          "absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center transition-opacity duration-700",
          canPlay && !videoFailed ? "opacity-0" : "opacity-100",
        )}
      >
        <img src="/logo.png" alt="PillarPath" className="size-20 animate-pulse" />
        <p className="font-display text-2xl font-semibold text-white">PillarPath</p>
        <p className="text-sm text-white/60">Better than yesterday.</p>
      </div>

      {!videoFailed && (
        <video
          ref={videoRef}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-700",
            canPlay ? "opacity-100" : "opacity-0",
          )}
          src={src}
          playsInline
          preload="auto"
          onCanPlay={() => setCanPlay(true)}
          onEnded={dismiss}
          onError={() => setVideoFailed(true)}
        />
      )}

      {/* Sound toggle — appears only when the browser blocked unmuted autoplay */}
      {soundBlocked && !videoFailed && canPlay && !fading && (
        <button
          type="button"
          onClick={unmute}
          className="absolute bottom-16 flex items-center gap-2 rounded-full border border-white/20 bg-black/60 px-4 py-2.5 text-sm font-medium text-white backdrop-blur"
          aria-label="Turn sound on"
        >
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          Tap for sound
        </button>
      )}

      {!fading && (
        <p className="absolute bottom-8 text-[11px] tracking-wide text-white/40">
          tap to skip
        </p>
      )}
    </div>
  );
}
