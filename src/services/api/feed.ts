import { fetchFollowingIds, fetchFollowingPosts, fetchPostsByIds, fetchPostsRange, POSTS_PER_PAGE, type FeedPost } from "./posts";
import { fetchFollowingReposts, repostedTikTokVideo } from "./reposts";
import { fetchApprovedTikToks, starterTikToks, type TikTokVideo } from "./tiktok";
import { isDeadTikTok } from "./tiktokMeta";
import { categoryOf, exposure, interest, isSeen, seenAt, setCategories, tasteOfPost, tasteOfVideo, tiktokAgeDays } from "@/lib/taste";
import { familySafeOn, unsafeText } from "@/lib/familySafe";
import { blockedTikToks, isHiddenLocally, reportedItems, tiktokIsBlocked } from "./safety";

/**
 * What may be shown: never what a moderator took out (handled by the database for posts, by
 * `blocked_tiktoks` for TikToks) or what this person reported; in family-safe mode also nothing with
 * strong language / adult themes or an open report.
 */
async function contentFilter() {
  const family = familySafeOn();
  const reported = family ? await reportedItems() : null;
  return {
    tiktok: (v: TikTokVideo) => !isHiddenLocally("tiktok", v.tiktok_id) && !(family && (unsafeText(v.title) || reported?.has(`tiktok:${v.tiktok_id}`))),
    post: (p: FeedPost) => !isHiddenLocally("post", p.id) && !(family && (unsafeText(p.caption) || reported?.has(`post:${p.id}`))),
    item: (it: FeedItem) => (it.kind === "tiktok" ? !isHiddenLocally("tiktok", it.video.tiktok_id) && !(family && (unsafeText(it.video.title) || reported?.has(`tiktok:${it.video.tiktok_id}`)))
      : !isHiddenLocally("post", it.post.id) && !(family && (unsafeText(it.post.caption) || reported?.has(`post:${it.post.id}`)))),
  };
}
type ContentFilter = Awaited<ReturnType<typeof contentFilter>>;

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

export const postItem = (post: FeedPost): FeedItem => ({ kind: "post", key: `p:${post.id}`, post });
export const tiktokItem = (video: TikTokVideo, cycle = 0): FeedItem => ({ kind: "tiktok", key: cycle ? `t:${video.tiktok_id}~${cycle}` : `t:${video.tiktok_id}`, video });

// ── A shared link (/?tiktok=ID&by=handle) opens that TikTok first in For You ──
let openFirst: { id: string; handle?: string } | null = null;
export function openTikTokFirst(id: string, handle?: string) { openFirst = { id, handle }; session = null; }
// Read the link as soon as the app starts (this module loads with the app's layout), before the
// background prefetch builds For You's first page — otherwise a signed-in viewer could land on
// something else.
if (typeof window !== "undefined") {
  const q = new URLSearchParams(window.location.search);
  const id = q.get("tiktok");
  if (id && /^\d{5,25}$/.test(id)) openFirst = { id, handle: q.get("by") ?? undefined };
}
export const hasTikTokToOpen = () => openFirst !== null || !!session?.link;

export type Library = { creators: Record<string, string>; videos: [string, string, number, number, string][]; kinds?: Record<string, string>; updated?: string; likes?: Record<string, number> };
/** Refreshed every day on GitHub (scripts/refresh-christian-tiktoks.mjs), read live — no republishing needed. */
const LIVE_LIBRARY = "https://raw.githubusercontent.com/DejiA123/sooz/main/src/data/christianTikTokLibrary.json";
const LIBRARY_KEY = "sooz-tt-library";

/** This phone's copy of the library. It's a few MB with thousands of creators, so it lives in the
 *  browser's Cache Storage (localStorage only holds ~5 MB for everything). */
const LIBRARY_CACHE = "sooz-library";
async function savedLibrary(): Promise<Library | null> {
  try {
    const hit = await (await caches.open(LIBRARY_CACHE)).match(LIVE_LIBRARY);
    if (hit) return (await hit.json()) as Library;
  } catch { /* no Cache Storage here */ }
  try {
    const old = localStorage.getItem(LIBRARY_KEY); // copies saved by earlier versions
    if (old) return JSON.parse(old) as Library;
  } catch { /* storage blocked */ }
  return null;
}

