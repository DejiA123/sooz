import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Heart, MessageCircle, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OptimizedAvatar } from "@/components/ui/optimized-avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: "image" | "video";
  caption: string | null;
  created_at: string;
  expires_at: string;
  profiles: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface StoryModalProps {
  stories: Story[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onStoryChange?: (index: number) => void;
}

const StoryModal = ({ stories, initialIndex, isOpen, onClose, onStoryChange }: StoryModalProps) => {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [storyDuration] = useState(5000); // 5 seconds per story

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setProgress(0);
    setIsPlaying(true);
  }, [initialIndex]);

  useEffect(() => {
    if (!isOpen || stories.length === 0) return;

    let interval: NodeJS.Timeout;
    
    if (isPlaying) {
      interval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev + (100 / (storyDuration / 100));
          if (newProgress >= 100) {
            handleNext();
            return 0;
          }
          return newProgress;
        });
      }, 100);
    }

    return () => clearInterval(interval);
  }, [isOpen, isPlaying, currentIndex, stories.length, storyDuration]);

  useEffect(() => {
    if (onStoryChange) {
      onStoryChange(currentIndex);
    }
  }, [currentIndex, onStoryChange]);

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setProgress(0);
    } else {
      // End of all stories
      onClose();
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setProgress(0);
    }
  };

  const handleLikeStory = async () => {
    if (!user || !stories[currentIndex]) return;

    try {
      // For now, we'll just show a toast. In a real app, you'd track story likes
      toast.success("Story liked!");
    } catch (error) {
      console.error("Error liking story:", error);
    }
  };

  const handleShareStory = async () => {
    if (!stories[currentIndex]) return;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${stories[currentIndex].profiles.display_name || stories[currentIndex].profiles.username}'s story`,
          url: window.location.href,
        });
      } else {
        // Fallback for browsers that don't support Web Share API
        navigator.clipboard.writeText(window.location.href);
        toast.success("Link copied to clipboard!");
      }
    } catch (error) {
      console.error("Error sharing story:", error);
      toast.error("Failed to share story");
    }
  };

  const handleProgressClick = (index: number) => {
    setCurrentIndex(index);
    setProgress(0);
  };

  if (!isOpen || stories.length === 0) return null;

  const currentStory = stories[currentIndex];
  if (!currentStory) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Progress bars */}
      <div className="absolute top-4 left-4 right-4 z-10 flex gap-1">
        {stories.map((_, index) => (
          <div
            key={index}
            className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden cursor-pointer"
            onClick={() => handleProgressClick(index)}
          >
            <div
              className="h-full bg-white transition-all duration-100 ease-linear"
              style={{
                width: index < currentIndex ? "100%" : index === currentIndex ? `${progress}%` : "0%",
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-12 left-4 right-4 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <OptimizedAvatar
            src={currentStory.profiles.avatar_url || ""}
            alt={`${currentStory.profiles.display_name || currentStory.profiles.username}'s avatar`}
            fallback={currentStory.profiles.display_name?.charAt(0) || currentStory.profiles.username.charAt(0).toUpperCase()}
            size="md"
            className="border-2 border-white"
          />
          <div>
            <p className="text-white font-semibold text-sm">
              {currentStory.profiles.display_name || currentStory.profiles.username}
            </p>
            <p className="text-white/70 text-xs">
              {new Date(currentStory.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-white hover:bg-white/20"
        >
          <X className="w-6 h-6" />
        </Button>
      </div>

      {/* Story Content */}
      <div className="absolute inset-0 flex items-center justify-center">
        <img
          src={currentStory.media_url}
          alt="Story"
          className="w-full h-full object-cover"
        />
        
        {/* Navigation areas */}
        <div 
          className="absolute left-0 top-0 bottom-0 w-1/3 cursor-pointer"
          onClick={handlePrevious}
        />
        <div 
          className="absolute right-0 top-0 bottom-0 w-1/3 cursor-pointer"
          onClick={handleNext}
        />
        
        {/* Navigation arrows */}
        {currentIndex > 0 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
        )}
        
        {currentIndex < stories.length - 1 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
          >
            <ChevronRight className="w-6 h-6" />
          </Button>
        )}
      </div>

      {/* Caption */}
      {currentStory.caption && (
        <div className="absolute bottom-20 left-4 right-4 z-10">
          <div className="bg-black/50 backdrop-blur-sm rounded-lg p-3">
            <p className="text-white text-sm">{currentStory.caption}</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLikeStory}
          className="bg-black/50 hover:bg-black/70 text-white rounded-full"
        >
          <Heart className="w-5 h-5" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowComments(true)}
          className="bg-black/50 hover:bg-black/70 text-white rounded-full"
        >
          <MessageCircle className="w-5 h-5" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={handleShareStory}
          className="bg-black/50 hover:bg-black/70 text-white rounded-full"
        >
          <Share2 className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
};

export default StoryModal;