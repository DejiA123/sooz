import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useScrollDirection } from "@/hooks/useScrollDirection";
import {
  Menu, Settings, BarChart3, Bookmark, Moon, Sun, MessageSquareWarning, LogOut, Video, Search
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

export const TopBar = () => {
  const scrollDirection = useScrollDirection();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isExcludedPage = ["/chat", "/activity"].includes(location.pathname);
  const shouldHide = scrollDirection === "down" && !isExcludedPage && scrollY > 100;
  const showFull = scrollDirection === "up" || scrollY < 50;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{
          y: shouldHide ? -100 : 0,
          opacity: shouldHide ? 0 : 1,
        }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 38,
          mass: 1,
        }}
        className={cn(
          "fixed top-0 left-0 right-0 z-50 px-4 pt-[calc(0.25rem+env(safe-area-inset-top,0px))] pb-2 md:px-8",
          "transition-all duration-500 ease-out",
          scrollY > 15 
            ? "bg-background/80 backdrop-blur-2xl border-b border-border/10 shadow-[0_2px_20px_-10px_rgba(0,0,0,0.1)]" 
            : "bg-transparent border-b border-transparent"
        )}
        style={{ pointerEvents: shouldHide ? "none" : "auto" }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between h-12">
          <Link to="/" className="flex items-center active:scale-90 transition-all duration-200">
            <motion.div
              animate={{
                scale: showFull ? 1 : 0.85,
                opacity: showFull ? 1 : 0.7,
              }}
              className="relative overflow-hidden"
            >
              <img
                src="/sooz-logo-v3.png"
                alt="SOOZ"
                className={cn(
                  "h-7 object-contain transition-all duration-500",
                  "mix-blend-darken dark:invert dark:mix-blend-lighten", // Pure CSS background removal
                  "filter contrast-125 brightness-110" // Make it pop
                )}
              />
            </motion.div>
          </Link>

          <div className="flex items-center gap-1">
            <AnimatePresence>
              {showFull && (
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
                  <Link to="/discover">
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-secondary/50">
                      <Search className="w-4 h-4" />
                    </Button>
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>

            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-secondary/50 transition-all">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[85%] max-w-sm p-0 bg-background/95 backdrop-blur-2xl border-l border-border/10">
                <SheetHeader className="p-8 pt-[calc(2.5rem+env(safe-area-inset-top,0px))] border-b border-border/10">
                  <SheetTitle className="text-left text-2xl font-display font-bold leading-none">Menu</SheetTitle>
                  <SheetDescription className="sr-only">Access app settings, analytics, and more.</SheetDescription>
                </SheetHeader>
                <div className="flex flex-col p-6 gap-1">
                  {[
                    { to: "/archive", icon: Video, label: "Video Archive", color: "text-violet-500" },
                    { to: "/settings", icon: Settings, label: "Settings", color: "text-blue-500" },
                    { to: "/analytics", icon: BarChart3, label: "Analytics", color: "text-emerald-500" },
                  ].map((item) => (
                    <Link key={item.to} to={item.to} onClick={() => setIsOpen(false)} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-secondary/40 transition-all group">
                      <item.icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", item.color)} />
                      <span className="font-semibold text-[15px]">{item.label}</span>
                    </Link>
                  ))}
                  <button onClick={() => { setIsOpen(false); toast("Saved posts coming soon!"); }} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-secondary/40 transition-all group text-left">
                    <Bookmark className="w-5 h-5 text-amber-500 transition-transform group-hover:scale-110" />
                    <span className="font-semibold text-[15px]">Saved Items</span>
                  </button>
                  <button onClick={() => { const isDark = document.documentElement.classList.toggle("dark"); localStorage.setItem("sooz-mode", isDark ? "dark" : "light"); toast.success(isDark ? "Dark mode" : "Light mode"); setIsOpen(false); }} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-secondary/40 transition-all group text-left">
                    <div className="relative w-5 h-5 transition-transform group-hover:scale-110">
                      <Moon className="absolute inset-0 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                      <Sun className="absolute inset-0 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-primary" />
                    </div>
                    <span className="font-semibold text-[15px]">Appearance</span>
                  </button>
                  <button onClick={() => { setIsOpen(false); toast("Report submitted!"); }} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-secondary/40 transition-all group text-left">
                    <MessageSquareWarning className="w-5 h-5 text-orange-500 transition-transform group-hover:scale-110" />
                    <span className="font-semibold text-[15px]">Report Problem</span>
                  </button>
                  <div className="h-px bg-border/20 my-4 mx-2" />
                  <button onClick={async () => { setIsOpen(false); await supabase.auth.signOut(); window.location.href = "/auth"; }} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-destructive/10 text-destructive transition-all group text-left">
                    <LogOut className="w-5 h-5 transition-transform group-hover:scale-110" />
                    <span className="font-bold text-[15px]">Log out</span>
                  </button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};