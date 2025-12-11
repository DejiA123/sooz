import { SVGProps } from 'react';

// Premium Social Media Icon Library
// Custom designed icons replacing default Lucide icons for a unique, premium aesthetic

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
  filled?: boolean;
}

// Base Icon Component
const Icon = ({ size = 24, className = '', filled = false, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  />
);

// Home Icon - Premium house design
export const PremiumHome = ({ size = 24, className = '', filled = false }: IconProps) => (
  <Icon size={size} className={className} filled={filled}>
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </Icon>
);

// Search Icon - Premium magnifying glass
export const PremiumSearch = ({ size = 24, className = '', filled = false }: IconProps) => (
  <Icon size={size} className={className} filled={filled}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </Icon>
);

// Heart Icon - Premium heart with gradient support
export const PremiumHeart = ({ size = 24, className = '', filled = false }: IconProps) => (
  <Icon size={size} className={className} filled={filled}>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </Icon>
);

// Message Icon - Premium speech bubble
export const PremiumMessage = ({ size = 24, className = '', filled = false }: IconProps) => (
  <Icon size={size} className={className} filled={filled}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Icon>
);

// User Icon - Premium user profile
export const PremiumUser = ({ size = 24, className = '', filled = false }: IconProps) => (
  <Icon size={size} className={className} filled={filled}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </Icon>
);

// Plus Icon - Premium add button
export const PremiumPlus = ({ size = 24, className = '', filled = false }: IconProps) => (
  <Icon size={size} className={className} filled={filled}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </Icon>
);

// Camera Icon - Premium camera
export const PremiumCamera = ({ size = 24, className = '', filled = false }: IconProps) => (
  <Icon size={size} className={className} filled={filled}>
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </Icon>
);

// Settings Icon - Premium gear
export const PremiumSettings = ({ size = 24, className = '', filled = false }: IconProps) => (
  <Icon size={size} className={className} filled={filled}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Icon>
);

// Bell Icon - Premium notification
export const PremiumBell = ({ size = 24, className = '', filled = false }: IconProps) => (
  <Icon size={size} className={className} filled={filled}>
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </Icon>
);

// Share Icon - Premium share
export const PremiumShare = ({ size = 24, className = '', filled = false }: IconProps) => (
  <Icon size={size} className={className} filled={filled}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </Icon>
);

// Bookmark Icon - Premium bookmark
export const PremiumBookmark = ({ size = 24, className = '', filled = false }: IconProps) => (
  <Icon size={size} className={className} filled={filled}>
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </Icon>
);

// More Icon - Premium three dots
export const PremiumMore = ({ size = 24, className = '', filled = false }: IconProps) => (
  <Icon size={size} className={className} filled={filled}>
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="19" r="1" />
  </Icon>
);

// Play Icon - Premium play button
export const PremiumPlay = ({ size = 24, className = '', filled = false }: IconProps) => (
  <Icon size={size} className={className} filled={filled}>
    <polygon points="5 3 19 12 5 21 5 3" />
  </Icon>
);

// Pause Icon - Premium pause
export const PremiumPause = ({ size = 24, className = '', filled = false }: IconProps) => (
  <Icon size={size} className={className} filled={filled}>
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </Icon>
);

// Video Icon - Premium video camera
export const PremiumVideo = ({ size = 24, className = '', filled = false }: IconProps) => (
  <Icon size={size} className={className} filled={filled}>
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </Icon>
);

// Image Icon - Premium image
export const PremiumImage = ({ size = 24, className = '', filled = false }: IconProps) => (
  <Icon size={size} className={className} filled={filled}>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </Icon>
);

// Music Icon - Premium music note
export const PremiumMusic = ({ size = 24, className = '', filled = false }: IconProps) => (
  <Icon size={size} className={className} filled={filled}>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </Icon>
);

// Trending Icon - Premium trending arrow
export const PremiumTrending = ({ size = 24, className = '', filled = false }: IconProps) => (
  <Icon size={size} className={className} filled={filled}>
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </Icon>
);

// Hash Icon - Premium hashtag
export const PremiumHash = ({ size = 24, className = '', filled = false }: IconProps) => (
  <Icon size={size} className={className} filled={filled}>
    <line x1="4" y1="9" x2="20" y2="9" />
    <line x1="4" y1="15" x2="20" y2="15" />
    <line x1="10" y1="3" x2="8" y2="21" />
    <line x1="16" y1="3" x2="14" y2="21" />
  </Icon>
);

// Send Icon - Premium paper plane
export const PremiumSend = ({ size = 24, className = '', filled = false }: IconProps) => (
  <Icon size={size} className={className} filled={filled}>
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </Icon>
);

// X Icon - Premium close
export const PremiumX = ({ size = 24, className = '', filled = false }: IconProps) => (
  <Icon size={size} className={className} filled={filled}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </Icon>
);

// Arrow Left Icon - Premium back arrow
export const PremiumArrowLeft = ({ size = 24, className = '', filled = false }: IconProps) => (
  <Icon size={size} className={className} filled={filled}>
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </Icon>
);

// Instagram-style gradient icons
export const InstagramGradientIcon = ({ size = 24, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={className}
  >
    <defs>
      <linearGradient id="instagram-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#833AB4" />
        <stop offset="50%" stopColor="#C13584" />
        <stop offset="100%" stopColor="#F77737" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill="url(#instagram-gradient)" />
    <circle cx="12" cy="12" r="4" fill="white" />
    <circle cx="17" cy="7" r="1.5" fill="white" />
  </svg>
);

// TikTok-style neon icon
export const TikTokNeonIcon = ({ size = 24, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={className}
    style={{
      filter: 'drop-shadow(0 0 8px #00f2ea) drop-shadow(0 0 12px #ff0050)',
    }}
  >
    <path
      d="M9 12a4 4 0 1 0 4 4V9a5 5 0 0 0 5-5 5 5 0 0 0-5 5v3a4 4 0 1 0 4 4"
      fill="#00f2ea"
    />
    <path
      d="M9 12v7a4 4 0 0 0 4 4V9a5 5 0 0 0 5-5"
      fill="#ff0050"
    />
  </svg>
);

// Sound On Icon - Premium volume up
export const PremiumSoundOn = ({ size = 24, className = '', filled = false }: IconProps) => (
  <Icon size={size} className={className} filled={filled}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
  </Icon>
);

// Sound Off Icon - Premium volume mute
export const PremiumSoundOff = ({ size = 24, className = '', filled = false }: IconProps) => (
  <Icon size={size} className={className} filled={filled}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <line x1="23" y1="9" x2="17" y2="15" />
    <line x1="17" y1="9" x2="23" y2="15" />
  </Icon>
);

// Facebook-style rounded icon
export const FacebookRoundedIcon = ({ size = 24, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={className}
  >
    <circle cx="12" cy="12" r="10" fill="#1877F2" />
    <path
      d="M16.67 8.35a6.67 6.67 0 1 0-1.34 13.3h-2.67v-4.67h-1.33v-2.66h1.33V11a2.67 2.67 0 0 1 2.67-2.67h2.66v2.67h-2.66v2.66h2.66v4.67h-2.66a6.67 6.67 0 0 0 1.34-13.3z"
      fill="white"
    />
  </svg>
);

// WhatsApp-style green icon
export const WhatsAppGreenIcon = ({ size = 24, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={className}
  >
    <circle cx="12" cy="12" r="10" fill="#25D366" />
    <path
      d="M12.04 6.5c-3.03 0-5.5 2.47-5.5 5.5 0 1.22.4 2.35 1.07 3.27l-1.07 3.73 3.73-1.07c.92.67 2.05 1.07 3.27 1.07 3.03 0 5.5-2.47 5.5-5.5s-2.47-5.5-5.5-5.5zm0 9.5c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"
      fill="white"
    />
  </svg>
);

// Threads-style minimalist icon
export const ThreadsMinimalIcon = ({ size = 24, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={className}
    fill="currentColor"
  >
    <path d="M12.186 24c-3.444-.395-6.572-1.456-9.162-3.442.871-1.578 3.708-4.215 6.77-4.215.37 0 .737.037 1.097.108-1.734-1.953-2.8-4.577-2.8-7.443 0-2.306.83-4.428 2.207-6.104 1.378-1.676 3.3-2.85 5.5-3.23.4-.07.8-.105 1.2-.105 2.3 0 4.4.83 6.1 2.21 1.7 1.38 2.9 3.3 3.2 5.5.1.4.1.8.1 1.2 0 2.3-.8 4.4-2.2 6.1-1.4 1.7-3.3 2.9-5.5 3.2-.4.1-.8.1-1.2.1-2.9 0-5.6-1.1-7.6-2.9-2 1.8-4.7 2.9-7.6 2.9-.4 0-.8 0-1.2-.1z" />
  </svg>
);

// Premium animated icons
export const AnimatedHeartIcon = ({ size = 24, className = '', isLiked = false }: IconProps & { isLiked?: boolean }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={`${className} transition-all duration-300 ${isLiked ? 'scale-110 text-red-500' : 'text-gray-400'}`}
    fill={isLiked ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={isLiked ? 0 : 2}
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

export const AnimatedCommentIcon = ({ size = 24, className = '', hasComments = false }: IconProps & { hasComments?: boolean }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={`${className} transition-all duration-300 ${hasComments ? 'scale-110 text-blue-500' : 'text-gray-400'}`}
    fill="none"
    stroke="currentColor"
    strokeWidth={hasComments ? 2.5 : 2}
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

export const AnimatedShareIcon = ({ size = 24, className = '', isShared = false }: IconProps & { isShared?: boolean }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={`${className} transition-all duration-300 ${isShared ? 'scale-110 text-green-500' : 'text-gray-400'}`}
    fill="none"
    stroke="currentColor"
    strokeWidth={isShared ? 2.5 : 2}
  >
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);

// Loading spinner icon
export const PremiumLoadingSpinner = ({ size = 24, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={`${className} animate-spin`}
    fill="none"
  >
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeDasharray="32 32"
      opacity="0.3"
    />
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeDasharray="32 32"
      strokeDashoffset="16"
    />
  </svg>
);

// Verified badge icon
export const PremiumVerified = ({ size = 16, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={`${className} text-blue-500`}
    fill="currentColor"
  >
    <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.89 0-1.409.24-1.938.48-.53-.24-1.02-.48-1.938-.48-2.108 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .878 0 1.43-.24 1.938-.48.53.24 1.04.48 1.938.48 2.108 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.688 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767c.45-.675 1.37-2.19 2.486-3.955.39-.585 1.235-.585 1.625 0 .39.585-.195 1.17-.585 1.755z" />
  </svg>
);

// Story ring icon
export const PremiumStoryRing = ({ size = 64, className = '', isViewed = false }: IconProps & { isViewed?: boolean }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    className={className}
  >
    <defs>
      <linearGradient id="story-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={isViewed ? '#8e8e93' : '#feda75'} />
        <stop offset="25%" stopColor={isViewed ? '#8e8e93' : '#fa7e1e'} />
        <stop offset="50%" stopColor={isViewed ? '#8e8e93' : '#d62976'} />
        <stop offset="75%" stopColor={isViewed ? '#8e8e93' : '#962fbf'} />
        <stop offset="100%" stopColor={isViewed ? '#8e8e93' : '#4f5bd5'} />
      </linearGradient>
    </defs>
    <circle
      cx="32"
      cy="32"
      r="30"
      stroke="url(#story-gradient)"
      strokeWidth="3"
      fill="none"
    />
  </svg>
);

// Sun Icon - Light mode
export const PremiumSun = ({ size = 24, className = '', filled = false }: IconProps) => (
  <Icon size={size} className={className} filled={filled}>
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </Icon>
);

// Moon Icon - Dark mode
export const PremiumMoon = ({ size = 24, className = '', filled = false }: IconProps) => (
  <Icon size={size} className={className} filled={filled}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </Icon>
);

// Icon exports
export const PremiumIcons = {
  Home: PremiumHome,
  Search: PremiumSearch,
  Heart: PremiumHeart,
  Message: PremiumMessage,
  User: PremiumUser,
  Plus: PremiumPlus,
  Camera: PremiumCamera,
  Settings: PremiumSettings,
  Bell: PremiumBell,
  Share: PremiumShare,
  Bookmark: PremiumBookmark,
  More: PremiumMore,
  Play: PremiumPlay,
  Pause: PremiumPause,
  Video: PremiumVideo,
  Image: PremiumImage,
  Music: PremiumMusic,
  Trending: PremiumTrending,
  Hash: PremiumHash,
  Send: PremiumSend,
  X: PremiumX,
  ArrowLeft: PremiumArrowLeft,
  InstagramGradient: InstagramGradientIcon,
  TikTokNeon: TikTokNeonIcon,
  FacebookRounded: FacebookRoundedIcon,
  WhatsAppGreen: WhatsAppGreenIcon,
  ThreadsMinimal: ThreadsMinimalIcon,
  AnimatedHeart: AnimatedHeartIcon,
  AnimatedComment: AnimatedCommentIcon,
  AnimatedShare: AnimatedShareIcon,
  LoadingSpinner: PremiumLoadingSpinner,
  Verified: PremiumVerified,
  StoryRing: PremiumStoryRing,
};

export default PremiumIcons;