async function fetchLiveLibrary(timeoutMs: number): Promise<Library | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(LIVE_LIBRARY, { signal: ctrl.signal, cache: "no-cache" });
    const text = res.ok ? await res.text() : "";
    clearTimeout(t);
    const lib = text ? (JSON.parse(text) as Library) : null;
    if (!lib || !Array.isArray(lib.videos) || !lib.videos.length || !lib.creators) return null;
    try {
      await (await caches.open(LIBRARY_CACHE)).put(LIVE_LIBRARY, new Response(text, { headers: { "content-type": "application/json" } }));
      localStorage.removeItem(LIBRARY_KEY);
    } catch { /* no Cache Storage: it'll be fetched again next time */ }
    return lib;
  } catch {
    return null;
  }
}

/** The newest library we can get without slowing the feed: this phone's copy (refreshed quietly for
 *  next time), else the live file, else the copy built into the app. */
let libraryLoad: Promise<Library> | null = null;
export function loadLibrary(): Promise<Library> {
  libraryLoad ??= (async () => {
    const saved = await savedLibrary();
    if (saved) { fetchLiveLibrary(20000); return saved; }
    return (await fetchLiveLibrary(6000)) ?? ((await import("@/data/christianTikTokLibrary.json")).default as unknown as Library);
  })().finally(() => setTimeout(() => { libraryLoad = null; }, 60_000));
  return libraryLoad;
}

