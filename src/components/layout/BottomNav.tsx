import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import CreatePostModal from "@/components/create/CreatePostModal";
import { 
  PremiumHome, 
  PremiumSearch, 
  PremiumPlus, 
  PremiumHeart, 
  PremiumUser,
  PremiumMessage,
  PremiumSettings,
  PremiumBookmark
} from "@/components/icons/PremiumIcons";

const BottomNav = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const getActiveTab = () => {
    if (location.pathname === "/") return "home";
    if (location.pathname === "/discover") return "discover";
    if (location.pathname === "/activity") return "activity";
    if (location.pathname.startsWith("/profile")) return "profile";
    return "home";
  };

  const active = getActiveTab();

  const navItems = [
    { icon: PremiumHome, label: "Home", id: "home", path: "/" },
    { icon: PremiumSearch, label: "Discover", id: "discover", path: "/discover" },
    { icon: PremiumPlus, label: "Create", id: "create", action: () => setShowCreateModal(true) },
    { icon: PremiumHeart, label: "Activity", id: "activity", path: "/activity" },
    { icon: PremiumUser, label: "Profile", id: "profile", path: user ? `/profile/${user.user_metadata?.username || user.id}` : "/auth" },
  ];

  const moreMenuItems = [
    { icon: PremiumMessage, label: "Messages", id: "messages", path: "/messaging" },
    { icon: PremiumBookmark, label: "Saved", id: "saved", path: "/saved" },
    { icon: PremiumUser, label: "Friends", id: "friends", path: "/friends" },
    { icon: PremiumSettings, label: "Settings", id: "settings", path: "/settings" },
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
      <nav className={cn(
        "fixed bottom-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur-xl border-t border-surface-variant/20 shadow-lg md3-elevation-3 pb-safe transition-all duration-300",
        isMounted && "animate-slide-up"
      )} role="navigation" aria-label="Bottom navigation">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20" role="menubar">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.id;
              const isCreate = item.id === "create";

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item)}
                  className={cn(
                    "flex flex-col items-center gap-2 px-3 py-3 rounded-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 animate-fade-in",
                    "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2",
                    isCreate && "relative -mt-8",
                    isActive && !isCreate && "text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 animate-pulse-subtle",
                    !isActive && !isCreate && "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
                  )}
                  role="menuitem"
                  aria-label={`${item.label}${isActive ? " - Current page" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                  title={item.label}
                >
                  {isCreate ? (
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-xl shadow-primary-500/40 hover:shadow-2xl hover:shadow-primary-500/50 transition-all duration-300 transform hover:scale-110 active:scale-95 animate-bounce-subtle">
                      <Icon className="w-8 h-8 text-white" filled aria-hidden="true" />
                    </div>
                  ) : (
                    <>
                      <Icon
                        className={cn(
                          "w-7 h-7 transition-all duration-300",
                          isActive && "scale-110 drop-shadow-lg"
                        )}
                        filled={isActive}
                        aria-hidden="true"
                      />
                      <span className={cn(
                        "text-xs font-semibold transition-all duration-300",
                        isActive && "text-primary-600 dark:text-primary-400"
                      )}>
                        {item.label}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
            
            {/* Facebook-style More Menu Button */}
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="flex flex-col items-center gap-2 px-3 py-3 rounded-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800/50 animate-fade-in"
              role="menuitem"
              aria-label={`More options${showMoreMenu ? " - Menu open" : ""}`}
              aria-expanded={showMoreMenu}
              title="More options"
            >
              <div className="w-7 h-7 flex flex-col justify-center items-center gap-1" aria-hidden="true">
                <div className={cn(
                  "w-1 h-1 rounded-full transition-all duration-300",
                  showMoreMenu ? "bg-primary-600 dark:bg-primary-400" : "bg-current"
                )} />
                <div className={cn(
                  "w-1 h-1 rounded-full transition-all duration-300",
                  showMoreMenu ? "bg-primary-600 dark:bg-primary-400" : "bg-current"
                )} />
                <div className={cn(
                  "w-1 h-1 rounded-full transition-all duration-300",
                  showMoreMenu ? "bg-primary-600 dark:bg-primary-400" : "bg-current"
                )} />
              </div>
              <span className={cn(
                "text-xs font-semibold transition-all duration-300",
                showMoreMenu && "text-primary-600 dark:text-primary-400"
              )}>
                More
              </span>
            </button>
          </div>
        </div>
        
        {/* Facebook-style Comprehensive Menu */}
        {showMoreMenu && (
          <div 
            className="absolute bottom-full left-0 right-0 bg-surface/95 backdrop-blur-xl border border-surface-variant/20 rounded-t-2xl shadow-2xl md3-elevation-4 animate-slide-up"
            role="menu"
            aria-label="More options menu"
          >
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="grid grid-cols-2 gap-3">
                {moreMenuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (item.path) {
                          navigate(item.path);
                          setShowMoreMenu(false);
                        }
                      }}
                      className="flex items-center gap-3 p-4 rounded-xl bg-surface-variant/30 hover:bg-surface-variant/50 transition-all duration-300 transform hover:scale-105 active:scale-95 animate-fade-in"
                      role="menuitem"
                      aria-label={item.label}
                      title={item.label}
                    >
                      <Icon className="w-6 h-6 text-neutral-700 dark:text-neutral-300" aria-hidden="true" />
                      <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </nav>

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

export default BottomNav;
