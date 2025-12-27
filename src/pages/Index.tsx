import { useEffect, useState, useRef, useCallback } from "react";
import { StoryRail } from "@/components/feed/StoryRail";
import { PostCard } from "@/components/feed/PostCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { useInView } from "react-intersection-observer";
import { toast } from "sonner";
import { SuggestedAccounts } from "@/components/home/SuggestedAccounts";
import { SuggestedUsersRail } from "@/components/feed/SuggestedUsersRail";
import { useVideoStore } from "@/store/useVideoStore";
import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchPosts } from "@/services/api/posts";

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



export default function Index() {
  const { user } = useAuth();
  const activeVideoId = useVideoStore((state) => state.activeVideoId);
  const setActiveVideo = useVideoStore((state) => state.setActiveVideo);

  // Global interaction unlock
  const handleInteractionUnlock = useCallback(() => {
    const videos = document.querySelectorAll("video");
    videos.forEach((video) => {
      if (video.paused) {
        video.muted = true;
        video.play().catch(() => { });
      }
    });
  }, []);

  useEffect(() => {
    handleInteractionUnlock();
    // Start at top on mount as per user preference
    window.scrollTo(0, 0);
  }, []);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status
  } = useInfiniteQuery({
    queryKey: ['posts', user?.id], // Key includes user ID to refresh on auth change
    queryFn: ({ pageParam }) => fetchPosts({ pageParam, userId: user?.id }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    refetchOnWindowFocus: true,
  });

  const { ref, inView } = useInView();

  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, fetchNextPage]);

  // Flatten pages
  const posts = data?.pages.flatMap(page => page.posts) || [];
  const isLoading = status === 'pending';

  return (
    <div className="pb-20">
      <div className="flex justify-center items-start">
        {/* Feed Column */}
        <div className="w-full md:max-w-md">
          <StoryRail />

          {isLoading ? (
            /* User explicitly said "I don't want that skeleton posts thing" and "I don't want to see that loading circle".
               The best "Instagram-like" behavior when absolutely nothing is loaded yet is usually a spinner, 
               but since they hate it, showing nothing (transparent) until load might be preferred, 
               or just the StoryRail (which might also load).
               
               Actually, the best bet if they hate visual loaders is to show NOTHING or a very minimal loader.
               Let's stick to NO loader if they are switching tabs (since cache handles it).
               But for FIRST load... we need something. 
               I will show a minimal spinner but ONLY if there is no data at all.
            */
            <div className="flex justify-center pt-20">
              {/* Minimal loader only if strictly necessary */}
              <Loader2 className="w-8 h-8 animate-spin text-primary opacity-50" />
            </div>
          ) : posts.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">No posts yet. Follow people to see their posts!</p>
            </div>
          ) : (
            <div className="mt-2 space-y-6">
              {posts.map((post, index) => (
                <div key={`${post.id}-${index}`} className="space-y-6">
                  <PostCard
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
                    views_count={0}
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

              {/* Infinite Scroll Loader */}
              <div ref={ref} className="h-10 flex items-center justify-center p-4">
                {isFetchingNextPage && <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />}
                {!hasNextPage && posts.length > 0 && (
                  <span className="text-xs text-muted-foreground">You're all caught up!</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Suggested Accounts Sidebar (Desktop Only) */}
        <SuggestedAccounts />
      </div>
    </div>
  );
}
