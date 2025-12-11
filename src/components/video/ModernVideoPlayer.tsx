import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Play, 
  Pause,
  Volume2,
  VolumeX,
  MoreVertical,
  Music
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
      "relative w-full h-full bg-black rounded-2xl overflow-hidden group",
      "max-w-[500px] mx-auto", // Limit width for better mobile experience
      className
    )}>
      {/* Video Element */}
      <div 
        className="relative w-full h-full cursor-pointer"
        onClick={handleVideoInteraction}
        onTouchStart={handleVideoInteraction}
        onMouseMove={showControlsTemporarily}
        onMouseEnter={showControlsTemporarily}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          poster={thumbnail}
          className="w-full h-full object-cover"
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

      {/* Side Interaction Panel - TikTok Style */}
      <div className={cn(
        "absolute right-4 bottom-20 flex flex-col items-center gap-6 transition-all duration-300 transform",
        showSidePanel ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
      )}>
        
        {/* Profile Picture with Follow Button */}
        <div className="flex flex-col items-center gap-2">
          <button 
            className="relative focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black/50 rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              // Navigate to user profile
              window.location.href = `/profile/${user.username}`;
            }}
            aria-label={`View profile of ${user.name}`}
            title={`View profile of ${user.name}`}
          >
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 p-[2px]">
              {user.avatar ? (
                <OptimizedImage
                  src={user.avatar}
                  alt={`${user.name}'s avatar`}
                  className="w-full h-full rounded-full object-cover bg-black"
                  width={48}
                  height={48}
                  priority={false}
                />
              ) : (
                <div className="w-full h-full rounded-full bg-black flex items-center justify-center">
                  <span className="text-sm font-bold text-white">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          </button>
          
          {/* Follow Button */}
          <button 
            className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-lg font-bold hover:bg-blue-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white"
            aria-label={`Follow ${user.name}`}
            title={`Follow ${user.name}`}
          >
            +
          </button>
        </div>

        {/* Like Button with Animation */}
        <div className="flex flex-col items-center">
          <button
            className={cn(
              "w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center transition-all duration-300 hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white",
              isLiked && "bg-red-500/80 border-red-400"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onLike();
              // Trigger like animation
              const heartEvent = new CustomEvent('videoLike', { detail: { user: user.name } });
              document.dispatchEvent(heartEvent);
            }}
            aria-label={isLiked ? `Unlike video by ${user.name}` : `Like video by ${user.name}`}
            title={isLiked ? `Unlike video` : `Like video`}
          >
            <Heart 
              className={cn(
                "w-6 h-6 text-white transition-all duration-300",
                isLiked && "fill-current text-red-500 animate-heart-beat"
              )} 
              fill={isLiked ? "currentColor" : "none"}
            />
          </button>
          <span className="text-xs text-white font-semibold mt-1 drop-shadow-lg">
            {formatNumber(likes)}
          </span>
        </div>

        {/* Comment Button */}
        <div className="flex flex-col items-center">
          <button
            className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center transition-all duration-300 hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white"
            onClick={(e) => {
              e.stopPropagation();
              onComment();
            }}
            aria-label={`Comment on video by ${user.name}`}
            title={`Comment on video`}
          >
            <MessageCircle className="w-6 h-6 text-white" />
          </button>
          <span className="text-xs text-white font-semibold mt-1 drop-shadow-lg">
            {formatNumber(comments)}
          </span>
        </div>

        {/* Share Button */}
        <div className="flex flex-col items-center">
          <button
            className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center transition-all duration-300 hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white"
            onClick={(e) => {
              e.stopPropagation();
              onShare();
            }}
            aria-label={`Share video by ${user.name}`}
            title={`Share video`}
          >
            <Share2 className="w-6 h-6 text-white" />
          </button>
          <span className="text-xs text-white font-semibold mt-1 drop-shadow-lg">
            {formatNumber(shares)}
          </span>
        </div>
      </div>

      {/* Bottom Info Section - Instagram Reels Style */}
      <div className="absolute left-4 right-20 bottom-6 space-y-3">
        {/* User Info */}
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold text-sm">@{user.username}</span>
          {user.verified && (
            <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
              <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>
        
        {/* Caption */}
        {caption && (
          <p className="text-white text-sm leading-relaxed line-clamp-3 drop-shadow-lg">
            {caption}
          </p>
        )}
        
        {/* Music Info - TikTok Style */}
        {music && (
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-white/80" />
            <span className="text-white text-xs opacity-80 animate-pulse">
              {music}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModernVideoPlayer;