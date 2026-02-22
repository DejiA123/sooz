import { useEffect, useState, useRef, useCallback } from "react";
import { LiveBanner } from "@/components/live/LiveBanner";
import { StoryRail } from "@/components/feed/StoryRail";
import { PostCard } from "@/components/feed/PostCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Heart } from "lucide-react";
import { useInView } from "react-intersection-observer";
import { toast } from "sonner";
import { SuggestedAccounts } from "@/components/home/SuggestedAccounts";
import { SuggestedUsersRail } from "@/components/feed/SuggestedUsersRail";
import { useVideoStore } from "@/store/useVideoStore";
import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchPosts } from "@/services/api/posts";
import { useVideoPreloader } from "@/hooks/useVideoPreloader";
import { LivePostCard } from "@/components/feed/LivePostCard";

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

  // Enable aggressive video preloading for the feed
  useVideoPreloader(posts);

  return (
    <div className="min-h-screen bg-background/50">
      <div className="flex justify-center items-start lg:gap-8 px-4 sm:px-0">
        {/* Feed Column */}
        <div className="w-full md:max-w-[500px] pt-8">
          <div className="mb-10 animate-fade-in-up">
            <StoryRail />
          </div>

          <LivePostCard />

          {isLoading ? (
            <div className="flex justify-center pt-24">
              <div className="w-10 h-10 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
            </div>
          ) : posts.length === 0 ? (
            <div className="py-20 text-center bg-card/30 rounded-[2rem] border border-dashed border-border/50 mx-4">
              <p className="text-muted-foreground font-medium">No posts to show yet.</p>
              <button className="text-primary font-bold mt-2">Discover New People</button>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post, index) => (
                <div key={`${post.id}-${index}`} className="animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
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
                    priority={index < 2}
                  />
                  {index === 0 && (
                    <div className="lg:hidden -mx-4 mb-8">
                      <div className="px-4 mb-2">
                        <h4 className="text-[14px] font-bold tracking-tight">Suggested for you</h4>
                      </div>
                      <div className="py-4 bg-secondary/20 border-y border-white/5 backdrop-blur-md">
                        <SuggestedUsersRail />
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Infinite Scroll Loader */}
              <div ref={ref} className="h-20 flex items-center justify-center p-8">
                {isFetchingNextPage ? (
                  <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                ) : (
                  !hasNextPage && posts.length > 0 && (
                    <div className="flex flex-col items-center gap-2 grayscale opacity-40">
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                        <Heart className="w-5 h-5 fill-current" />
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-widest">End of the road</span>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* Suggested Accounts Sidebar (Desktop Only) */}
        {!isLoading && posts.length > 0 && (
          <div className="hidden lg:block w-[320px] sticky top-[calc(5rem+env(safe-area-inset-top,0px))]">
            <SuggestedAccounts />
          </div>
        )}
      </div>
    </div>
  );
}
