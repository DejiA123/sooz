import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { BarChart3, Bookmark, History, LogOut, MessageSquareWarning, Settings, ShieldCheck, Sparkles, UserPlus, Video } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { openReportCount } from "@/services/api/safety";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/admin";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/** The app's side menu (archive, settings, log out; Christian TikTok for admins only). */
export const AppMenuSheet = ({ trigger }: { trigger: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const { isAdmin } = useIsAdmin();
  const reports = useQuery({ queryKey: ["moderation-count"], queryFn: openReportCount, enabled: isAdmin && open, staleTime: 30_000 });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="right" className="w-[85%] max-w-sm border-l border-border/10 bg-background/95 p-0 backdrop-blur-2xl">
        <SheetHeader className="border-b border-border/10 p-8 pt-[calc(2.5rem+env(safe-area-inset-top,0px))]">
          <SheetTitle className="text-left font-display text-2xl font-bold leading-none">Menu</SheetTitle>
          <SheetDescription className="sr-only">Access app settings, analytics, and more.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-1 p-6">
          {[
            ...(isAdmin ? [
              { to: "/tiktok", icon: Sparkles, label: "Christian TikTok", color: "text-amber-400" },
              { to: "/moderation", icon: ShieldCheck, label: "Moderation", color: "text-emerald-400", badge: reports.data || 0 },
            ] : []),
            { to: "/friends", icon: UserPlus, label: "Add friends", color: "text-emerald-400" },
            { to: "/history", icon: History, label: "Watch history", color: "text-amber-400" },
            { to: "/archive", icon: Video, label: "Video Archive", color: "text-violet-500" },
            { to: "/settings", icon: Settings, label: "Settings", color: "text-blue-500" },
            { to: "/analytics", icon: BarChart3, label: "Analytics", color: "text-emerald-500" },
          ].map((item) => (
            <Link key={item.to} to={item.to} onClick={close} className="group flex items-center gap-4 rounded-2xl p-4 transition-all hover:bg-secondary/40">
              <item.icon className={cn("h-5 w-5 transition-transform group-hover:scale-110", item.color)} />
              <span className="flex-1 text-[15px] font-semibold">{item.label}</span>
              {"badge" in item && item.badge ? <span className="rounded-full bg-red-500 px-2 py-0.5 text-[12px] font-bold text-white">{item.badge}</span> : null}
            </Link>
          ))}
          <button onClick={() => { close(); toast("Saved posts coming soon!"); }} className="group flex items-center gap-4 rounded-2xl p-4 text-left transition-all hover:bg-secondary/40">
            <Bookmark className="h-5 w-5 text-amber-500 transition-transform group-hover:scale-110" />
            <span className="text-[15px] font-semibold">Saved Items</span>
          </button>
          <button onClick={() => { close(); toast("Report submitted!"); }} className="group flex items-center gap-4 rounded-2xl p-4 text-left transition-all hover:bg-secondary/40">
            <MessageSquareWarning className="h-5 w-5 text-orange-500 transition-transform group-hover:scale-110" />
            <span className="text-[15px] font-semibold">Report Problem</span>
          </button>
          <div className="mx-2 my-4 h-px bg-border/20" />
          <button
            onClick={async () => { close(); await supabase.auth.signOut(); window.location.href = "/auth"; }}
            className="group flex items-center gap-4 rounded-2xl p-4 text-left text-destructive transition-all hover:bg-destructive/10"
          >
            <LogOut className="h-5 w-5 transition-transform group-hover:scale-110" />
            <span className="text-[15px] font-bold">Log out</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
