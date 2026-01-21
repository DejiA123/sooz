import { Link } from "react-router-dom";
import { useScrollDirection } from "@/hooks/useScrollDirection";
import { cn } from "@/lib/utils";

export const TopBar = () => {
  const scrollDirection = useScrollDirection();

  return (
    <div className={cn(
      "fixed top-0 left-0 right-0 z-50 bg-white flex items-center justify-between px-4 py-2 md:px-6 transition-transform duration-300",
      scrollDirection === "down" ? "-translate-y-full" : "translate-y-0"
    )}>
      <Link to="/" className="flex items-center">
        <img
          src="/sooz-logo-v3.png"
          alt="SOOZ"
          className="h-12 w-auto object-contain text-foreground"
        />
      </Link>
    </div>
  );
};
