import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import CreatePostModal from "@/components/create/CreatePostModal";
import { 
  Home,
  Search,
  PlusSquare,
  Heart,
  User,
  MessageCircle,
  Bookmark,
  Settings,
  Users
} from "lucide-react";

const ModernBottomNav = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    // Listen for video playback events
    const handleVideoPlay = () => setIsVideoPlaying(true);
    const handleVideoPause = () => setIsVideoPlaying(false);
    const handleVideoEnd = () => setIsVideoPlaying(false);

    document.addEventListener('videoPlay', handleVideoPlay);
    document.addEventListener('videoPause', handleVideoPause);
    document.addEventListener('videoEnd', handleVideoEnd);

    return () => {
      document.removeEventListener('videoPlay', handleVideoPlay);
      document.removeEventListener('videoPause', handleVideoPause);
      document.removeEventListener('videoEnd', handleVideoEnd);
    };
  }, []);

  const getActiveTab = () => {
    if (location.pathname === "/") return "home";
    if (location.pathname === "/discover") return "discover";
    if (location.pathname === "/activity") return "activity";
    if (location.pathname.startsWith("/profile")) return "profile";
    if (location.pathname === "/messaging") return "messages";
    return "home";
  };

  const active = getActiveTab();

  const navItems = [
    { icon: Home, label: "Home", id: "home", path: "/" },
    { icon: Search, label: "Discover", id: "discover", path: "/discover" },
    { icon: PlusSquare, label: "Create", id: "create", action: () => setShowCreateModal(true) },
    { icon: Heart, label: "Activity", id: "activity", path: "/activity" },
    { icon: User, label: "Profile", id: "profile", path: user ? `/profile/${user.user_metadata?.username || user.id}` : "/auth" },
  ];

  const moreMenuItems = [
    { icon: MessageCircle, label: "Messages", id: "messages", path: "/messaging" },
    { icon: Bookmark, label: "Saved", id: "saved", path: "/saved" },
    { icon: Users, label: "Friends", id: "friends", path: "/friends" },
    { icon: Settings, label: "Settings", id: "settings", path: "/settings" },
  ];

  const handleNavClick = (item: typeof navItems[0]) => {
    if (item.action) {
      if (!user) {
        navigate("/auth");
        return;
      }
      item.action();
    } else if (item.path) {
      navigate(item.path);
    }
  };

  return (
    <>
      {/* Modern Bottom Navigation - Instagram/TikTok/Facebook Hybrid */}
      <nav className={cn(
        "fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-black/95 backdrop-blur-xl border-t border-gray-200 dark:border-gray-800 shadow-lg transition-all duration-300",
        "md:hidden", // Hide on desktop, show on mobile
        isMounted && "animate-slide-in-up",
        isVideoPlaying && "opacity-0 pointer-events-none", // Hide during video playback
        "pb-safe" // Safe area for modern phones
      )} role="navigation" aria-label="Bottom navigation">
        
        {/* Navigation Container */}
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16 relative">
            
            {/* Navigation Items */}
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = active === item.id;
              const isCreate = item.id === "create";

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-2xl transition-all duration-200 transform hover:scale-110 active:scale-95 relative",
                    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                    "min-w-[64px]", // Ensure minimum touch target size
                    isCreate && "relative",
                    isActive && !isCreate && "bg-gradient-to-br from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 animate-gradient-shift",
                    !isActive && !isCreate && "text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:animate-lift"
                  )}
                  role="menuitem"
                  aria-label={`${item.label}${isActive ? " - Current page" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                  title={item.label}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {isCreate ? (
                    // Instagram-style create button
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300",
                      "bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg hover:shadow-xl animate-morphing-shape hover:animate-scale",
                      "border-2 border-white dark:border-gray-900"
                    )}>
                      <Icon className="w-6 h-6 text-white" strokeWidth={2.5} aria-hidden="true" />
                    </div>
                  ) : (
                    <>
                      {/* Icon with active indicator */}
                      <div className="relative">
                        <Icon
                          className={cn(
                            "w-6 h-6 transition-all duration-200",
                            isActive && "scale-110 drop-shadow-lg"
                          )}
                          strokeWidth={isActive ? 2.5 : 2}
                          aria-hidden="true"
                        />
                        
                        {/* Active dot indicator */}
                        {isActive && (
                          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-blue-600 dark:bg-blue-400 rounded-full animate-pulse" />
                        )}
                        
                        {/* Notification badge for activity */}
                        {item.id === "activity" && (
                          <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        )}
                      </div>
                      
                      {/* Label */}
                      <span className={cn(
                        "text-xs font-semibold transition-all duration-200",
                        isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-gray-400"
                      )}>
                        {item.label}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Safe area background */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-white/95 dark:bg-black/95" />
      </nav>

      {/* Create Post Modal */}
      {showCreateModal && (
        <CreatePostModal
          onClose={() => setShowCreateModal(false)}
          onPostCreated={() => {
            setShowCreateModal(false);
            if (location.pathname === "/") {
              window.location.reload();
            } else {
              navigate("/");
            }
          }}
        />
      )}
    </>
  );
};

export default ModernBottomNav;