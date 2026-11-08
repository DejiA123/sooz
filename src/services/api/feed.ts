import { fetchFollowingPosts, fetchPostsRange, POSTS_PER_PAGE, type FeedPost } from "./posts";
import { fetchApprovedTikToks, starterTikToks, type TikTokVideo } from "./tiktok";
import { isDeadTikTok } from "./tiktokMeta";

export type FeedItem =
  | { kind: "post"; key: string; post: FeedPost }
  | { kind: "tiktok"; key: string; video: TikTokVideo };

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
const tiktokItem = (video: TikTokVideo): FeedItem => ({ kind: "tiktok", key: `t:${video.tiktok_id}`, video });

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

/** All Christian TikToks (curator-approved + built-in starter videos, no duplicates), in random order. */
let tiktokPool: Promise<TikTokVideo[]> | null = null;
function getTikTokPool(): Promise<TikTokVideo[]> {
  if (!tiktokPool) {
    tiktokPool = (async () => {
      const videos = enrich((await fetchApprovedTikToks(0, 300)).videos);
      const inDb = new Set(videos.map((v) => v.tiktok_id));
      const all = [...videos, ...starterTikToks().filter((v) => !inDb.has(v.tiktok_id))];
      return shuffle(all.filter((v) => !isDeadTikTok(v.tiktok_id)));
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
  if (pageParam.page === 0) { tiktokPool = null; postPool = null; } // new load, new shuffle
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
  const tiktoks = ttPool.slice(pageParam.tiktokOffset, pageParam.tiktokOffset + wanted);

  // Mix them: TikToks land at random spots, roughly one per two posts.
  const items: FeedItem[] = posts.map(postItem);
  for (const v of tiktoks) {
    const at = Math.floor(Math.random() * (items.length + 1));
    items.splice(at, 0, tiktokItem(v));
  }

  // Keep the video the app opened on (shown instantly from the device) in first place, so the
  // screen doesn't change under the viewer when the fresh shuffle arrives.
  if (pageParam.page === 0) {
    const pinned = readCachedFeed("foryou")?.items[0]?.key;
    const i = pinned ? items.findIndex((it) => it.key === pinned) : -1;
    if (i > 0) items.unshift(...items.splice(i, 1));
  }

  const nextTiktokOffset = pageParam.tiktokOffset + tiktoks.length;
  const moreTiktoks = nextTiktokOffset < ttPool.length;
  return {
    items,
    nextCursor: morePosts || moreTiktoks
      ? { postOffset: off + posts.length, tiktokOffset: nextTiktokOffset, page: pageParam.page + 1 }
      : null,
  };
}

export async function fetchFollowingPage({ pageParam = FIRST_CURSOR, userId }: { pageParam?: FeedCursor; userId: string }): Promise<FeedPage> {
  const page = await fetchFollowingPosts({ pageParam: pageParam.page, userId });
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
