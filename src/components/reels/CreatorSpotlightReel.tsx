import { lazy, memo, Suspense, useState } from "react";
import { ChevronUp, ExternalLink, Play } from "lucide-react";
import type { ChristianCreator } from "@/data/christianTikTokStarter";

// The drawer (and TikTok's player) only loads when someone opens it.
const CreatorProfileDrawer = lazy(() => import("@/components/tiktok/ChristianCreators").then((m) => ({ default: m.CreatorProfileDrawer })));

const GLOW: Record<ChristianCreator["kind"], string> = {
  Worship: "rgba(245,158,11,0.38)",
  Gospel: "rgba(244,63,94,0.32)",
  Preaching: "rgba(99,102,241,0.38)",
  Scripture: "rgba(20,184,166,0.34)",
};

/** Full-screen "Christian creator" card in the feed: tap to watch that creator's TikToks inside SOOZ. */
export const CreatorSpotlightReel = memo(function CreatorSpotlightReel({ creator }: { creator: ChristianCreator }) {
  const [open, setOpen] = useState(false);
  const initial = creator.name.replace(/^Pastor /, "")[0];

  return (
    <div className="reel-frame">
      <div
        className="reel-media flex flex-col items-center justify-center px-8 pb-[calc(var(--bottom-nav-height)+48px)] pt-16 text-center text-white md:pb-16"
        style={{ background: `radial-gradient(120% 70% at 50% 18%, ${GLOW[creator.kind]}, transparent 62%), linear-gradient(180deg, #0d0b08 0%, #050403 60%, #000 100%)` }}
      >
        <span className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 text-5xl font-bold shadow-[0_20px_60px_-15px_rgba(245,158,11,0.6)] ring-4 ring-white/15">
          {initial}
        </span>
        <h2 className="mt-5 font-display text-[30px] font-bold leading-tight">{creator.name}</h2>
        <p className="mt-1 text-[15px] text-white/60">@{creator.handle}</p>
        <span className="mt-3 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-200 backdrop-blur">
          Christian creator · {creator.kind}
        </span>
        <p className="mt-4 max-w-xs text-[15px] text-white/80">Watch {creator.name}'s TikToks right here in SOOZ.</p>

        <div className="mt-7 flex w-full max-w-xs flex-col gap-2.5">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(true); }}
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-primary font-bold text-primary-foreground shadow-lg shadow-primary/30 active:scale-[0.98]"
          >
            <Play className="h-4 w-4 fill-current" /> Watch their videos
          </button>
          <a
            href={`https://www.tiktok.com/@${creator.handle}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-white/10 font-semibold backdrop-blur active:scale-[0.98]"
          >
            <ExternalLink className="h-4 w-4" /> Open on TikTok
          </a>
        </div>

        <div className="creator-swipe-hint pointer-events-none absolute inset-x-0 flex flex-col items-center gap-0.5 text-[12px] font-semibold text-white/50">
          <ChevronUp className="h-4 w-4 animate-bounce" /> Swipe up to keep scrolling
        </div>
      </div>

      {open && (
        <Suspense fallback={null}>
          <CreatorProfileDrawer creator={creator} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </div>
  );
});
