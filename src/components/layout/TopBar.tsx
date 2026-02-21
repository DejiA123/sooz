import { Link, useLocation } from "react-router-dom";
import { useScrollDirection } from "@/hooks/useScrollDirection";
import { PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const TopBar = () => {
  const scrollDirection = useScrollDirection();
  const location = useLocation();

  // Disable scroll-hiding on chat and activity pages
  const isExcludedPage = ["/chat", "/activity"].includes(location.pathname);
  const shouldHide = scrollDirection === "down" && !isExcludedPage;

  return (
    <div className={cn(
      "fixed top-0 left-0 right-0 z-50 bg-white flex items-center justify-between px-4 py-2 md:px-6 transition-transform duration-300",
      shouldHide ? "-translate-y-full" : "translate-y-0"
    )}>
      <Link to="/" className="flex items-center">
        <img
          src="/sooz-logo-v3.png"
          alt="SOOZ"
          className="h-12 w-auto object-contain text-foreground"
        />
      </Link>

      {/* Discover / Video Archive Button */}
      <Link
        to="/archive"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary/10 to-red-500/10 border border-primary/20 hover:border-primary/40 transition-all duration-300 hover:shadow-md hover:shadow-primary/10 group"
      >
        <PlayCircle className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
        <span className="text-xs font-semibold text-primary">Discover</span>
      </Link>
    </div>
  );
};
