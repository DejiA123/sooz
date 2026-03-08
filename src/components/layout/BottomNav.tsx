import { useState } from "react";
import { Home, MessageCircle, Bell, User, Plus, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { CreateModal } from "@/components/create/CreateModal";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

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
    { icon: MessageCircle, path: "/chat" },
    { icon: Bell, path: "/activity" },
    { icon: User, path: "/profile/me" },
  ];

  return (
    <>
      {/* Vertical floating pill — right edge */}
      <motion.div
        initial={{ x: 60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 200, damping: 25 }}
        className="fixed right-3 bottom-28 z-50 flex-col gap-1 p-1.5 rounded-full bg-background/60 backdrop-blur-2xl border border-border/20 shadow-lg md:hidden flex"
        style={{ paddingBottom: "calc(0.375rem + env(safe-area-inset-bottom, 0px))" }}
      >
        {navItems.map(({ icon: Icon, path }) => {
          const isActive = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              onMouseEnter={() => prefetchData(path)}
              className="relative flex items-center justify-center w-11 h-11 rounded-full transition-all duration-200 group"
            >
              {isActive && (
                <motion.div
                  layoutId="nav-glow"
                  className="absolute inset-0 rounded-full bg-primary/15"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                />
              )}
              <Icon
                className={cn(
                  "w-[22px] h-[22px] transition-all duration-200 relative z-10",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground group-hover:text-foreground"
                )}
                strokeWidth={isActive ? 2.5 : 1.8}
                fill={isActive ? "currentColor" : "none"}
              />
            </Link>
          );
        })}
      </motion.div>

      {/* Floating create orb */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 260, damping: 20 }}
        onClick={handleCreateClick}
        className={cn(
          "fixed right-3 z-50 w-12 h-12 rounded-full flex items-center justify-center md:hidden",
          "bg-primary text-primary-foreground shadow-xl",
          "active:scale-90 transition-transform duration-150"
        )}
        style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <motion.div
          animate={{ rotate: showCreateModal ? 45 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <Plus className="w-6 h-6" strokeWidth={2.5} />
        </motion.div>
        {/* Pulse ring */}
        {!showCreateModal && (
          <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping" style={{ animationDuration: "2s" }} />
        )}
      </motion.button>

      {/* Desktop: horizontal bar at bottom */}
      <div className="hidden md:block fixed bottom-0 left-64 right-0 z-50 pb-[env(safe-area-inset-bottom,0px)]">
        <div className="bg-background/70 backdrop-blur-2xl border-t border-border/20">
          <div className="max-w-lg mx-auto flex items-center">
            {[...navItems.slice(0, 2), { icon: Plus, path: "#", isCreate: true }, ...navItems.slice(2)].map((item, idx) => {
              const isCreate = 'isCreate' in item && item.isCreate;
              const isActive = isCreate ? showCreateModal : location.pathname === item.path;
              if (isCreate) {
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
                  {isActive && <motion.div layoutId="desk-nav-line" className="absolute top-0 left-4 right-4 h-[2px] rounded-full bg-foreground" transition={{ type: "spring", bounce: 0.15, duration: 0.5 }} />}
                  <item.icon className={cn("w-5 h-5 transition-all", isActive ? "text-foreground" : "text-muted-foreground")} strokeWidth={isActive ? 2.5 : 1.8} fill={isActive ? "currentColor" : "none"} />
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