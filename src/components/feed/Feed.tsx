import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import PostCard from "./PostCard";
import StoriesBar from "./StoriesBar";
import { ErrorState } from "@/components/error/ErrorState";
import { handleSupabaseError } from "@/lib/error-utils";
import { Loader2 } from "lucide-react";
import FeedSkeleton from "./FeedSkeleton";

interface Post {
  id: string;
  user_id: string;
  caption: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  profiles: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  likes: { id: string }[];
  comments: { id: string }[];
}

const Feed = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetchPosts();

    // Set up real-time subscription
    const channel = supabase
      .channel("posts-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        () => {
          fetchPosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from("posts")
        .select(`
          *,
          profiles:user_id (username, display_name, avatar_url),
          likes (id),
          comments (id)
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        throw error;
      }

      if (data) {
        setPosts(data as Post[]);
      }
    } catch (error) {
      const appError = handleSupabaseError(error, 'fetchPosts');
      setError(appError);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
    return `${Math.floor(diffInSeconds / 604800)}w`;
  };

  if (loading) {
    return (
      <div className="pt-20 pb-24 bg-surface min-h-screen">
        <div className="bg-surface/95 backdrop-blur-sm border-b border-surface-variant/20 z-50 relative">
          <StoriesBar />
        </div>
        <div className="max-w-5xl mx-auto">
          <FeedSkeleton />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pt-16 pb-24 bg-surface min-h-screen">
        <div className="max-w-2xl mx-auto px-4">
          <ErrorState 
            error={error}
            onRetry={fetchPosts}
            title="Failed to load feed"
            message="We couldn't load your feed. Please try again."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="pt-20 pb-24 bg-surface min-h-screen">
      {/* Stories Section - Instagram-style */}
      <div className="bg-surface/95 backdrop-blur-sm border-b border-surface-variant/20 z-50 relative">
        <StoriesBar />
      </div>
      
      {/* Posts Feed - Instagram-inspired layout */}
      <div className="max-w-5xl mx-auto lg:max-w-6xl xl:max-w-7xl">
        {posts.length > 0 ? (
          <div className="space-y-0">
            {posts.map((post, index) => (
              <article key={post.id} className="bg-surface border-b border-surface-variant/20 last:border-b-0">
                <PostCard
                  post={{
                    id: post.id,
                    user: {
                      id: post.user_id,
                      name: post.profiles.display_name || post.profiles.username,
                      username: post.profiles.username,
                      avatar: post.profiles.avatar_url || "",
                      verified: false,
                    },
                    content: post.media_url
                      ? {
                          type: post.media_type as "image" | "video",
                          url: post.media_url,
                        }
                      : null,
                    caption: post.caption || "",
                    likes: post.likes?.length || 0,
                    comments: post.comments?.length || 0,
                    shares: 0,
                    view_count: post.view_count || 0,
                    timeAgo: formatTimeAgo(post.created_at),
                  }}
                  onRefresh={fetchPosts}
                />
              </article>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 px-4">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-400 to-secondary-400 flex items-center justify-center mb-6">
              <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200 mb-2">Welcome to Sooz</h3>
            <p className="text-neutral-600 dark:text-neutral-400 text-center max-w-sm">
              When you follow people, you'll see the photos and videos they post here.
            </p>
            <button className="mt-6 bg-primary-500 hover:bg-primary-600 text-white font-semibold px-6 py-3 rounded-lg transition-colors">
              Discover People
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Feed;