/** Hundreds of recent videos from trusted Christian creators (loaded on its own, so the app stays light). */
function libraryTikToks(lib: Library): TikTokVideo[] {
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
    likes: lib.likes?.[id] ?? null,
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

/** All Christian TikToks (curator-approved + built-in + the creator library, no duplicates). */
let tiktokPool: Promise<TikTokVideo[]> | null = null;
function getTikTokPool(): Promise<TikTokVideo[]> {
  if (!tiktokPool) {
    tiktokPool = (async () => {
      const [db, lib, blocked] = await Promise.all([
        fetchApprovedTikToks(0, 300).then((r) => enrich(r.videos)).catch(() => [] as TikTokVideo[]),
        loadLibrary().catch(() => null),
        blockedTikToks(),
      ]);
      setCategories(lib?.kinds);
      const library = lib ? libraryTikToks(lib) : [];
      const seen = new Set<string>();
      const all = [...db, ...starterTikToks(), ...library]
        .filter((v) => !seen.has(v.tiktok_id) && !!seen.add(v.tiktok_id))
        .map((v) => (v.likes == null && lib?.likes?.[v.tiktok_id] != null ? { ...v, likes: lib.likes[v.tiktok_id] } : v));
      return all.filter((v) => !isDeadTikTok(v.tiktok_id) && !tiktokIsBlocked(blocked, v));
    })().catch(() => shuffle(starterTikToks().filter((v) => !isDeadTikTok(v.tiktok_id))));
  }
  return tiktokPool;
}

// ── For You: ranked for this viewer, like TikTok (src/lib/taste.ts learns what they enjoy) ──
//
// Each page is picked fresh from everything they haven't seen yet, using what this phone has learnt
// so far (so the feed keeps adapting while they watch):
//   interest in the creator / kind of video / hashtags  +  how new it is  +  how popular  +  a little
//   chance (so it never feels the same and new interests can appear),
// then dealt out so the same creator doesn't come back for a while, the same kind doesn't run on,
// every fifth TikTok is from a creator they haven't met yet, and The Power House's own videos keep
// coming round. Videos they've already watched only return once there's nothing new left.

/** When this copy of the app started (things seen since then still count as new for the instant start). */
const APP_START = Date.now();
const CHURCH = "Our church";
/** A random "luck" term (Gumbel), so equal scores share the top spots. */
const luck = () => -Math.log(-Math.log(Math.random() * 0.999998 + 0.000001));

type Session = {
  user: string | null;
  /** Pages (as promises, so two simultaneous requests for a page share one answer). */
  pages: Map<number, Promise<FeedPage>>;
  /** A shared link to open first (kept until the first page is built). */
  link: { id: string; handle?: string } | null;
  /** TikTok id → times dealt in this session (repeats get their own keys). */
  times: Map<string, number>;
  /** Dealt in the current round (cleared only if every single video has been shown). */
  dealt: Set<string>;
  dealtPosts: Set<string>;
  recent: string[];
  recentKinds: (string | null)[];
  sinceChurch: number;
  slot: number;
  posts: FeedPost[];
  postFrom: number;
  postsMore: boolean;
  postsLoaded: boolean;
  allow: ContentFilter | null;
};
let session: Session | null = null;
const newSession = (user: string | null, link: Session["link"] = null): Session => {
  tiktokPool = null;
  return {
    user, link, pages: new Map(), times: new Map(), dealt: new Set(), dealtPosts: new Set(), recent: [], recentKinds: [],
    sinceChurch: 0, slot: 0, posts: [], postFrom: 0, postsMore: true, postsLoaded: false, allow: null,
  };
};
/** Start For You afresh (e.g. after a post was deleted or TikToks were added). */
export function resetForYou() { session = null; }

async function loadPosts(sess: Session, count: number) {
  if (!sess.postsMore) return;
  const r = await fetchPostsRange({ from: sess.postFrom, count, userId: sess.user ?? undefined });
  const have = new Set(sess.posts.map((p) => p.id));
  sess.posts.push(...r.posts.filter((p) => !have.has(p.id)));
  sess.postFrom += count;
  sess.postsMore = r.hasMore;
}

/** The SOOZ posts this viewer hasn't seen, best first (new, liked, and from people they enjoy). */
async function dealPosts(sess: Session, n: number): Promise<FeedPost[]> {
  if (!sess.postsLoaded) { await loadPosts(sess, SHUFFLED_POSTS); sess.postsLoaded = true; }
  const fresh = () => sess.posts.filter((p) => !sess.dealtPosts.has(p.id) && !isSeen("post", p.id) && (!sess.allow || sess.allow.post(p)));
  for (let tries = 0; fresh().length < n && sess.postsMore && tries < 3; tries++) await loadPosts(sess, POSTS_PER_PAGE * 3);
  const scored = fresh().map((p) => {
    const hours = Math.max(0, (Date.now() - new Date(p.created_at).getTime()) / 3_600_000);
    const buzz = (p.likes_count ?? 0) + 2 * (p.comments_count ?? 0) + 3 * (p.shares_count ?? 0);
    return { p, s: interest(tasteOfPost(p)) + 1.6 * Math.exp(-hours / 72) + 0.35 * Math.log10(1 + buzz) + 0.6 * luck() };
  }).sort((a, b) => b.s - a.s);
  const out: FeedPost[] = [];
  while (out.length < n && scored.length) {
    // Not the same person twice in a row when there's a choice.
    const i = Math.max(0, scored.findIndex((x) => x.p.user_id !== out[out.length - 1]?.user_id));
    out.push(scored.splice(i, 1)[0].p);
  }
  out.forEach((p) => sess.dealtPosts.add(p.id));
  return out;
}

function noteDealt(sess: Session, v: TikTokVideo) {
  const creator = (v.author_handle || v.tiktok_id).toLowerCase();
  const kind = categoryOf(creator);
  sess.dealt.add(v.tiktok_id);
  sess.recent = [...sess.recent, creator].slice(-6);
  sess.recentKinds = [...sess.recentKinds, kind].slice(-3);
  sess.sinceChurch = kind === CHURCH ? 0 : sess.sinceChurch + 1;
  sess.slot += 1;
  const times = sess.times.get(v.tiktok_id) ?? 0;
  sess.times.set(v.tiktok_id, times + 1);
  return times;
}

/** The next `n` TikToks for this viewer. */
function dealTikToks(sess: Session, pool: TikTokVideo[], n: number): { video: TikTokVideo; cycle: number }[] {
  if (!pool.length || n <= 0) return [];
  if (sess.allow) pool = pool.filter(sess.allow.tiktok);
  let cands = pool.filter((v) => !sess.dealt.has(v.tiktok_id) && !isSeen("tiktok", v.tiktok_id));
  if (cands.length < n) {
    // Nothing (or little) new left: the ones watched longest ago come back too.
    cands = pool.filter((v) => !sess.dealt.has(v.tiktok_id));
    if (cands.length < n) {
      const last = new Set(sess.recent);
      sess.dealt.clear(); // a whole new round
      cands = pool.filter((v) => !last.has((v.author_handle || v.tiktok_id).toLowerCase()) || pool.length < 20);
    }
  }
  const base = new Map<string, number>();
  for (const v of cands) {
    const age = tiktokAgeDays(v.tiktok_id);
    let s = interest(tasteOfVideo(v))
      + 0.22 * Math.log10((v.likes ?? 0) + 1)
      + (age == null ? 0.4 : 1.3 * Math.exp(-age / 7))
      + 0.7 * luck();
    const seen = seenAt("tiktok", v.tiktok_id);
    if (seen != null) s += -3 + Math.min(2.5, (Date.now() - seen) / 86_400_000 / 10);
    base.set(v.tiktok_id, s);
  }
  const out: { video: TikTokVideo; cycle: number }[] = [];
  const taken = new Set<string>();
  for (let i = 0; i < n; i++) {
    const discover = sess.slot % 5 === 4;
    let best: TikTokVideo | null = null;
    let bestScore = -Infinity;
    for (const v of cands) {
      if (taken.has(v.tiktok_id)) continue;
      const creator = (v.author_handle || v.tiktok_id).toLowerCase();
      const kind = categoryOf(creator);
      let s = base.get(v.tiktok_id)!;
      const back = sess.recent.lastIndexOf(creator);
      if (back >= 0) s -= 4 - (sess.recent.length - 1 - back) * 0.6;
      if (kind && sess.recentKinds[sess.recentKinds.length - 1] === kind) s -= sess.recentKinds[sess.recentKinds.length - 2] === kind ? 1.2 : 0.35;
      if (kind === CHURCH && sess.sinceChurch >= 10) s += 3;
      if (discover) { const e = exposure(creator); s += e === 0 ? 2.5 : e < 3 ? 1 : -1; }
      if (s > bestScore) { bestScore = s; best = v; }
    }
    if (!best) break;
    taken.add(best.tiktok_id);
    out.push({ video: best, cycle: noteDealt(sess, best) });
  }
  return out;
}

/** Posts and TikToks evenly woven together (TikTok first), each list already in best-first order. */
function weave(posts: FeedItem[], tiktoks: FeedItem[]): FeedItem[] {
  const total = posts.length + tiktoks.length;
  const at = (k: number, of: number, shift: number) => ((k + shift) * total) / of;
  return [
    ...tiktoks.map((item, k) => ({ item, t: at(k, tiktoks.length, 0.25) })),
    ...posts.map((item, k) => ({ item, t: at(k, posts.length, 0.75) })),
  ].sort((a, b) => a.t - b.t).map((x) => x.item);
}

/** "For You": SOOZ posts and Christian TikToks picked for this viewer, never what they've already seen. */
export function fetchForYouPage({ pageParam = FIRST_CURSOR, userId }: { pageParam?: FeedCursor; userId?: string }): Promise<FeedPage> {
  const uid = userId ?? null;
  if (!session || session.user !== uid || (pageParam.page === 0 && openFirst)) {
    session = newSession(uid, openFirst);
    openFirst = null;
  }
  const sess = session;
  // The same page asked for again (coming back to Home, or two requests at once) gives the same
  // videos, so nothing jumps.
  let page = sess.pages.get(pageParam.page);
  if (!page) {
    page = buildForYouPage(sess, pageParam);
    sess.pages.set(pageParam.page, page);
    page.catch(() => { if (sess.pages.get(pageParam.page) === page) sess.pages.delete(pageParam.page); });
  }
  return page;
}

async function buildForYouPage(sess: Session, pageParam: FeedCursor): Promise<FeedPage> {
  sess.allow = await contentFilter();
  const [ttPool] = await Promise.all([getTikTokPool(), sess.postsLoaded ? null : dealPosts(sess, 0).catch(() => { sess.postsLoaded = true; sess.postsMore = false; })]);
  const first: FeedItem[] = [];

  if (pageParam.page === 0 && sess.link) {
    // A shared link: that TikTok first.
    const { id, handle } = sess.link;
    const video: TikTokVideo = ttPool.find((v) => v.tiktok_id === id) ?? {
      id: `link-${id}`, tiktok_id: id, url: `https://www.tiktok.com/@${handle || "_"}/video/${id}`,
      author_name: null, author_handle: handle ?? null, author_url: handle ? `https://www.tiktok.com/@${handle}` : null,
      title: null, thumbnail_url: null, thumbnail_width: null, thumbnail_height: null, faith_tags: [], created_at: new Date().toISOString(),
    };
    first.push(tiktokItem(video, noteDealt(sess, video)));
  } else if (pageParam.page === 0) {
    // Keep the video the app opened on (shown instantly from this phone) in first place, so the
    // screen doesn't change under the viewer when this page arrives.
    const pinned = readCachedFeed("foryou")?.items.find(sess.allow.item);
    if (pinned?.kind === "tiktok") { noteDealt(sess, pinned.video); first.push(tiktokItem(pinned.video)); }
    else if (pinned?.kind === "post") { sess.dealtPosts.add(pinned.post.id); first.push(pinned); }
  }

  const posts = await dealPosts(sess, POSTS_PER_PAGE).catch(() => [] as FeedPost[]);
  const wanted = posts.length >= POSTS_PER_PAGE
    ? Math.ceil(posts.length / POSTS_BETWEEN_TIKTOKS)
    : Math.max(Math.ceil(posts.length / POSTS_BETWEEN_TIKTOKS), TIKTOKS_WHEN_NO_POSTS);
  const tiktoks = dealTikToks(sess, ttPool, wanted).map(({ video, cycle }) => tiktokItem(video, cycle));
  const items = [...first, ...weave(posts.map(postItem), tiktoks)];

  const page: FeedPage = {
    items,
    nextCursor: items.length || ttPool.length || sess.postsMore
      ? { postOffset: 0, tiktokOffset: 0, page: pageParam.page + 1 }
      : null,
  };
  if (pageParam.page === 0) sess.link = null;
  return page;
}

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
    else if (r.tiktok_id) out.push({ item: { ...tiktokItem(repostedTikTokVideo(r)), key: `rt:${r.tiktok_id}`, repostedBy: name }, at: r.created_at });
  }
  return out;
}

