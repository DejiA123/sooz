import { fetchFollowingPosts, fetchPosts, POSTS_PER_PAGE, type FeedPost } from "./posts";
import { fetchApprovedTikToks, starterTikToks, type TikTokVideo } from "./tiktok";
import { CHRISTIAN_CREATORS, type ChristianCreator } from "@/data/christianTikTokStarter";

export type FeedItem =
  | { kind: "post"; key: string; post: FeedPost }
  | { kind: "tiktok"; key: string; video: TikTokVideo }
  | { kind: "creator"; key: string; creator: ChristianCreator };

/** Where the next page of For You continues from. */
export interface FeedCursor {
  postPage: number;
  tiktokOffset: number;
  page: number;
}

export const FIRST_CURSOR: FeedCursor = { postPage: 0, tiktokOffset: 0, page: 0 };

export interface FeedPage {
  items: FeedItem[];
  nextCursor: FeedCursor | null;
  followsNobody?: boolean;
}

/** One Christian TikTok after every this many SOOZ posts… */
const POSTS_BETWEEN_TIKTOKS = 2;
/** …and once SOOZ posts run out, this many TikToks per page keep the feed going. */
const TIKTOKS_WHEN_NO_POSTS = 10;
/** A creator spotlight lands at about this position on each page. */
const SPOTLIGHT_POSITION = 6;

const postItem = (post: FeedPost): FeedItem => ({ kind: "post", key: `p:${post.id}`, post });
const tiktokItem = (video: TikTokVideo): FeedItem => ({ kind: "tiktok", key: `t:${video.tiktok_id}`, video });

// Same order all day (so scrolling back and forth is stable), fresh order tomorrow.
function dailyShuffle<T>(list: T[]): T[] {
  const day = new Date().toISOString().slice(0, 10);
  let seed = [...day].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * All Christian TikToks for For You: curator-approved ones from the database plus the built-in
 * starter videos (so the feed is never empty of them), without duplicates. Videos approved in the
 * last two days go first so new additions are seen right away.
 */
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
      url: handle && v.url.includes("/@_/") ? `https://www.tiktok.com/@${handle}/video/${v.tiktok_id}` : v.url,
    };
  });
}

/** Creators we can actually play videos for inside SOOZ (used for in-feed spotlights). */
const SPOTLIGHT_CREATORS = CHRISTIAN_CREATORS.filter((c) => starterTikToks().some((v) => v.author_handle === c.handle));

let tiktokPool: Promise<TikTokVideo[]> | null = null;
function getTikTokPool(): Promise<TikTokVideo[]> {
  if (!tiktokPool) {
    tiktokPool = (async () => {
      const videos = enrich((await fetchApprovedTikToks(0, 300)).videos);
      const inDb = new Set(videos.map((v) => v.tiktok_id));
      const starter = starterTikToks().filter((v) => !inDb.has(v.tiktok_id));
      const freshSince = Date.now() - 2 * 86400000;
      const fresh = videos.filter((v) => new Date(v.created_at).getTime() > freshSince);
      const rest = videos.filter((v) => new Date(v.created_at).getTime() <= freshSince);
      return [...fresh, ...dailyShuffle([...rest, ...starter])];
    })().catch(() => dailyShuffle(starterTikToks()));
  }
  return tiktokPool;
}

/** "For You": SOOZ posts with Christian TikToks woven in, plus a creator spotlight per page. */
export async function fetchForYouPage({ pageParam = FIRST_CURSOR, userId }: { pageParam?: FeedCursor; userId?: string }): Promise<FeedPage> {
  if (pageParam.page === 0) tiktokPool = null; // fresh feed load picks up newly approved videos
  const [postPage, pool] = await Promise.all([
    fetchPosts({ pageParam: pageParam.postPage, userId }),
    getTikTokPool(),
  ]);

  const posts = postPage.posts;
  const wanted = posts.length >= POSTS_PER_PAGE
    ? Math.ceil(posts.length / POSTS_BETWEEN_TIKTOKS)
    : Math.max(Math.ceil(posts.length / POSTS_BETWEEN_TIKTOKS), TIKTOKS_WHEN_NO_POSTS);
  const tiktoks = pool.slice(pageParam.tiktokOffset, pageParam.tiktokOffset + wanted);

  const items: FeedItem[] = [];
  const queue = [...tiktoks];
  posts.forEach((post, i) => {
    items.push(postItem(post));
    if ((i + 1) % POSTS_BETWEEN_TIKTOKS === 0 && queue.length) items.push(tiktokItem(queue.shift()!));
  });
  queue.forEach((v) => items.push(tiktokItem(v)));

  // Creator spotlight: a full-screen card that plays that creator's videos inside SOOZ.
  if (items.length >= 3 && SPOTLIGHT_CREATORS.length) {
    const dayOffset = new Date().getDate();
    const creator = SPOTLIGHT_CREATORS[(pageParam.page + dayOffset) % SPOTLIGHT_CREATORS.length];
    items.splice(Math.min(SPOTLIGHT_POSITION, items.length), 0, { kind: "creator", key: `c:${creator.handle}:${pageParam.page}`, creator });
  }

  const nextTiktokOffset = pageParam.tiktokOffset + tiktoks.length;
  const morePosts = postPage.nextPage !== null;
  const moreTiktoks = nextTiktokOffset < pool.length;
  return {
    items,
    nextCursor: morePosts || moreTiktoks
      ? { postPage: pageParam.postPage + 1, tiktokOffset: nextTiktokOffset, page: pageParam.page + 1 }
      : null,
  };
}

export async function fetchFollowingPage({ pageParam = FIRST_CURSOR, userId }: { pageParam?: FeedCursor; userId: string }): Promise<FeedPage> {
  const page = await fetchFollowingPosts({ pageParam: pageParam.postPage, userId });
  return {
    items: page.posts.map(postItem),
    nextCursor: page.nextPage !== null ? { ...pageParam, postPage: page.nextPage, page: pageParam.page + 1 } : null,
    followsNobody: page.followsNobody,
  };
}

// ── Instant start: keep the first screenful of the feed on the device ──────────
const CACHE_PREFIX = "sooz-feed-v3:";

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

export function writeCachedFeed(scope: string, page: FeedPage) {
  try {
    localStorage.setItem(CACHE_PREFIX + scope, JSON.stringify({ items: page.items.slice(0, 12), nextCursor: page.nextCursor }));
  } catch {
    /* storage full or blocked — the feed still works, just without the instant start */
  }
}
