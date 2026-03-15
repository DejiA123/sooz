import { useEffect, useCallback } from "react";
import { LiveBanner } from "@/components/live/LiveBanner";
import { StoryRail } from "@/components/feed/StoryRail";
import { PostCard } from "@/components/feed/PostCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Heart } from "lucide-react";
import { useInView } from "react-intersection-observer";
import { SuggestedAccounts } from "@/components/home/SuggestedAccounts";
import { useVideoStore } from "@/store/useVideoStore";
import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchPosts } from "@/services/api/posts";
import { useVideoPreloader } from "@/hooks/useVideoPreloader";
import { LivePostCard } from "@/components/feed/LivePostCard";

export default function Index() {
  const { user } = useAuth();

  const handleInteractionUnlock = useCallback(() => {
    const videos = document.querySelectorAll("video");
    videos.forEach((video) => { if (video.paused) { video.muted = true; video.play().catch(() => {}); } });
  }, []);

  useEffect(() => { handleInteractionUnlock(); window.scrollTo(0, 0); }, []);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } = useInfiniteQuery({
    queryKey: ['posts', user?.id],
    queryFn: ({ pageParam }) => fetchPosts({ pageParam, userId: user?.id }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: true,
  });

  const { ref, inView } = useInView();
  useEffect(() => { if (inView && hasNextPage) fetchNextPage(); }, [inView, hasNextPage, fetchNextPage]);

  const posts = data?.pages.flatMap(page => page.posts) || [];
  const isLoading = status === 'pending';

  useVideoPreloader(posts);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex justify-center items-start lg:gap-8">
        {/* Feed — full width, zero padding for immersive media */}
        <div className="w-full md:max-w-[500px] pt-[50px]">
          <StoryRail />

          <LivePostCard />

          {isLoading ? (
            <div className="flex justify-center pt-24">
              <div className="w-10 h-10 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
            </div>
          ) : posts.length === 0 ? (
            <div className="py-20 text-center mx-4">
              <p className="text-muted-foreground font-medium">No posts to show yet.</p>
              <button className="text-primary font-bold mt-2">Discover New People</button>
            </div>
          ) : (
            <div className="space-y-1">
              {posts.map((post, index) => (
                <div key={`${post.id}-${index}`}>
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
                    views_count={0}
                    // @ts-ignore
                    is_liked_by_user={post.is_liked_by_user}
                    // @ts-ignore
                    is_saved_by_user={post.is_saved_by_user}
                    priority={index < 2}
                  />
                </div>
              ))}

              <div ref={ref} className="h-20 flex items-center justify-center p-8">
                {isFetchingNextPage ? (
                  <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                ) : (
                  !hasNextPage && posts.length > 0 && (
                    <div className="flex flex-col items-center gap-2 opacity-30">
                      <Heart className="w-5 h-5 fill-current" />
                      <span className="text-[11px] font-bold uppercase tracking-widest">You're all caught up</span>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* Desktop sidebar */}
        {!isLoading && posts.length > 0 && (
          <div className="hidden lg:block w-[320px] sticky top-20">
            <SuggestedAccounts />
          </div>
        )}
      </div>
    </div>
  );
}