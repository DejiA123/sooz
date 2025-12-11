import { Bell, MessageCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-strong">
      <div className="max-w-lg mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-gold-glow flex items-center justify-center glow-gold">
            <span className="font-display text-lg text-primary-foreground font-bold">S</span>
          </div>
          <div className="flex flex-col">
            <span className="font-display text-xl gradient-text font-bold tracking-tight">SOOZ</span>
            <span className="text-[10px] text-muted-foreground -mt-1">Sound Out Of Zion</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button variant="icon" size="icon-sm">
            <Search className="w-5 h-5 text-muted-foreground" />
          </Button>
          <Button variant="icon" size="icon-sm" className="relative">
            <MessageCircle className="w-5 h-5 text-muted-foreground" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
