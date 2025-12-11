import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import { PremiumSun, PremiumMoon } from "@/components/icons/PremiumIcons";

interface ThemeToggleProps {
  className?: string;
  variant?: "default" | "compact";
}

export const ThemeToggle = ({ className, variant = "default" }: ThemeToggleProps) => {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(resolvedTheme === "light" ? "dark" : "light");
  };

  const getNextTheme = () => {
    if (theme === "system") return resolvedTheme === "light" ? "dark" : "light";
    return theme === "light" ? "dark" : "light";
  };

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "relative inline-flex items-center justify-center rounded-full transition-all duration-300 transform hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2",
        variant === "default" && "w-10 h-10 bg-surface-variant/50 hover:bg-surface-variant/70 backdrop-blur-sm",
        variant === "compact" && "w-8 h-8 bg-transparent hover:bg-surface-variant/30",
        className
      )}
      aria-label={`Switch to ${getNextTheme()} mode`}
      title={`Switch to ${getNextTheme()} mode`}
    >
      <div className="relative w-5 h-5">
        {/* Sun Icon */}
        <div className={cn(
          "absolute inset-0 transition-all duration-300 transform",
          resolvedTheme === "light" ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-50 rotate-90"
        )}>
          <PremiumSun className="w-5 h-5 text-yellow-500" />
        </div>
        
        {/* Moon Icon */}
        <div className={cn(
          "absolute inset-0 transition-all duration-300 transform",
          resolvedTheme === "dark" ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-50 -rotate-90"
        )}>
          <PremiumMoon className="w-5 h-5 text-blue-400" />
        </div>
      </div>
      
      {/* Ripple effect */}
      <div className="absolute inset-0 rounded-full bg-primary-500/20 opacity-0 transition-opacity duration-300 hover:opacity-100" />
    </button>
  );
};

export default ThemeToggle;