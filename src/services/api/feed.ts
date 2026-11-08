import { fetchFollowingPosts, fetchPosts, type FeedPost } from "./posts";
import { fetchApprovedTikToks, type TikTokVideo } from "./tiktok";

export type FeedItem =
  | { kind: "post"; key: string; post: FeedPost }
  | { kind: "tiktok"; key: string; video: TikTokVideo };

export interface FeedPage {
  items: FeedItem[];
  nextPage: number | null;
  followsNobody?: boolean;
}

/** One Christian TikTok after every this many SOOZ posts. */
const POSTS_BETWEEN_TIKTOKS = 3;
const TIKTOKS_PER_PAGE = 4;

const postItem = (post: FeedPost): FeedItem => ({ kind: "post", key: `p:${post.id}`, post });
const tiktokItem = (video: TikTokVideo): FeedItem => ({ kind: "tiktok", key: `t:${video.id}`, video });

/** "For You": SOOZ posts with approved Christian TikToks woven in. */
export async function fetchForYouPage({ pageParam = 0, userId }: { pageParam?: number; userId?: string }): Promise<FeedPage> {
  const [postPage, tiktokPage] = await Promise.all([
    fetchPosts({ pageParam, userId }),
    fetchApprovedTikToks(pageParam, TIKTOKS_PER_PAGE),
  ]);

  const items: FeedItem[] = [];
  const tiktoks = [...tiktokPage.videos];
  postPage.posts.forEach((post, i) => {
    items.push(postItem(post));
    if ((i + 1) % POSTS_BETWEEN_TIKTOKS === 0 && tiktoks.length) items.push(tiktokItem(tiktoks.shift()!));
  });
  // Few SOOZ posts on this page (or none left) — the rest of the TikToks still get shown.
  tiktoks.forEach((v) => items.push(tiktokItem(v)));

  const hasMore = postPage.nextPage !== null || tiktokPage.hasMore;
  return { items, nextPage: hasMore ? pageParam + 1 : null };
}

export async function fetchFollowingPage({ pageParam = 0, userId }: { pageParam?: number; userId: string }): Promise<FeedPage> {
  const page = await fetchFollowingPosts({ pageParam, userId });
  return { items: page.posts.map(postItem), nextPage: page.nextPage, followsNobody: page.followsNobody };
}

// ── Instant start: keep the first screenful of the feed on the device ──────────
const CACHE_PREFIX = "sooz-feed-v2:";

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
    localStorage.setItem(CACHE_PREFIX + scope, JSON.stringify({ items: page.items.slice(0, 12), nextPage: page.nextPage }));
  } catch {
    /* storage full or blocked — the feed still works, just without the instant start */
  }
}
