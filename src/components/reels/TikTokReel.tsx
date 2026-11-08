import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { requestTikTokRefresh, tiktokPlayerUrl, type TikTokVideo } from "@/services/api/tiktok";
import { cachedTikTokMeta, loadTikTokMeta } from "@/services/api/tiktokMeta";
import { Spinner } from "./gestures";
import { RailButton, ShareArrow, railIconClass } from "./ReelRail";

const TIKTOK_ORIGIN = "https://www.tiktok.com";
/** Fill the screen (cropping a little, like TikTok) only when that hides at most this much of the video. */
const MAX_FILL_CROP = 0.2;
const clampRatio = (r: number) => Math.min(2, Math.max(0.45, r));

/** Small TikTok-style note mark for attribution. */
export const TikTokMark = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M16.6 2h-3.4v13.3a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V9a6.4 6.4 0 1 0 5.4 6.3V8.6a8 8 0 0 0 4.6 1.5V6.7a4.7 4.7 0 0 1-4.6-4.7z" />
  </svg>
);

interface TikTokReelProps {
  video: TikTokVideo;
  active: boolean;
  /** On screen or next to it: look up the video's shape ahead of time. */
  near?: boolean;
}

/**
 * A Christian TikTok in the feed, played by TikTok's own embed player and filling the screen like
 * the TikTok app: from the top of the screen (under the transparent For You tabs) down to the tab
 * bar. Portrait videos are zoomed to fill (a sliver is trimmed, as TikTok does); square and
 * landscape videos sit full-width on black. Either way the player box has exactly the video's
 * shape, so TikTok never pads it with a blurred copy. The player receives taps directly, so TikTok's
 * play and sound buttons work (iPhone only allows sound when the player itself is tapped). Videos
 * start muted by themselves (`autoplay=1&muted=1` + "play" message); when the phone refuses (Low
 * Power Mode) a "Tap to play" cue shows. SOOZ's caption and action rail sit on top, like TikTok.
 */
export const TikTokReel = memo(function TikTokReel({ video, active, near = false }: TikTokReelProps) {
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [blockedHint, setBlockedHint] = useState(false);
  // The video's real shape (square and landscape TikToks exist), so the box matches it exactly.
  const [meta, setMeta] = useState(() => cachedTikTokMeta(video.tiktok_id));
  useEffect(() => {
    if (!(near || active) || meta?.ratio) return;
    let alive = true;
    loadTikTokMeta(video.tiktok_id, video.url).then((m) => { if (alive && (m.ratio || m.thumbnail)) setMeta(m); });
    return () => { alive = false; };
  }, [near, active, meta?.ratio, video.tiktok_id, video.url]);
  // The cover image's own size is another way to learn the shape when TikTok's lookup is blocked.
  const [thumbRatio, setThumbRatio] = useState<number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageAR, setStageAR] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => { if (el.clientWidth && el.clientHeight) setStageAR(el.clientWidth / el.clientHeight); };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
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

  // TikToks are 9:16 unless TikTok (or the cover image) says otherwise.
  const dbRatio = video.thumbnail_width && video.thumbnail_height ? video.thumbnail_width / video.thumbnail_height : null;
  const ratio = clampRatio(meta?.ratio ?? dbRatio ?? thumbRatio ?? 9 / 16);
  // Fill the screen when the video is close to the screen's shape; otherwise show it whole on black.
  const sar = stageAR ?? 390 / 738;
  const fill = 1 - Math.min(sar / ratio, ratio / sar) <= MAX_FILL_CROP;
  const thumbnail = video.thumbnail_url || meta?.thumbnail || null;
  const handle = video.author_handle ? `@${video.author_handle}` : null;
  const who = video.author_name || handle || "Christian TikTok";
  const tiktokUrl = video.url;
  const profileUrl = video.author_url || (video.author_handle ? `${TIKTOK_ORIGIN}/@${video.author_handle}` : tiktokUrl);

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: "SOOZ", text: video.title?.slice(0, 120) || `${who} on TikTok`, url: tiktokUrl });
      else { await navigator.clipboard.writeText(tiktokUrl); toast.success("Link copied"); }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") { await navigator.clipboard.writeText(tiktokUrl).catch(() => {}); toast.success("Link copied"); }
    }
  };

  return (
    <div className="reel-frame">
      <div className="reel-media bg-black">
        <div ref={stageRef} className="tiktok-stage">
          <div className={cn("tiktok-player", fill && "tiktok-player--fill")} style={{ ["--ar" as string]: String(ratio) }}>
          {/* Until TikTok's player has loaded (and on the slides next to this one) */}
          {!(active && loaded) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black px-8 text-center text-white">
              {thumbnail && !thumbFailed ? (
                <img
                  src={thumbnail}
                  alt=""
                  className="absolute inset-0 h-full w-full object-contain"
                  referrerPolicy="no-referrer"
                  onLoad={(e) => {
                    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
                    if (w > 0 && h > 0) setThumbRatio(w / h);
                  }}
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
          </div>

          {/* Hints never block taps: they pass straight through to TikTok's buttons */}
          {active && blockedHint && !isPlaying && (
            <div className="pointer-events-none absolute inset-x-0 top-[62%] z-10 flex justify-center px-6">
              <span className="rounded-2xl bg-black/75 px-4 py-2.5 text-center text-[13px] font-semibold leading-snug text-white backdrop-blur">
                Tap ▶ to play
                <span className="block text-[11px] font-medium text-white/65">Low Power Mode stops videos from starting by themselves</span>
              </span>
            </div>
          )}
        </div>

        <div className="reel-scrim-top" aria-hidden />
        <div className="tiktok-scrim" aria-hidden />

        {/* Who made it, like TikTok's caption (kept above TikTok's own play / sound bar) */}
        <div className="reel-caption reel-caption--tiktok">
          <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="block truncate text-[16px] font-bold text-white hover:underline">
            {who}
          </a>
          {video.title && <p className="mt-1.5 line-clamp-2 text-[14.5px] leading-snug text-white/95">{video.title}</p>}
          <div className="mt-2 flex max-w-[80%] items-center gap-1.5 overflow-hidden text-[13px] text-white/80">
            <TikTokMark className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">TikTok{handle && handle !== who ? ` · ${handle}` : ""}</span>
          </div>
        </div>
      </div>

      {/* Right-hand actions */}
      <div className="reel-rail reel-rail--tiktok">
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${who} on TikTok`}
          className="relative mb-3 block h-12 w-12 rounded-full bg-gradient-to-br from-amber-400 to-amber-700 ring-2 ring-white"
        >
          <span className="flex h-full w-full items-center justify-center text-lg font-bold text-white">
            {(video.author_handle || who)[0]?.toUpperCase()}
          </span>
          <span className="absolute -bottom-2.5 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full bg-black text-white shadow-md ring-1 ring-white/30">
            <TikTokMark className="h-3.5 w-3.5" />
          </span>
        </a>
        <RailButton ariaLabel="Share" onClick={share} label="Share" icon={<ShareArrow className={cn(railIconClass, "text-white/95")} />} />
        <RailButton
          ariaLabel="Open in TikTok"
          onClick={() => window.open(tiktokUrl, "_blank", "noopener,noreferrer")}
          label="TikTok"
          icon={<TikTokMark className={cn(railIconClass, "text-white/95")} />}
        />
      </div>
    </div>
  );
});
