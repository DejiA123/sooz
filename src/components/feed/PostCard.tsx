
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Share2, MoreHorizontal, Bookmark, Trash2, Edit, Eye, Flame } from "lucide-react";
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
    if (!currentUser) {
      toast.error("Please login to save posts");
      return;
    }
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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="group relative mx-2 sm:mx-0"
      >
        {/* Card with media-first design */}
        <div className="relative overflow-hidden rounded-[20px] sm:rounded-[24px] bg-card border border-border/50 shadow-sm hover:shadow-lg transition-shadow duration-500">
          
          {/* Media Section - Hero style */}
          {media_url && (
            <div className="relative w-full overflow-hidden">
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
                  className="w-full h-full object-cover max-h-[520px]"
                  priority={priority}
                />
              )}

              {/* Floating top-left badge */}
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <Link to={`/profile/${user.username}`} className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-background/70 backdrop-blur-xl border border-border/30 hover:bg-background/90 transition-all">
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={user.avatar_url || ""} className="object-cover" />
                    <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">{(user.display_name || user.username)[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="text-[12px] font-bold text-foreground">{user.username}</span>
                </Link>
              </div>

              {/* Floating time badge */}
              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-background/60 backdrop-blur-xl border border-border/20 text-[11px] font-semibold text-muted-foreground">
                {timeAgo}
              </div>

              {/* Video view count */}
              {media_type === 'video' && initialViews > 0 && (
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background/60 backdrop-blur-xl border border-border/20">
                  <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-bold text-muted-foreground">{initialViews.toLocaleString()}</span>
                </div>
              )}
            </div>
          )}

          {/* Content footer - compact & modern */}
          <div className="px-4 py-3">
            {/* Caption */}
            {caption && (
              <p className="text-[14px] leading-relaxed mb-2.5 line-clamp-2">
                <span className="text-foreground/90">{caption}</span>
              </p>
            )}

            {/* No media - show user info inline */}
            {!media_url && (
              <div className="flex items-center gap-2.5 mb-3">
                <Link to={`/profile/${user.username}`}>
                  <Avatar className="w-8 h-8 ring-1 ring-border">
                    <AvatarImage src={user.avatar_url || ""} className="object-cover" />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{(user.display_name || user.username)[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Link>
                <div>
                  <Link to={`/profile/${user.username}`} className="text-[13px] font-bold hover:underline">{user.display_name || user.username}</Link>
                  <p className="text-[11px] text-muted-foreground">{timeAgo} ago</p>
                </div>
              </div>
            )}

            {/* Action bar - horizontal with engagement counts */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {/* Like */}
                <motion.button
                  whileTap={{ scale: 1.3 }}
                  onClick={handleLike}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200",
                    isLiked 
                      ? "bg-destructive/10 text-destructive" 
                      : "hover:bg-secondary text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Heart className={cn("w-[18px] h-[18px]", isLiked && "fill-current")} strokeWidth={2} />
                  <span className="text-[13px] font-bold">{likes > 0 ? likes.toLocaleString() : ''}</span>
                </motion.button>

                {/* Comment */}
                <CommentDrawer
                  postId={id}
                  postOwnerUsername={user.username}
                  trigger={
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-all">
                      <MessageCircle className="w-[18px] h-[18px]" strokeWidth={2} />
                      <span className="text-[13px] font-bold">{comments_count > 0 ? comments_count : ''}</span>
                    </button>
                  }
                />

                {/* Share */}
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-all"
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
                  <Share2 className="w-[18px] h-[18px]" strokeWidth={2} />
                </button>
              </div>

              <div className="flex items-center gap-1">
                {/* Bookmark */}
                <motion.button
                  whileTap={{ scale: 1.2 }}
                  className={cn(
                    "p-2 rounded-full transition-all",
                    isSaved ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                  onClick={handleSave}
                  disabled={isSaveLoading}
                >
                  <Bookmark className={cn("w-[18px] h-[18px]", isSaved && "fill-current")} strokeWidth={2} />
                </motion.button>

                {/* More menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-secondary">
                      <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-2xl border-border bg-popover backdrop-blur-xl">
                    {isOwner && (
                      <>
                        <DropdownMenuItem onClick={() => setShowEditDialog(true)} className="rounded-xl">
                          <Edit className="w-4 h-4 mr-2" /> Edit Post
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleDelete} className="rounded-xl text-destructive focus:text-destructive focus:bg-destructive/10">
                          <Trash2 className="w-4 h-4 mr-2" /> Delete Post
                        </DropdownMenuItem>
                      </>
                    )}
                    {!isOwner && (
                      <DropdownMenuItem onClick={() => toast.success("Reported")} className="rounded-xl">
                        Report Post
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
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
