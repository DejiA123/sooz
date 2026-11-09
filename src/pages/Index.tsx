import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
import { Compass, PlayCircle, RefreshCw, Users } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { useLiveStatus } from "@/hooks/useLiveStatus";
import { fetchFollowingPage, fetchForYouPage, FIRST_CURSOR, hasTikTokToOpen, openTikTokFirst, readCachedFeed, writeCachedFeed, type FeedCursor, type FeedPage } from "@/services/api/feed";
import { ReelsFeed } from "@/components/reels/ReelsFeed";
import { FeedTopBar, LiveViewer, SoundToggle, StoriesPanel, type FeedTab } from "@/components/reels/FeedChrome";
import { SuggestedAccounts } from "@/components/home/SuggestedAccounts";

// A shared SOOZ link (/?tiktok=ID&by=handle) opens that TikTok first — read it before the feed loads.
if (typeof window !== "undefined") {
  const q = new URLSearchParams(window.location.search);
  const id = q.get("tiktok");
  if (id && /^\d{5,25}$/.test(id)) {
    openTikTokFirst(id, q.get("by") ?? undefined);
    try { sessionStorage.setItem("sooz-feed-tab", "foryou"); } catch { /* private mode */ }
    window.history.replaceState(null, "", window.location.pathname);
  }
}

// Remember where the viewer was in each tab while they visit other pages.
const savedIndex: Record<FeedTab, number> = { foryou: 0, following: 0 };
const TAB_KEY = "sooz-feed-tab";

const FeedSkeleton = () => (
  <div className="reel-frame" aria-busy="true" aria-label="Loading feed">
    <div className="reel-media bg-[radial-gradient(120%_70%_at_50%_0%,rgba(245,158,11,0.10),transparent_60%),linear-gradient(180deg,#0d0b08,#000)]">
      <div className="reel-caption space-y-2.5">
        <div className="h-4 w-36 animate-pulse rounded-full bg-white/10" />
        <div className="h-3.5 w-64 max-w-full animate-pulse rounded-full bg-white/[0.07]" />
        <div className="h-3.5 w-48 animate-pulse rounded-full bg-white/[0.07]" />
      </div>
    </div>
    <div className="reel-rail reel-dock">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className={`animate-pulse rounded-full bg-white/10 ${i === 0 ? "mb-3 h-12 w-12" : "h-10 w-10"}`} />
      ))}
    </div>
  </div>
);

