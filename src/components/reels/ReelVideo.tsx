import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVideoStore } from "@/store/useVideoStore";
import { isSlowConnection } from "@/lib/network";
import { acquireVideo, releaseVideo, setActiveVideo } from "@/lib/videoPool";
import { Spinner } from "./gestures";
import { soundBlocked } from "@/lib/soundAutoplay";

export interface ReelVideoHandle {
  togglePlay: () => void;
  /** Must be called inside a tap handler — browsers only allow sound there. */
  unmuteNow: () => void;
}

interface ReelVideoProps {
  src: string;
  poster?: string | null;
  active: boolean;
  /** Mount the <video> (adjacent slides buffer ahead so swiping starts instantly). */
  mounted: boolean;
}


export const ReelVideo = forwardRef<ReelVideoHandle, ReelVideoProps>(({ src, poster, active, mounted }, ref) => {
  // The <video> comes from a shared pool of players woken by the viewer's first tap, so feed
  // videos keep autoplaying even in iPhone Low Power Mode (see lib/videoPool).
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [el, setEl] = useState<HTMLVideoElement | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [userPaused, setUserPaused] = useState(false);
  const [fit, setFit] = useState<"cover" | "contain">("cover");
  const [buffering, setBuffering] = useState(false);
  const [started, setStarted] = useState(false);
  const [seeking, setSeeking] = useState(false);
  // The phone refused to start it by itself (e.g. Low Power Mode) — a tap will start it.
  const [blocked, setBlocked] = useState(false);
  const muted = useVideoStore((s) => s.isGlobalMuted);
  const setGlobalMuted = useVideoStore((s) => s.setGlobalMuted);

  useImperativeHandle(ref, () => ({
    // Play/pause right inside the tap: phones in Low Power Mode only start videos from a tap.
    togglePlay: () => {
      const v = videoRef.current;
      if (!v) return;
      if (v.paused) {
        setUserPaused(false);
        setBlocked(false);
        v.play().catch((e) => { if ((e as DOMException)?.name === "NotAllowedError") setBlocked(true); });
      } else {
        setUserPaused(true);
        v.pause();
      }
    },
    unmuteNow: () => {
      const v = videoRef.current;
      if (v) { v.muted = false; if (v.paused && active) v.play().catch(() => {}); }
    },
  }), [active]);

  useEffect(() => {
    if (!mounted || !boxRef.current) return;
    const v = acquireVideo();
    if (v.getAttribute("src") !== src) v.src = src;
    if (poster) v.poster = poster; else v.removeAttribute("poster");
    boxRef.current.appendChild(v);
    videoRef.current = v;
    setEl(v);
    return () => {
      videoRef.current = null;
      setEl(null);
      releaseVideo(v);
    };
  }, [mounted, src, poster]);

  // Player events (portrait fills the screen; landscape sits on black, like TikTok).
  useEffect(() => {
    if (!el) return;
    const onMeta = () => { if (el.videoWidth && el.videoHeight) setFit(el.videoHeight / el.videoWidth >= 1.3 ? "cover" : "contain"); };
    const onCanPlay = () => setBuffering(false);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("waiting", onWaiting);
    el.addEventListener("playing", onPlaying);
    el.addEventListener("canplay", onCanPlay);
    if (el.readyState >= 1) onMeta();
    return () => {
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("waiting", onWaiting);
      el.removeEventListener("playing", onPlaying);
      el.removeEventListener("canplay", onCanPlay);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [el]);

  useEffect(() => {
    if (!el) return;
    el.className = cn("absolute inset-0 h-full w-full", fit === "cover" ? "object-cover" : "object-contain");
  }, [el, fit]);

  useEffect(() => {
    if (!el) return;
    el.preload = active || !isSlowConnection() ? "auto" : "metadata";
    if (!active) return;
    setActiveVideo(el);
    return () => setActiveVideo(null);
  }, [el, active]);

  // Play the active slide, pause the rest.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (active && !userPaused) {
      v.muted = muted;
      const refused = (e: unknown) => (e as DOMException)?.name === "NotAllowedError";
      v.play().catch((e) => {
        if (!refused(e)) return; // interrupted by scrolling, not refused
        // Sound blocked until the first tap — fall back to muted autoplay.
        if (!v.muted) {
          v.muted = true;
          soundBlocked(); // not the person's choice: carry on muted, "Tap for sound"
          v.play().catch((e2) => { if (refused(e2)) setBlocked(true); });
        } else {
          setBlocked(true); // even muted autoplay refused (Low Power Mode)
        }
      });
    } else {
      v.pause();
    }
  }, [active, userPaused, muted, setGlobalMuted, mounted, el]);

  // Leaving a slide rewinds it, like TikTok.
  useEffect(() => {
    if (active) return;
    setUserPaused(false);
    setBlocked(false);
    const v = videoRef.current;
    if (v && v.currentTime > 0) { try { v.currentTime = 0; } catch { /* not seekable yet */ } }
  }, [active]);

  // Smooth progress bar without re-rendering React every frame.
  useEffect(() => {
    if (!active || !mounted) return;
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v && progressRef.current && v.duration) progressRef.current.style.transform = `scaleX(${v.currentTime / v.duration})`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, mounted, el]);

  // Only show the spinner if buffering lasts long enough to notice.
  const bufferTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onWaiting = () => { if (bufferTimer.current) clearTimeout(bufferTimer.current); bufferTimer.current = setTimeout(() => setBuffering(true), 350); };
  const onPlaying = () => { if (bufferTimer.current) clearTimeout(bufferTimer.current); setBuffering(false); setStarted(true); setBlocked(false); };
  useEffect(() => () => { if (bufferTimer.current) clearTimeout(bufferTimer.current); }, []);

  const seekTo = (clientX: number, el: HTMLElement) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    v.currentTime = ratio * v.duration;
    if (progressRef.current) progressRef.current.style.transform = `scaleX(${ratio})`;
  };

  if (!mounted) {
    return (
      <div className="absolute inset-0 bg-black">
        {poster && <img src={poster} alt="" className="absolute inset-0 h-full w-full object-contain" decoding="async" loading="lazy" />}
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-black">
      <div ref={boxRef} className="absolute inset-0" />

      {active && (userPaused || blocked) && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-black/35 backdrop-blur-sm animate-scale-in">
            <Play className="ml-1 h-10 w-10 fill-white/90 text-white/90" />
          </div>
          {blocked && <span className="rounded-full bg-black/55 px-3 py-1 text-[13px] font-semibold text-white">Tap to play</span>}
        </div>
      )}
      {active && buffering && !userPaused && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"><Spinner /></div>
      )}

      {/* Progress — drag along it to scrub */}
      {active && (
        <div
          className="reel-progress group absolute inset-x-0 z-20 flex h-6 cursor-pointer items-end px-0"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => { e.stopPropagation(); setSeeking(true); e.currentTarget.setPointerCapture(e.pointerId); seekTo(e.clientX, e.currentTarget); }}
          onPointerMove={(e) => { if (seeking) seekTo(e.clientX, e.currentTarget); }}
          onPointerUp={() => setSeeking(false)}
          onPointerCancel={() => setSeeking(false)}
          role="slider"
          aria-label="Video progress"
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className={cn("relative w-full overflow-hidden rounded-full bg-white/20 transition-[height] duration-150", seeking ? "h-1.5" : "h-[3px] group-hover:h-1.5")}>
            <div ref={progressRef} className={cn("absolute inset-0 origin-left rounded-full", started ? "bg-white/90" : "bg-white/0")} style={{ transform: "scaleX(0)" }} />
          </div>
        </div>
      )}
    </div>
  );
});
ReelVideo.displayName = "ReelVideo";
