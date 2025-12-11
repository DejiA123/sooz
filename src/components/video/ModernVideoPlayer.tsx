import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { OptimizedAvatar } from "@/components/ui/optimized-avatar";
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Play, 
  Pause,
  Volume2,
  VolumeX,
  MoreVertical,
  Music,
  Check
} from "lucide-react";

interface ModernVideoPlayerProps {
  videoUrl: string;
  thumbnail?: string;
  likes: number;
  comments: number;
  shares: number;
  isLiked: boolean;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  user: {
    name: string;
    username: string;
    avatar: string;
    verified?: boolean;
  };
  caption: string;
  music?: string;
  className?: string;
}

const ModernVideoPlayer = ({
  videoUrl,
  thumbnail,
  likes,
  comments,
  shares,
  isLiked,
  onLike,
  onComment,
  onShare,
  user,
  caption,
  music,
  className
}: ModernVideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const lastTapRef = useRef<number>(0);

  // Notify parent components about video state changes
  const notifyVideoState = useCallback((playing: boolean) => {
    const event = new CustomEvent(playing ? 'videoPlay' : 'videoPause');
    document.dispatchEvent(event);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateProgress = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    const handlePlay = () => {
      setIsPlaying(true);
      setShowSidePanel(true);
      notifyVideoState(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
      setShowSidePanel(false);
      notifyVideoState(false);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setShowSidePanel(false);
      notifyVideoState(false);
    };

    video.addEventListener('timeupdate', updateProgress);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', updateProgress);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [notifyVideoState]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  }, [isPlaying]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  const handleVideoInteraction = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
      // Double tap detected
      if (!isLiked) {
        onLike();
        setShowHeartAnimation(true);
        setTimeout(() => setShowHeartAnimation(false), 1000);
      }
    } else {
      // Single tap - toggle play/pause
      togglePlay();
    }

    lastTapRef.current = now;
    showControlsTemporarily();
  }, [isLiked, onLike, togglePlay]);

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  return (
    <div className={cn(
      "relative w-full max-w-sm mx-auto bg-black rounded-2xl overflow-hidden shadow-xl group",
      className
    )}>
      {/* Video Element */}
      <div 
        className="relative aspect-[9/16] bg-black rounded-2xl cursor-pointer"
        onClick={handleVideoInteraction}
        onTouchStart={handleVideoInteraction}
        onMouseMove={showControlsTemporarily}
        onMouseEnter={showControlsTemporarily}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          poster={thumbnail}
          className="w-full h-full object-cover rounded-2xl"
          loop
          muted={isMuted}
          playsInline
          preload="metadata"
          disablePictureInPicture
          controlsList="nodownload"
        />
        
        {/* Play/Pause Overlay - Instagram/TikTok Style */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/40 via-transparent to-transparent">
            <button 
              className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center animate-pulse focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black/50"
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              aria-label={`Play video by ${user.name}`}
              title="Play video"
            >
              <Play className="w-8 h-8 text-white ml-1" fill="currentColor" />
            </button>
          </div>
        )}

        {/* Heart Animation for Double-tap - TikTok Style */}
        {showHeartAnimation && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="animate-heart-pop">
              <Heart 
                className="w-24 h-24 text-red-500 fill-current drop-shadow-2xl" 
                fill="currentColor"
              />
              {/* Floating hearts effect */}
              <div className="absolute inset-0">
                {[...Array(3)].map((_, i) => (
                  <Heart
                    key={i}
                    className="w-4 h-4 text-red-500 fill-current absolute animate-float-like"
                    style={{
                      left: `${30 + i * 20}%`,
                      top: `${40 + i * 10}%`,
                      animationDelay: `${i * 0.2}s`
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Progress Bar - TikTok Style */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
        <div 
          className="h-full bg-white transition-all duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Top Controls - Instagram Stories Style */}
      {showControls && (
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10">
          <div className="flex items-center gap-2">
            {/* More Options */}
            <Button
              variant="ghost"
              size="icon"
              className="bg-black/40 backdrop-blur-sm border border-white/20 hover:bg-black/60 text-white"
              aria-label="More options"
              title="More options"
            >
              <MoreVertical className="w-5 h-5" />
            </Button>
          </div>

          {/* Sound Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              toggleMute();
            }}
            className="bg-black/40 backdrop-blur-sm border border-white/20 hover:bg-black/60 text-white"
            aria-label={isMuted ? "Unmute video" : "Mute video"}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <VolumeX className="w-5 h-5" />
            ) : (
              <Volume2 className="w-5 h-5" />
            )}
          </Button>
        </div>
      )}

      {/* Side Panel - TikTok/Instagram Style */}
      {isPlaying && (
        <div className="absolute right-3 bottom-24 flex flex-col gap-5 z-10">
          {/* Like Button */}
          <button
            onClick={onLike}
            className="w-12 h-12 rounded-full bg-white/80 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 shadow-lg group"
          >
            <Heart className={cn("w-6 h-6", isLiked ? "text-red-500 fill-current" : "text-gray-700 dark:text-gray-300")} />
          </button>
          <span className="text-xs text-white font-semibold drop-shadow-lg">
            {formatNumber(likes)}
          </span>

          {/* Comment Button */}
          <button
            onClick={onComment}
            className="w-12 h-12 rounded-full bg-white/80 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 shadow-lg group"
          >
            <MessageCircle className="w-6 h-6 text-gray-700 dark:text-gray-300" />
          </button>
          <span className="text-xs text-white font-semibold drop-shadow-lg">
            {formatNumber(comments)}
          </span>

          {/* Share Button */}
          <button
            onClick={onShare}
            className="w-12 h-12 rounded-full bg-white/80 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 shadow-lg group"
          >
            <Share2 className="w-6 h-6 text-gray-700 dark:text-gray-300" />
          </button>
          <span className="text-xs text-white font-semibold drop-shadow-lg">
            {formatNumber(shares)}
          </span>
        </div>
      )}

      {/* Bottom Info Section - Instagram Reels Style */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 via-black/20 to-transparent">
          {/* User Info */}
          <div className="flex items-center gap-2 mb-2">
            <OptimizedAvatar
              src={user.avatar}
              alt={user.name}
              fallback={user.name.charAt(0)}
              size="sm"
              className="w-8 h-8 border border-white/80"
            />
            <div className="flex items-center gap-1">
              <span className="text-white font-semibold text-sm">{user.name}</span>
              {user.verified && (
                <div className="w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center">
                  <Check className="w-2 h-2 text-white" />
                </div>
              )}
            </div>
          </div>
        
        {/* Caption */}
        {caption && (
          <p className="text-white text-sm leading-relaxed line-clamp-2 drop-shadow-md mb-2">
            {caption}
          </p>
        )}
        
        {/* Music Info - TikTok Style */}
        {music && (
          <div className="flex items-center gap-2 text-white/80 text-xs">
            <Music className="w-3 h-3" />
            <span className="drop-shadow-md">{music}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModernVideoPlayer;