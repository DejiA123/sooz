import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { 
  PremiumHeart, 
  PremiumMessage, 
  PremiumShare, 
  PremiumPlay, 
  PremiumPause,
  PremiumSoundOn,
  PremiumSoundOff 
} from "@/components/icons/PremiumIcons";

interface TikTokVideoPlayerProps {
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

const TikTokVideoPlayer = ({
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
}: TikTokVideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateProgress = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    video.addEventListener('timeupdate', updateProgress);
    video.addEventListener('ended', () => setIsPlaying(false));

    return () => {
      video.removeEventListener('timeupdate', updateProgress);
      video.removeEventListener('ended', () => setIsPlaying(false));
    };
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play();
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVideoClick = () => {
    const now = Date.now();
    if (now - (lastClickRef.current || 0) < 300) {
      // Double tap detected
      if (!isLiked) {
        onLike();
        setShowHeartAnimation(true);
        setTimeout(() => setShowHeartAnimation(false), 1000);
      }
    } else {
      togglePlay();
    }
    lastClickRef.current = now;
  };

  const lastClickRef = useRef<number>();

  const showControlsTemporarily = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  return (
    <div className={cn("relative w-full h-full bg-black rounded-2xl overflow-hidden", className)}>
      {/* Video Element */}
      <div 
        className="relative w-full h-full cursor-pointer"
        onClick={handleVideoClick}
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
        />
        
        {/* Play/Pause Overlay */}
        {!isPlaying && (
          <button 
            className="absolute inset-0 flex items-center justify-center bg-black/20 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            onClick={togglePlay}
            aria-label={`Play video by ${user.name}`}
            title="Play video"
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center animate-pulse">
              <PremiumPlay className="w-8 h-8 sm:w-10 sm:h-10 text-white ml-1" filled aria-hidden="true" />
            </div>
          </button>
        )}

        {/* Heart Animation for Double-tap */}
        {showHeartAnimation && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="animate-heart-pop">
              <PremiumHeart 
              className="w-24 h-24 sm:w-32 sm:h-32 text-red-500 fill-current drop-shadow-2xl" 
              filled={true}
            />
            </div>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
        <div 
          className="h-full bg-white transition-all duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Controls */}
      {showControls && (
        <div className="absolute top-4 right-4 flex flex-col gap-3">
          {/* Sound Toggle */}
          <Button
            variant="md3-icon"
            size="md3-icon"
            onClick={toggleMute}
            className="md3-button bg-black/40 backdrop-blur-sm border border-white/20"
            aria-label={isMuted ? "Unmute video" : "Mute video"}
            title={isMuted ? "Unmute" : "Mute"}
            aria-pressed={isMuted}
          >
            {isMuted ? (
              <PremiumSoundOff className="w-6 h-6 text-white" aria-hidden="true" />
            ) : (
              <PremiumSoundOn className="w-6 h-6 text-white" aria-hidden="true" />
            )}
          </Button>
        </div>
      )}

      {/* Right Side Action Bar */}
      <div className="absolute right-4 bottom-20 flex flex-col items-center gap-5">
        {/* Profile Picture */}
        <button 
          className="relative focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 rounded-full"
          onClick={(e) => {
            e.stopPropagation();
            // Navigate to user profile
            window.location.href = `/profile/${user.username}`;
          }}
          aria-label={`View profile of ${user.name}`}
          title={`View profile of ${user.name}`}
        >
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 p-[2px]">
            {user.avatar ? (
              <OptimizedImage
                src={user.avatar}
                alt={`${user.name}'s avatar`}
                className="w-full h-full rounded-full object-cover bg-black"
                width={48}
                height={48}
              />
            ) : (
              <div className="w-full h-full rounded-full bg-black flex items-center justify-center">
                <span className="text-sm font-bold text-white" aria-hidden="true">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          {user.verified && (
            <div className="absolute -bottom-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-primary-500 rounded-full flex items-center justify-center" aria-hidden="true">
              <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </button>

        {/* Like Button */}
        <div className="flex flex-col items-center">
          <Button
            variant="md3-icon"
            size="md3-icon"
            onClick={(e) => {
              e.stopPropagation();
              onLike();
            }}
            className={cn("md3-button bg-black/40 backdrop-blur-sm border border-white/20", isLiked && "text-red-500")}
            aria-label={isLiked ? `Unlike video by ${user.name}` : `Like video by ${user.name}`}
            title={isLiked ? `Unlike video` : `Like video`}
            aria-pressed={isLiked}
          >
            <PremiumHeart 
              className={cn("w-6 h-6 sm:w-7 sm:h-7 transition-all duration-300", isLiked && "fill-current animate-heart-beat")} 
              filled={isLiked}
              aria-hidden="true"
            />
          </Button>
          <span className="text-xs text-white font-semibold mt-1" aria-label={`${formatNumber(likes)} likes`}>{formatNumber(likes)}</span>
        </div>

        {/* Comment Button */}
        <div className="flex flex-col items-center">
          <Button
            variant="md3-icon"
            size="md3-icon"
            onClick={(e) => {
              e.stopPropagation();
              onComment();
            }}
            className="md3-button bg-black/40 backdrop-blur-sm border border-white/20"
            aria-label={`Comment on video by ${user.name}`}
            title={`Comment on video`}
          >
            <PremiumMessage className="w-6 h-6 sm:w-7 sm:h-7 text-white" aria-hidden="true" />
          </Button>
          <span className="text-xs text-white font-semibold mt-1" aria-label={`${formatNumber(comments)} comments`}>{formatNumber(comments)}</span>
        </div>

        {/* Share Button */}
        <div className="flex flex-col items-center">
          <Button
            variant="md3-icon"
            size="md3-icon"
            onClick={(e) => {
              e.stopPropagation();
              onShare();
            }}
            className="md3-button bg-black/40 backdrop-blur-sm border border-white/20"
            aria-label={`Share video by ${user.name}`}
            title={`Share video`}
          >
            <PremiumShare className="w-6 h-6 sm:w-7 sm:h-7 text-white" aria-hidden="true" />
          </Button>
          <span className="text-xs text-white font-semibold mt-1" aria-label={`${formatNumber(shares)} shares`}>{formatNumber(shares)}</span>
        </div>
      </div>

      {/* Bottom Info Section */}
      <div className="absolute left-4 right-16 sm:right-20 bottom-4 sm:bottom-6">
        {/* User Info */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-white font-semibold text-sm">@{user.username}</span>
            {user.verified && (
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          
          {/* Caption */}
          {caption && (
            <p className="text-white text-sm leading-relaxed line-clamp-3">
              {caption}
            </p>
          )}
          
          {/* Music Info */}
          {music && (
            <div className="flex items-center gap-2 mt-2">
              <div className="w-4 h-4 bg-white/20 rounded-full flex items-center justify-center animate-spin" style={{ animationDuration: '3s' }}>
                <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                </svg>
              </div>
              <span className="text-white text-xs opacity-80">{music}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TikTokVideoPlayer;