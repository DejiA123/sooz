import { useState } from "react";
import { Home, MessageCircle, Bell, User, Plus } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { CreateModal } from "@/components/create/CreateModal";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

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
    { icon: Home, path: "/", label: "Home" },
    { icon: MessageCircle, path: "/chat", label: "Messages" },
    { icon: Bell, path: "/activity", label: "Activity" },
    { icon: User, path: "/profile/me", label: "Profile" },
  ];

  return (
    <>
      <nav aria-label="Main navigation" className="mobile-bottom-nav md:hidden">
          <div className="mx-auto grid h-[var(--bottom-nav-row-height)] max-w-lg grid-cols-5 items-center px-2">
            {[...navItems.slice(0, 2), { icon: Plus, path: "#", label: "Create post", isCreate: true }, ...navItems.slice(2)].map((item) => {
              const isCreate = 'isCreate' in item && item.isCreate;
              const isActive = isCreate ? showCreateModal : (item.path === "/" ? ["/", "/index"].includes(location.pathname) : location.pathname.startsWith(item.path.replace("/me", "")));
              if (isCreate) {
                return (
                  <Button key="create" onClick={handleCreateClick} aria-label={item.label} title={item.label} size="icon" className="mx-auto h-11 w-11 rounded-full shadow-none active:scale-95 motion-reduce:transition-none [&_svg]:size-6">
                    <Plus className={cn("transition-transform motion-reduce:transition-none", showCreateModal && "rotate-45")} strokeWidth={2} />
                  </Button>
                );
              }
              const Icon = item.icon;
              return (
                <Button key={item.path} asChild variant="ghost" className={cn("group h-12 w-full rounded-lg px-0 active:scale-95 motion-reduce:transition-none [&_svg]:size-[26px]", isActive ? "text-foreground" : "text-muted-foreground")}>
                  <Link to={item.path} aria-label={item.label} title={item.label} aria-current={isActive ? "page" : undefined} onMouseEnter={() => prefetchData(item.path)}>
                    <Icon strokeWidth={isActive ? 2.2 : 1.8} fill={isActive && item.path === "/" ? "currentColor" : "none"} />
                  </Link>
                </Button>
              );
            })}
          </div>
      </nav>

      <CreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onPostCreated={() => { window.location.reload(); }}
      />
    </>
  );
};