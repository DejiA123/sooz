
import { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, MessageCircle, Share2, MoreHorizontal, Bookmark, Play, Trash2, Edit } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CommentDrawer } from "./CommentDrawer";
import { VideoFeedModal } from "./VideoFeedModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditPostDialog } from "./EditPostDialog";

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
  caption: initialCaption,
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
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [caption, setCaption] = useState(initialCaption);
  const [isDeleted, setIsDeleted] = useState(false);

  const isOwner = currentUser?.id === user.id;

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

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this post?")) return;

    try {
      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setIsDeleted(true);
      toast.success("Post deleted");
    } catch (error) {
      console.error("Error deleting post:", error);
      toast.error("Failed to delete post");
    }
  };

  if (isDeleted) return null;

  return (
    <>
      <article className="mb-4 border-b border-white/5 pb-4 last:border-0 sm:border sm:rounded-lg sm:bg-card">
        {/* Header */}
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-3">
            <Link to={`/profile/${user.username}`}>
              <Avatar className="w-8 h-8 cursor-pointer ring-2 ring-transparent hover:ring-primary/20 transition-all">
                <AvatarImage src={user.avatar_url || ""} className="object-cover" />
                <AvatarFallback>{(user.display_name || user.username)[0].toUpperCase()}</AvatarFallback>
              </Avatar>
            </Link>
            <div>
              <Link to={`/profile/${user.username}`} className="hover:opacity-80 transition-opacity">
                <h3 className="font-semibold text-sm leading-none">{user.display_name || user.username}</h3>
              </Link>
              {/* Optional: Location or subtext could go here */}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white/50 hover:text-white">
                <MoreHorizontal className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isOwner && (
                <>
                  <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDelete} className="text-red-500 hover:text-red-600">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
              {!isOwner && (
                <DropdownMenuItem onClick={() => toast.success("Reported (Mock)")}>
                  Report
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Media - Full bleed on mobile */}
        {media_url && (
          <div className="relative w-full aspect-square bg-muted flex items-center justify-center overflow-hidden">
            {media_type === 'video' ? (
              <div
                className="w-full h-full relative group cursor-pointer"
                onClick={() => setShowVideoFeed(true)}
              >
                <video
                  src={media_url}
                  className="w-full h-full object-cover"
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  poster=""
                  onMouseOver={e => e.currentTarget.play()}
                  onMouseOut={e => e.currentTarget.pause()}
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-black/30 rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="w-6 h-6 text-white fill-white" />
                  </div>
                </div>
                <div className="absolute bottom-3 right-3 bg-black/50 p-1.5 rounded-full">
                  <Play className="w-3 h-3 text-white fill-white" />
                </div>
              </div>
            ) : (
              <img
                src={media_url}
                alt="Post"
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
            )}
          </div>
        )}

        {/* Action Bar */}
        <div className="px-3 pt-3 pb-1">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4">
              <button
                onClick={handleLike}
                className="hover:opacity-70 transition-opacity focus:outline-none"
              >
                <Heart
                  className={cn("w-6 h-6 transition-all", isLiked ? "fill-red-500 text-red-500 scale-110" : "text-white")}
                  strokeWidth={2}
                />
              </button>

              <CommentDrawer
                postId={id}
                postOwnerUsername={user.username}
                trigger={
                  <button className="hover:opacity-70 transition-opacity focus:outline-none">
                    <MessageCircle className="w-6 h-6 text-white -rotate-90" strokeWidth={2} />
                  </button>
                }
              />

              <button className="hover:opacity-70 transition-opacity focus:outline-none">
                <Share2 className="w-6 h-6 text-white" strokeWidth={2} />
              </button>
            </div>

            <button className="hover:opacity-70 transition-opacity focus:outline-none">
              <Bookmark className="w-6 h-6 text-white" strokeWidth={2} />
            </button>
          </div>

          {/* Likes */}
          <div className="mb-2">
            <p className="text-sm font-semibold">{likes.toLocaleString()} likes</p>
          </div>

          {/* Caption */}
          {caption && (
            <div className="mb-1">
              <p className="text-sm leading-normal">
                <Link to={`/profile/${user.username}`} className="font-semibold hover:underline mr-2">
                  {user.username}
                </Link>
                {caption}
              </p>
            </div>
          )}

          {/* Comments Link */}
          {comments_count > 0 && (
            <div className="mb-1">
              <CommentDrawer
                postId={id}
                postOwnerUsername={user.username}
                trigger={
                  <button className="text-sm text-neutral-500 hover:text-neutral-300">
                    View all {comments_count} comments
                  </button>
                }
              />
            </div>
          )}

          {/* Time */}
          <p className="text-[10px] text-neutral-500 uppercase tracking-wide">
            {formatDistanceToNow(new Date(created_at), { addSuffix: false })} ago
          </p>
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
            likes: [],
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

      <EditPostDialog
        post={{ id, caption }}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onUpdate={setCaption}
      />
    </>
  );
};

