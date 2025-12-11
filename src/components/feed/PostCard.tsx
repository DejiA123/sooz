import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import CommentModal from "@/components/comments/CommentModal";
import TikTokVideoPlayer from "@/components/video/TikTokVideoPlayer";
import { OptimizedAvatar } from "@/components/ui/optimized-avatar";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { PremiumHeart, PremiumMessage, PremiumShare, PremiumBookmark, PremiumMore, PremiumPlay } from "@/components/icons/PremiumIcons";

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
    view_count?: number;
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
  const [showComments, setShowComments] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post.comments);
  const [viewCount, setViewCount] = useState(post.view_count || 0);
  const [hasTrackedView, setHasTrackedView] = useState(false);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [lastTap, setLastTap] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (user) {
      checkIfLiked();
      checkIfSaved();
    }
    fetchViewCount();
    trackView();
  }, [user, post.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleCommentClick = () => {
    setShowComments(true);
  };

  const handleCommentAdded = () => {
    // Refresh comments count
    fetchCommentsCount();
    if (onRefresh) onRefresh();
  };

  const fetchCommentsCount = async () => {
    try {
      const { count } = await supabase
        .from("comments")
        .select("*", { count: "exact", head: true })
        .eq("post_id", post.id);
      
      setCommentsCount(count || 0);
    } catch (error) {
      console.error("Error fetching comments count:", error);
    }
  };

  const fetchViewCount = async () => {
    try {
      const { count } = await supabase
        .from("post_views")
        .select("*", { count: "exact", head: true })
        .eq("post_id", post.id);
      
      setViewCount(count || 0);
    } catch (error) {
      console.error("Error fetching view count:", error);
    }
  };

  const trackView = async () => {
    if (!user || hasTrackedView) return;
    
    // Check if user has already viewed this post
    const { data: existingView } = await supabase
      .from("post_views")
      .select("id")
      .eq("post_id", post.id)
      .eq("user_id", user.id)
      .maybeSingle();
    
    if (existingView) {
      setHasTrackedView(true);
      return;
    }
    
    try {
      await supabase.from("post_views").insert({
        post_id: post.id,
        user_id: user.id,
      });
      setHasTrackedView(true);
      setViewCount(prev => prev + 1);
    } catch (error) {
      console.error("Error tracking view:", error);
    }
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap < 300) {
      // Double tap detected
      if (!liked) {
        handleLike();
        setShowHeartAnimation(true);
        setTimeout(() => setShowHeartAnimation(false), 1000);
      }
    }
    setLastTap(now);
  };

  return (
    <article className={cn(
      "bg-surface rounded-xl sm:rounded-2xl overflow-hidden border border-surface-variant/20 shadow-sm md3-elevation-1 hover:md3-elevation-2 transition-all duration-300 max-w-full",
      isMounted && "animate-fade-in-up"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <button 
          className="flex items-center gap-3 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded-xl p-1"
          onClick={() => navigate(`/profile/${post.user.username}`)}
          aria-label={`View profile of ${post.user.name}`}
          title={`View profile of ${post.user.name}`}
        >
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 p-[2px] shadow-md shadow-primary-500/20 group-hover:shadow-lg group-hover:shadow-primary-500/30 transition-all duration-300">
              <OptimizedAvatar 
                src={post.user.avatar}
                alt={`${post.user.name}'s avatar`}
                fallback={post.user.name.charAt(0).toUpperCase()}
                size="sm"
                className="w-full h-full rounded-full"
              />
            </div>
            {post.user.verified && (
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center shadow-md" aria-hidden="true">
                <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{post.user.name}</span>
            </div>
            <span className="text-xs text-neutral-600 dark:text-neutral-400 font-medium">@{post.user.username} · {post.timeAgo}</span>
          </div>
        </button>
        <Button variant="md3-icon" size="md3-icon" className="md3-button" aria-label="More options" title="More options">
          <PremiumMore className="w-5 h-5 text-neutral-600 dark:text-neutral-400" aria-hidden="true" />
        </Button>
      </div>

      {/* Content */}
      {post.content && (
        <div className="relative bg-surface-variant w-full max-h-[400px] sm:max-h-[500px] lg:max-h-[600px] overflow-hidden">
          {post.content.type === "image" ? (
            <div 
              className="relative cursor-pointer"
              onClick={handleDoubleTap}
            >
              <OptimizedImage
                src={post.content.url}
                alt="Post content"
                className="w-full h-auto object-cover"
                width={800}
                height={800}
              />
              {/* Heart animation for double-tap */}
              {showHeartAnimation && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="animate-heart-pop">
                    <PremiumHeart 
                      className="w-24 h-24 text-red-500 fill-current drop-shadow-2xl" 
                      filled={true}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <TikTokVideoPlayer
              videoUrl={post.content.url}
              likes={likesCount}
              comments={commentsCount}
              shares={post.shares}
              isLiked={liked}
              onLike={handleLike}
              onComment={handleCommentClick}
              onShare={() => {/* TODO: Implement share */}}
              user={post.user}
              caption={post.caption}
              className="w-full h-[400px] sm:h-[500px] lg:h-[600px]"
            />
          )}
        </div>
      )}

      {/* Actions */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <Button 
              variant="md3-icon" 
              size="md3-icon" 
              onClick={handleLike}
              className={cn("md3-button transition-all duration-300 hover:scale-110", liked && "text-red-500")}
              aria-label={liked ? `Unlike post by ${post.user.name}` : `Like post by ${post.user.name}`}
              title={liked ? `Unlike post by ${post.user.name}` : `Like post by ${post.user.name}`}
              aria-pressed={liked}
            >
              <PremiumHeart 
                className={cn(
                  "w-6 h-6 transition-all duration-300",
                  liked && "fill-current animate-heart-beat drop-shadow-md"
                )} 
                filled={liked}
                aria-hidden="true"
              />
            </Button>
            <Button 
              variant="md3-icon" 
              size="md3-icon" 
              onClick={handleCommentClick} 
              className="md3-button"
              aria-label={`Comment on post by ${post.user.name}`}
              title={`Comment on post by ${post.user.name}`}
            >
              <PremiumMessage className="w-6 h-6" aria-hidden="true" />
            </Button>
            <Button 
              variant="md3-icon" 
              size="md3-icon" 
              className="md3-button"
              aria-label={`Share post by ${post.user.name}`}
              title={`Share post by ${post.user.name}`}
            >
              <PremiumShare className="w-6 h-6" aria-hidden="true" />
            </Button>
          </div>
          <Button 
            variant="md3-icon" 
            size="md3-icon"
            onClick={handleSave}
            className="md3-button"
            aria-label={saved ? `Remove post by ${post.user.name} from saved` : `Save post by ${post.user.name}`}
            title={saved ? `Remove post by ${post.user.name} from saved` : `Save post by ${post.user.name}`}
            aria-pressed={saved}
          >
            <PremiumBookmark 
              className={cn(
                "w-6 h-6 transition-all duration-300",
                saved && "fill-current text-neutral-900 dark:text-neutral-100 drop-shadow-md"
              )} 
              filled={saved}
              aria-hidden="true"
            />
          </Button>
        </div>

        {/* Stats */}
        <div className="space-y-2">
          <div className="flex items-center gap-4 text-sm">
            <button 
              className="font-semibold text-neutral-900 dark:text-neutral-100 cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 rounded-md px-1 py-0.5"
              onClick={() => {/* TODO: Show likes modal */}}
              aria-label={`View ${formatNumber(likesCount)} likes for post by ${post.user.name}`}
              title={`View ${formatNumber(likesCount)} likes`}
            >
              {formatNumber(likesCount)} likes
            </button>
            <button 
              className="text-neutral-600 dark:text-neutral-400 cursor-pointer hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 rounded-md px-1 py-0.5"
              onClick={handleCommentClick}
              aria-label={`View ${formatNumber(commentsCount)} comments for post by ${post.user.name}`}
              title={`View ${formatNumber(commentsCount)} comments`}
            >
              {formatNumber(commentsCount)} comments
            </button>
            <button 
              className="text-neutral-600 dark:text-neutral-400 cursor-pointer hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 rounded-md px-1 py-0.5"
              onClick={() => {/* TODO: Show views modal */}}
              aria-label={`View ${formatNumber(viewCount)} views for post by ${post.user.name}`}
              title={`View ${formatNumber(viewCount)} views`}
            >
              {formatNumber(viewCount)} views
            </button>
          </div>
          
          {/* Caption */}
          {post.caption && (
            <p className="text-sm leading-relaxed">
              <button 
                className="font-semibold text-neutral-900 dark:text-neutral-100 mr-2 cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 rounded-md px-1 py-0.5"
                onClick={() => navigate(`/profile/${post.user.username}`)}
                aria-label={`View profile of ${post.user.name}`}
                title={`View profile of ${post.user.name}`}
              >
                {post.user.username}
              </button>
              <span className="text-neutral-800 dark:text-neutral-200">{post.caption}</span>
            </p>
          )}
        </div>
      </div>
      
      {/* Comment Modal */}
      <CommentModal
        postId={post.id}
        postOwnerId={post.user.id}
        isOpen={showComments}
        onClose={() => setShowComments(false)}
        onCommentAdded={handleCommentAdded}
      />
    </article>
  );
};

export default PostCard;
