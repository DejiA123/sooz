import { Home, Search, PlusSquare, Heart, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const navItems = [
  { icon: Home, label: "Home", id: "home" },
  { icon: Search, label: "Discover", id: "discover" },
  { icon: PlusSquare, label: "Create", id: "create" },
  { icon: Heart, label: "Activity", id: "activity" },
  { icon: User, label: "Profile", id: "profile" },
];

const BottomNav = () => {
  const [active, setActive] = useState("home");

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-strong pb-safe">
      <div className="max-w-lg mx-auto px-2">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            const isCreate = item.id === "create";

            return (
              <button
                key={item.id}
                onClick={() => setActive(item.id)}
                className={cn(
                  "flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-300",
                  isCreate && "relative -mt-6",
                  isActive && !isCreate && "text-primary",
                  !isActive && !isCreate && "text-muted-foreground hover:text-foreground"
                )}
              >
                {isCreate ? (
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-gold-glow flex items-center justify-center shadow-lg shadow-primary/30 hover:scale-110 transition-transform active:scale-95">
                    <Icon className="w-7 h-7 text-primary-foreground" />
                  </div>
                ) : (
                  <>
                    <Icon
                      className={cn(
                        "w-6 h-6 transition-all",
                        isActive && "scale-110"
                      )}
                      fill={isActive ? "currentColor" : "none"}
                    />
                    <span className="text-[10px] font-medium">{item.label}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
