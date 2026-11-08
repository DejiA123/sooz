import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { CHRISTIAN_CREATORS, type ChristianCreator } from "@/data/christianTikTokStarter";
import { starterTikToks, tiktokPlayerUrl } from "@/services/api/tiktok";

const creatorVideos = (handle: string) => starterTikToks().filter((v) => v.author_handle === handle);

/**
 * Plays a creator's videos right inside SOOZ with TikTok's official player, with their other videos
 * listed underneath. (TikTok's profile widget doesn't load inside the app on iPhone, so we use the player.)
 */
const CreatorVideos = ({ handle }: { handle: string }) => {
  const videos = useMemo(() => creatorVideos(handle), [handle]);
  const [current, setCurrent] = useState(0);
  useEffect(() => setCurrent(0), [handle]);

  if (!videos.length) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Their videos open on TikTok.</p>;
  }
  const video = videos[Math.min(current, videos.length - 1)];

  return (
    <div>
      <div className="relative mx-auto aspect-[9/16] max-h-[58vh] w-full max-w-[330px] overflow-hidden rounded-2xl bg-black">
        <iframe
          key={video.tiktok_id}
          src={tiktokPlayerUrl(video.tiktok_id)}
          title={video.title || `TikTok by @${handle}`}
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
      {videos.length > 1 && (
        <div className="mt-4 space-y-2">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">More from @{handle}</p>
          {videos.map((v, i) => (
            <button
              key={v.tiktok_id}
              type="button"
              onClick={() => setCurrent(i)}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border p-3 text-left text-[13px] transition",
                i === current ? "border-primary bg-primary/10" : "border-border/60 bg-card"
              )}
            >
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", i === current ? "bg-primary text-primary-foreground" : "bg-secondary")}>
                <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
              </span>
              <span className="line-clamp-2">{v.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/** Bottom sheet with a creator's videos. */
export const CreatorProfileDrawer = ({ creator, onClose }: { creator: ChristianCreator | null; onClose: () => void }) => (
  <Drawer open={!!creator} onOpenChange={(o) => { if (!o) onClose(); }}>
    <DrawerContent className="max-h-[92vh]">
      {creator && (
        <>
          <DrawerHeader className="text-left">
            <DrawerTitle>{creator.name}</DrawerTitle>
            <DrawerDescription>@{creator.handle} · {creator.kind} · tap the video to play, use its 🔊 button for sound</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
            <CreatorVideos handle={creator.handle} />
            <a
              href={`https://www.tiktok.com/@${creator.handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center justify-center gap-2 rounded-full bg-secondary py-3 text-sm font-semibold"
            >
              <ExternalLink className="h-4 w-4" /> See all of @{creator.handle} on TikTok
            </a>
          </div>
        </>
      )}
    </DrawerContent>
  </Drawer>
);

export const ChristianCreators = () => {
  const [open, setOpen] = useState<ChristianCreator | null>(null);

  return (
    <section className="mt-6">
      <div className="flex items-end justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Christian creators</h2>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">Watch in SOOZ</span>
      </div>
      <p className="mt-1 text-[13px] text-muted-foreground">Accounts that post Christian content. Tap one to watch their videos right here.</p>

      <div className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-2 hide-scrollbar">
        {CHRISTIAN_CREATORS.map((c) => (
          <button
            key={c.handle}
            type="button"
            onClick={() => setOpen(c)}
            className="w-[108px] shrink-0 rounded-2xl border border-border/60 bg-card p-3 text-center transition active:scale-95"
          >
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 text-xl font-bold text-white ring-2 ring-primary/30">
              {c.name.replace(/^Pastor /, "")[0]}
            </span>
            <span className="mt-2 block truncate text-[13px] font-bold">{c.name}</span>
            <span className="block truncate text-[11px] text-muted-foreground">@{c.handle}</span>
            <span className="mt-1.5 inline-block rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">{c.kind}</span>
          </button>
        ))}
      </div>

      <CreatorProfileDrawer creator={open} onClose={() => setOpen(null)} />
    </section>
  );
};
