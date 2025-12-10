import { Home, Search, PlusSquare, Heart, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import CreatePostModal from "@/components/create/CreatePostModal";

const BottomNav = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const getActiveTab = () => {
    if (location.pathname === "/") return "home";
    if (location.pathname === "/discover") return "discover";
    if (location.pathname === "/activity") return "activity";
    if (location.pathname.startsWith("/profile")) return "profile";
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
      <nav className="fixed bottom-0 left-0 right-0 z-50 glass-strong pb-safe">
        <div className="max-w-lg mx-auto px-2">
          <div className="flex items-center justify-around h-16">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.id;
              const isCreate = item.id === "create";

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item)}
                  className={cn(
                    "flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-300",
                    isCreate && "relative -mt-6",
                    isActive && !isCreate && "text-primary",
                    !isActive && !isCreate && "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {isCreate ? (
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-gold-glow flex items-center justify-center shadow-lg shadow-primary/30 hover:scale-110 transition-transform active:scale-95">
                      <Icon className="w-7 h-7 text-primary-foreground" />
                    </div>
                  ) : (
                    <>
                      <Icon
                        className={cn(
                          "w-6 h-6 transition-all",
                          isActive && "scale-110"
                        )}
                        fill={isActive ? "currentColor" : "none"}
                      />
                      <span className="text-[10px] font-medium">{item.label}</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
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
