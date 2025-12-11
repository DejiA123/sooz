import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import PostCard from "./PostCard";
import StoriesBar from "./StoriesBar";
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

const Feed = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

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
      <div className="pt-16 pb-24 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
      <div className="px-4 space-y-6">
        {posts.length > 0 ? (
          posts.map((post) => (
            <PostCard
              key={post.id}
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
                timeAgo: formatTimeAgo(post.created_at),
              }}
              onRefresh={fetchPosts}
            />
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
