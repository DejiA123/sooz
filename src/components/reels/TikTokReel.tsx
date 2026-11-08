import { memo, useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Music2, Play } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useVideoStore } from "@/store/useVideoStore";
import { requestTikTokRefresh, tiktokPlayerUrl, type TikTokVideo } from "@/services/api/tiktok";
import { RichCaption } from "./RichCaption";
import { RailButton, ShareArrow, railIconClass } from "./ReelRail";
import { Spinner, useTapGesture } from "./gestures";

const TIKTOK_ORIGIN = "https://www.tiktok.com";

// TikTok embed player states (onStateChange): -1 init, 0 ended, 1 playing, 2 paused, 3 buffering.
type PlayerState = "loading" | "playing" | "paused" | "buffering" | "error";

/** Small TikTok-style note mark for attribution. */
const TikTokMark = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M16.6 2h-3.4v13.3a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V9a6.4 6.4 0 1 0 5.4 6.3V8.6a8 8 0 0 0 4.6 1.5V6.7a4.7 4.7 0 0 1-4.6-4.7z" />
  </svg>
);

interface TikTokReelProps {
  video: TikTokVideo;
  active: boolean;
}

export const TikTokReel = memo(function TikTokReel({ video, active }: TikTokReelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<PlayerState>("loading");
  const [ready, setReady] = useState(false);
  // If the browser blocks autoplay inside the embed, let taps reach TikTok's own play button.
  const [needsNativeTap, setNeedsNativeTap] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);
  const muted = useVideoStore((s) => s.isGlobalMuted);

  const send = useCallback((type: string, value?: unknown) => {
    iframeRef.current?.contentWindow?.postMessage({ type, value, "x-tiktok-player": true }, TIKTOK_ORIGIN);
  }, []);

  // Reset whenever the slide is left — the iframe is unmounted then, so it can't keep playing.
  useEffect(() => {
    if (active) return;
    setState("loading");
    setReady(false);
    setNeedsNativeTap(false);
    setExpanded(false);
  }, [active]);

  // Listen to the official player's events.
  useEffect(() => {
    if (!active) return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== TIKTOK_ORIGIN || e.source !== iframeRef.current?.contentWindow) return;
      let data = e.data;
      if (typeof data === "string") { try { data = JSON.parse(data); } catch { return; } }
      if (!data || data["x-tiktok-player"] !== true) return;
      switch (data.type) {
        case "onPlayerReady":
          setReady(true);
          send(useVideoStore.getState().isGlobalMuted ? "mute" : "unMute");
          send("play");
          break;
        case "onStateChange": {
          const v = Number(data.value);
          if (v === 1) { setState("playing"); setNeedsNativeTap(false); }
          else if (v === 2) setState("paused");
          else if (v === 3) setState("buffering");
          else if (v === 0) send("play"); // loop
          break;
        }
        case "onCurrentTime": {
          const { currentTime, duration } = (data.value || {}) as { currentTime?: number; duration?: number };
          if (progressRef.current && duration) progressRef.current.style.transform = `scaleX(${Math.min(1, (currentTime || 0) / duration)})`;
          break;
        }
        case "onError":
          setState("error");
          break;
      }
    };
    window.addEventListener("message", onMessage);
    // Autoplay didn't start in time (some iOS versions block it in embeds).
    const t = setTimeout(() => setNeedsNativeTap(true), 4500);
    return () => { window.removeEventListener("message", onMessage); clearTimeout(t); };
  }, [active, send]);

  useEffect(() => { if (state === "playing") setNeedsNativeTap(false); }, [state]);
  useEffect(() => { if (active && ready) send(muted ? "mute" : "unMute"); }, [muted, active, ready, send]);

  const onFirstTap = useCallback(() => {
    const st = useVideoStore.getState();
    if (!st.isGlobalMuted || st.soundUnlocked) return false;
    send("unMute"); // inside the tap, so the browser allows sound
    st.setGlobalMuted(false);
    st.setSoundUnlocked(true);
    return true;
  }, [send]);

  const onTap = useTapGesture({
    onSingle: () => {
      if (state === "playing" || state === "buffering") { send("pause"); setState("paused"); }
      else { send("play"); }
    },
    onFirstTap,
  });

  const handle = video.author_handle ? `@${video.author_handle}` : video.author_name || "TikTok creator";
  const tiktokUrl = video.url;

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: video.title || "Christian TikTok on SOOZ", url: tiktokUrl });
      else { await navigator.clipboard.writeText(tiktokUrl); toast.success("Link copied"); }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") { await navigator.clipboard.writeText(tiktokUrl).catch(() => {}); toast.success("Link copied"); }
    }
  };

  const showThumb = !(active && state === "playing");
  const portraitThumb = !!video.thumbnail_width && !!video.thumbnail_height && video.thumbnail_height / video.thumbnail_width >= 1.3;

  return (
    <div className="reel-frame">
      <div className="reel-media">
        {/* Thumbnail while the player loads (and for slides that aren't playing) */}
        {showThumb && (
          <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(245,158,11,0.18),transparent_60%),linear-gradient(170deg,#0b1020,#05070d)]">
            {video.thumbnail_url && !thumbFailed ? (
              <>
                <img src={video.thumbnail_url} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl" referrerPolicy="no-referrer" />
                <img
                  src={video.thumbnail_url}
                  alt=""
                  className={cn("absolute inset-0 h-full w-full", portraitThumb ? "object-cover" : "object-contain")}
                  referrerPolicy="no-referrer"
                  decoding="async"
                  onError={() => { setThumbFailed(true); requestTikTokRefresh(video.id); }}
                />
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pb-40 text-white/70">
                <TikTokMark className="h-10 w-10" />
                <span className="text-sm font-semibold">{handle}</span>
              </div>
            )}
          </div>
        )}

        {active && (
          <iframe
            ref={iframeRef}
            key={video.tiktok_id}
            src={tiktokPlayerUrl(video.tiktok_id)}
            title={video.title || `TikTok by ${handle}`}
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            className={cn(
              "absolute inset-0 h-full w-full border-0 bg-transparent transition-opacity duration-300",
              ready || needsNativeTap ? "opacity-100" : "opacity-0",
              needsNativeTap && state !== "playing" ? "pointer-events-auto z-[5]" : "pointer-events-none"
            )}
          />
        )}

        {/* SOOZ gesture layer: swipe to scroll, tap to pause, first tap for sound */}
        {!(needsNativeTap && state !== "playing") && <div className="absolute inset-0 z-[6]" onClick={onTap} aria-hidden />}

        {active && !ready && !needsNativeTap && state !== "error" && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"><Spinner /></div>
        )}
        {active && state === "paused" && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-black/35 backdrop-blur-sm animate-scale-in">
              <Play className="ml-1 h-10 w-10 fill-white/90 text-white/90" />
            </div>
          </div>
        )}
        {active && state === "error" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/70 px-8 text-center text-white">
            <p className="font-semibold">This TikTok can't be played here right now.</p>
            <a href={tiktokUrl} target="_blank" rel="noopener noreferrer" className="rounded-full bg-white px-4 py-2 text-sm font-bold text-black">Watch on TikTok</a>
            <p className="text-xs text-white/60">Swipe up for the next video</p>
          </div>
        )}

        <div className="reel-scrim-top pointer-events-none z-[7]" aria-hidden />
        <div className="reel-scrim-bottom pointer-events-none z-[7]" aria-hidden />

        <div className="reel-caption z-[8]">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white backdrop-blur-md">
            <TikTokMark className="h-3.5 w-3.5" /> Christian TikTok
          </div>
          <a href={video.author_url || tiktokUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="block truncate text-[16px] font-bold text-white hover:underline">
            {handle}
          </a>
          {video.title && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
              className={cn("mt-1.5 block w-full text-left text-[14.5px] leading-snug text-white/95", expanded ? "max-h-[40vh] overflow-y-auto hide-scrollbar" : "line-clamp-2")}
            >
              <RichCaption text={video.title} mentionsAreSooz={false} />
            </button>
          )}
          <div className="mt-2.5 flex max-w-[75%] items-center gap-1.5 overflow-hidden text-[13px] text-white/85">
            <Music2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Original sound · {video.author_name || handle}</span>
          </div>
        </div>

        {active && (
          <div className="reel-progress pointer-events-none absolute inset-x-0 z-[8] flex h-6 items-end">
            <div className="relative h-[3px] w-full overflow-hidden rounded-full bg-white/20">
              <div ref={progressRef} className="absolute inset-0 origin-left rounded-full bg-white/90" style={{ transform: "scaleX(0)" }} />
            </div>
          </div>
        )}
      </div>

      <div className="reel-rail">
        <a
          href={video.author_url || tiktokUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${handle} on TikTok`}
          className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-neutral-800 to-black text-lg font-bold text-white ring-2 ring-white"
        >
          {(video.author_name || video.author_handle || "T")[0].toUpperCase()}
        </a>
        <RailButton ariaLabel="Share" onClick={share} label="Share" icon={<ShareArrow className={cn(railIconClass, "text-white/95")} />} />
        <RailButton
          ariaLabel="Open on TikTok"
          onClick={() => window.open(tiktokUrl, "_blank", "noopener,noreferrer")}
          label="TikTok"
          icon={<ExternalLink className={cn(railIconClass, "h-[30px] w-[30px] text-white/95")} strokeWidth={2} />}
        />
      </div>
    </div>
  );
});
