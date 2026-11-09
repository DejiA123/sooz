import { supabase } from "@/integrations/supabase/client";
import type { TikTokVideo } from "./tiktok";

/**
 * Reposts, like TikTok: share a SOOZ post or a Christian TikTok with your followers (they see it in
 * Following with "… reposted"). Table `reposts` (migration 20261109120000). If the table isn't
 * there yet every call quietly does nothing, so the app never breaks.
 */
export type RepostTarget = { postId: string } | { tiktok: TikTokVideo };

const targetId = (t: RepostTarget) => ("postId" in t ? t.postId : t.tiktok.tiktok_id);

/** Small copy of a TikTok's details, so a repost can be shown even outside the library. */
export interface RepostedTikTok { url: string; handle: string | null; name: string | null; caption: string | null; w: number | null; h: number | null }

const tiktokInfo = (v: TikTokVideo): RepostedTikTok => ({
  url: v.url, handle: v.author_handle, name: v.author_name, caption: v.title, w: v.thumbnail_width, h: v.thumbnail_height,
});

export async function isReposted(userId: string, t: RepostTarget): Promise<boolean> {
  const q = supabase.from("reposts" as never).select("id").eq("user_id", userId).limit(1);
  const { data, error } = "postId" in t ? await q.eq("post_id", t.postId) : await q.eq("tiktok_id", t.tiktok.tiktok_id);
  return !error && !!(data as unknown[] | null)?.length;
}

export async function repostCount(t: RepostTarget): Promise<number | null> {
  const { data, error } = await supabase.from("repost_counts" as never).select("reposts").eq("target", targetId(t)).maybeSingle();
  if (error) return null;
  return (data as { reposts?: number } | null)?.reposts ?? 0;
}

/** Repost (or undo). Returns the new state, or null if it couldn't be saved. */
export async function setReposted(userId: string, t: RepostTarget, on: boolean): Promise<boolean | null> {
  if (on) {
    const row = "postId" in t
      ? { user_id: userId, post_id: t.postId }
      : { user_id: userId, tiktok_id: t.tiktok.tiktok_id, tiktok: tiktokInfo(t.tiktok) };
    const { error } = await supabase.from("reposts" as never).insert(row as never);
    if (error && error.code !== "23505") return null; // 23505 = already reposted
    return true;
  }
  const q = supabase.from("reposts" as never).delete().eq("user_id", userId);
  const { error } = "postId" in t ? await q.eq("post_id", t.postId) : await q.eq("tiktok_id", t.tiktok.tiktok_id);
  return error ? null : false;
}

export interface FollowingRepost {
  created_at: string;
  user_id: string;
  post_id: string | null;
  tiktok_id: string | null;
  tiktok: RepostedTikTok | null;
  reposter: { username: string | null; display_name: string | null } | null;
}

/** Latest reposts by the people you follow (for the Following feed). */
export async function fetchFollowingReposts(followingIds: string[], limit = 40): Promise<FollowingRepost[]> {
  if (!followingIds.length) return [];
  const { data, error } = await supabase
    .from("reposts" as never)
    .select("created_at, user_id, post_id, tiktok_id, tiktok, reposter:user_id(username, display_name)")
    .in("user_id", followingIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  return error || !data ? [] : (data as unknown as FollowingRepost[]);
}

/** Everything one member reposted, newest first (their profile's Reposts tab). */
export interface UserRepost { created_at: string; post_id: string | null; tiktok_id: string | null; tiktok: RepostedTikTok | null }
export async function fetchUserReposts(userId: string, limit = 120): Promise<UserRepost[]> {
  const { data, error } = await supabase
    .from("reposts" as never)
    .select("created_at, post_id, tiktok_id, tiktok")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return error || !data ? [] : (data as unknown as UserRepost[]);
}

/** A reposted TikTok as a playable video, from the copy of its details saved with the repost. */
export const repostedTikTokVideo = (r: Pick<UserRepost, "tiktok_id" | "tiktok" | "created_at">): TikTokVideo => ({
  id: `repost-${r.tiktok_id}`, tiktok_id: r.tiktok_id!, url: r.tiktok?.url || `https://www.tiktok.com/@_/video/${r.tiktok_id}`,
  author_name: r.tiktok?.name ?? null, author_handle: r.tiktok?.handle ?? null,
  author_url: r.tiktok?.handle ? `https://www.tiktok.com/@${r.tiktok.handle}` : null, title: r.tiktok?.caption ?? null,
  thumbnail_url: null, thumbnail_width: r.tiktok?.w ?? null, thumbnail_height: r.tiktok?.h ?? null, faith_tags: [], created_at: r.created_at,
});

/** Link that opens this TikTok first in SOOZ's For You. */
export const soozTikTokLink = (v: TikTokVideo) =>
  `${window.location.origin}/?tiktok=${encodeURIComponent(v.tiktok_id)}${v.author_handle ? `&by=${encodeURIComponent(v.author_handle)}` : ""}`;

/** SOOZ links to a TikTok inside a chat message (to show them as a card). */
export const TIKTOK_LINK_RE = /https?:\/\/[^\s]+\/\?tiktok=(\d{5,25})(?:&by=([\w.]+))?/;
