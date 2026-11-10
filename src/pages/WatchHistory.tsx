import { useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, History, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { clearWatchHistory, watchHistory } from "@/lib/taste";
import { ReelsViewer } from "@/components/reels/ReelsViewer";
import { TextTile, TikTokTile } from "@/components/reels/GridTiles";
import { postItem, tiktokItem, type FeedItem } from "@/services/api/feed";
import { fetchPostsByIds } from "@/services/api/posts";
import { tiktoksById } from "@/services/api/profileTabs";
import { isHiddenLocally } from "@/services/api/safety";

const dayLabel = (at: number) => {
  const d = new Date(at); const today = new Date(); const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", ...(d.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}) });
};

/** Everything you've watched in SOOZ (videos and posts), newest first, like TikTok's watch history. */
async function loadHistory(viewerId?: string): Promise<{ item: FeedItem; at: number }[]> {
  const entries = watchHistory(500).filter((e) => !isHiddenLocally(e.kind, e.id));
  const postIds = entries.filter((e) => e.kind === "post").map((e) => e.id);
  const ttEntries = entries.filter((e) => e.kind === "tiktok");
  const [posts, videos] = await Promise.all([
    postIds.length ? fetchPostsByIds(postIds, viewerId).catch(() => []) : Promise.resolve([]),
    tiktoksById(ttEntries.map((e) => ({ id: e.id }))),
  ]);
  const postById = new Map(posts.map((p) => [p.id, p]));
  const videoById = new Map(videos.map((v) => [v.tiktok_id, v]));
  const out: { item: FeedItem; at: number }[] = [];
  for (const e of entries) {
    if (e.kind === "post") { const p = postById.get(e.id); if (p) out.push({ item: postItem(p), at: e.at }); }
    else { const v = videoById.get(e.id); if (v) out.push({ item: tiktokItem(v), at: e.at }); }
  }
  return out;
}

export default function WatchHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [version, setVersion] = useState(0);
  const q = useQuery({ queryKey: ["watch-history", user?.id ?? null, version], queryFn: () => loadHistory(user?.id), staleTime: 30_000 });
  const rows = useMemo(() => q.data ?? [], [q.data]);
  const items = useMemo(() => rows.map((r) => r.item), [rows]);
  const groups = useMemo(() => {
    const g: { label: string; start: number; rows: typeof rows }[] = [];
    rows.forEach((r, i) => {
      const label = dayLabel(r.at);
      if (!g.length || g[g.length - 1].label !== label) g.push({ label, start: i, rows: [] });
      g[g.length - 1].rows.push(r);
    });
    return g;
  }, [rows]);

  // The full-screen player (?watch=N), so the phone's back gesture closes it.
  const watchParam = searchParams.get("watch");
  const watching = watchParam !== null && /^\d+$/.test(watchParam) ? Number(watchParam) : null;
  const open = (i: number) => setSearchParams((p) => { p.set("watch", String(i)); return p; }, { state: { soozViewer: true } });
  const close = () => {
    if ((location.state as { soozViewer?: boolean } | null)?.soozViewer) navigate(-1);
    else setSearchParams((p) => { p.delete("watch"); return p; }, { replace: true });
  };
  const clear = () => {
    if (!confirm("Clear your watch history? For You will still remember what you've seen, so it won't repeat videos.")) return;
    clearWatchHistory();
    setVersion((v) => v + 1);
    toast("Watch history cleared");
  };

  return (
    <div className="min-h-screen bg-background pb-[calc(var(--bottom-nav-height)+2rem)] text-foreground">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/20 bg-background/90 px-3 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] backdrop-blur-xl">
        <button type="button" aria-label="Back" onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-secondary"><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="flex-1 font-display text-xl font-bold">Watch history</h1>
        {rows.length > 0 && (
          <button type="button" onClick={clear} className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold text-muted-foreground active:bg-secondary">
            <Trash2 className="h-4 w-4" /> Clear
          </button>
        )}
      </div>

      {q.isLoading ? (
        <div className="mt-4 grid grid-cols-3 gap-1 px-1">
          {[...Array(9)].map((_, i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-lg bg-secondary/40" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="py-28 text-center">
          <History className="mx-auto mb-4 h-12 w-12 text-muted-foreground/25" />
          <h3 className="text-lg font-bold">Nothing here yet</h3>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">Videos and posts you watch show up here, so you can always find them again.</p>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.label + g.start}>
            <h2 className="px-4 pb-2 pt-5 text-[13px] font-bold uppercase tracking-wider text-muted-foreground">{g.label}</h2>
            <div className="grid grid-cols-3 gap-1 px-1">
              {g.rows.map((r, j) => {
                const i = g.start + j;
                const it = r.item;
                const post = it.kind === "post" ? it.post : null;
                return (
                  <button
                    key={it.key}
                    type="button"
                    onClick={() => open(i)}
                    aria-label={it.kind === "tiktok" ? `TikTok by ${it.video.author_name || it.video.author_handle || "a creator"}` : post?.caption || "Post"}
                    className={cn("relative block aspect-[3/4] overflow-hidden rounded-lg bg-secondary/30 text-left")}
                  >
                    {it.kind === "tiktok" ? (
                      <TikTokTile video={it.video} />
                    ) : post!.media_type === "video" ? (
                      post!.thumbnail_url ? <img src={post!.thumbnail_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                        : <video src={`${post!.media_url}#t=0.1`} preload="metadata" muted playsInline className="absolute inset-0 h-full w-full object-cover" />
                    ) : post!.media_url ? (
                      <img src={post!.media_url} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <TextTile text={post!.caption || ""} />
                    )}
                    {(it.kind === "tiktok" || post?.media_type === "video") && <Play className="absolute right-1.5 top-1.5 z-10 h-4 w-4 fill-white/20 text-white drop-shadow-md" />}
                  </button>
                );
              })}
            </div>
          </section>
        ))
      )}

      {watching !== null && items.length > 0 && (
        <ReelsViewer items={items} startIndex={watching} title="Watch history" onClose={close} />
      )}
    </div>
  );
}
