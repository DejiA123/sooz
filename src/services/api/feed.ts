import { fetchFollowingIds, fetchFollowingPosts, fetchPostsByIds, fetchPostsRange, POSTS_PER_PAGE, type FeedPost } from "./posts";
import { fetchFollowingReposts, type FollowingRepost } from "./reposts";
import { fetchApprovedTikToks, starterTikToks, type TikTokVideo } from "./tiktok";
import { isDeadTikTok } from "./tiktokMeta";

export type FeedItem =
  | { kind: "post"; key: string; post: FeedPost; repostedBy?: string }
  | { kind: "tiktok"; key: string; video: TikTokVideo; repostedBy?: string };

/** Where the next page of a feed continues from. */
export interface FeedCursor {
  postOffset: number;
  tiktokOffset: number;
  page: number;
}

export const FIRST_CURSOR: FeedCursor = { postOffset: 0, tiktokOffset: 0, page: 0 };

export interface FeedPage {
  items: FeedItem[];
  nextCursor: FeedCursor | null;
  followsNobody?: boolean;
}

/** One Christian TikTok after every this many SOOZ posts… */
const POSTS_BETWEEN_TIKTOKS = 2;
/** …and once SOOZ posts run out, this many TikToks per page keep the feed going. */
const TIKTOKS_WHEN_NO_POSTS = 10;
/** The newest posts are dealt out in a fresh random order every time the feed loads. */
const SHUFFLED_POSTS = 60;

const postItem = (post: FeedPost): FeedItem => ({ kind: "post", key: `p:${post.id}`, post });
const tiktokItem = (video: TikTokVideo, cycle = 0): FeedItem => ({ kind: "tiktok", key: cycle ? `t:${video.tiktok_id}~${cycle}` : `t:${video.tiktok_id}`, video });

// ── A shared link (/?tiktok=ID&by=handle) opens that TikTok first in For You ──
let openFirst: { id: string; handle?: string } | null = null;
export function openTikTokFirst(id: string, handle?: string) { openFirst = { id, handle }; }
export const hasTikTokToOpen = () => openFirst !== null;

export type Library = { creators: Record<string, string>; videos: [string, string, number, number, string][]; kinds?: Record<string, string>; updated?: string };
/** Refreshed every day on GitHub (scripts/refresh-christian-tiktoks.mjs), read live — no republishing needed. */
const LIVE_LIBRARY = "https://raw.githubusercontent.com/DejiA123/sooz/main/src/data/christianTikTokLibrary.json";
const LIBRARY_KEY = "sooz-tt-library";

async function fetchLiveLibrary(timeoutMs: number): Promise<Library | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(LIVE_LIBRARY, { signal: ctrl.signal, cache: "no-cache" });
    clearTimeout(t);
    const lib = res.ok ? ((await res.json()) as Library) : null;
    if (!lib || !Array.isArray(lib.videos) || !lib.videos.length || !lib.creators) return null;
    try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(lib)); } catch { /* full */ }
    return lib;
  } catch {
    return null;
  }
}

/** The newest library we can get without slowing the feed: this phone's copy (refreshed quietly for
 *  next time), else the live file, else the copy built into the app. */
export async function loadLibrary(): Promise<Library> {
  try {
    const saved = localStorage.getItem(LIBRARY_KEY);
    if (saved) { fetchLiveLibrary(10000); return JSON.parse(saved) as Library; }
  } catch { /* storage blocked */ }
  return (await fetchLiveLibrary(2500)) ?? ((await import("@/data/christianTikTokLibrary.json")).default as unknown as Library);
}

/** Hundreds of recent videos from trusted Christian creators (loaded on its own, so the app stays light). */
async function libraryTikToks(): Promise<TikTokVideo[]> {
  const lib = await loadLibrary();
  return lib.videos.map(([id, handle, w, h, caption]) => ({
    id: `lib-${id}`,
    tiktok_id: id,
    url: `https://www.tiktok.com/@${handle}/video/${id}`,
    author_name: lib.creators[handle] ?? null,
    author_handle: handle,
    author_url: `https://www.tiktok.com/@${handle}`,
    title: caption || null,
    thumbnail_url: null,
    thumbnail_width: w,
    thumbnail_height: h,
    faith_tags: [],
    created_at: "2026-11-08T00:00:00Z",
  }));
}

