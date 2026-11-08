import { useState, useEffect } from "react";
import { Check, ArrowLeft, LogOut, Bell, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const THEMES = [
  { id: "gold", primary: "38 92% 50%", color: "hsl(38, 92%, 50%)" },
  { id: "blue", primary: "240 100% 27%", color: "hsl(240, 100%, 27%)" },
  { id: "rose", primary: "340 75% 55%", color: "hsl(340, 75%, 55%)" },
  { id: "emerald", primary: "142 71% 45%", color: "hsl(142, 71%, 45%)" },
  { id: "violet", primary: "263 70% 58%", color: "hsl(263, 70%, 58%)" },
];

export default function Settings() {
  const navigate = useNavigate();
  const [currentTheme, setCurrentTheme] = useState("gold");
  const { isSubscribed, subscribeToPush, unsubscribeFromPush } = usePushNotifications();

  useEffect(() => {
    const theme = localStorage.getItem("sooz-theme") || "gold";
    setCurrentTheme(theme);
    applyTheme(theme);
  }, []);

  const applyTheme = (themeId: string) => {
    const theme = THEMES.find(t => t.id === themeId);
    if (theme) { document.documentElement.style.setProperty("--primary", theme.primary); localStorage.setItem("sooz-theme", themeId); setCurrentTheme(themeId); }
  };

  const handleLogout = async () => {
    try { await supabase.auth.signOut(); } catch (error) { console.error(error); }
    finally { Object.keys(localStorage).forEach((key) => { if (key.startsWith("sb-")) localStorage.removeItem(key); }); window.location.href = "/auth"; }
  };

  const sections = [
    {
      icon: Palette,
      iconColor: "text-violet-500",
      title: "Accent Color",
      content: (
        <div className="flex items-center gap-2.5 mt-3">
          {THEMES.map((theme) => (
            <button key={theme.id} onClick={() => applyTheme(theme.id)}
              className={cn("w-10 h-10 rounded-full transition-all duration-200 relative flex items-center justify-center", currentTheme === theme.id ? "ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110" : "hover:scale-105")}
              style={{ backgroundColor: theme.color }}>
              {currentTheme === theme.id && <Check className="w-4 h-4 text-white" />}
            </button>
          ))}
        </div>
      ),
    },
    {
      icon: Bell,
      iconColor: "text-amber-500",
      title: "Push Notifications",
      subtitle: "Messages and calls",
      trailing: <Switch checked={isSubscribed} onCheckedChange={() => isSubscribed ? unsubscribeFromPush() : subscribeToPush()} />,
    },
  ];

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="px-5 py-6">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-display font-bold">Settings</h1>
        </div>

        <div className="space-y-3">
          {sections.map((section, i) => (
            <div key={i} className="bg-card rounded-2xl border border-border/20 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center bg-secondary", section.iconColor)}>
                    <section.icon className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold">{section.title}</p>
                    {section.subtitle && <p className="text-[12px] text-muted-foreground">{section.subtitle}</p>}
                  </div>
                </div>
                {section.trailing}
              </div>
              {section.content}
            </div>
          ))}

          {/* Logout */}
          <div className="pt-4">
            <Button variant="ghost" className="w-full justify-start gap-3 h-14 text-destructive hover:text-destructive hover:bg-destructive/5 rounded-2xl" onClick={handleLogout}>
              <LogOut className="w-5 h-5" />
              <span className="font-bold">Log Out</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}