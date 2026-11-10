import { supabase } from "@/integrations/supabase/client";
import { loadLibrary, postItem, tiktokItem, type FeedItem, type Library } from "./feed";
import { fetchPostsByIds, fetchUserPosts, type FeedPost } from "./posts";
import { fetchUserReposts, repostedTikTokVideo } from "./reposts";
import { starterTikToks, type TikTokVideo } from "./tiktok";
import { likedTikToks } from "@/lib/taste";
import { isHiddenLocally } from "./safety";

/** The tabs on a profile, like TikTok: their posts, what they reposted, and (your own) saved / liked. */
export type ProfileTab = "posts" | "reposts" | "saved" | "liked";

const inOrder = (ids: string[], posts: FeedPost[]) => {
  const byId = new Map(posts.map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter((p): p is FeedPost => !!p);
};

/** Posts this member bookmarked or liked, newest first (with when). */
async function postsFrom(table: "bookmarks" | "likes", profileId: string, viewerId?: string): Promise<{ post: FeedPost; at: number }[]> {
  const { data } = await supabase.from(table).select("post_id, created_at").eq("user_id", profileId).order("created_at", { ascending: false }).limit(120);
  const when = new Map<string, number>();
  for (const r of data ?? []) if (r.post_id && !when.has(r.post_id)) when.set(r.post_id, new Date(r.created_at).getTime());
  const ids = [...when.keys()];
  return inOrder(ids, await fetchPostsByIds(ids, viewerId)).map((post) => ({ post, at: when.get(post.id) ?? 0 }));
}

/**
 * Christian TikToks by id, with creator, caption, shape and like count from the library (or the
 * built-in starter list); ones that have left the library still play from their id.
 */
export async function tiktoksById(entries: { id: string; handle?: string | null }[]): Promise<TikTokVideo[]> {
  if (!entries.length) return [];
  const lib = await loadLibrary().catch(() => null);
  const rows = new Map((lib?.videos ?? []).map((v) => [v[0], v]));
  const starter = new Map(starterTikToks().map((v) => [v.tiktok_id, v]));
  return entries.map(({ id, handle }) => {
    const known = starter.get(id);
    const row = rows.get(id);
    const h = row?.[1] ?? known?.author_handle ?? handle ?? null;
    return {
      id: `lib-${id}`,
      tiktok_id: id,
      url: `https://www.tiktok.com/@${h || "_"}/video/${id}`,
      author_name: (h ? lib?.creators[h] : undefined) ?? known?.author_name ?? null,
      author_handle: h,
      author_url: h ? `https://www.tiktok.com/@${h}` : null,
      title: row?.[4] || known?.title || null,
      thumbnail_url: null,
      thumbnail_width: row?.[2] ?? known?.thumbnail_width ?? null,
      thumbnail_height: row?.[3] ?? known?.thumbnail_height ?? null,
      faith_tags: [],
      created_at: new Date().toISOString(),
      likes: lib?.likes?.[id] ?? null,
    };
  });
}

/** Your Liked tab: SOOZ posts you liked and TikToks you hearted (kept on your account), newest first. */
async function likedItems(profileId: string, viewerId?: string): Promise<FeedItem[]> {
  const mine = viewerId === profileId;
  const hearts = mine ? likedTikToks().filter((h) => !isHiddenLocally("tiktok", h.id)) : [];
  const [posts, videos] = await Promise.all([postsFrom("likes", profileId, viewerId), tiktoksById(hearts)]);
  return [
    ...posts.map(({ post, at }) => ({ item: postItem(post), at })),
    ...videos.map((video, i) => ({ item: tiktokItem(video), at: hearts[i].at })),
  ].sort((a, b) => b.at - a.at).map((x) => x.item);
}

/** What they reposted: SOOZ posts and Christian TikToks (with the library's full caption and like count). */
async function repostItems(profileId: string, viewerId?: string): Promise<FeedItem[]> {
  const reposts = await fetchUserReposts(profileId);
  if (!reposts.length) return [];
  const postIds = reposts.map((r) => r.post_id).filter((id): id is string => !!id);
  const libReq: Promise<Library | null> = reposts.some((r) => r.tiktok_id) ? loadLibrary().catch(() => null) : Promise.resolve(null);
  const postsReq: Promise<FeedPost[]> = postIds.length ? fetchPostsByIds(postIds, viewerId) : Promise.resolve([]);
  const [posts, lib] = await Promise.all([postsReq, libReq]);
  const byId = new Map(posts.map((p) => [p.id, p]));
  const captions = new Map((lib?.videos ?? []).map((v) => [v[0], v[4]]));
  const items: FeedItem[] = [];
  for (const r of reposts) {
    if (r.post_id) {
      const post = byId.get(r.post_id);
      if (post) items.push(postItem(post));
    } else if (r.tiktok_id) {
      const video = repostedTikTokVideo(r);
      const handle = video.author_handle;
      video.title = captions.get(r.tiktok_id) || video.title;
      video.author_name = (handle ? lib?.creators[handle] : undefined) || video.author_name;
      video.likes = lib?.likes?.[r.tiktok_id] ?? null;
      items.push(tiktokItem(video));
    }
  }
  return items;
}

export async function fetchProfileTab(profileId: string, tab: ProfileTab, viewerId?: string): Promise<FeedItem[]> {
  switch (tab) {
    case "posts": return (await fetchUserPosts(profileId, viewerId)).map(postItem);
    case "saved": return (await postsFrom("bookmarks", profileId, viewerId)).map(({ post }) => postItem(post));
    case "liked": return likedItems(profileId, viewerId);
    case "reposts": return repostItems(profileId, viewerId);
  }
}
