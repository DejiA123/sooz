
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
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="group"
      >
        {/* Full-bleed media */}
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
                className="w-full h-full object-cover max-h-[560px]"
                priority={priority}
              />
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

        {/* Content section with left accent */}
        <div className="flex">
          <div className="w-[3px] bg-primary/40 rounded-full my-2 ml-4 shrink-0" />
          <div className="flex-1 px-4 py-3">
            {/* User info row */}
            <div className="flex items-center gap-2.5 mb-2">
              <Link to={`/profile/${user.username}`}>
                <Avatar className="w-7 h-7">
                  <AvatarImage src={user.avatar_url || ""} className="object-cover" />
                  <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">{(user.display_name || user.username)[0].toUpperCase()}</AvatarFallback>
                </Avatar>
              </Link>
              <Link to={`/profile/${user.username}`} className="text-[13px] font-bold text-foreground hover:underline">
                {user.username}
              </Link>
              <span className="text-[11px] text-muted-foreground">·</span>
              <span className="text-[11px] text-muted-foreground">{timeAgo}</span>
              
              <div className="ml-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-secondary">
                      <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl border-border bg-popover backdrop-blur-xl">
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

            {/* Caption */}
            {caption && (
              <p className="text-[15px] leading-relaxed text-foreground/90 line-clamp-3 mb-3">
                {caption}
              </p>
            )}

            {/* Action row — icon-only with counts stacked vertically */}
            <div className="flex items-center gap-5">
              <motion.button
                whileTap={{ scale: 1.3 }}
                onClick={handleLike}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Heart className={cn("w-[18px] h-[18px]", isLiked && "fill-current text-destructive")} strokeWidth={1.8} />
                {likes > 0 && <span className="text-[12px] font-semibold">{likes.toLocaleString()}</span>}
              </motion.button>

              <CommentDrawer
                postId={id}
                postOwnerUsername={user.username}
                trigger={
                  <button className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                    <MessageCircle className="w-[18px] h-[18px]" strokeWidth={1.8} />
                    {comments_count > 0 && <span className="text-[12px] font-semibold">{comments_count}</span>}
                  </button>
                }
              />

              <button
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
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
                <Share2 className="w-[18px] h-[18px]" strokeWidth={1.8} />
              </button>

              <div className="ml-auto">
                <motion.button
                  whileTap={{ scale: 1.2 }}
                  className={cn(
                    "transition-colors",
                    isSaved ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={handleSave}
                  disabled={isSaveLoading}
                >
                  <Bookmark className={cn("w-[18px] h-[18px]", isSaved && "fill-current")} strokeWidth={1.8} />
                </motion.button>
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
