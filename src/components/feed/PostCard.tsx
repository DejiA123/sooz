import { useState } from "react";
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PostCardProps {
  post: {
    id: string;
    user: {
      name: string;
      username: string;
      avatar: string;
      verified?: boolean;
    };
    content: {
      type: "image" | "video";
      url: string;
      aspectRatio?: string;
    };
    caption: string;
    likes: number;
    comments: number;
    shares: number;
    timeAgo: string;
  };
}

const PostCard = ({ post }: PostCardProps) => {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes);

  const handleLike = () => {
    setLiked(!liked);
    setLikesCount(liked ? likesCount - 1 : likesCount + 1);
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
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-secondary p-[2px]">
              <img
                src={post.user.avatar}
                alt={post.user.name}
                className="w-full h-full rounded-full object-cover bg-background"
              />
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
      <div className="relative bg-muted aspect-square">
        <img
          src={post.content.url}
          alt="Post content"
          className="w-full h-full object-cover"
        />
        {post.content.type === "video" && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/20">
            <div className="w-16 h-16 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center">
              <Play className="w-8 h-8 text-foreground ml-1" fill="currentColor" />
            </div>
          </div>
        )}
      </div>

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
            onClick={() => setSaved(!saved)}
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
          <p className="text-sm">
            <span className="font-semibold mr-2">{post.user.username}</span>
            {post.caption}
          </p>
        </div>
      </div>
    </article>
  );
};

export default PostCard;
