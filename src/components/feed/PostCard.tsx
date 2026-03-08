
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Share2, MoreHorizontal, Bookmark, Trash2, Edit, Eye } from "lucide-react";
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
import { motion } from "framer-motion";

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
  const [isSaved, setIsSaved] = useState(false);
  const [isSaveLoading, setIsSaveLoading] = useState(false);

  useEffect(() => {
    if (typeof initialSaved !== 'undefined') setIsSaved(initialSaved);
  }, [initialSaved]);

  const handleSave = async () => {
    if (!currentUser) { toast.error("Please login to save posts"); return; }
    if (isSaveLoading) return;
    setIsSaveLoading(true);
    const previousSaved = isSaved;
    setIsSaved(!isSaved);
    try {
      if (previousSaved) {
        const { error } = await supabase.from('bookmarks').delete().eq('user_id', currentUser.id).eq('post_id', id);
        if (error) throw error;
        toast.success("Post unsaved");
      } else {
        const { error } = await supabase.from('bookmarks').insert({ user_id: currentUser.id, post_id: id });
        if (error) throw error;
        toast.success("Post saved");
      }
    } catch (error) {
      setIsSaved(previousSaved);
      toast.error("Failed to update bookmark");
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
  const [showDoubleTapHeart, setShowDoubleTapHeart] = useState(false);
  const lastTapRef = useRef(0);

  const isOwner = currentUser?.id === user.id;

  useEffect(() => {
    if (hasTrackedView || !postRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasTrackedView) {
          setHasTrackedView(true);
          setViews(prev => prev + 1);
          (async () => {
            try { await supabase.from('post_views').insert({ post_id: id }); } catch (err) { console.error(err); }
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
    if (!currentUser) { toast.error("Please login to like posts"); navigate("/auth"); return; }
    if (isLikeLoading) return;
    setIsLikeLoading(true);
    const newLikedState = !isLiked;
    setIsLiked(newLikedState);
    setLikes(prev => newLikedState ? prev + 1 : prev - 1);
    try {
      if (newLikedState) {
        const { error } = await supabase.from("likes").insert({ post_id: id, user_id: currentUser.id });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("likes").delete().eq("post_id", id).eq("user_id", currentUser.id);
        if (error) throw error;
      }
    } catch (error) {
      setIsLiked(!newLikedState);
      setLikes(prev => !newLikedState ? prev + 1 : prev - 1);
      toast.error("Failed to update like");
    } finally {
      setIsLikeLoading(false);
    }
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (!isLiked) handleLike();
      setShowDoubleTapHeart(true);
      setTimeout(() => setShowDoubleTapHeart(false), 800);
    }
    lastTapRef.current = now;
  };

  const handleDelete = async () => {
    if (!currentUser || currentUser.id !== user.id) { toast.error("You can only delete your own posts"); return; }
    if (!confirm("Are you sure you want to delete this post?")) return;
    try {
      const { error } = await supabase.from("posts").delete().eq("id", id);
      if (error) throw error;
      setIsDeleted(true);
    } catch (error) {
      toast.error("Failed to delete post");
    }
  };

  if (isDeleted) return null;

  const timeAgo = formatDistanceToNow(new Date(created_at), { addSuffix: false });

  return (
    <>
      <motion.article
        ref={postRef}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="group"
      >
        {/* Full-bleed media with rounded corners */}
        {media_url && (
          <div
            className="relative w-full overflow-hidden rounded-2xl shadow-sm mx-auto"
            onClick={handleDoubleTap}
          >
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
                className="w-full h-full object-cover max-h-[560px]"
                priority={priority}
              />
            )}

            {/* Double-tap heart animation */}
            {showDoubleTapHeart && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.5, opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
              >
                <Heart className="w-20 h-20 text-white fill-white drop-shadow-2xl" />
              </motion.div>
            )}

            {/* Video view count */}
            {media_type === 'video' && initialViews > 0 && (
              <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background/60 backdrop-blur-xl">
                <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[11px] font-bold text-muted-foreground">{initialViews.toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        {/* Content section — editorial newspaper style */}
        <div className="px-1 py-3">
          {/* Bold username on its own line */}
          <Link to={`/profile/${user.username}`} className="text-[16px] font-extrabold text-foreground hover:underline decoration-1 underline-offset-2">
            {user.display_name || user.username}
          </Link>

          {/* Avatar + timestamp row */}
          <div className="flex items-center gap-2 mt-1 mb-2.5">
            <Link to={`/profile/${user.username}`}>
              <Avatar className="w-5 h-5">
                <AvatarImage src={user.avatar_url || ""} className="object-cover" />
                <AvatarFallback className="bg-primary/10 text-primary text-[8px] font-bold">{(user.display_name || user.username)[0].toUpperCase()}</AvatarFallback>
              </Avatar>
            </Link>
            <span className="text-[12px] text-muted-foreground">@{user.username}</span>
            <span className="text-[12px] text-muted-foreground/50">·</span>
            <span className="text-[12px] text-muted-foreground/50">{timeAgo}</span>

            <div className="ml-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-secondary">
                    <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl border-border bg-popover backdrop-blur-xl">
                  <DropdownMenuItem onClick={handleSave} className="rounded-lg">
                    <Bookmark className={cn("w-4 h-4 mr-2", isSaved && "fill-current")} /> {isSaved ? "Unsave" : "Save"}
                  </DropdownMenuItem>
                  {isOwner && (
                    <>
                      <DropdownMenuItem onClick={() => setShowEditDialog(true)} className="rounded-lg">
                        <Edit className="w-4 h-4 mr-2" /> Edit Post
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleDelete} className="rounded-lg text-destructive focus:text-destructive focus:bg-destructive/10">
                        <Trash2 className="w-4 h-4 mr-2" /> Delete Post
                      </DropdownMenuItem>
                    </>
                  )}
                  {!isOwner && (
                    <DropdownMenuItem onClick={() => toast.success("Reported")} className="rounded-lg">
                      Report Post
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Caption — serif editorial font */}
          {caption && (
            <p className="text-[15px] leading-relaxed text-foreground/85 font-serif line-clamp-3 mb-3">
              {caption}
            </p>
          )}

          {/* Action row — text links style */}
          <div className="flex items-center gap-1 text-[13px] text-muted-foreground">
            <motion.button
              whileTap={{ scale: 1.2 }}
              onClick={handleLike}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-secondary/50 transition-colors",
                isLiked && "text-destructive"
              )}
            >
              <Heart className={cn("w-4 h-4", isLiked && "fill-current")} strokeWidth={1.8} />
              {likes > 0 && <span className="font-semibold">{likes.toLocaleString()}</span>}
            </motion.button>

            <span className="text-muted-foreground/30">·</span>

            <CommentDrawer
              postId={id}
              postOwnerUsername={user.username}
              trigger={
                <button className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-secondary/50 transition-colors">
                  <MessageCircle className="w-4 h-4" strokeWidth={1.8} />
                  {comments_count > 0 && <span className="font-semibold">{comments_count}</span>}
                </button>
              }
            />

            <span className="text-muted-foreground/30">·</span>

            <button
              className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-secondary/50 transition-colors"
              onClick={async () => {
                const appDomain = import.meta.env.VITE_APP_DOMAIN || 'https://sooz.vercel.app';
                const postUrl = `${appDomain}/share/${id}`;
                try {
                  if (navigator.share) { await navigator.share({ url: postUrl }); }
                  else { await navigator.clipboard.writeText(postUrl); toast.success("Link copied!"); }
                } catch (err) {
                  await navigator.clipboard.writeText(postUrl);
                  toast.success("Link copied!");
                }
              }}
            >
              <Share2 className="w-4 h-4" strokeWidth={1.8} />
              <span className="font-medium">Share</span>
            </button>
          </div>
        </div>
      </motion.article>

      {showVideoFeed && (
        <VideoFeedModal
          initialPost={{ id, user, caption, media_url, media_type, created_at, likes: [], likes_count: initialLikes, comments: [{ count: comments_count }], profiles: { username: user.username, display_name: user.display_name, avatar_url: user.avatar_url } }}
          startTime={videoStartTime}
          onClose={() => setShowVideoFeed(false)}
        />
      )}
      <EditPostDialog post={{ id, caption }} open={showEditDialog} onOpenChange={setShowEditDialog} onUpdate={setCaption} />
    </>
  );
};
