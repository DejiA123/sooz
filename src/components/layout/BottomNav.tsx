
import { useState } from "react";
import { House, MessageCircle, Heart, User, PlusSquare } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { CreateModal } from "@/components/create/CreateModal";
import { useAuth } from "@/hooks/useAuth";

import { queryClient } from "@/lib/react-query";
import { supabase } from "@/integrations/supabase/client";

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
      // Prefetch notifications (simulated by fetching recent likes/follows)
      queryClient.prefetchQuery({
        queryKey: ['notifications'],
        queryFn: async () => {
          return []; // Placeholder until notification query is formalized
        }
      });
    }
  };

  const navItems = [
    { icon: House, label: "Home", path: "/" },
    { icon: MessageCircle, label: "Chat", path: "/chat" },
    { icon: null, label: "Create", path: "#", isCreate: true },
    { icon: Heart, label: "Activity", path: "/activity" },
    { icon: User, label: "Profile", path: "/profile/me" },
  ];

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border pb-safe">
        <div className="flex items-center justify-around px-2 pt-0.5 pb-6">
          {navItems.map(({ icon: Icon, label, path, isCreate }) => {
            if (isCreate) {
              return (
                <button
                  key="create"
                  onClick={handleCreateClick}
                  className="flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-300 text-muted-foreground hover:text-foreground"
                >
                  <PlusSquare className="w-6 h-6 mb-1" strokeWidth={2} />
                  <span className="text-[10px] font-medium">{label}</span>
                </button>
              );
            }

            const isActive = location.pathname === path;
            const IconComponent = Icon!; // Safe assertion as filtered out by isCreate

            return (
              <Link
                key={path}
                to={path}
                onMouseEnter={() => {
                  // Prefetch the route chunk
                  if (path === '/chat') import('../../pages/Chat');
                  if (path === '/activity') import('../../pages/Notifications');
                  if (path === '/profile/me') import('../../pages/Profile');

                  // Prefetch Data
                  prefetchData(path);
                }}
                onTouchStart={() => {
                  if (path === '/chat') import('../../pages/Chat');
                  if (path === '/activity') import('../../pages/Notifications');
                  if (path === '/profile/me') import('../../pages/Profile');

                  // Prefetch Data
                  prefetchData(path);
                }}
                className={cn(
                  "flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-300",
                  isActive
                    ? "text-primary scale-110"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <IconComponent
                  className={cn("w-6 h-6 mb-1", isActive && "fill-current")}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <CreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onPostCreated={() => {
          // You might want to trigger a refresh here if you're on the home feed
          window.location.reload();
        }}
      />
    </>
  );
};