const Centered = ({ children }: { children: React.ReactNode }) => (
  <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(120%_70%_at_50%_0%,rgba(245,158,11,0.12),transparent_60%),linear-gradient(180deg,#0d0b08,#000)] px-6 pb-[var(--bottom-nav-height)] pt-16 text-center text-white md:pb-0">
    <div className="w-full max-w-sm">{children}</div>
  </div>
);

const EndSlide = ({ onTop }: { onTop: () => void }) => (
  <Centered>
    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-3xl">🕊️</div>
    <h2 className="font-display text-2xl font-bold">You're all caught up</h2>
    <p className="mx-auto mt-4 max-w-xs font-serif text-[17px] italic leading-relaxed text-white/80">
      “Your word is a lamp to my feet and a light to my path.”
    </p>
    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-200/70">Psalm 119:105</p>
    <div className="mt-8 flex flex-col gap-2.5">
      <Link to="/archive" className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 font-bold text-primary-foreground active:scale-[0.98]">
        <PlayCircle className="h-5 w-5" /> Watch sermons
      </Link>
      <div className="flex gap-2.5">
        <Link to="/discover" className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white/10 px-4 py-3 font-semibold active:scale-[0.98]">
          <Compass className="h-4 w-4" /> Discover
        </Link>
        <button type="button" onClick={onTop} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white/10 px-4 py-3 font-semibold active:scale-[0.98]">
          <RefreshCw className="h-4 w-4" /> Back to top
        </button>
      </div>
    </div>
  </Centered>
);

export default function Index() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isLive = useLiveStatus();
  const [tab, setTab] = useState<FeedTab>(() => {
    try { return sessionStorage.getItem(TAB_KEY) === "following" ? "following" : "foryou"; } catch { return "foryou"; }
  });
  const [storiesOpen, setStoriesOpen] = useState(false);
  const [liveOpen, setLiveOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => savedIndex[tab]);

  const changeTab = (t: FeedTab) => {
    setTab(t);
    try { sessionStorage.setItem(TAB_KEY, t); } catch { /* private mode */ }
  };

  // ── For You: SOOZ posts + Christian TikToks. Shows the last copy instantly, then refreshes. ──
  const forYou = useInfiniteQuery<FeedPage, Error, InfiniteData<FeedPage>, (string | null)[], FeedCursor>({
    queryKey: ["feed", "foryou", user?.id ?? null],
    queryFn: ({ pageParam }) => fetchForYouPage({ pageParam, userId: user?.id }),
    initialPageParam: FIRST_CURSOR,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: () => {
      if (hasTikTokToOpen()) return undefined; // a shared TikTok goes first: don't flash the saved screen
      const cached = readCachedFeed("foryou");
      return cached ? { pages: [cached], pageParams: [FIRST_CURSOR] } : undefined;
    },
    enabled: !authLoading,
    staleTime: 1000 * 60 * 2,
  });

  const savedFirst = useRef(false);
  useEffect(() => {
    const first = forYou.data?.pages[0];
    if (first && !forYou.isPlaceholderData && !savedFirst.current) { savedFirst.current = true; writeCachedFeed("foryou", first); }
  }, [forYou.data, forYou.isPlaceholderData]);

  const following = useInfiniteQuery<FeedPage, Error, InfiniteData<FeedPage>, (string | null)[], FeedCursor>({
    queryKey: ["feed", "following", user?.id ?? null],
    queryFn: ({ pageParam }) => fetchFollowingPage({ pageParam, userId: user!.id }),
    initialPageParam: FIRST_CURSOR,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!user && tab === "following",
    staleTime: 1000 * 60 * 2,
  });

  const q = tab === "foryou" ? forYou : following;
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const loadMore = useCallback(() => { if (!q.isPlaceholderData) q.fetchNextPage(); }, [q]);
  const onIndexChange = useCallback((i: number) => { savedIndex[tab] = i; setActiveIndex(i); }, [tab]);
  const activeKind = items[Math.min(activeIndex, Math.max(items.length - 1, 0))]?.kind;

  // Leaving the app: keep the videos after this one for next time, so it opens on something new.
  const upcoming = useRef({ items, activeIndex, tab });
  upcoming.current = { items, activeIndex, tab };
  useEffect(() => {
    const onHide = () => {
      const u = upcoming.current;
      if (document.visibilityState !== "hidden" || u.tab !== "foryou" || u.items.length <= u.activeIndex + 1) return;
      writeCachedFeed("foryou", { items: u.items, nextCursor: null }, u.activeIndex + 1);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);
  const toTop = () => window.dispatchEvent(new CustomEvent("sooz:feed-top"));

  // Stop the page behind the feed from scrolling/bouncing on iOS.
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.body.style.overscrollBehavior;
    document.body.style.overscrollBehavior = "none";
    return () => { document.body.style.overscrollBehavior = prev; };
  }, []);

  let body: React.ReactNode;
  if (tab === "following" && !authLoading && !user) {
    body = (
      <Centered>
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-white/10"><Users className="h-8 w-8" /></div>
        <h2 className="font-display text-2xl font-bold">Your people, in one place</h2>
        <p className="mt-2 text-white/70">Sign in to see posts from the believers you follow.</p>
        <button type="button" onClick={() => navigate("/auth")} className="mt-6 w-full rounded-full bg-primary py-3 font-bold text-primary-foreground">Sign in</button>
      </Centered>
    );
  } else if (items.length) {
    body = (
      <ReelsFeed
        key={tab}
        items={items}
        hasMore={!!q.hasNextPage}
        loadingMore={q.isFetchingNextPage}
        loadMore={loadMore}
        initialIndex={Math.min(savedIndex[tab], Math.max(items.length - 1, 0))}
        onIndexChange={onIndexChange}
        endSlide={<EndSlide onTop={toTop} />}
      />
    );
  } else if (q.isPending || q.isFetching || authLoading) {
    body = <section className="reel-slide"><FeedSkeleton /></section>;
  } else if (q.isError) {
    body = (
      <Centered>
        <h2 className="font-display text-xl font-bold">Couldn't load the feed</h2>
        <p className="mt-2 text-white/70">Check your connection and try again.</p>
        <button type="button" onClick={() => q.refetch()} className="mt-6 w-full rounded-full bg-white/10 py-3 font-semibold">Try again</button>
      </Centered>
    );
  } else if (tab === "following" && q.data?.pages[0]?.followsNobody) {
    body = (
      <div className="h-full overflow-y-auto bg-[linear-gradient(180deg,#0d0b08,#000)] px-4 pb-[calc(var(--bottom-nav-height)+16px)] pt-20 text-white md:pb-8">
        <div className="mx-auto max-w-md">
          <h2 className="text-center font-display text-2xl font-bold">Follow believers you love</h2>
          <p className="mt-2 text-center text-white/70">Their posts will show up here first.</p>
          <div className="dark mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-2"><SuggestedAccounts /></div>
          <button type="button" onClick={() => changeTab("foryou")} className="mt-4 w-full rounded-full bg-white/10 py-3 font-semibold">Browse For You</button>
        </div>
      </div>
    );
  } else {
    body = (
      <Centered>
        <h2 className="font-display text-xl font-bold">{tab === "following" ? "No posts from people you follow yet" : "No posts yet"}</h2>
        <p className="mt-2 text-white/70">Be the first to share something that encourages someone today.</p>
        <button type="button" onClick={() => changeTab("foryou")} className="mt-6 w-full rounded-full bg-white/10 py-3 font-semibold">Go to For You</button>
      </Centered>
    );
  }

  return (
    <div ref={rootRef} className="feed-page relative h-full w-full overflow-hidden bg-black text-white">
      <Helmet>
        <title>SOOZ — Sound Out Of Zion</title>
      </Helmet>

      {body}

      <FeedTopBar
        tab={tab}
        onTabChange={(t) => { changeTab(t); setStoriesOpen(false); setActiveIndex(savedIndex[t]); }}
        isLive={isLive}
        onOpenLive={() => setLiveOpen(true)}
        storiesOpen={storiesOpen}
        onToggleStories={() => setStoriesOpen((v) => !v)}
      />
      {items.length > 0 && !storiesOpen && activeKind === "post" && <SoundToggle />}
      {storiesOpen && user && <StoriesPanel onClose={() => setStoriesOpen(false)} />}
      {storiesOpen && !user && (
        <StoriesPanelSignIn onClose={() => setStoriesOpen(false)} onSignIn={() => navigate("/auth")} />
      )}
      {liveOpen && <LiveViewer onClose={() => setLiveOpen(false)} />}
    </div>
  );
}

const StoriesPanelSignIn = ({ onClose, onSignIn }: { onClose: () => void; onSignIn: () => void }) => (
  <>
    <div className="absolute inset-0 z-[35] bg-black/30" onClick={onClose} aria-hidden />
    <div className="feed-stories absolute inset-x-0 z-[36] mx-auto max-w-[640px] px-2">
      <div className="flex items-center justify-between gap-3 rounded-3xl border border-white/10 bg-black/60 p-4 text-white backdrop-blur-2xl">
        <span className="text-sm text-white/80">Sign in to see and share stories.</span>
        <button type="button" onClick={onSignIn} className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Sign in</button>
      </div>
    </div>
  </>
);
