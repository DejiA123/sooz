import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useScrollDirection } from "@/hooks/useScrollDirection";
import {
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

  const isExcludedPage = ["/chat", "/activity"].includes(location.pathname);
  const shouldHide = scrollDirection === "down" && !isExcludedPage;

  return (
    <div className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-in-out px-4 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] pb-2 md:px-8",
      "bg-transparent",
      shouldHide ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"
    )}>
      <div className="max-w-7xl mx-auto flex items-center justify-between h-10">
        <Link to="/" className="flex items-center group active:scale-95 transition-transform duration-200">
          <img
            src="/sooz-logo-v3.png"
            alt="SOOZ"
            className="h-8 w-auto object-contain brightness-100 dark:brightness-110"
          />
        </Link>

        <div className="flex items-center gap-2">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-secondary/50 transition-all">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85%] max-w-sm p-0 bg-background/95 backdrop-blur-2xl border-l border-border/10">
              <SheetHeader className="p-8 pt-[calc(2.5rem+env(safe-area-inset-top,0px))] border-b border-border/10">
                <SheetTitle className="text-left text-2xl font-display font-bold leading-none">
                  Menu
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Access app settings, analytics, and more.
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-col p-6 gap-2">
                {[
                  { to: "/archive", icon: Video, label: "Video Archive" },
                  { to: "/settings", icon: Settings, label: "Settings" },
                  { to: "/analytics", icon: BarChart3, label: "Analytics" },
                ].map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-4 p-4 rounded-2xl hover:bg-secondary/40 transition-all group"
                  >
                    <item.icon className="w-5 h-5 text-muted-foreground transition-transform group-hover:scale-110" />
                    <span className="font-semibold text-[15px]">{item.label}</span>
                  </Link>
                ))}

                <button
                  onClick={() => { setIsOpen(false); toast("Saved posts coming soon!"); }}
                  className="flex items-center gap-4 p-4 rounded-2xl hover:bg-secondary/40 transition-all group text-left"
                >
                  <Bookmark className="w-5 h-5 text-muted-foreground transition-transform group-hover:scale-110" />
                  <span className="font-semibold text-[15px]">Saved Items</span>
                </button>

                <button
                  onClick={() => {
                    const isDark = document.documentElement.classList.toggle("dark");
                    localStorage.setItem("sooz-mode", isDark ? "dark" : "light");
                    toast.success(isDark ? "Dark mode" : "Light mode");
                    setIsOpen(false);
                  }}
                  className="flex items-center gap-4 p-4 rounded-2xl hover:bg-secondary/40 transition-all group text-left"
                >
                  <div className="relative w-5 h-5 transition-transform group-hover:scale-110">
                    <Moon className="absolute inset-0 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Sun className="absolute inset-0 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-primary" />
                  </div>
                  <span className="font-semibold text-[15px]">Appearance</span>
                </button>

                <button
                  onClick={() => { setIsOpen(false); toast("Report submitted!"); }}
                  className="flex items-center gap-4 p-4 rounded-2xl hover:bg-secondary/40 transition-all group text-left"
                >
                  <MessageSquareWarning className="w-5 h-5 text-muted-foreground transition-transform group-hover:scale-110" />
                  <span className="font-semibold text-[15px]">Report Problem</span>
                </button>

                <div className="h-px bg-border/20 my-4 mx-2" />

                <button
                  onClick={async () => { setIsOpen(false); await supabase.auth.signOut(); window.location.href = "/auth"; }}
                  className="flex items-center gap-4 p-4 rounded-2xl hover:bg-destructive/10 text-destructive transition-all group text-left"
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
