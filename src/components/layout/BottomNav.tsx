import { useState } from "react";
import { Home, MessageCircle, Heart, User, Plus } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { CreateModal } from "@/components/create/CreateModal";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

export const BottomNav = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleCreateClick = () => {
    if (!user) { window.location.href = "/auth"; return; }
    setShowCreateModal(prev => !prev);
  };

  const prefetchData = (path: string) => {
    if (path === '/chat') {
      queryClient.prefetchQuery({ queryKey: ['conversations'], queryFn: async () => { const { data } = await supabase.from('conversations').select('*').limit(20); return data; } });
    }
    if (path === '/activity') {
      queryClient.prefetchQuery({ queryKey: ['notifications'], queryFn: async () => [] });
    }
  };

  const navItems = [
    { icon: Home, path: "/" },
    { icon: Search, path: "/discover" },
    { icon: Heart, path: "/activity" },
    { icon: User, path: "/profile/me" },
  ];

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Mobile: Instagram-style horizontal bottom bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border/40 md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-center justify-around h-[50px]">
          {/* Home */}
          <NavItem icon={Home} path="/" active={isActive("/")} onHover={() => prefetchData("/")} />

          {/* Search */}
          <NavItem icon={Search} path="/discover" active={isActive("/discover")} />

          {/* Create */}
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={handleCreateClick}
            className="relative flex items-center justify-center w-12 h-12 -mt-1"
          >
            <div className={cn(
              "flex items-center justify-center w-[28px] h-[28px] rounded-lg border transition-colors duration-200",
              showCreateModal
                ? "border-foreground bg-foreground text-background"
                : "border-foreground/80 text-foreground"
            )}>
              <Plus className="w-[18px] h-[18px]" strokeWidth={showCreateModal ? 2.5 : 2} />
            </div>
          </motion.button>

          {/* Activity */}
          <NavItem icon={Heart} path="/activity" active={isActive("/activity")} onHover={() => prefetchData("/activity")} />

          {/* Profile */}
          <NavItem icon={User} path="/profile/me" active={isActive("/profile/me")} />
        </div>
      </div>

      {/* Desktop: horizontal bar at bottom */}
      <div className="hidden md:block fixed bottom-0 left-64 right-0 z-50 pb-[env(safe-area-inset-bottom,0px)]">
        <div className="bg-background/70 backdrop-blur-2xl border-t border-border/20">
          <div className="max-w-lg mx-auto flex items-center">
            {[...navItems.slice(0, 2), { icon: Plus, path: "#", isCreate: true }, ...navItems.slice(2)].map((item, idx) => {
              const isCreateItem = 'isCreate' in item && item.isCreate;
              const activeDesktop = isCreateItem ? showCreateModal : isActive(item.path);
              if (isCreateItem) {
                return (
                  <button key="create" onClick={handleCreateClick} className="relative flex-1 flex flex-col items-center justify-center py-3 group">
                    <motion.div animate={{ rotate: showCreateModal ? 45 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                      <Plus className={cn("w-6 h-6 transition-colors", showCreateModal ? "text-primary" : "text-muted-foreground")} strokeWidth={2} />
                    </motion.div>
                  </button>
                );
              }
              return (
                <Link key={item.path} to={item.path} className="relative flex-1 flex flex-col items-center justify-center py-3 group">
                  {activeDesktop && <motion.div layoutId="desk-nav-line" className="absolute top-0 left-4 right-4 h-[2px] rounded-full bg-foreground" transition={{ type: "spring", bounce: 0.15, duration: 0.5 }} />}
                  <item.icon className={cn("w-5 h-5 transition-all", activeDesktop ? "text-foreground" : "text-muted-foreground")} strokeWidth={activeDesktop ? 2.5 : 1.8} fill={activeDesktop ? "currentColor" : "none"} />
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <CreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onPostCreated={() => { window.location.reload(); }}
      />
    </>
  );
};

/* Small reusable nav icon for the mobile bar */
const NavItem = ({ icon: Icon, path, active, onHover }: { icon: any; path: string; active: boolean; onHover?: () => void }) => (
  <Link to={path} onMouseEnter={onHover} className="relative flex items-center justify-center w-12 h-12">
    <motion.div whileTap={{ scale: 0.85 }} className="flex items-center justify-center">
      <Icon
        className={cn(
          "w-[26px] h-[26px] transition-all duration-150",
          active ? "text-foreground" : "text-foreground/60"
        )}
        strokeWidth={active ? 2.5 : 1.5}
        fill={active ? "currentColor" : "none"}
      />
    </motion.div>
    {active && (
      <motion.div
        layoutId="mobile-nav-dot"
        className="absolute bottom-0.5 w-1 h-1 rounded-full bg-foreground"
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    )}
  </Link>
);