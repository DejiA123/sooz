import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Heart, Loader2, Play, Search, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useTilePress } from "@/hooks/useTilePress";
import { cn } from "@/lib/utils";
import { ReelsViewer } from "@/components/reels/ReelsViewer";
import { TextTile, TikTokTile } from "@/components/reels/GridTiles";
import { formatCount } from "@/components/reels/gestures";
import { TileOptions } from "@/components/profile/TileOptions";
import { VideoPlayerModal } from "@/components/videoArchive/VideoPlayerModal";
import { discoverTikToks, postItem, searchTikToks, tiktokItem, type FeedItem } from "@/services/api/feed";
import { searchPosts } from "@/services/api/posts";
import { searchPeople } from "@/services/api/chat";
import { fetchVideos, getYouTubeWatchUrl, type VideoItem } from "@/services/videoArchiveService";

const FOR_YOU = "For you";
const PAGE = 24;

/** A creator's initials bubble (TikTok gives no profile pictures here). */
const CreatorBubble = ({ name, handle }: { name: string; handle: string }) => {
  let hue = 32;
  for (const c of handle) hue = (hue * 31 + c.charCodeAt(0)) % 360;
  return (
    <span className="flex h-14 w-14 items-center justify-center rounded-full text-[20px] font-bold text-white ring-2 ring-white/10" style={{ background: `linear-gradient(150deg, hsl(${hue} 45% 38%), hsl(${(hue + 40) % 360} 50% 18%))` }}>
      {name.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 1).toUpperCase() || "?"}
    </span>
  );
};

/**
 * Discover, like TikTok's: search Christian TikToks, creators, people on SOOZ and church videos; topic
 * chips; and a grid of TikToks from creators this viewer hasn't got to know yet. Tap to watch full
 * screen, long-press to share / copy / report.
 */
