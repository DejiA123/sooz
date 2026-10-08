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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditPostDialog } from "./EditPostDialog";
import { LazyVideo } from "./LazyVideo";
import { LazyImage } from "./LazyImage";
import { motion } from "framer-motion";

interface PostCardProps {
  id: string;
  user: { id: string; username: string; avatar_url: string | null; display_name: string | null; };
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
  id, user, caption: initialCaption, media_url, media_type, created_at,
  likes_count: initialLikes, comments_count, views_count: initialViews = 0,
  is_liked_by_user: initialLiked, is_saved_by_user: initialSaved, priority = false
}: PostCardProps) => {
  const { user: currentUser } = useAuth();
  const isMobile = useIsMobile();
  const [likes, setLikes] = useState(initialLikes);
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [showVideoFeed, setShowVideoFeed] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaveLoading, setIsSaveLoading] = useState(false);

  useEffect(() => { if (typeof initialSaved !== 'undefined') setIsSaved(initialSaved); }, [initialSaved]);

  const handleSave = async () => {
    if (!currentUser) { toast.error("Please login to save posts"); return; }
    if (isSaveLoading) return;
    setIsSaveLoading(true);
    const prev = isSaved;
    setIsSaved(!isSaved);
    try {
      if (prev) { const { error } = await supabase.from('bookmarks').delete().eq('user_id', currentUser.id).eq('post_id', id); if (error) throw error; toast.success("Post unsaved"); }
      else { const { error } = await supabase.from('bookmarks').insert({ user_id: currentUser.id, post_id: id }); if (error) throw error; toast.success("Post saved"); }
    } catch { setIsSaved(prev); toast.error("Failed to update bookmark"); }
    finally { setIsSaveLoading(false); }
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
  const [showCaption, setShowCaption] = useState(false);

  const isOwner = currentUser?.id === user.id;

  useEffect(() => {
    if (hasTrackedView || !postRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && !hasTrackedView) { setHasTrackedView(true); setViews(prev => prev + 1); (async () => { try { await supabase.from('post_views').insert({ post_id: id }); } catch (err) { console.error(err); } })(); } },
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
    const newState = !isLiked;
    setIsLiked(newState);
    setLikes(prev => newState ? prev + 1 : prev - 1);
    try {
      if (newState) { const { error } = await supabase.from("likes").insert({ post_id: id, user_id: currentUser.id }); if (error) throw error; }
      else { const { error } = await supabase.from("likes").delete().eq("post_id", id).eq("user_id", currentUser.id); if (error) throw error; }
    } catch { setIsLiked(!newState); setLikes(prev => !newState ? prev + 1 : prev - 1); toast.error("Failed to update like"); }
    finally { setIsLikeLoading(false); }
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) { if (!isLiked) handleLike(); setShowDoubleTapHeart(true); setTimeout(() => setShowDoubleTapHeart(false), 800); }
    lastTapRef.current = now;
  };

  const handleDelete = async () => {
    if (!currentUser || currentUser.id !== user.id) { toast.error("You can only delete your own posts"); return; }
    if (!confirm("Are you sure you want to delete this post?")) return;
    try { const { error } = await supabase.from("posts").delete().eq("id", id); if (error) throw error; setIsDeleted(true); }
    catch { toast.error("Failed to delete post"); }
  };

  if (isDeleted) return null;
  const timeAgo = formatDistanceToNow(new Date(created_at), { addSuffix: false });

  return (
    <>
      <motion.article
        ref={postRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="group relative"
      >
        {/* Full-bleed media — edge to edge, no radius */}
        {media_url && (
          <div className="relative w-full overflow-hidden" onClick={handleDoubleTap}>
            {media_type === 'video' ? (
              <LazyVideo
                src={media_url}
                id={id}
                priority={priority}
                onClick={isMobile ? (time) => { setVideoStartTime(time); setShowVideoFeed(true); } : undefined}
              />
            ) : (
              <LazyImage
                src={media_url}
                alt="Post"
                className="w-full h-full object-cover max-h-[600px]"
                priority={priority}
              />
            )}

            {/* Gradient overlay at bottom */}
            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 via-black/30 to-transparent pointer-events-none" />

            {/* Username + time on image */}
            <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2">
              <Link to={`/profile/${user.username}`}>
                <Avatar className="w-7 h-7 ring-2 ring-white/20">
                  <AvatarImage src={user.avatar_url || ""} className="object-cover" />
                  <AvatarFallback className="bg-white/20 text-white text-[10px] font-bold">{(user.display_name || user.username)[0].toUpperCase()}</AvatarFallback>
                </Avatar>
              </Link>
              <div>
                <Link to={`/profile/${user.username}`} className="text-white text-[14px] font-bold hover:underline decoration-1 underline-offset-2 drop-shadow-md">
                  {user.display_name || user.username}
                </Link>
                <span className="text-white/50 text-[11px] ml-2 drop-shadow-md">{timeAgo}</span>
              </div>
            </div>

            {/* Floating action pills — right edge */}
            <div className="absolute right-3 bottom-14 z-10 flex flex-col items-center gap-3">
              <motion.button whileTap={{ scale: 1.3 }} onClick={handleLike} className="flex flex-col items-center">
                <div className={cn("w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center", isLiked && "bg-destructive/80")}>
                  <Heart className={cn("w-5 h-5 text-white", isLiked && "fill-current")} strokeWidth={1.8} />
                </div>
                {likes > 0 && <span className="text-white text-[10px] font-bold mt-0.5 drop-shadow-md">{likes.toLocaleString()}</span>}
              </motion.button>

              <CommentDrawer
                postId={id}
                postOwnerUsername={user.username}
                trigger={
                  <button className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center">
                      <MessageCircle className="w-5 h-5 text-white" strokeWidth={1.8} />
                    </div>
                    {comments_count > 0 && <span className="text-white text-[10px] font-bold mt-0.5 drop-shadow-md">{comments_count}</span>}
                  </button>
                }
              />

              <button
                className="flex flex-col items-center"
                onClick={async () => {
                  const appDomain = 'https://xhqpojnmcibkaydidnex.supabase.co/functions/v1/share-preview?id=';
                  const postUrl = `${appDomain}${id}`;
                  try { if (navigator.share) await navigator.share({ url: postUrl }); else { await navigator.clipboard.writeText(postUrl); toast.success("Link copied!"); } }
                  catch { await navigator.clipboard.writeText(postUrl); toast.success("Link copied!"); }
                }}
              >
                <div className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center">
                  <Share2 className="w-5 h-5 text-white" strokeWidth={1.8} />
                </div>
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center">
                    <MoreHorizontal className="w-5 h-5 text-white" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl border-border bg-popover backdrop-blur-xl">
                  <DropdownMenuItem onClick={handleSave} className="rounded-lg">
                    <Bookmark className={cn("w-4 h-4 mr-2", isSaved && "fill-current")} /> {isSaved ? "Unsave" : "Save"}
                  </DropdownMenuItem>
                  {isOwner && (
                    <>
                      <DropdownMenuItem onClick={() => setShowEditDialog(true)} className="rounded-lg"><Edit className="w-4 h-4 mr-2" /> Edit Post</DropdownMenuItem>
                      <DropdownMenuItem onClick={handleDelete} className="rounded-lg text-destructive focus:text-destructive focus:bg-destructive/10"><Trash2 className="w-4 h-4 mr-2" /> Delete Post</DropdownMenuItem>
                    </>
                  )}
                  {!isOwner && <DropdownMenuItem onClick={() => toast.success("Reported")} className="rounded-lg">Report Post</DropdownMenuItem>}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* View count badge */}
            {media_type === 'video' && initialViews > 0 && (
              <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/30 backdrop-blur-md z-10">
                <Eye className="w-3 h-3 text-white/60" />
                <span className="text-[10px] font-bold text-white/60">{initialViews.toLocaleString()}</span>
              </div>
            )}

            {/* Double-tap heart */}
            {showDoubleTapHeart && (
              <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.5, opacity: 0 }} transition={{ duration: 0.4 }} className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <Heart className="w-20 h-20 text-white fill-white drop-shadow-2xl" />
              </motion.div>
            )}
          </div>
        )}

        {/* Caption — tap to reveal */}
        {caption && (
          <button onClick={() => setShowCaption(!showCaption)} className="w-full text-left px-4 py-2">
            <p className={cn(
              "text-[14px] leading-relaxed text-foreground/70 font-serif transition-all duration-300",
              showCaption ? "" : "line-clamp-1"
            )}>
              {caption}
            </p>
          </button>
        )}
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