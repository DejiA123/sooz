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
      {/* Unified Bottom Bar (Mobile & Desktop) */}
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 25 }}
        className="fixed bottom-0 left-0 md:left-64 right-0 z-50 pb-[env(safe-area-inset-bottom,0px)]"
      >
        <div className="bg-background/80 backdrop-blur-2xl border-t border-border/20 shadow-lg">
          <div className="max-w-lg mx-auto flex items-center justify-around">
            {[...navItems.slice(0, 2), { icon: Plus, path: "#", isCreate: true }, ...navItems.slice(2)].map((item, idx) => {
              const isCreate = 'isCreate' in item && item.isCreate;
              const isActive = isCreate ? showCreateModal : location.pathname === item.path;
              if (isCreate) {
                return (
                  <button key="create" onClick={handleCreateClick} className="relative flex-1 flex flex-col items-center justify-center py-3 group">
                    <motion.div animate={{ rotate: showCreateModal ? 45 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                      <Plus className={cn("w-6 h-6 transition-colors", showCreateModal ? "text-primary" : "text-muted-foreground hover:text-foreground")} strokeWidth={2.5} />
                    </motion.div>
                  </button>
                );
              }
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const Icon = item.icon as any; // Cast as icon exists if not create
              return (
                <Link key={item.path} to={item.path} onMouseEnter={() => prefetchData(item.path)} className="relative flex-1 flex flex-col items-center justify-center py-3 group">
                  {isActive && <motion.div layoutId="nav-glow-bar" className="absolute top-0 left-4 right-4 h-[2px] rounded-full bg-foreground" transition={{ type: "spring", bounce: 0.15, duration: 0.5 }} />}
                  <Icon className={cn("w-[22px] h-[22px] transition-all duration-200", isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")} strokeWidth={isActive ? 2.5 : 1.8} fill={isActive ? "currentColor" : "none"} />
                </Link>
              );
            })}
          </div>
        </div>
      </motion.div>

      <CreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onPostCreated={() => { window.location.reload(); }}
      />
    </>
  );
};