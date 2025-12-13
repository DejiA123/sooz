
import { useEffect, useState } from "react";
import { StoryRail } from "@/components/feed/StoryRail";
import { PostCard } from "@/components/feed/PostCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

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
}

export default function Index() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostWithUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPosts();
  }, [user]);

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from("posts")
        .select(`
          *,
          profiles:user_id (id, username, avatar_url, display_name),
          likes (count),
          comments (count),
          user_likes:likes (id)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Transform data to include is_liked_by_user filter which isn't directly possible in one query with simple filters
      // We are fetching all user_likes, filtering in JS for now or using the filter on the join if possible.
      // For simplicity in this v1, checking if user_likes has entries for current user

      // Since specific filter on joined table is tricky with Supabase basic client without complex modifiers
      // and we want efficient queries, we might need a separate query or an RPC for "is_liked_by_user".
      // BUT for now, let's just try to map the returned structure

      const transformedPosts = (data || []).map(post => ({
        ...post,
        // @ts-ignore - Supabase type inference for joined tables can be tricky
        likes_count: post.likes[0]?.count || 0,
        // @ts-ignore
        comments_count: post.comments[0]?.count || 0,
        // @ts-ignore 
        is_liked_by_user: user ? post.user_likes.some(like => like.user_id === user.id) : false
      }));

      // NOTE: The above logic for is_liked_by_user is imperfect because we can't easily filter the nested `user_likes` by current user ID 
      // AND get the total count in one go without raw SQL or RPCs properly.
      // So ensuring we only fetched OUR likes would require .eq('likes.user_id', user.id). 
      // But that filters the PARENT rows if using inner join logic.
      // Let's rely on a second pass or just accept that for this demo we might need to adjust.

      // Better approach for `is_liked_by_user`:
      // Since we can't easily do it in one query without an RPC, let's fetch the posts, then fetch the user's likes for these posts.

      // Re-fetching with a better strategy
      const { data: postsData, error: postsError } = await supabase
        .from("posts")
        .select(`
          *,
          profiles:user_id (id, username, avatar_url, display_name),
          likes (count),
          comments (count)
        `)
        .order("created_at", { ascending: false });

      if (postsError) throw postsError;

      let likedPostIds = new Set<string>();
      if (user) {
        const { data: userLikes } = await supabase
          .from("likes")
          .select("post_id")
          .eq("user_id", user.id);

        if (userLikes) {
          userLikes.forEach(like => likedPostIds.add(like.post_id));
        }
      }

      const finalPosts = (postsData || []).map(post => ({
        ...post,
        // @ts-ignore
        likes_count: post.likes[0]?.count || 0,
        // @ts-ignore
        comments_count: post.comments[0]?.count || 0,
        is_liked_by_user: likedPostIds.has(post.id)
      }));

      // @ts-ignore
      setPosts(finalPosts);
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center pt-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="pb-10">
      <StoryRail />
      <div className="px-1 mt-2">
        {posts.map(post => (
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
            is_liked_by_user={post.is_liked_by_user}
          />
        ))}
      </div>
    </div>
  );
}
