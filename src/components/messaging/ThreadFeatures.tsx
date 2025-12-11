import { useState } from "react";
import { Heart, Reply, Share2, Bookmark, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ThreadFeaturesProps {
  messageId: string;
  isLiked?: boolean;
  likeCount?: number;
  onLike?: (messageId: string) => void;
  onReply?: (messageId: string) => void;
  onShare?: (messageId: string) => void;
  onBookmark?: (messageId: string) => void;
  className?: string;
}

export const ThreadFeatures = ({
  messageId,
  isLiked = false,
  likeCount = 0,
  onLike,
  onReply,
  onShare,
  onBookmark,
  className
}: ThreadFeaturesProps) => {
  const [showMore, setShowMore] = useState(false);

  const handleLike = () => {
    onLike?.(messageId);
  };

  const handleReply = () => {
    onReply?.(messageId);
  };

  const handleShare = () => {
    onShare?.(messageId);
  };

  const handleBookmark = () => {
    onBookmark?.(messageId);
  };

  return (
    <div className={cn("flex items-center gap-1 mt-2", className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleLike}
        className={cn(
          "h-6 px-2 text-xs hover:bg-transparent hover:text-red-500 transition-colors",
          isLiked && "text-red-500"
        )}
      >
        <Heart className={cn("h-3 w-3 mr-1", isLiked && "fill-current")} />
        {likeCount > 0 && likeCount}
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleReply}
        className="h-6 px-2 text-xs hover:bg-transparent hover:text-blue-500 transition-colors"
      >
        <Reply className="h-3 w-3 mr-1" />
        Reply
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleShare}
        className="h-6 px-2 text-xs hover:bg-transparent hover:text-green-500 transition-colors"
      >
        <Share2 className="h-3 w-3 mr-1" />
        Share
      </Button>

      <div className="relative">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowMore(!showMore)}
          className="h-6 px-2 text-xs hover:bg-transparent hover:text-purple-500 transition-colors"
        >
          <MoreHorizontal className="h-3 w-3" />
        </Button>

        {showMore && (
          <div className="absolute right-0 bottom-full mb-2 bg-background border rounded-lg shadow-lg p-1 min-w-[120px] z-10">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBookmark}
              className="w-full justify-start text-xs hover:bg-accent"
            >
              <Bookmark className="h-3 w-3 mr-2" />
              Bookmark
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};