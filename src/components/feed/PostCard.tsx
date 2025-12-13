
import { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, MessageCircle, Share2, MoreHorizontal, Bookmark, Play } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CommentDrawer } from "./CommentDrawer";
import { VideoFeedModal } from "./VideoFeedModal";

interface PostCardProps {
  id: string;
  user: {
    id: string;
    username: string;
    avatar_url: string | null;
    display_name: string | null;
  };
  caption: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
  is_liked_by_user?: boolean;
}

export const PostCard = ({
  id,
  user,
  caption,
  media_url,
  media_type,
  created_at,
  likes_count: initialLikes,
  comments_count,
  is_liked_by_user: initialLiked
}: PostCardProps) => {
  const { user: currentUser } = useAuth();
  const [likes, setLikes] = useState(initialLikes);
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [showVideoFeed, setShowVideoFeed] = useState(false);

  const handleLike = async () => {
    if (!currentUser) {
      toast.error("Please login to like posts");
      return;
    }
    if (isLikeLoading) return;

    setIsLikeLoading(true);

    // Optimistic update
    const newLikedState = !isLiked;
    setIsLiked(newLikedState);
    setLikes(prev => newLikedState ? prev + 1 : prev - 1);

    try {
      if (newLikedState) {
        const { error } = await supabase
          .from("likes")
          .insert({ post_id: id, user_id: currentUser.id });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("likes")
          .delete()
          .eq("post_id", id)
          .eq("user_id", currentUser.id);
        if (error) throw error;
      }
    } catch (error) {
      // Revert optimism
      setIsLiked(!newLikedState);
      setLikes(prev => !newLikedState ? prev + 1 : prev - 1);
      toast.error("Failed to update like");
    } finally {
      setIsLikeLoading(false);
    }
  };



  // ...

  return (
    <>
      <article className="mb-6 bg-card rounded-3xl border border-white/5 overflow-hidden animate-scale-in">
        {/* Header ... */}
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Link to={`/profile/${user.username}`}>
              <Avatar className="w-10 h-10 border-2 border-primary/20 hover:border-primary transition-colors cursor-pointer">
                <AvatarImage src={user.avatar_url || ""} className="object-cover" />
                <AvatarFallback>{(user.display_name || user.username)[0].toUpperCase()}</AvatarFallback>
              </Avatar>
            </Link>
            <div>
              <Link to={`/profile/${user.username}`} className="hover:underline">
                <h3 className="font-semibold text-sm">{user.display_name || user.username}</h3>
              </Link>
              <p className="text-xs text-muted-foreground">
                @{user.username} • {formatDistanceToNow(new Date(created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <MoreHorizontal className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        {caption && (
          <div className="px-4 pb-2">
            <p className="text-sm leading-relaxed mb-3">{caption}</p>
          </div>
        )}

        {media_url && (
          <div className="relative w-full bg-muted">
            {media_type === 'video' ? (
              <div
                className="w-full relative group cursor-pointer"
                onClick={() => setShowVideoFeed(true)}
              >
                <video
                  src={media_url}
                  className="w-full max-h-[500px] object-cover"
                  muted
                  loop
                  playsInline
                  onMouseOver={e => e.currentTarget.play()}
                  onMouseOut={e => e.currentTarget.pause()}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="rounded-full bg-white/20 backdrop-blur-md p-4">
                    <Play className="w-8 h-8 text-white fill-white" />
                  </div>
                </div>
              </div>
            ) : (
              <img
                src={media_url}
                alt="Post content"
                className="w-full h-auto max-h-[500px] object-cover"
                loading="lazy"
              />
            )}
          </div>
        )}

        {/* Actions */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "hover:text-red-500 hover:bg-red-500/10 transition-colors",
                  isLiked && "text-red-500"
                )}
                onClick={handleLike}
              >
                <Heart className={cn("w-6 h-6", isLiked && "fill-current")} />
              </Button>
              <CommentDrawer
                postId={id}
                postOwnerUsername={user.username}
                trigger={
                  <Button variant="ghost" size="icon" className="hover:text-primary hover:bg-primary/10 transition-colors">
                    <MessageCircle className="w-6 h-6" />
                  </Button>
                }
              />
              <Button variant="ghost" size="icon" className="hover:text-primary hover:bg-primary/10 transition-colors">
                <Share2 className="w-6 h-6" />
              </Button>
            </div>
            <Button variant="ghost" size="icon" className="hover:text-primary hover:bg-primary/10 transition-colors">
              <Bookmark className="w-6 h-6" />
            </Button>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-semibold">{likes} likes</p>
            <p className="text-sm text-muted-foreground">View all {comments_count} comments</p>
          </div>
        </div>
      </article>

      {showVideoFeed && (
        <VideoFeedModal
          initialPost={{
            id,
            user,
            caption,
            media_url,
            media_type,
            created_at,
            likes: [], // Basic info passed, full details fetched inside modal if needed or handled via Supabase
            likes_count: initialLikes,
            comments: [{ count: comments_count }],
            profiles: {
              username: user.username,
              display_name: user.display_name,
              avatar_url: user.avatar_url
            }
          }}
          onClose={() => setShowVideoFeed(false)}
        />
      )}
    </>
  );
};
