import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PostCard } from "./PostCard";
import StoriesBar from "./StoriesBar";
import { PostCardSkeleton } from "./PostCardSkeleton";
import { Loader2 } from "lucide-react";

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

import { useVideoPreloader } from "@/hooks/useVideoPreloader";

const Feed = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  // Aggressively preload next videos with optimized memory management
  useVideoPreloader(posts);

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

    if (!error && data) {
      setPosts(data as Post[]);
    }
    setLoading(false);
  };



  if (loading) {
    return (
      <div className="pt-16 pb-24">
        <StoriesBar />
        <div className="h-px bg-border mx-0 md:mx-4 mb-4" />
        <div className="px-0 md:px-4 space-y-6">
          {[1, 2, 3].map((i) => (
            <PostCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pt-16 pb-24">
      {/* Stories */}
      <StoriesBar />

      {/* Divider */}
      <div className="h-px bg-border mx-4 mb-4" />

      {/* Posts */}
      <div className="px-0 md:px-4 space-y-6">
        {posts.length > 0 ? (
          posts.map((post, index) => (
            <div key={post.id} className="space-y-6">
              <PostCard
                id={post.id}
                user={{
                  id: post.user_id,
                  username: post.profiles.username,
                  display_name: post.profiles.display_name,
                  avatar_url: post.profiles.avatar_url,
                }}
                caption={post.caption}
                media_url={post.media_url}
                media_type={post.media_type}
                created_at={post.created_at}
                // @ts-ignore
                likes_count={post.likes?.length || 0}
                // @ts-ignore
                comments_count={post.comments?.length || 0}
              />
            </div>
          ))
        ) : (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">No posts yet. Be the first to share!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Feed;