function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Some imported rows came back from TikTok without a creator or caption; fill those gaps from the
 * built-in starter list (same video ID) or from the link itself, so slides never say "TikTok creator".
 */
function enrich(rows: TikTokVideo[]): TikTokVideo[] {
  const starter = new Map(starterTikToks().map((v) => [v.tiktok_id, v]));
  return rows.map((v) => {
    const s = starter.get(v.tiktok_id);
    const fromUrl = v.url.match(/tiktok\.com\/@([^/]+)\/video\//)?.[1];
    const handle = v.author_handle || (fromUrl && fromUrl !== "_" ? fromUrl : null) || s?.author_handle || null;
    return {
      ...v,
      author_handle: handle,
      author_name: v.author_name || s?.author_name || null,
      author_url: v.author_url || (handle ? `https://www.tiktok.com/@${handle}` : null),
      title: v.title || s?.title || null,
      thumbnail_width: v.thumbnail_width || s?.thumbnail_width || null,
      thumbnail_height: v.thumbnail_height || s?.thumbnail_height || null,
      url: handle && v.url.includes("/@_/") ? `https://www.tiktok.com/@${handle}/video/${v.tiktok_id}` : v.url,
    };
  });
}

/** All Christian TikToks (curator-approved + built-in + the creator library, no duplicates), in random order. */
let tiktokPool: Promise<TikTokVideo[]> | null = null;
/**
 * Variety: deal the TikToks out one creator at a time (random creator order, random videos), so a
 * worship song, a sermon, a gospel clip, a Bible answer… follow each other instead of ten videos
 * from the same account in a row.
 */
function mixCreators(videos: TikTokVideo[]): TikTokVideo[] {
  const byCreator = new Map<string, TikTokVideo[]>();
  for (const v of shuffle(videos)) {
    const k = (v.author_handle || v.tiktok_id).toLowerCase();
    if (!byCreator.has(k)) byCreator.set(k, []);
    byCreator.get(k)!.push(v);
  }
  const queues = shuffle([...byCreator.values()]);
  const out: TikTokVideo[] = [];
  while (queues.length) {
    for (let i = 0; i < queues.length; ) {
      out.push(queues[i].shift()!);
      if (queues[i].length) i++; else queues.splice(i, 1);
    }
  }
  return out;
}

/** After the whole pool has been shown, it starts again in a new order — the feed never ends. */
const laterRounds = new Map<number, TikTokVideo[]>();
const round = (pool: TikTokVideo[], n: number) => {
  if (n === 0) return pool;
  if (!laterRounds.has(n)) laterRounds.set(n, mixCreators(pool));
  return laterRounds.get(n)!;
};
function getTikTokPool(): Promise<TikTokVideo[]> {
  if (!tiktokPool) {
    tiktokPool = (async () => {
      const [db, library] = await Promise.all([
        fetchApprovedTikToks(0, 300).then((r) => enrich(r.videos)).catch(() => [] as TikTokVideo[]),
        libraryTikToks().catch(() => [] as TikTokVideo[]),
      ]);
      const seen = new Set<string>();
      const all = [...db, ...starterTikToks(), ...library].filter((v) => !seen.has(v.tiktok_id) && !!seen.add(v.tiktok_id));
      return mixCreators(all.filter((v) => !isDeadTikTok(v.tiktok_id)));
    })().catch(() => shuffle(starterTikToks().filter((v) => !isDeadTikTok(v.tiktok_id))));
  }
  return tiktokPool;
}

/** The newest SOOZ posts, shuffled. (Older posts follow afterwards, newest first.) */
let postPool: Promise<{ posts: FeedPost[]; hasMore: boolean }> | null = null;
function getPostPool(userId?: string) {
  if (!postPool) {
    postPool = fetchPostsRange({ from: 0, count: SHUFFLED_POSTS, userId })
      .then((r) => ({ posts: shuffle(r.posts), hasMore: r.hasMore }))
      .catch((e) => { postPool = null; throw e; });
  }
  return postPool;
}

/** "For You": SOOZ posts and Christian TikToks, in a fresh random order every time it loads. */
export async function fetchForYouPage({ pageParam = FIRST_CURSOR, userId }: { pageParam?: FeedCursor; userId?: string }): Promise<FeedPage> {
  if (pageParam.page === 0) { tiktokPool = null; postPool = null; laterRounds.clear(); } // new load, new shuffle
  const [pool, ttPool] = await Promise.all([getPostPool(userId), getTikTokPool()]);

  let posts: FeedPost[] = [];
  let morePosts = false;
  const off = pageParam.postOffset;
  if (off < pool.posts.length) {
    posts = pool.posts.slice(off, off + POSTS_PER_PAGE);
    morePosts = off + posts.length < pool.posts.length || pool.hasMore;
  } else if (pool.hasMore) {
    const older = await fetchPostsRange({ from: off, count: POSTS_PER_PAGE, userId });
    posts = older.posts;
    morePosts = older.hasMore;
  }

  const wanted = posts.length >= POSTS_PER_PAGE
    ? Math.ceil(posts.length / POSTS_BETWEEN_TIKTOKS)
    : Math.max(Math.ceil(posts.length / POSTS_BETWEEN_TIKTOKS), TIKTOKS_WHEN_NO_POSTS);
  const tiktoks: { video: TikTokVideo; cycle: number }[] = [];
  for (let k = 0; ttPool.length && k < wanted; k++) {
    const at = pageParam.tiktokOffset + k;
    const cycle = Math.floor(at / ttPool.length);
    tiktoks.push({ video: round(ttPool, cycle)[at % ttPool.length], cycle });
  }

  // Mix them: TikToks land at random spots, roughly one per two posts.
  const items: FeedItem[] = posts.map(postItem);
  for (const { video, cycle } of tiktoks) {
    const at = Math.floor(Math.random() * (items.length + 1));
    items.splice(at, 0, tiktokItem(video, cycle));
  }

  // Keep the video the app opened on (shown instantly from the device) in first place, so the
  // screen doesn't change under the viewer when the fresh shuffle arrives.
  if (pageParam.page === 0 && openFirst) {
    const { id, handle } = openFirst;
    openFirst = null;
    const known = ttPool.find((v) => v.tiktok_id === id);
    const video: TikTokVideo = known ?? {
      id: `link-${id}`, tiktok_id: id, url: `https://www.tiktok.com/@${handle || "_"}/video/${id}`,
      author_name: null, author_handle: handle ?? null, author_url: handle ? `https://www.tiktok.com/@${handle}` : null,
      title: null, thumbnail_url: null, thumbnail_width: null, thumbnail_height: null, faith_tags: [], created_at: new Date().toISOString(),
    };
    const at = items.findIndex((it) => it.kind === "tiktok" && it.video.tiktok_id === id);
    if (at >= 0) items.splice(at, 1);
    items.unshift(tiktokItem(video));
  } else if (pageParam.page === 0) {
    const pinned = readCachedFeed("foryou")?.items[0]?.key;
    const i = pinned ? items.findIndex((it) => it.key === pinned) : -1;
    if (i > 0) items.unshift(...items.splice(i, 1));
  }

  const nextTiktokOffset = pageParam.tiktokOffset + tiktoks.length;
  const moreTiktoks = ttPool.length > 0; // TikToks go round again, so For You never runs out
  return {
    items,
    nextCursor: morePosts || moreTiktoks
      ? { postOffset: off + posts.length, tiktokOffset: nextTiktokOffset, page: pageParam.page + 1 }
      : null,
  };
}

const repostedVideo = (r: FollowingRepost): TikTokVideo => ({
  id: `repost-${r.tiktok_id}`, tiktok_id: r.tiktok_id!, url: r.tiktok?.url || `https://www.tiktok.com/@_/video/${r.tiktok_id}`,
  author_name: r.tiktok?.name ?? null, author_handle: r.tiktok?.handle ?? null,
  author_url: r.tiktok?.handle ? `https://www.tiktok.com/@${r.tiktok.handle}` : null, title: r.tiktok?.caption ?? null,
  thumbnail_url: null, thumbnail_width: r.tiktok?.w ?? null, thumbnail_height: r.tiktok?.h ?? null, faith_tags: [], created_at: r.created_at,
});

/** Reposts by people you follow, as feed items ("Name reposted"), newest first. */
async function followingRepostItems(userId: string, skipPostIds: Set<string>): Promise<{ item: FeedItem; at: string }[]> {
  const reposts = await fetchFollowingReposts(await fetchFollowingIds(userId), 40).catch(() => []);
  if (!reposts.length) return [];
  const postIds = [...new Set(reposts.map((r) => r.post_id).filter((id): id is string => !!id && !skipPostIds.has(id)))];
  const posts = new Map((await fetchPostsByIds(postIds, userId)).map((p) => [p.id, p]));
  const out: { item: FeedItem; at: string }[] = [];
  const seen = new Set<string>();
  for (const r of reposts) {
    const name = r.reposter?.display_name || r.reposter?.username || "Someone";
    const target = r.post_id ?? r.tiktok_id ?? "";
    if (seen.has(target)) continue;
    seen.add(target);
    if (r.post_id && posts.has(r.post_id)) out.push({ item: { ...postItem(posts.get(r.post_id)!), key: `rp:${r.post_id}`, repostedBy: name }, at: r.created_at });
    else if (r.tiktok_id) out.push({ item: { ...tiktokItem(repostedVideo(r)), key: `rt:${r.tiktok_id}`, repostedBy: name }, at: r.created_at });
  }
  return out;
}

export async function fetchFollowingPage({ pageParam = FIRST_CURSOR, userId }: { pageParam?: FeedCursor; userId: string }): Promise<FeedPage> {
  const page = await fetchFollowingPosts({ pageParam: pageParam.page, userId });
  if (pageParam.page === 0) {
    const reposts = await followingRepostItems(userId, new Set(page.posts.map((p) => p.id)));
    if (reposts.length) {
      const merged = [...page.posts.map((p) => ({ item: postItem(p), at: p.created_at })), ...reposts]
        .sort((a, b) => b.at.localeCompare(a.at)).map((x) => x.item);
      return { items: merged, nextCursor: page.nextPage !== null ? { ...pageParam, page: page.nextPage } : null };
    }
  }
  return {
    items: page.posts.map(postItem),
    nextCursor: page.nextPage !== null ? { ...pageParam, page: page.nextPage } : null,
    followsNobody: page.followsNobody,
  };
}

// ── Instant start: keep the first screenful of the feed on the device ──────────
const CACHE_PREFIX = "sooz-feed-v4:";

export function readCachedFeed(scope: string): FeedPage | undefined {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + scope);
    if (!raw) return undefined;
    const page = JSON.parse(raw) as FeedPage;
    return Array.isArray(page.items) && page.items.length ? page : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Saves a screenful for next time. It starts from the *second* item, so each launch opens on a
 * different video (and the fresh shuffle then keeps that one in first place).
 */
export function writeCachedFeed(scope: string, page: FeedPage) {
  try {
    const items = page.items.length > 1 ? page.items.slice(1, 13) : page.items;
    localStorage.setItem(CACHE_PREFIX + scope, JSON.stringify({ items, nextCursor: page.nextCursor }));
  } catch {
    /* storage full or blocked — the feed still works, just without the instant start */
  }
}
