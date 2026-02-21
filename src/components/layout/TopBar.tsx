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
      "fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md flex items-center justify-between px-4 py-2 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] md:px-6 md:pt-2 transition-transform duration-300 border-b border-border/50",
      shouldHide ? "-translate-y-full" : "translate-y-0"
    )}>
      <Link to="/" className="flex items-center">
        <img
          src="/sooz-logo-v3.png"
          alt="SOOZ"
          className="h-10 w-auto object-contain text-foreground"
        />
      </Link>

      <div className="flex items-center gap-2">
        {/* Discover / Video Archive Button */}
        <Link
          to="/archive"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary/10 to-red-500/10 border border-primary/20 hover:border-primary/40 transition-all duration-300 hover:shadow-md hover:shadow-primary/10 group"
        >
          <PlayCircle className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
          <span className="text-xs font-semibold text-primary">Discover</span>
        </Link>

        {/* Hamburger Menu on Mobile */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden h-9 w-9 rounded-full bg-secondary/30">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[80%] p-0 bg-background border-l border-border/50">
            <SheetHeader className="p-6 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] border-b border-border/50">
              <SheetTitle className="text-left text-xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                App Settings
              </SheetTitle>
              <SheetDescription className="sr-only">
                Access app settings, analytics, and more.
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col p-4 gap-2">
              <Link
                to="/settings"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-4 p-4 rounded-xl hover:bg-secondary/50 transition-colors"
              >
                <Settings className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium">Settings</span>
              </Link>

              <Link
                to="/analytics"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-4 p-4 rounded-xl hover:bg-secondary/50 transition-colors"
              >
                <BarChart3 className="w-5 h-5 text-primary" />
                <span className="font-medium text-primary">App Analytics</span>
              </Link>

              <Link
                to="/archive"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-4 p-4 rounded-xl hover:bg-secondary/50 transition-colors"
              >
                <Video className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium">Video Archive</span>
              </Link>

              <button
                onClick={() => {
                  setIsOpen(false);
                  toast("Saved posts coming soon!");
                }}
                className="flex items-center gap-4 p-4 rounded-xl hover:bg-secondary/50 transition-colors text-left"
              >
                <Bookmark className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium">Saved Items</span>
              </button>

              <button
                onClick={() => {
                  const isDark = document.documentElement.classList.toggle("dark");
                  localStorage.setItem("sooz-mode", isDark ? "dark" : "light");
                  toast.success(isDark ? "Dark mode enabled" : "Light mode enabled");
                  // Appearance toggle doesn't necessarily need to close menu, 
                  // but we can close it for consistency if desired.
                  setIsOpen(false);
                }}
                className="flex items-center gap-4 p-4 rounded-xl hover:bg-secondary/50 transition-colors text-left"
              >
                <div className="relative w-5 h-5">
                  <Moon className="absolute inset-0 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Sun className="absolute inset-0 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                </div>
                <span className="font-medium">Switch Appearance</span>
              </button>

              <button
                onClick={() => {
                  setIsOpen(false);
                  toast("Report submitted, thanks!");
                }}
                className="flex items-center gap-4 p-4 rounded-xl hover:bg-secondary/50 transition-colors text-left"
              >
                <MessageSquareWarning className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium">Report a Problem</span>
              </button>

              <div className="h-px bg-border/50 my-4 mx-2" />

              <button
                onClick={async () => {
                  setIsOpen(false);
                  await supabase.auth.signOut();
                  window.location.href = "/auth";
                }}
                className="flex items-center gap-4 p-4 rounded-xl hover:bg-red-500/10 text-red-500 transition-colors text-left"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Log out</span>
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
};
