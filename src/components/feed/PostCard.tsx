import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface PostCardProps {
  post: {
    id: string;
    user: {
      id: string;
      name: string;
      username: string;
      avatar: string;
      verified?: boolean;
    };
    content: {
      type: "image" | "video";
      url: string;
    } | null;
    caption: string;
    likes: number;
    comments: number;
    shares: number;
    timeAgo: string;
  };
  onRefresh?: () => void;
}

const PostCard = ({ post, onRefresh }: PostCardProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes);
  const [isLiking, setIsLiking] = useState(false);

  useEffect(() => {
    if (user) {
      checkIfLiked();
      checkIfSaved();
    }
  }, [user, post.id]);

  const checkIfLiked = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("likes")
      .select("id")
      .eq("user_id", user.id)
      .eq("post_id", post.id)
      .maybeSingle();
    setLiked(!!data);
  };

  const checkIfSaved = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("bookmarks")
      .select("id")
      .eq("user_id", user.id)
      .eq("post_id", post.id)
      .maybeSingle();
    setSaved(!!data);
  };

  const handleLike = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }

    if (isLiking) return;
    setIsLiking(true);

    if (liked) {
      setLiked(false);
      setLikesCount((prev) => prev - 1);
      await supabase
        .from("likes")
        .delete()
        .eq("user_id", user.id)
        .eq("post_id", post.id);
    } else {
      setLiked(true);
      setLikesCount((prev) => prev + 1);
      await supabase.from("likes").insert({
        user_id: user.id,
        post_id: post.id,
      });
    }

    setIsLiking(false);
  };

  const handleSave = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }

    if (saved) {
      setSaved(false);
      await supabase
        .from("bookmarks")
        .delete()
        .eq("user_id", user.id)
        .eq("post_id", post.id);
      toast.success("Removed from saved");
    } else {
      setSaved(true);
      await supabase.from("bookmarks").insert({
        user_id: user.id,
        post_id: post.id,
      });
      toast.success("Saved to collection");
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  return (
    <article className="bg-card rounded-2xl overflow-hidden border border-border/50 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div 
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => navigate(`/profile/${post.user.username}`)}
        >
          <div className="relative">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-secondary p-[2px]">
              {post.user.avatar ? (
                <img
                  src={post.user.avatar}
                  alt={post.user.name}
                  className="w-full h-full rounded-full object-cover bg-background"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-muted flex items-center justify-center">
                  <span className="text-sm font-bold">
                    {post.user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            {post.user.verified && (
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className="font-semibold text-sm">{post.user.name}</span>
            </div>
            <span className="text-xs text-muted-foreground">@{post.user.username} · {post.timeAgo}</span>
          </div>
        </div>
        <Button variant="icon" size="icon-sm">
          <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
        </Button>
      </div>

      {/* Content */}
      {post.content && (
        <div className="relative bg-muted aspect-square">
          {post.content.type === "image" ? (
            <img
              src={post.content.url}
              alt="Post content"
              className="w-full h-full object-cover"
            />
          ) : (
            <video
              src={post.content.url}
              className="w-full h-full object-cover"
              controls
            />
          )}
          {post.content.type === "video" && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/20 pointer-events-none">
              <div className="w-16 h-16 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center">
                <Play className="w-8 h-8 text-foreground ml-1" fill="currentColor" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1">
            <Button 
              variant="icon" 
              size="icon" 
              onClick={handleLike}
              className={cn(liked && "text-red-500")}
            >
              <Heart 
                className={cn(
                  "w-6 h-6 transition-all",
                  liked && "fill-current animate-heart-beat"
                )} 
              />
            </Button>
            <Button variant="icon" size="icon">
              <MessageCircle className="w-6 h-6" />
            </Button>
            <Button variant="icon" size="icon">
              <Send className="w-6 h-6" />
            </Button>
          </div>
          <Button 
            variant="icon" 
            size="icon"
            onClick={handleSave}
          >
            <Bookmark 
              className={cn(
                "w-6 h-6 transition-all",
                saved && "fill-current text-primary"
              )} 
            />
          </Button>
        </div>

        {/* Stats */}
        <div className="space-y-2">
          <div className="flex items-center gap-4 text-sm">
            <span className="font-semibold">{formatNumber(likesCount)} likes</span>
            <span className="text-muted-foreground">{formatNumber(post.comments)} comments</span>
          </div>
          
          {/* Caption */}
          {post.caption && (
            <p className="text-sm">
              <span 
                className="font-semibold mr-2 cursor-pointer hover:underline"
                onClick={() => navigate(`/profile/${post.user.username}`)}
              >
                {post.user.username}
              </span>
              {post.caption}
            </p>
          )}
        </div>
      </div>
    </article>
  );
};

export default PostCard;
