import { useState } from "react";
import { House, MessageCircle, Heart, User, PlusSquare } from "lucide-react";
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
    if (!user) {
      window.location.href = "/auth";
      return;
    }
    setShowCreateModal(true);
  };

  const prefetchData = (path: string) => {
    if (path === '/chat') {
      queryClient.prefetchQuery({
        queryKey: ['conversations'],
        queryFn: async () => {
          const { data } = await supabase.from('conversations').select('*').limit(20);
          return data;
        }
      });
    }
    if (path === '/activity') {
      queryClient.prefetchQuery({
        queryKey: ['notifications'],
        queryFn: async () => {
          return [];
        }
      });
    }
  };

  const navItems = [
    { icon: House, label: "Home", path: "/" },
    { icon: MessageCircle, label: "Chat", path: "/chat" },
    { icon: PlusSquare, label: "Create", path: "#", isCreate: true },
    { icon: Heart, label: "Activity", path: "/activity" },
    { icon: User, label: "Profile", path: "/profile/me" },
  ];

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-2 sm:pb-4 pointer-events-none">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="max-w-md mx-auto pointer-events-auto relative"
        >
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/50 backdrop-blur-md rounded-full border border-white/5 text-[8px] text-white/40 pointer-events-none uppercase tracking-widest font-medium">
            v1.0.1-revamp
          </div>
          <div className="flex items-center justify-around p-2 rounded-full bg-background/80 backdrop-blur-2xl border border-white/10 shadow-premium overflow-hidden">
            {navItems.map(({ icon: Icon, label, path, isCreate }) => {
              const isActive = location.pathname === path || (isCreate && showCreateModal);
              const IconComponent = Icon!;

              if (isCreate) {
                return (
                  <button
                    key="create"
                    onClick={handleCreateClick}
                    className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 active:scale-95 transition-transform"
                  >
                    <IconComponent className="w-7 h-7" strokeWidth={2.5} />
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
                    "relative flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300",
                    isActive ? "text-primary" : "text-muted-foreground/60 hover:text-foreground"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-active"
                      className="absolute inset-0 bg-primary/10 rounded-2xl"
                      transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
                    />
                  )}
                  <IconComponent
                    className={cn("w-6 h-6 z-10", isActive && "fill-current")}
                    strokeWidth={isActive ? 2.5 : 2}
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
        onPostCreated={() => {
          window.location.reload();
        }}
      />
    </>
  );
};
