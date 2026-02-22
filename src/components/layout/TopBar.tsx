import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useScrollDirection } from "@/hooks/useScrollDirection";
import {
  PlayCircle,
  Menu,
  Settings,
  BarChart3,
  Bookmark,
  Moon,
  Sun,
  MessageSquareWarning,
  LogOut,
  Video
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const TopBar = () => {
  const scrollDirection = useScrollDirection();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  // Disable scroll-hiding on chat and activity pages
  const isExcludedPage = ["/chat", "/activity"].includes(location.pathname);
  const shouldHide = scrollDirection === "down" && !isExcludedPage;

  return (
    <div className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-in-out px-4 py-2 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] md:px-8",
      "bg-background/80 backdrop-blur-xl border-b border-white/5 dark:border-white/10",
      shouldHide ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"
    )}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center group active:scale-95 transition-transform duration-200">
          <img
            src="/sooz-logo-v3.png"
            alt="SOOZ"
            className="h-9 w-auto object-contain brightness-100 dark:brightness-110"
          />
        </Link>

        <div className="flex items-center gap-3">
          {/* Discover / Video Archive Button */}
          <Link
            to="/archive"
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 hover:bg-primary/20 border border-primary/20 transition-all duration-300 group overflow-hidden relative shadow-sm hover:shadow-primary/20"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <PlayCircle className="w-4 h-4 text-primary group-hover:scale-110 group-hover:rotate-6 transition-transform" />
            <span className="text-[13px] font-bold text-primary tracking-tight">Discover</span>
          </Link>

          {/* Hamburger Menu on Mobile */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden h-10 w-10 rounded-full bg-secondary/50 hover:bg-secondary border border-transparent hover:border-border/50 transition-all">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85%] max-w-sm p-0 bg-background/95 backdrop-blur-2xl border-l border-white/10">
              <SheetHeader className="p-8 pt-[calc(2.5rem+env(safe-area-inset-top,0px))] border-b border-border/10">
                <SheetTitle className="text-left text-2xl font-display font-bold leading-none">
                  App Settings
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Access app settings, analytics, and more.
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-col p-6 gap-3">
                {[
                  { to: "/settings", icon: Settings, label: "Settings", color: "text-muted-foreground" },
                  { to: "/analytics", icon: BarChart3, label: "App Analytics", color: "text-primary" },
                  { to: "/archive", icon: Video, label: "Video Archive", color: "text-muted-foreground" },
                ].map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-4 p-4 rounded-2xl hover:bg-secondary/40 border border-transparent hover:border-border/20 transition-all group"
                  >
                    <item.icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", item.color)} />
                    <span className="font-semibold text-[15px]">{item.label}</span>
                  </Link>
                ))}

                <button
                  onClick={() => {
                    setIsOpen(false);
                    toast("Saved posts coming soon!");
                  }}
                  className="flex items-center gap-4 p-4 rounded-2xl hover:bg-secondary/40 border border-transparent hover:border-border/20 transition-all group text-left"
                >
                  <Bookmark className="w-5 h-5 text-muted-foreground transition-transform group-hover:scale-110" />
                  <span className="font-semibold text-[15px]">Saved Items</span>
                </button>

                <button
                  onClick={() => {
                    const isDark = document.documentElement.classList.toggle("dark");
                    localStorage.setItem("sooz-mode", isDark ? "dark" : "light");
                    toast.success(isDark ? "Dark mode enabled" : "Light mode enabled");
                    setIsOpen(false);
                  }}
                  className="flex items-center gap-4 p-4 rounded-2xl hover:bg-secondary/40 border border-transparent hover:border-border/20 transition-all group text-left"
                >
                  <div className="relative w-5 h-5 transition-transform group-hover:scale-110">
                    <Moon className="absolute inset-0 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Sun className="absolute inset-0 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-primary" />
                  </div>
                  <span className="font-semibold text-[15px]">Appearance</span>
                </button>

                <button
                  onClick={() => {
                    setIsOpen(false);
                    toast("Report submitted, thanks!");
                  }}
                  className="flex items-center gap-4 p-4 rounded-2xl hover:bg-secondary/40 border border-transparent hover:border-border/20 transition-all group text-left"
                >
                  <MessageSquareWarning className="w-5 h-5 text-muted-foreground transition-transform group-hover:scale-110" />
                  <span className="font-semibold text-[15px]">Report Problem</span>
                </button>

                <div className="h-px bg-border/20 my-6 mx-2" />

                <button
                  onClick={async () => {
                    setIsOpen(false);
                    await supabase.auth.signOut();
                    window.location.href = "/auth";
                  }}
                  className="flex items-center gap-4 p-4 rounded-2xl hover:bg-red-500/10 border border-transparent hover:border-red-500/20 text-red-500 transition-all group text-left"
                >
                  <LogOut className="w-5 h-5 transition-transform group-hover:scale-110" />
                  <span className="font-bold text-[15px]">Log out</span>
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
  );
};
