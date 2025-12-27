
import { supabase } from "@/integrations/supabase/client";

export const POSTS_PER_PAGE = 10;

export const fetchPosts = async ({ pageParam = 0, userId }: { pageParam?: number; userId?: string }) => {
    const from = pageParam * POSTS_PER_PAGE;
    const to = from + POSTS_PER_PAGE - 1;

    const { data: postsData, error: postsError } = await supabase
        .from("posts")
        .select(`
      *,
      profiles:user_id (id, username, avatar_url, display_name),
      likes (count),
      comments (count)
    `)
        .order("created_at", { ascending: false })
        .range(from, to);

    if (postsError) throw postsError;

    if (!postsData || postsData.length === 0) {
        return { posts: [], nextPage: null };
    }

    // Collect IDs for likes/bookmarks if user is logged in
    const newPostIds = postsData.map(p => p.id);
    let likedPostIds = new Set<string>();
    let savedPostIds = new Set<string>();

    if (userId) {
        const { data: userLikes } = await supabase
            .from("likes")
            .select("post_id")
            .eq("user_id", userId)
            .in("post_id", newPostIds);

        if (userLikes) userLikes.forEach(like => likedPostIds.add(like.post_id));

        const { data: userBookmarks } = await supabase
            .from("bookmarks")
            .select("post_id")
            .eq("user_id", userId)
            .in("post_id", newPostIds);

        if (userBookmarks) userBookmarks.forEach(bookmark => savedPostIds.add(bookmark.post_id));
    }

    const posts = postsData.map(post => ({
        ...post,
        likes_count: post.likes?.[0]?.count || 0,
        comments_count: post.comments?.[0]?.count || 0,
        is_liked_by_user: likedPostIds.has(post.id),
        is_saved_by_user: savedPostIds.has(post.id),
    }));

    return {
        posts,
        nextPage: posts.length === POSTS_PER_PAGE ? pageParam + 1 : null,
    };
};
