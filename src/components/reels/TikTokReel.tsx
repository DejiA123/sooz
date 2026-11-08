import { memo, useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { requestTikTokRefresh, tiktokPlayerUrl, type TikTokVideo } from "@/services/api/tiktok";
import { Spinner } from "./gestures";

const TIKTOK_ORIGIN = "https://www.tiktok.com";

/** Small TikTok-style note mark for attribution. */
export const TikTokMark = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M16.6 2h-3.4v13.3a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V9a6.4 6.4 0 1 0 5.4 6.3V8.6a8 8 0 0 0 4.6 1.5V6.7a4.7 4.7 0 0 1-4.6-4.7z" />
  </svg>
);

interface TikTokReelProps {
  video: TikTokVideo;
  active: boolean;
}

/**
 * A Christian TikTok in the feed, played by TikTok's own embed player on pure black, like TikTok.
 * The player box has exactly the video's shape, so TikTok never pads the sides with a blurred copy.
 * The player gets as much of the screen as possible between SOOZ's top bar and tab bar and receives
 * taps directly, so TikTok's play, sound and like buttons all work (iPhone only allows sound when the
 * player itself is tapped). Videos start muted by themselves (`autoplay=1&muted=1` + "play" message);
 * when the phone refuses (Low Power Mode) a "Tap to play" cue shows. A slim bar offers "Next".
 */
export const TikTokReel = memo(function TikTokReel({ video, active }: TikTokReelProps) {
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [blockedHint, setBlockedHint] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playing = useRef(false);
  const userPaused = useRef(false);

  // Commands for TikTok's embed player, in the exact shape Mux's tiktok-video-element sends them.
  const send = useCallback((type: string, value?: unknown) => {
    const w = iframeRef.current?.contentWindow;
    if (!w) return;
    w.postMessage({ "x-tiktok-player": true, type, ...(value !== undefined ? { value } : {}) }, "*");
  }, []);

  // Autoplay: phones only let videos start by themselves when muted, so start muted.
  const kick = useCallback(() => {
    if (playing.current || userPaused.current) return;
    send("mute");
    send("play");
  }, [send]);

  // Only the slide on screen holds a player, so nothing keeps playing after you scroll away.
  useEffect(() => {
    if (active) return;
    setLoaded(false);
    setSlow(false);
    setIsPlaying(false);
    setBlockedHint(false);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    playing.current = false;
    userPaused.current = false;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== TIKTOK_ORIGIN || e.source !== iframeRef.current?.contentWindow) return;
      let data = e.data;
      if (typeof data === "string") { try { data = JSON.parse(data); } catch { return; } }
      if (!data || typeof data !== "object" || typeof data.type !== "string") return;
      if (data.type === "onPlayerReady") kick();
      if (data.type === "onStateChange") {
        const state = Number(data.value); // -1 init, 0 ended, 1 playing, 2 paused, 3 buffering
        if (state === 1) { playing.current = true; setIsPlaying(true); setBlockedHint(false); }
        else if (state === 2 && playing.current) userPaused.current = true; // they paused it — leave it
        else if (state === 0) send("play"); // loop
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [active, kick, send]);

  // Keep nudging for a few seconds after it loads, until TikTok reports it is playing.
  useEffect(() => {
    if (!active || !loaded) return;
    const timers = [150, 600, 1200, 2000, 3200, 5000, 8000].map((ms) => setTimeout(kick, ms));
    // Still not playing: the phone is refusing autoplay (usually Low Power Mode) — say "tap to play".
    const blocked = setTimeout(() => { if (!playing.current && !userPaused.current) setBlockedHint(true); }, 3500);
    return () => { timers.forEach(clearTimeout); clearTimeout(blocked); };
  }, [active, loaded, kick]);

  useEffect(() => {
    if (!active || loaded) return;
    const t = setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(t);
  }, [active, loaded]);

  // TikToks are 9:16 unless TikTok told us otherwise (thumbnail size).
  const ratio = video.thumbnail_width && video.thumbnail_height ? `${video.thumbnail_width} / ${video.thumbnail_height}` : "9 / 16";
  const handle = video.author_handle ? `@${video.author_handle}` : null;
  const who = video.author_name || handle || "Christian TikTok";
  const tiktokUrl = video.url;

  return (
    <div className="reel-frame">
      <div className="reel-media bg-black">
        <div className="tiktok-stage">
          <div className="tiktok-player" style={{ aspectRatio: ratio }}>
          {/* Until TikTok's player has loaded (and on the slides next to this one) */}
          {!(active && loaded) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black px-8 text-center text-white">
              {video.thumbnail_url && !thumbFailed ? (
                <img
                  src={video.thumbnail_url}
                  alt=""
                  className="absolute inset-0 h-full w-full object-contain"
                  referrerPolicy="no-referrer"
                  onError={() => { setThumbFailed(true); requestTikTokRefresh(video.id); }}
                />
              ) : (
                <>
                  <TikTokMark className="h-9 w-9 text-white/40" />
                  <p className="text-[15px] font-bold text-white/85">{who}</p>
                  {video.title && <p className="line-clamp-3 max-w-xs text-[14px] text-white/55">{video.title}</p>}
                </>
              )}
              {active && !slow && <Spinner className="relative mt-4" />}
              {active && slow && (
                <a href={tiktokUrl} target="_blank" rel="noopener noreferrer" className="relative mt-4 flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black">
                  <ExternalLink className="h-4 w-4" /> Watch on TikTok
                </a>
              )}
            </div>
          )}

          {active && (
            <iframe
              ref={iframeRef}
              key={video.tiktok_id}
              src={tiktokPlayerUrl(video.tiktok_id)}
              title={video.title || `TikTok by ${who}`}
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={() => setLoaded(true)}
              className={cn("absolute inset-0 h-full w-full border-0 bg-black transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0")}
            />
          )}

          {/* Hints never block taps: they pass straight through to TikTok's buttons */}
          </div>

          {active && blockedHint && !isPlaying && (
            <div className="pointer-events-none absolute inset-x-0 top-[62%] z-10 flex justify-center px-6">
              <span className="rounded-2xl bg-black/75 px-4 py-2.5 text-center text-[13px] font-semibold leading-snug text-white backdrop-blur">
                Tap ▶ to play
                <span className="block text-[11px] font-medium text-white/65">Low Power Mode stops videos from starting by themselves</span>
              </span>
            </div>
          )}
        </div>

        {/* Slim bar: a guaranteed way to the next video (TikTok's player already shows the creator) */}
        <div className="tiktok-strip">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("sooz:feed-next"))}
            className="flex h-8 items-center gap-1 rounded-full px-4 text-[13px] font-semibold text-white/80 active:scale-95"
          >
            Next video <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
});
