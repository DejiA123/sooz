import { useState } from "react";
import { House, MessageCircle, Heart, User, Sparkles } from "lucide-react";
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
    setShowCreateModal(true);
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
    { icon: House, label: "Home", path: "/" },
    { icon: MessageCircle, label: "Chat", path: "/chat" },
    { icon: Sparkles, label: "Create", path: "#", isCreate: true },
    { icon: Heart, label: "Activity", path: "/activity" },
    { icon: User, label: "Profile", path: "/profile/me" },
  ];

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom,8px)] px-3 pointer-events-none">
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring" as const, stiffness: 300, damping: 28 }}
          className="max-w-lg mx-auto pointer-events-auto"
        >
          <div className="relative flex items-center justify-between px-2 py-1.5 rounded-2xl bg-card/90 backdrop-blur-2xl border border-border/60 shadow-lg">
            {navItems.map(({ icon: Icon, label, path, isCreate }) => {
              const isActive = location.pathname === path || (isCreate && showCreateModal);

              if (isCreate) {
                return (
                  <button
                    key="create"
                    onClick={handleCreateClick}
                    className="relative -mt-5 flex flex-col items-center"
                  >
                    <div className="flex items-center justify-center w-[52px] h-[52px] rounded-[18px] bg-primary text-primary-foreground shadow-lg shadow-primary/30 active:scale-90 transition-transform duration-200">
                      <Icon className="w-6 h-6" strokeWidth={2.5} />
                    </div>
                    <span className="text-[10px] font-bold text-primary mt-1">{label}</span>
                  </button>
                );
              }

              return (
                <Link
                  key={path}
                  to={path}
                  onMouseEnter={() => {
                    if (path === '/chat') import('../../pages/Chat');
                    if (path === '/activity') import('../../pages/Notifications');
                    if (path === '/profile/me') import('../../pages/Profile');
                    prefetchData(path);
                  }}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-0.5 py-2 px-4 rounded-xl transition-all duration-300",
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className="relative">
                    {isActive && (
                      <motion.div
                        layoutId="nav-dot"
                        className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary"
                        transition={{ type: "spring" as const, bounce: 0.4, duration: 0.5 }}
                      />
                    )}
                    <Icon
                      className={cn("w-[22px] h-[22px]", isActive && "fill-current")}
                      strokeWidth={isActive ? 2.5 : 1.8}
                    />
                  </div>
                  <span className={cn(
                    "text-[10px] font-semibold tracking-tight",
                    isActive ? "font-bold text-primary" : "text-muted-foreground"
                  )}>
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        </motion.div>
      </div>

      <CreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onPostCreated={() => { window.location.reload(); }}
      />
    </>
  );
};
