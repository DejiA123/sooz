import { supabase } from "@/integrations/supabase/client";
import { loadLibrary, postItem, tiktokItem, type FeedItem, type Library } from "./feed";
import { fetchPostsByIds, fetchUserPosts, type FeedPost } from "./posts";
import { fetchUserReposts, repostedTikTokVideo } from "./reposts";

/** The tabs on a profile, like TikTok: their posts, what they reposted, and (your own) saved / liked. */
export type ProfileTab = "posts" | "reposts" | "saved" | "liked";

const inOrder = (ids: string[], posts: FeedPost[]) => {
  const byId = new Map(posts.map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter((p): p is FeedPost => !!p);
};

/** Posts this member bookmarked or liked, newest first. */
async function postsFrom(table: "bookmarks" | "likes", profileId: string, viewerId?: string): Promise<FeedPost[]> {
  const { data } = await supabase.from(table).select("post_id").eq("user_id", profileId).order("created_at", { ascending: false }).limit(120);
  const ids = [...new Set((data ?? []).map((r) => r.post_id).filter(Boolean))];
  return inOrder(ids, await fetchPostsByIds(ids, viewerId));
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
    case "saved": return (await postsFrom("bookmarks", profileId, viewerId)).map(postItem);
    case "liked": return (await postsFrom("likes", profileId, viewerId)).map(postItem);
    case "reposts": return repostItems(profileId, viewerId);
  }
}
