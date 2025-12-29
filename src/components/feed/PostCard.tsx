

import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Share2, MoreHorizontal, Bookmark, Play, Trash2, Edit } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
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
import { LazyVideo } from "./LazyVideo";

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
  views_count?: number;
  is_liked_by_user?: boolean;
  is_saved_by_user?: boolean;
  priority?: boolean;
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
  views_count: initialViews = 0,
  is_liked_by_user: initialLiked,
  is_saved_by_user: initialSaved,
  priority = false
}: PostCardProps) => {
  const { user: currentUser } = useAuth();
  const isMobile = useIsMobile();
  const [likes, setLikes] = useState(initialLikes);
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [showVideoFeed, setShowVideoFeed] = useState(false);
  const [isSaved, setIsSaved] = useState(false); // Prop will be added later, default false for now
  const [isSaveLoading, setIsSaveLoading] = useState(false);

  // Initialize saved state from prop if available (we will add prop next)
  useEffect(() => {
    if (typeof initialSaved !== 'undefined') setIsSaved(initialSaved);
  }, [initialSaved]);

  const handleSave = async () => {
    if (!currentUser) {
      toast.error("Please login to save posts");
      return;
    }

    if (isSaveLoading) return;
    setIsSaveLoading(true);

    // Optimistic update
    const previousSaved = isSaved;
    setIsSaved(!isSaved);

    try {
      if (previousSaved) {
        // Unsave
        const { error } = await supabase
          .from('bookmarks')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('post_id', id);

        if (error) throw error;
        toast.success("Post unsaved");
      } else {
        // Save
        const { error } = await supabase
          .from('bookmarks')
          .insert({
            user_id: currentUser.id,
            post_id: id
          });

        if (error) throw error;
        toast.success("Post saved");
      }
    } catch (error) {
      // Revert on error
      setIsSaved(previousSaved);
      toast.error("Failed to update bookmark");
      console.error(error);
    } finally {
      setIsSaveLoading(false);
    }
  };
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [caption, setCaption] = useState(initialCaption);
  const [videoStartTime, setVideoStartTime] = useState(0);
  const [isDeleted, setIsDeleted] = useState(false);
  const [views, setViews] = useState(initialViews);
  const [hasTrackedView, setHasTrackedView] = useState(false);
  const postRef = useRef<HTMLElement>(null);

  const isOwner = currentUser?.id === user.id;

  // Track view when post enters viewport
  useEffect(() => {
    if (hasTrackedView || !postRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasTrackedView) {
          setHasTrackedView(true);
          setViews(prev => prev + 1);
          // Fire and forget - wrap in async IIFE
          (async () => {
            try {
              await supabase.rpc('increment_view_count', { post_id_param: id });
            } catch (err) {
              console.error("Failed to track view:", err);
            }
          })();
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(postRef.current);
    return () => observer.disconnect();
  }, [id, hasTrackedView]);

  const navigate = useNavigate();

  const handleLike = async () => {
    if (!currentUser) {
      toast.error("Please login to like posts");
      navigate("/auth");
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
    if (!currentUser || currentUser.id !== user.id) {
      toast.error("You can only delete your own posts");
      return;
    }
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
      <article ref={postRef} className="mb-4 border-b border-white/5 pb-4 last:border-0 sm:border sm:rounded-lg sm:bg-card">
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
                <h3 className="font-semibold text-base leading-none">{user.display_name || user.username}</h3>
              </Link>
              {/* Optional: Location or subtext could go here */}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
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
          <div className="relative w-full flex items-center justify-center">
            {media_type === 'video' ? (
              <LazyVideo
                src={media_url}
                id={id}
                priority={priority}
                onClick={isMobile ? (time) => {
                  setVideoStartTime(time);
                  setShowVideoFeed(true);
                } : undefined}
              />
            ) : (
              <img
                src={media_url}
                alt="Post"
                className="w-full max-h-[600px] object-contain"
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
                  className={cn("w-6 h-6 transition-all", isLiked ? "fill-red-500 text-red-500 scale-110" : "text-foreground")}
                  strokeWidth={2}
                />
              </button>

              <CommentDrawer
                postId={id}
                postOwnerUsername={user.username}
                trigger={
                  <button className="hover:opacity-70 transition-opacity focus:outline-none">
                    <MessageCircle className="w-6 h-6 text-foreground -rotate-90" strokeWidth={2} />
                  </button>
                }
              />

              <button
                className="hover:opacity-70 transition-opacity focus:outline-none"
                onClick={async () => {
                  const postUrl = `${window.location.origin}/s/${id}`;
                  try {
                    if (navigator.share) {
                      await navigator.share({
                        url: postUrl,
                      });
                    } else {
                      await navigator.clipboard.writeText(postUrl);
                      toast.success("Link copied to clipboard!");
                    }
                  } catch (err) {
                    await navigator.clipboard.writeText(postUrl);
                    toast.success("Link copied to clipboard!");
                  }
                }}
              >
                <Share2 className="w-6 h-6 text-foreground" strokeWidth={2} />
              </button>
            </div>

            <button
              className="hover:opacity-70 transition-opacity focus:outline-none"
              onClick={handleSave}
              disabled={isSaveLoading}
            >
              <Bookmark
                className={cn("w-6 h-6 transition-all", isSaved ? "fill-foreground text-foreground" : "text-foreground")}
                strokeWidth={2}
              />
            </button>
          </div>

          {/* Likes */}
          <div className="mb-2">
            <p className="text-base font-semibold">{likes.toLocaleString()} likes</p>
          </div>

          {/* Caption */}
          {caption && (
            <div className="mb-1">
              <p className="text-base leading-normal">
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
          startTime={videoStartTime}
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

