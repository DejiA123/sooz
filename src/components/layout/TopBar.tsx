import { MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Button } from "@/components/ui/button";

export const TopBar = () => {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 glass flex items-center justify-between px-4 py-3 md:px-6">
      <Link to="/" className="flex items-center">
        <img
          src="/sooz-logo.svg"
          alt="SOOZ"
          className="h-12 w-auto object-contain text-foreground"
        />
      </Link>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <Link to="/chat" className="p-2 rounded-full hover:bg-white/5 transition-colors">
          <MessageCircle className="w-6 h-6 text-foreground" />
        </Link>
      </div>
    </div>
  );
};
