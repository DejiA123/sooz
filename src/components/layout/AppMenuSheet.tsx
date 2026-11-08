import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { BarChart3, Bookmark, LogOut, MessageSquareWarning, Moon, Settings, Sparkles, Sun, Video } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getColorMode, setColorMode } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/** The app's side menu (archive, Christian TikTok, settings, appearance, log out). */
export const AppMenuSheet = ({ trigger }: { trigger: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

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
            { to: "/tiktok", icon: Sparkles, label: "Christian TikTok", color: "text-amber-400" },
            { to: "/archive", icon: Video, label: "Video Archive", color: "text-violet-500" },
            { to: "/settings", icon: Settings, label: "Settings", color: "text-blue-500" },
            { to: "/analytics", icon: BarChart3, label: "Analytics", color: "text-emerald-500" },
          ].map((item) => (
            <Link key={item.to} to={item.to} onClick={close} className="group flex items-center gap-4 rounded-2xl p-4 transition-all hover:bg-secondary/40">
              <item.icon className={cn("h-5 w-5 transition-transform group-hover:scale-110", item.color)} />
              <span className="text-[15px] font-semibold">{item.label}</span>
            </Link>
          ))}
          <button onClick={() => { close(); toast("Saved posts coming soon!"); }} className="group flex items-center gap-4 rounded-2xl p-4 text-left transition-all hover:bg-secondary/40">
            <Bookmark className="h-5 w-5 text-amber-500 transition-transform group-hover:scale-110" />
            <span className="text-[15px] font-semibold">Saved Items</span>
          </button>
          <button
            onClick={() => {
              const next = getColorMode() === "dark" ? "light" : "dark";
              setColorMode(next);
              toast.success(next === "dark" ? "Dark mode" : "Light mode");
              close();
            }}
            className="group flex items-center gap-4 rounded-2xl p-4 text-left transition-all hover:bg-secondary/40"
          >
            <div className="relative h-5 w-5 transition-transform group-hover:scale-110">
              <Moon className="absolute inset-0 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Sun className="absolute inset-0 rotate-90 scale-0 text-primary transition-all dark:rotate-0 dark:scale-100" />
            </div>
            <span className="text-[15px] font-semibold">Appearance</span>
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
