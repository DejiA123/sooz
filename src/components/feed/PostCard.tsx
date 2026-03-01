

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
import { LazyImage } from "./LazyImage";

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
          // Fire and forget - track view via insert
          (async () => {
            try {
              await supabase.from('post_views').insert({ post_id: id });
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
    } catch (error) {
      console.error("Error deleting post:", error);
      toast.error("Failed to delete post");
    }
  };

  if (isDeleted) return null;

  return (
    <>
      <article ref={postRef} className="mb-10 sm:mb-12 overflow-hidden bg-card border-y sm:border sm:rounded-[2.5rem] border-white/5 sm:shadow-premium transition-shadow duration-500 hover:shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 px-5">
          <div className="flex items-center gap-3">
            <Link to={`/profile/${user.username}`}>
              <Avatar className="w-10 h-10 cursor-pointer ring-2 ring-primary/10 hover:ring-primary/30 transition-all duration-300">
                <AvatarImage src={user.avatar_url || ""} className="object-cover" />
                <AvatarFallback className="bg-primary/5 text-primary font-bold">{(user.display_name || user.username)[0].toUpperCase()}</AvatarFallback>
              </ Avatar>
            </Link>
            <div className="flex flex-col justify-center">
              <Link to={`/profile/${user.username}`} className="hover:opacity-80 transition-opacity">
                <h3 className="font-display font-bold text-[15px] leading-tight tracking-tight">{user.display_name || user.username}</h3>
              </Link>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-secondary/50 transition-colors">
                <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl border-white/10 bg-background/95 backdrop-blur-xl">
              {isOwner && (
                <>
                  <DropdownMenuItem onClick={() => setShowEditDialog(true)} className="rounded-xl">
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Post
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDelete} className="rounded-xl text-red-500 focus:text-red-500 focus:bg-red-500/10">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Post
                  </DropdownMenuItem>
                </>
              )}
              {!isOwner && (
                <DropdownMenuItem onClick={() => toast.success("Reported (Mock)")} className="rounded-xl">
                  Report Post
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Media - Full bleed on mobile */}
        {media_url && (
          <div className="relative w-full overflow-hidden bg-muted/20 border-y border-white/5">
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
              <LazyImage
                src={media_url}
                alt="Post"
                className="w-full h-full object-cover max-h-[700px] transition-transform duration-700 hover:scale-105"
                priority={priority}
              />
            )}

            {/* View Count Overlay for Video */}
            {media_type === 'video' && initialViews > 0 && (
              <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-black/20 backdrop-blur-md border border-white/10 text-[11px] font-bold text-white pointer-events-none">
                {initialViews.toLocaleString()} views
              </div>
            )}
          </div>
        )}

        {/* Action Bar & Content */}
        <div className="p-5 pt-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-5">
              <button
                onClick={handleLike}
                className="transform transition-all duration-200 active:scale-125 focus:outline-none"
              >
                <Heart
                  className={cn("w-7 h-7 transition-all", isLiked ? "fill-red-500 text-red-500" : "text-foreground")}
                  strokeWidth={2}
                />
              </button>

              <CommentDrawer
                postId={id}
                postOwnerUsername={user.username}
                trigger={
                  <button className="transform transition-transform active:scale-90 focus:outline-none">
                    <MessageCircle className="w-7 h-7 text-foreground" strokeWidth={2} />
                  </button>
                }
              />

              <button
                className="transform transition-transform active:scale-90 focus:outline-none"
                onClick={async () => {
                  const appDomain = import.meta.env.VITE_APP_DOMAIN || 'https://sooz.vercel.app';
                  const postUrl = `${appDomain}/share/${id}`;

                  try {
                    if (navigator.share) {
                      await navigator.share({ url: postUrl });
                    } else {
                      await navigator.clipboard.writeText(postUrl);
                      toast.success("Link copied!");
                    }
                  } catch (err) {
                    await navigator.clipboard.writeText(postUrl);
                    toast.success("Link copied!");
                  }
                }}
              >
                <Share2 className="w-7 h-7 text-foreground" strokeWidth={2} />
              </button>
            </div>

            <button
              className="transform transition-transform active:scale-90 focus:outline-none"
              onClick={handleSave}
              disabled={isSaveLoading}
            >
              <Bookmark
                className={cn("w-7 h-7 transition-all", isSaved ? "fill-primary text-primary" : "text-foreground")}
                strokeWidth={2}
              />
            </button>
          </div>

          {/* Likes & Caption Section */}
          <div className="space-y-2">
            <p className="text-[15px] font-bold tracking-tight">{likes.toLocaleString()} likes</p>

            {caption && (
              <div className="group">
                <p className="text-[15px] leading-relaxed">
                  <Link to={`/profile/${user.username}`} className="font-bold hover:underline mr-2">
                    {user.username}
                  </Link>
                  <span className="text-foreground/90">{caption}</span>
                </p>
              </div>
            )}

            {/* Comments & Timestamp */}
            <div className="flex flex-col gap-1.5 pt-1">
              {comments_count > 0 && (
                <CommentDrawer
                  postId={id}
                  postOwnerUsername={user.username}
                  trigger={
                    <button className="text-[14px] text-muted-foreground hover:text-foreground transition-colors text-left w-fit">
                      View all {comments_count} comments
                    </button>
                  }
                />
              )}

              <p className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-widest pt-1">
                {formatDistanceToNow(new Date(created_at), { addSuffix: false })} ago
              </p>
            </div>
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

