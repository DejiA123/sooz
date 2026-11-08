import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { CHRISTIAN_CREATORS, type ChristianCreator } from "@/data/christianTikTokStarter";

/**
 * A creator's live TikTok profile through TikTok's official creator embed
 * (blockquote.tiktok-embed[data-embed-type=creator] + embed.js). It always shows their newest
 * videos, so a whole Christian account stays up to date without anyone pasting links.
 */
const TikTokCreatorProfile = ({ handle }: { handle: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    setState("loading");
    // embed.js turns every .tiktok-embed on the page into TikTok's player when it runs, so load it fresh each time.
    const script = document.createElement("script");
    script.src = "https://www.tiktok.com/embed.js";
    script.async = true;
    box.appendChild(script);
    const observer = new MutationObserver(() => { if (box.querySelector("iframe")) setState("ready"); });
    observer.observe(box, { childList: true, subtree: true });
    const timeout = setTimeout(() => setState((s) => (s === "ready" ? s : "failed")), 10000);
    return () => { observer.disconnect(); clearTimeout(timeout); script.remove(); };
  }, [handle]);

  return (
    <div className="relative min-h-[420px]">
      {state === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
      )}
      {state === "failed" && (
        <p className="absolute inset-x-0 top-24 text-center text-sm text-muted-foreground">TikTok didn't load here — open the profile on TikTok instead.</p>
      )}
      <div ref={ref} key={handle} className="flex justify-center [&_iframe]:!max-w-full">
        <blockquote
          className="tiktok-embed"
          cite={`https://www.tiktok.com/@${handle}`}
          data-unique-id={handle}
          data-embed-type="creator"
          style={{ maxWidth: 780, minWidth: 288, margin: 0 }}
        >
          <section>
            <a target="_blank" rel="noopener noreferrer" href={`https://www.tiktok.com/@${handle}?refer=creator_embed`}>@{handle}</a>
          </section>
        </blockquote>
      </div>
    </div>
  );
};

export const ChristianCreators = () => {
  const [open, setOpen] = useState<ChristianCreator | null>(null);

  return (
    <section className="mt-6">
      <div className="flex items-end justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Christian creators</h2>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">Always up to date</span>
      </div>
      <p className="mt-1 text-[13px] text-muted-foreground">Accounts that post Christian content. Tap one to watch their newest TikToks.</p>

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

      <Drawer open={!!open} onOpenChange={(o) => { if (!o) setOpen(null); }}>
        <DrawerContent className="max-h-[88vh]">
          {open && (
            <>
              <DrawerHeader className="text-left">
                <DrawerTitle>{open.name}</DrawerTitle>
                <DrawerDescription>@{open.handle} · {open.kind} · newest videos from TikTok</DrawerDescription>
              </DrawerHeader>
              <div className="overflow-y-auto px-4 pb-4">
                <TikTokCreatorProfile handle={open.handle} />
                <a
                  href={`https://www.tiktok.com/@${open.handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex items-center justify-center gap-2 rounded-full bg-secondary py-3 text-sm font-semibold"
                >
                  <ExternalLink className="h-4 w-4" /> Open @{open.handle} on TikTok
                </a>
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </section>
  );
};
