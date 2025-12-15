import { useEffect, useState, useRef } from "react";
import { StoryRail } from "@/components/feed/StoryRail";
import { PostCard } from "@/components/feed/PostCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { useInView } from "react-intersection-observer";
import { toast } from "sonner";
import { SuggestedAccounts } from "@/components/home/SuggestedAccounts";
import { SuggestedUsersRail } from "@/components/feed/SuggestedUsersRail";

interface PostWithUser {
  id: string;
  caption: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  user_id: string;
  profiles: {
    id: string;
    username: string;
    avatar_url: string | null;
    display_name: string | null;
  };
  likes: { count: number }[];
  comments: { count: number }[];
  user_likes: { id: string }[];
  is_saved_by_user?: boolean;
}

const POSTS_PER_PAGE = 10;

export default function Index() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: '100px',
  });

  // Initial fetch
  useEffect(() => {
    setPosts([]);
    setPage(0);
    setHasMore(true);
    fetchPosts(0, true);
  }, [user?.id]);

  // Load more when scrolling
  useEffect(() => {
    if (inView && hasMore && !loading && !loadingMore) {
      fetchPosts(page + 1, false);
    }
  }, [inView, hasMore, loading, loadingMore, page]);

  const fetchPosts = async (pageIndex: number, isInitial: boolean) => {
    try {
      if (isInitial) setLoading(true);
      else setLoadingMore(true);

      const from = pageIndex * POSTS_PER_PAGE;
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
        setHasMore(false);
        if (isInitial) setPosts([]);
      } else {
        // Collect IDs to fetch likes
        const newPostIds = postsData.map(p => p.id);
        let likedPostIds = new Set<string>();
        let savedPostIds = new Set<string>();

        if (user) {
          const { data: userLikes } = await supabase
            .from("likes")
            .select("post_id")
            .eq("user_id", user.id)
            .in("post_id", newPostIds);

          if (userLikes) {
            userLikes.forEach(like => likedPostIds.add(like.post_id));
          }

          const { data: userBookmarks } = await supabase
            .from("bookmarks")
            .select("post_id")
            .eq("user_id", user.id)
            .in("post_id", newPostIds);

          if (userBookmarks) {
            userBookmarks.forEach(bookmark => savedPostIds.add(bookmark.post_id));
          }
        }

        const transformedNewPosts = postsData.map(post => ({
          ...post,
          // @ts-ignore
          likes_count: post.likes[0]?.count || 0,
          // @ts-ignore
          comments_count: post.comments[0]?.count || 0,
          is_liked_by_user: likedPostIds.has(post.id),
          is_saved_by_user: savedPostIds.has(post.id)
        }));

        if (isInitial) {
          // @ts-ignore
          setPosts(transformedNewPosts);
        } else {
          // @ts-ignore
          setPosts(prev => [...prev, ...transformedNewPosts]);
        }

        setPage(pageIndex);
        if (postsData.length < POSTS_PER_PAGE) {
          setHasMore(false);
        }
      }

    } catch (error) {
      console.error("Error fetching posts:", error);
      toast.error("Failed to load posts");
    } finally {
      if (isInitial) setLoading(false);
      else setLoadingMore(false);
    }
  };

  return (
    <div className="pb-20">
      <div className="flex gap-10 justify-center items-start">
        {/* Feed Column */}
        <div className="w-full max-w-md">
          <StoryRail />

          {loading ? (
            <div className="flex justify-center pt-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : posts.length === 0 && !hasMore ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">No posts yet. Follow people to see their posts!</p>
            </div>
          ) : (
            <div className="px-1 mt-2">
              {posts.map((post, index) => (
                <div key={post.id} className="space-y-6">
                  <PostCard
                    key={post.id}
                    id={post.id}
                    user={post.profiles}
                    caption={post.caption}
                    media_url={post.media_url}
                    media_type={post.media_type}
                    created_at={post.created_at}
                    // @ts-ignore
                    likes_count={post.likes_count}
                    // @ts-ignore
                    comments_count={post.comments_count}
                    // @ts-ignore
                    views_count={post.views_count || 0}
                    // @ts-ignore
                    is_liked_by_user={post.is_liked_by_user}
                    // @ts-ignore
                    is_saved_by_user={post.is_saved_by_user}
                  />
                  {index === 0 && (
                    <div className="lg:hidden -mx-1 px-4 py-2 border-y border-white/5 bg-white/5 backdrop-blur-sm">
                      <SuggestedUsersRail />
                    </div>
                  )}
                </div>
              ))}

              {/* Loading Trigger */}
              <div ref={ref} className="h-10 flex items-center justify-center p-4">
                {loadingMore && <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />}
                {!hasMore && posts.length > 0 && (
                  <span className="text-xs text-muted-foreground">You're all caught up!</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Suggested Accounts Sidebar (Desktop Only) */}
        <SuggestedAccounts />
      </div>
    </div >
  );
}
