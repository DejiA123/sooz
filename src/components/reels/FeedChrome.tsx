import { lazy, Suspense, useEffect } from "react";
import { Link } from "react-router-dom";
import { Menu, Plus, Search, Volume2, VolumeX, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVideoStore } from "@/store/useVideoStore";
import { AppMenuSheet } from "@/components/layout/AppMenuSheet";
import { ActivityBell } from "@/components/layout/ActivityBell";
import { StoryRail } from "@/components/feed/StoryRail";

// hls.js is ~500 KB — only download the live player when someone actually opens the stream.
const LivePostCard = lazy(() => import("@/components/feed/LivePostCard").then((m) => ({ default: m.LivePostCard })));

export type FeedTab = "following" | "foryou";

const iconBtn =
  "flex h-10 w-10 items-center justify-center rounded-full text-white transition-transform active:scale-90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]";

export const FeedTopBar = ({
  tab,
  onTabChange,
  isLive,
  onOpenLive,
  storiesOpen,
  onToggleStories,
}: {
  tab: FeedTab;
  onTabChange: (t: FeedTab) => void;
  isLive: boolean;
  onOpenLive: () => void;
  storiesOpen: boolean;
  onToggleStories: () => void;
}) => (
  <header className="feed-topbar pointer-events-none absolute inset-x-0 top-0 z-40">
    <div className="pointer-events-auto mx-auto flex h-14 max-w-[640px] items-center justify-between px-2">
      <div className="flex w-[92px] items-center gap-0.5">
        <AppMenuSheet trigger={<button type="button" aria-label="Menu" className={iconBtn}><Menu className="h-6 w-6" /></button>} />
        {isLive ? (
          <button type="button" onClick={onOpenLive} aria-label="Watch live" className="flex h-7 items-center gap-1.5 rounded-md bg-gradient-to-r from-[#ff2d55] to-[#ff5e3a] px-2 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-lg shadow-[#ff2d55]/30 active:scale-95">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Live
          </button>
        ) : (
          <button type="button" onClick={onToggleStories} aria-label={storiesOpen ? "Hide stories" : "Show stories"} aria-expanded={storiesOpen} className={iconBtn}>
            <span className="story-ring-active flex h-[26px] w-[26px] items-center justify-center rounded-full p-[2px]">
              <span className="flex h-full w-full items-center justify-center rounded-full bg-black">
                {storiesOpen ? <X className="h-3.5 w-3.5" strokeWidth={3} /> : <Plus className="h-3.5 w-3.5" strokeWidth={3} />}
              </span>
            </span>
          </button>
        )}
      </div>

      <div role="tablist" aria-label="Feed" className="flex items-center gap-6">
        {([
          ["following", "Following"],
          ["foryou", "For You"],
        ] as const).map(([key, label]) => {
          const selected = tab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => (selected ? window.dispatchEvent(new CustomEvent("sooz:feed-top")) : onTabChange(key))}
              className={cn(
                "relative py-2 text-[17px] font-bold tracking-tight transition-colors [text-shadow:0_1px_4px_rgba(0,0,0,0.5)]",
                selected ? "text-white" : "text-white/60 hover:text-white/80"
              )}
            >
              {label}
              <span className={cn("absolute -bottom-0.5 left-1/2 h-[3px] -translate-x-1/2 rounded-full bg-white transition-all duration-300", selected ? "w-7 opacity-100" : "w-0 opacity-0")} />
            </button>
          );
        })}
      </div>

      <div className="flex w-[92px] items-center justify-end gap-0.5">
        <Link to="/discover" aria-label="Search" className={iconBtn}><Search className="h-[22px] w-[22px]" strokeWidth={2.2} /></Link>
        <ActivityBell className="text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]" />
      </div>
    </div>
  </header>
);

/** Small sound button. First tap anywhere already turns sound on; this toggles it afterwards. */
export const SoundToggle = () => {
  const muted = useVideoStore((s) => s.isGlobalMuted);
  const unlocked = useVideoStore((s) => s.soundUnlocked);

  const toggle = () => {
    const st = useVideoStore.getState();
    const next = !st.isGlobalMuted;
    // Apply inside the tap itself — browsers only allow sound from a user gesture.
    document.querySelectorAll<HTMLVideoElement>(".reels-scroller video").forEach((v) => { v.muted = next; });
    document.querySelectorAll<HTMLIFrameElement>(".reels-scroller iframe").forEach((f) =>
      f.contentWindow?.postMessage({ type: next ? "mute" : "unMute", "x-tiktok-player": true }, "https://www.tiktok.com")
    );
    st.setGlobalMuted(next);
    st.setSoundUnlocked(true);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={muted ? "Turn sound on" : "Mute"}
      className={cn(
        "feed-sound-toggle absolute right-3 z-40 flex h-9 items-center gap-1.5 rounded-full bg-black/35 px-2.5 text-white backdrop-blur-md transition-all active:scale-95",
        muted && !unlocked ? "pr-3.5" : "w-9 justify-center px-0"
      )}
    >
      {muted ? <VolumeX className="h-[18px] w-[18px]" /> : <Volume2 className="h-[18px] w-[18px]" />}
      {muted && !unlocked && <span className="text-[12px] font-semibold">Tap for sound</span>}
    </button>
  );
};

export const StoriesPanel = ({ onClose }: { onClose: () => void }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <>
      <div className="absolute inset-0 z-[35] bg-black/30" onClick={onClose} aria-hidden />
      <div className="feed-stories absolute inset-x-0 z-[36] mx-auto max-w-[640px] px-2 animate-in fade-in slide-in-from-top-2 duration-200">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0b0d14]/90 text-white shadow-2xl backdrop-blur-2xl [&_.story-rail-glass]:border-0 [&_.story-rail-glass]:bg-transparent [&_.story-rail-glass]:shadow-none [&>div>div]:mb-0">
          <StoryRail />
        </div>
      </div>
    </>
  );
};

export const LiveViewer = ({ onClose }: { onClose: () => void }) => (
  <div className="fixed inset-0 z-[60] flex flex-col bg-black/95 backdrop-blur-xl" role="dialog" aria-label="Live stream">
    <div className="flex items-center justify-between px-4 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top,0px))]">
      <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[#ff2d55]" /> Live now
      </span>
      <button type="button" onClick={onClose} aria-label="Close live stream" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white">
        <X className="h-5 w-5" />
      </button>
    </div>
    <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-2">
      <Suspense fallback={<div className="flex h-64 items-center justify-center"><div className="h-9 w-9 animate-spin rounded-full border-[3px] border-white/20 border-t-white" /></div>}>
        <LivePostCard />
      </Suspense>
    </div>
  </div>
);
