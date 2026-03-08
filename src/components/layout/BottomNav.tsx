import { useState } from "react";
import { Compass, MessageCircle, Bell, User, Plus, X } from "lucide-react";
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
    { icon: Compass, label: "Home", path: "/" },
    { icon: MessageCircle, label: "Chat", path: "/chat" },
    { icon: Plus, label: "Create", path: "#", isCreate: true },
    { icon: Bell, label: "Activity", path: "/activity" },
    { icon: User, label: "Profile", path: "/profile/me" },
  ];

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom,0px)]">
        <div className="bg-background/70 backdrop-blur-2xl border-t border-border/30">
          <div className="max-w-lg mx-auto flex items-center">
            {navItems.map(({ icon: Icon, label, path, isCreate }) => {
              const isActive = isCreate ? showCreateModal : location.pathname === path;

              if (isCreate) {
                return (
                  <button
                    key="create"
                    onClick={handleCreateClick}
                    className="relative flex-1 flex flex-col items-center justify-center py-3 group"
                  >
                    {/* Top line indicator */}
                    <AnimatePresence>
                      {showCreateModal && (
                        <motion.div
                          layoutId="nav-line"
                          className="absolute top-0 left-4 right-4 h-[2px] rounded-full bg-primary"
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          exit={{ scaleX: 0 }}
                          transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                        />
                      )}
                    </AnimatePresence>
                    <motion.div
                      animate={{ rotate: showCreateModal ? 45 : 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                      <Icon
                        className={cn(
                          "w-6 h-6 transition-colors duration-200",
                          showCreateModal ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                        )}
                        strokeWidth={showCreateModal ? 2.5 : 1.8}
                      />
                    </motion.div>
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
                  className="relative flex-1 flex flex-col items-center justify-center py-3 group"
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-line"
                      className="absolute top-0 left-4 right-4 h-[2px] rounded-full bg-foreground"
                      transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                    />
                  )}
                  <Icon
                    className={cn(
                      "w-6 h-6 transition-all duration-200",
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground group-hover:text-foreground"
                    )}
                    strokeWidth={isActive ? 2.5 : 1.8}
                    fill={isActive ? "currentColor" : "none"}
                  />
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