export default function Discover() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(() => params.get("q") ?? "");
  const [term, setTerm] = useState(q.trim());
  const [chip, setChip] = useState(FOR_YOU);
  const [count, setCount] = useState(PAGE);
  const [optionsFor, setOptionsFor] = useState<number | null>(null);
  const [archiveOpen, setArchiveOpen] = useState<VideoItem | null>(null);

  // Search as they type (a short pause), kept in the address so Back returns to the same results.
  useEffect(() => {
    const t = setTimeout(() => {
      setTerm(q.trim());
      setParams((p) => { if (q.trim()) p.set("q", q.trim()); else p.delete("q"); return p; }, { replace: true });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  useEffect(() => { setCount(PAGE); }, [term, chip]);

  const data = useQuery({ queryKey: ["discover"], queryFn: discoverTikToks, staleTime: 5 * 60_000 });
  const archive = useQuery({ queryKey: ["discover-archive", term], queryFn: () => fetchVideos(undefined, term || undefined), staleTime: 5 * 60_000 });
  const people = useQuery({ queryKey: ["discover-people", term], queryFn: () => searchPeople(term.replace(/^@/, ""), user?.id), enabled: !term.startsWith("#") && term.replace(/^@/, "").length >= 2, staleTime: 60_000 });
  const posts = useQuery({ queryKey: ["discover-posts", term, user?.id], queryFn: () => searchPosts(term, user?.id), enabled: term.length >= 2, staleTime: 60_000 });

  const kinds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const k of Object.values(data.data?.kinds ?? {})) counts.set(k, (counts.get(k) ?? 0) + 1);
    return [FOR_YOU, ...[...counts.entries()].filter(([k]) => k !== "Creators").sort((a, b) => b[1] - a[1]).map(([k]) => k)];
  }, [data.data]);

  const search = useMemo(() => (data.data && term ? searchTikToks(data.data, term) : null), [data.data, term]);

  const items: FeedItem[] = useMemo(() => {
    if (!data.data) return [];
    if (term && search?.creator) return search.videos.map((v) => tiktokItem(v)); // a creator's page
    if (term) return [...(posts.data ?? []).filter((p) => p.media_url || p.caption).map(postItem), ...(search?.videos ?? []).map((v) => tiktokItem(v))];
    const vids = chip === FOR_YOU ? data.data.videos : data.data.videos.filter((v) => data.data!.kinds[v.author_handle?.toLowerCase() ?? ""] === chip);
    return vids.map((v) => tiktokItem(v));
  }, [data.data, term, chip, posts.data, search]);
  const shown = items.slice(0, count);

  // More as they scroll.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) setCount((c) => (c < items.length ? c + PAGE : c)); }, { rootMargin: "800px" });
    io.observe(el);
    return () => io.disconnect();
  }, [items.length]);

  // The full-screen player (?watch=N, so the phone's back gesture closes it); it keeps the list it opened with.
  const watchParam = params.get("watch");
  const watching = watchParam !== null && /^\d+$/.test(watchParam) ? Number(watchParam) : null;
  const [viewerItems, setViewerItems] = useState<FeedItem[] | null>(null);
  useEffect(() => {
    if (watching === null) { setViewerItems(null); return; }
    setViewerItems((v) => (v && v.length ? v : items.length ? items : null));
  }, [watching, items]);
  const openViewer = (index: number) => setParams((p) => { p.set("watch", String(index)); return p; }, { state: { soozViewer: true } });
  const closeViewer = () => {
    if ((location.state as { soozViewer?: boolean } | null)?.soozViewer) navigate(-1);
    else setParams((p) => { p.delete("watch"); return p; }, { replace: true });
  };
  const press = useTilePress(openViewer, setOptionsFor);

  const download = (video: VideoItem) => {
    if (video.r2_video_url) window.open(video.r2_video_url, "_blank", "noopener");
    else window.open(getYouTubeWatchUrl(video.youtube_id), "_blank", "noopener");
  };

  const archiveList = (archive.data ?? []).slice(0, 20);
  const showArchive = archiveList.length > 0 && (term ? true : chip === FOR_YOU || chip === "Our church");
  const searching = !!term;
  const loadingGrid = data.isLoading || (searching && posts.isLoading);

  return (
    <div className="pb-24">
      {/* Search + topics */}
      <div className="sticky top-[calc(3.75rem+env(safe-area-inset-top,0px))] z-30 bg-background/90 px-4 pb-2 pt-2 backdrop-blur-xl md:top-0">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search videos, creators, #hashtags"
            enterKeyHint="search"
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            className="h-11 w-full rounded-full bg-secondary/70 pl-11 pr-10 text-[16px] outline-none placeholder:text-muted-foreground"
            aria-label="Search"
          />
          {q && (
            <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground active:bg-white/10">
              <X className="h-[18px] w-[18px]" />
            </button>
          )}
        </div>
        {!searching && (
          <div className="-mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4 pb-0.5 hide-scrollbar">
            {kinds.map((k) => (
              <button key={k} type="button" onClick={() => setChip(k)} aria-pressed={chip === k}
                className={cn("shrink-0 rounded-full px-4 py-1.5 text-[14px] font-semibold transition-colors", chip === k ? "bg-foreground text-background" : "bg-secondary text-muted-foreground")}>
                {k}
              </button>
            ))}
          </div>
        )}
      </div>

      {!searching && chip === FOR_YOU && !!data.data?.tags.length && (
        <div className="-mt-0.5 flex gap-2 overflow-x-auto px-4 pb-2 pt-1 hide-scrollbar">
          {data.data.tags.map((t) => (
            <button key={t} type="button" onClick={() => setQ(`#${t}`)} className="shrink-0 rounded-full border border-border/40 px-3 py-1 text-[13px] font-medium text-amber-300/90 active:bg-white/5">#{t}</button>
          ))}
        </div>
      )}

      {/* A creator's page */}
      {search?.creator && search.creators[0] && (
        <section className="flex items-center gap-3 px-4 pb-3 pt-2">
          <CreatorBubble name={search.creators[0].name} handle={search.creator} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-bold">{search.creators[0].name}</p>
            <p className="truncate text-[13px] text-muted-foreground">@{search.creator}{search.creators[0].kind ? ` · ${search.creators[0].kind}` : ""} · {search.creators[0].videos} videos</p>
          </div>
          <a href={`https://www.tiktok.com/@${search.creator}`} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-full bg-secondary px-3.5 py-2 text-[13px] font-semibold active:scale-95">Open TikTok</a>
        </section>
      )}

      {/* Search: accounts */}
      {searching && !search?.creator && (!!people.data?.length || !!search?.creators.length) && (
        <section className="px-4 pt-2">
          <h2 className="mb-2 text-[13px] font-bold uppercase tracking-wider text-muted-foreground">Accounts</h2>
          <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-3 hide-scrollbar">
            {(people.data ?? []).map((p) => (
              <Link key={p.id} to={`/profile/${p.username}`} className="flex w-[76px] shrink-0 flex-col items-center gap-1.5 text-center">
                <Avatar className="h-14 w-14 ring-2 ring-amber-400/40"><AvatarImage src={p.avatar || ""} className="object-cover" /><AvatarFallback>{p.name[0]?.toUpperCase()}</AvatarFallback></Avatar>
                <span className="w-full truncate text-[12.5px] font-semibold">{p.name}</span>
                <span className="-mt-1 w-full truncate text-[11px] text-muted-foreground">On SOOZ</span>
              </Link>
            ))}
            {(search?.creators ?? []).map((c) => (
              <button key={c.handle} type="button" onClick={() => setQ(`@${c.handle}`)} className="flex w-[76px] shrink-0 flex-col items-center gap-1.5 text-center">
                <CreatorBubble name={c.name} handle={c.handle} />
                <span className="w-full truncate text-[12.5px] font-semibold">{c.name}</span>
                <span className="-mt-1 w-full truncate text-[11px] text-muted-foreground">{c.videos} video{c.videos === 1 ? "" : "s"}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Church videos (The Power House's archive) */}
      {showArchive && (
        <section className="pt-2">
          <h2 className="mb-2 px-4 text-[13px] font-bold uppercase tracking-wider text-muted-foreground">Church videos</h2>
          <div className="flex gap-2.5 overflow-x-auto px-4 pb-3 hide-scrollbar">
            {archiveList.map((v) => (
              <button key={v.id} type="button" onClick={() => setArchiveOpen(v)} className="relative aspect-[9/14] w-[124px] shrink-0 overflow-hidden rounded-xl bg-secondary text-left">
                <img src={v.thumbnail_url || `https://img.youtube.com/vi/${v.youtube_id}/hqdefault.jpg`} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                <Play className="absolute right-2 top-2 h-4 w-4 fill-white/30 text-white drop-shadow" />
                <span className="absolute inset-x-2 bottom-2 line-clamp-3 text-[11.5px] font-semibold leading-tight text-white">{v.title}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* The grid */}
      {searching && <h2 className="mb-2 px-4 pt-2 text-[13px] font-bold uppercase tracking-wider text-muted-foreground">Videos</h2>}
      {loadingGrid ? (
        <div className="grid grid-cols-2 gap-1.5 px-1.5">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-secondary/50" />)}
        </div>
      ) : shown.length === 0 ? (
        <div className="px-8 py-16 text-center">
          <Search className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 font-semibold">{searching ? `Nothing found for “${term}”` : "Nothing here yet"}</p>
          {searching && <p className="mt-1 text-sm text-muted-foreground">Try a creator's name, a song, or a word like “worship”.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1.5 px-1.5">
          {shown.map((item, i) => {
            const post = item.kind === "post" ? item.post : null;
            const likes = post?.likes_count;
            return (
              <button
                key={item.key}
                type="button"
                {...press(i)}
                aria-label={item.kind === "tiktok" ? `TikTok by ${item.video.author_name || item.video.author_handle || "a creator"}` : post?.caption || "Post"}
                className="profile-tile relative block aspect-[3/4] w-full select-none overflow-hidden rounded-xl bg-secondary/40 text-left"
              >
                {item.kind === "tiktok" ? <TikTokTile video={item.video} showLikes />
                  : post!.thumbnail_url || post!.media_type === "image" ? <img src={post!.thumbnail_url || post!.media_url || ""} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                  : <TextTile text={post!.caption || ""} />}
                {(item.kind === "tiktok" || post?.media_type === "video") && <Play className="absolute right-2 top-2 z-10 h-4 w-4 fill-white/20 text-white drop-shadow-md" />}
                {post && !!likes && (
                  <span className="absolute right-2 bottom-2 z-10 flex items-center gap-1 text-[12px] font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                    <Heart className="h-3.5 w-3.5 fill-white" /> {formatCount(likes)}
                  </span>
                )}
                {post && <span className="absolute left-2 top-2 z-10 rounded-full bg-black/55 px-2 py-0.5 text-[10.5px] font-bold text-amber-300">SOOZ</span>}
              </button>
            );
          })}
        </div>
      )}
      {count < items.length && (
        <div ref={sentinel} className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      )}

      {watching !== null && viewerItems && viewerItems.length > 0 && (
        <ReelsViewer items={viewerItems} startIndex={watching} title={searching ? `“${term}”` : chip === FOR_YOU ? "Discover" : chip} onClose={closeViewer} />
      )}
      {optionsFor !== null && items[optionsFor] && (
        <TileOptions key={items[optionsFor].key} item={items[optionsFor]} tab="posts" onClose={() => setOptionsFor(null)} onWatch={() => openViewer(optionsFor)} />
      )}
      {archiveOpen && <VideoPlayerModal video={archiveOpen} onClose={() => setArchiveOpen(null)} onDownload={download} />}
    </div>
  );
}
