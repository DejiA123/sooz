import { memo, useEffect, useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { requestTikTokRefresh, tiktokPlayerUrl, type TikTokVideo } from "@/services/api/tiktok";
import { Spinner } from "./gestures";

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
 * A Christian TikTok in the feed, played by TikTok's own embed player. The player gets the screen
 * between SOOZ's top bar and tab bar and receives taps directly, so TikTok's play, sound and like
 * buttons all work (iPhone only allows sound when the player itself is tapped). A strip along the
 * bottom always offers "Next", whatever the player does with swipes.
 */
export const TikTokReel = memo(function TikTokReel({ video, active }: TikTokReelProps) {
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);

  // Only the slide on screen holds a player, so nothing keeps playing after you scroll away.
  useEffect(() => {
    if (active) return;
    setLoaded(false);
    setSlow(false);
  }, [active]);

  useEffect(() => {
    if (!active || loaded) return;
    const t = setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(t);
  }, [active, loaded]);

  const handle = video.author_handle ? `@${video.author_handle}` : null;
  const who = video.author_name || handle || "Christian TikTok";
  const tiktokUrl = video.url;

  return (
    <div className="reel-frame">
      <div className="reel-media bg-[radial-gradient(120%_80%_at_50%_0%,rgba(245,158,11,0.16),transparent_60%),linear-gradient(170deg,#0b1020,#05070d)]">
        {video.thumbnail_url && !thumbFailed && (
          <img
            src={video.thumbnail_url}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-2xl"
            referrerPolicy="no-referrer"
            onError={() => { setThumbFailed(true); requestTikTokRefresh(video.id); }}
          />
        )}

        <div className="tiktok-stage">
          {/* Shown until TikTok's player has loaded (and for the slides next to this one) */}
          {!(active && loaded) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center text-white">
              {video.thumbnail_url && !thumbFailed ? (
                <img src={video.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-contain" referrerPolicy="no-referrer" />
              ) : (
                <>
                  <TikTokMark className="h-10 w-10 text-white/70" />
                  <p className="text-[15px] font-bold">{who}</p>
                  {video.title && <p className="line-clamp-3 max-w-xs text-[14px] text-white/70">{video.title}</p>}
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
              key={video.tiktok_id}
              src={tiktokPlayerUrl(video.tiktok_id)}
              title={video.title || `TikTok by ${who}`}
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={() => setLoaded(true)}
              className={cn("absolute inset-0 h-full w-full border-0 bg-transparent transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0")}
            />
          )}
        </div>

        {/* Bottom strip: who made it, and a guaranteed way to the next video */}
        <div className="tiktok-strip">
          <a
            href={video.author_url || tiktokUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-0 flex-1 items-center gap-2 text-white"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
              <TikTokMark className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-bold">{who}</span>
              <span className="block truncate text-[11px] font-semibold uppercase tracking-wider text-amber-200/80">Christian TikTok</span>
            </span>
          </a>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("sooz:feed-next"))}
            className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-white/12 px-3.5 text-[13px] font-bold text-white backdrop-blur active:scale-95"
            style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
          >
            Next <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
});