export async function fetchFollowingPage({ pageParam = FIRST_CURSOR, userId }: { pageParam?: FeedCursor; userId: string }): Promise<FeedPage> {
  const [raw, allow] = await Promise.all([fetchFollowingPosts({ pageParam: pageParam.page, userId }), contentFilter()]);
  const page = { ...raw, posts: raw.posts.filter(allow.post) };
  if (pageParam.page === 0) {
    const reposts = await followingRepostItems(userId, new Set(page.posts.map((p) => p.id)));
    if (reposts.length) {
      const merged = [...page.posts.map((p) => ({ item: postItem(p), at: p.created_at })), ...reposts.filter((r) => allow.item(r.item))]
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
    if (!Array.isArray(page.items)) return undefined;
    // For You never opens on something already watched before this launch.
    if (scope === "foryou") {
      page.items = page.items.filter((it) => {
        const at = it.kind === "tiktok" ? seenAt("tiktok", it.video.tiktok_id) : seenAt("post", it.post.id);
        return at == null || at >= APP_START - 60_000;
      });
    }
    return page.items.length ? page : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Saves a screenful for next time, starting `from` the given item (by default the *second*, so each
 * launch opens on a different video; when leaving the app, the ones after the current video), and
 * the next load keeps the first of them in first place.
 */
export function writeCachedFeed(scope: string, page: FeedPage, from = 1) {
  try {
    const items = page.items.length > from ? page.items.slice(from, from + 12) : page.items.slice(-1);
    localStorage.setItem(CACHE_PREFIX + scope, JSON.stringify({ items, nextCursor: page.nextCursor }));
  } catch {
    /* storage full or blocked — the feed still works, just without the instant start */
  }
}
