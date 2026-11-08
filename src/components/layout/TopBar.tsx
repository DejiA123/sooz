import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useScrollDirection } from "@/hooks/useScrollDirection";
import { Menu, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AppMenuSheet } from "./AppMenuSheet";
import { ActivityBell } from "./ActivityBell";
import { motion, AnimatePresence } from "framer-motion";

export const TopBar = () => {
  const scrollDirection = useScrollDirection();
  const location = useLocation();
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
          stiffness: 260,
          damping: 32,
          mass: 0.5,
          restDelta: 0.001
        }}
        className={cn(
          "fixed top-0 left-0 right-0 z-50 px-4 pt-[calc(0.25rem+env(safe-area-inset-top,0px))] pb-2 md:px-8",
          "bg-background/70 backdrop-blur-2xl border-b border-white/5"
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
                    <Button variant="ghost" size="icon" aria-label="Search" className="h-9 w-9 rounded-full hover:bg-secondary/50">
                      <Search className="w-4 h-4" />
                    </Button>
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>

            <ActivityBell className="h-9 w-9 hover:bg-secondary/50" iconClassName="h-5 w-5" />

            <AppMenuSheet
              trigger={
                <Button variant="ghost" size="icon" aria-label="Menu" className="h-9 w-9 rounded-full hover:bg-secondary/50 transition-all">
                  <Menu className="w-5 h-5" />
                </Button>
              }
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};