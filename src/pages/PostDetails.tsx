import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PostCard } from "@/components/feed/PostCard";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function PostDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [post, setPost] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            fetchPost();
        }
    }, [id, user]);

    const fetchPost = async () => {
        try {
            setLoading(true);
            const { data: postData, error } = await supabase
                .from("posts")
                .select(`
          *,
          profiles:user_id (id, username, avatar_url, display_name),
          likes (count),
          comments (count)
        `)
                .eq("id", id)
                .single();

            if (error) throw error;

            if (postData) {
                let isLiked = false;
                if (user) {
                    const { data: likeData } = await supabase
                        .from("likes")
                        .select("id")
                        .eq("post_id", id)
                        .eq("user_id", user.id)
                        .single();

                    if (likeData) isLiked = true;
                }

                setPost({
                    ...postData,
                    // @ts-ignore
                    likes_count: postData.likes[0]?.count || 0,
                    // @ts-ignore
                    comments_count: postData.comments[0]?.count || 0,
                    is_liked_by_user: isLiked
                });
            }
        } catch (error) {
            console.error("Error fetching post:", error);
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

    if (!post) {
        return (
            <div className="flex flex-col items-center justify-center pt-20 gap-4">
                <p className="text-muted-foreground">Post not found</p>
                <Button variant="outline" onClick={() => navigate(-1)}>
                    Go Back
                </Button>
            </div>
        );
    }

    return (
        <div className="pb-20">
            <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-white/5 px-4 h-14 flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <h1 className="font-semibold text-lg">Post</h1>
            </div>

            <div className="p-4 max-w-xl mx-auto">
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
                    is_liked_by_user={post.is_liked_by_user}
                />
            </div>
        </div>
    );
}
