import { supabase } from "@/integrations/supabase/client";

export const POSTS_PER_PAGE = 10;

export interface FeedProfile {
    id: string;
    username: string;
    avatar_url: string | null;
    display_name: string | null;
}

export interface FeedPost {
    id: string;
    user_id: string;
    caption: string | null;
    media_url: string | null;
    media_type: string | null;
    thumbnail_url: string | null;
    created_at: string;
    views_count: number;
    profiles: FeedProfile | null;
    likes_count: number;
    comments_count: number;
    shares_count: number;
    is_liked_by_user: boolean;
    is_saved_by_user: boolean;
}

export interface PostPage {
    posts: FeedPost[];
    nextPage: number | null;
}

const POST_SELECT = `
  *,
  profiles:user_id (id, username, avatar_url, display_name),
  likes (count),
  comments (count)
`;

type RawPost = Omit<FeedPost, "likes_count" | "comments_count" | "is_liked_by_user" | "is_saved_by_user" | "views_count"> & {
    views_count?: number | null;
    view_count?: number | null;
    likes?: { count: number }[];
    comments?: { count: number }[];
};

/** Adds counts and the viewer's like/bookmark state. The two lookups run in parallel. */
async function enrichPosts(rows: RawPost[], userId?: string): Promise<FeedPost[]> {
    const ids = rows.map((p) => p.id);
    let liked = new Set<string>();
    let saved = new Set<string>();

    // Share counts come separately, so the feed still loads before the shares table exists.
    const sharesReq = ids.length
        ? supabase.from("post_share_counts").select("post_id, shares").in("post_id", ids).then((r) => r, () => ({ data: null }))
        : Promise.resolve({ data: null });

    if (userId && ids.length) {
        const [likesRes, bookmarksRes] = await Promise.all([
            supabase.from("likes").select("post_id").eq("user_id", userId).in("post_id", ids),
            supabase.from("bookmarks").select("post_id").eq("user_id", userId).in("post_id", ids),
        ]);
        liked = new Set((likesRes.data || []).map((l) => l.post_id));
        saved = new Set((bookmarksRes.data || []).map((b) => b.post_id));
    }
    const shares = new Map<string, number>();
    for (const r of ((await sharesReq).data || []) as { post_id: string | null; shares: number | null }[]) {
        if (r.post_id) shares.set(r.post_id, r.shares || 0);
    }

    return rows.map(({ likes, comments, view_count, ...post }) => ({
        ...post,
        thumbnail_url: post.thumbnail_url ?? null,
        views_count: post.views_count ?? view_count ?? 0,
        likes_count: likes?.[0]?.count || 0,
        comments_count: comments?.[0]?.count || 0,
        shares_count: shares.get(post.id) || 0,
        is_liked_by_user: liked.has(post.id),
        is_saved_by_user: saved.has(post.id),
    }));
}

/** Posts `from`..`from + count - 1`, newest first, with counts and the viewer's like/save state. */
export const fetchPostsRange = async ({ from, count, userId }: { from: number; count: number; userId?: string }): Promise<{ posts: FeedPost[]; hasMore: boolean }> => {
    const { data, error } = await supabase
        .from("posts")
        .select(POST_SELECT)
        .order("created_at", { ascending: false })
        .range(from, from + count - 1);

    if (error) throw error;
    if (!data || data.length === 0) return { posts: [], hasMore: false };
    const posts = await enrichPosts(data as unknown as RawPost[], userId);
    return { posts, hasMore: data.length === count };
};

export const fetchPosts = async ({ pageParam = 0, userId }: { pageParam?: number; userId?: string }): Promise<PostPage> => {
    const from = pageParam * POSTS_PER_PAGE;
    const { data, error } = await supabase
        .from("posts")
        .select(POST_SELECT)
        .order("created_at", { ascending: false })
        .range(from, from + POSTS_PER_PAGE - 1);

    if (error) throw error;
    if (!data || data.length === 0) return { posts: [], nextPage: null };

    const posts = await enrichPosts(data as unknown as RawPost[], userId);
    return { posts, nextPage: data.length === POSTS_PER_PAGE ? pageParam + 1 : null };
};

/** Accounts the user follows (cached per session by React Query callers). */
export const fetchFollowingIds = async (userId: string): Promise<string[]> => {
    const { data, error } = await supabase.from("follows").select("following_id").eq("follower_id", userId);
    if (error) throw error;
    return (data || []).map((f) => f.following_id);
};

export const fetchFollowingPosts = async ({ pageParam = 0, userId }: { pageParam?: number; userId: string }): Promise<PostPage & { followsNobody?: boolean }> => {
    const ids = await fetchFollowingIds(userId);
    if (ids.length === 0) return { posts: [], nextPage: null, followsNobody: true };

    const from = pageParam * POSTS_PER_PAGE;
    const { data, error } = await supabase
        .from("posts")
        .select(POST_SELECT)
        .in("user_id", ids)
        .order("created_at", { ascending: false })
        .range(from, from + POSTS_PER_PAGE - 1);

    if (error) throw error;
    if (!data || data.length === 0) return { posts: [], nextPage: null };

    const posts = await enrichPosts(data as unknown as RawPost[], userId);
    return { posts, nextPage: data.length === POSTS_PER_PAGE ? pageParam + 1 : null };
};

/** One member's posts, newest first (their profile grid), with counts and the viewer's like/save state. */
export const fetchUserPosts = async (userId: string, viewerId?: string, limit = 120): Promise<FeedPost[]> => {
    const { data, error } = await supabase.from("posts").select(POST_SELECT).eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
    if (error || !data) return [];
    return enrichPosts(data as unknown as RawPost[], viewerId);
};

/** Particular posts (e.g. ones reposted by people you follow), with counts and like/save state. */
export const fetchPostsByIds = async (ids: string[], userId?: string): Promise<FeedPost[]> => {
    if (!ids.length) return [];
    const { data, error } = await supabase.from("posts").select(POST_SELECT).in("id", ids);
    if (error || !data) return [];
    return enrichPosts(data as unknown as RawPost[], userId);
};
