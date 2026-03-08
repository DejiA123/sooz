import { useState } from "react";
import { Compass, MessageCircle, Bell, User, Sparkles } from "lucide-react";
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
    { icon: Compass, label: "Home", path: "/" },
    { icon: MessageCircle, label: "Chat", path: "/chat" },
    { icon: Sparkles, label: "Create", path: "#", isCreate: true },
    { icon: Bell, label: "Activity", path: "/activity" },
    { icon: User, label: "Profile", path: "/profile/me" },
  ];

  const activeIndex = navItems.findIndex(item => 
    item.isCreate ? showCreateModal : location.pathname === item.path
  );

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom,4px)] px-4 pointer-events-none">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15, type: "spring" as const, stiffness: 400, damping: 30 }}
          className="max-w-md mx-auto pointer-events-auto mb-1"
        >
          <div className="relative flex items-center bg-card/95 backdrop-blur-2xl rounded-2xl shadow-[inset_0_1px_0_0_hsl(var(--border)/0.1),0_8px_32px_-8px_hsl(var(--foreground)/0.15)] p-1.5">
            {/* Sliding highlight */}
            {activeIndex >= 0 && (
              <motion.div
                layoutId="nav-highlight"
                className="absolute top-1.5 bottom-1.5 rounded-xl bg-primary/10"
                style={{ 
                  width: `${100 / navItems.length}%`,
                  left: `${(activeIndex / navItems.length) * 100}%`
                }}
                transition={{ type: "spring" as const, bounce: 0.15, duration: 0.5 }}
              />
            )}

            {navItems.map(({ icon: Icon, label, path, isCreate }) => {
              const isActive = isCreate ? showCreateModal : location.pathname === path;

              if (isCreate) {
                return (
                  <button
                    key="create"
                    onClick={handleCreateClick}
                    className="relative flex-1 flex items-center justify-center py-3 z-10"
                  >
                    <div className={cn(
                      "flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-300",
                      "bg-primary text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.4)]"
                    )}>
                      <Icon className="w-5 h-5" strokeWidth={2.5} />
                    </div>
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
                  className="relative flex-1 flex items-center justify-center py-3 z-10"
                >
                  <Icon
                    className={cn(
                      "w-[22px] h-[22px] transition-all duration-300",
                      isActive 
                        ? "text-primary scale-110" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    strokeWidth={isActive ? 2.5 : 1.8}
                    fill={isActive ? "currentColor" : "none"}
                  />
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
