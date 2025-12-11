import { Button } from "@/components/ui/button";
import { PremiumSearch, PremiumMessage, PremiumBell } from "@/components/icons/PremiumIcons";
import ThemeToggle from "@/components/theme/ThemeToggle";
import { Link } from "react-router-dom";

const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur-xl border-b border-surface-variant/20 shadow-md md3-elevation-2" role="banner">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo - Home link */}
        <a 
          href="/" 
          className="flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded-xl"
          aria-label="SOOZ - Sound Out Of Zion - Go to homepage"
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/35 transition-all duration-300 transform hover:scale-105 active:scale-95">
            <span className="font-display text-xl text-white font-bold tracking-tight" aria-hidden="true">S</span>
          </div>
          <div className="flex flex-col">
            <h1 className="font-display text-2xl gradient-text font-bold tracking-tight">SOOZ</h1>
            <span className="text-xs text-neutral-600 dark:text-neutral-400 -mt-0.5 font-medium">Sound Out Of Zion</span>
          </div>
        </a>

        {/* Actions */}
        <nav className="flex items-center gap-2" role="navigation" aria-label="Main navigation">
          <ThemeToggle variant="compact" />
          <Button 
            variant="md3-icon" 
            size="md3-icon" 
            className="md3-button"
            aria-label="Search"
            title="Search"
          >
            <PremiumSearch className="w-6 h-6 text-neutral-700 dark:text-neutral-300" aria-hidden="true" />
          </Button>
          <Link to="/messaging">
            <Button 
              variant="md3-icon" 
              size="md3-icon" 
              className="md3-button relative"
              aria-label="Messages - 1 new message"
              title="Messages"
            >
              <PremiumMessage className="w-6 h-6 text-neutral-700 dark:text-neutral-300" aria-hidden="true" />
              <span className="absolute top-1 right-1 w-3 h-3 bg-primary-500 rounded-full animate-pulse" aria-hidden="true" />
            </Button>
          </Link>
          <Button 
            variant="md3-icon" 
            size="md3-icon" 
            className="md3-button"
            aria-label="Notifications"
            title="Notifications"
          >
            <PremiumBell className="w-6 h-6 text-neutral-700 dark:text-neutral-300" aria-hidden="true" />
          </Button>
        </nav>
      </div>
    </header>
  );
};

export default Header;
