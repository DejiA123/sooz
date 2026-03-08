
import { useState, useEffect } from "react";
import { Check, ArrowLeft, LogOut, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const THEMES = [
    { id: "blue", name: "Deep Blue", primary: "240 100% 27%", color: "hsl(240, 100%, 27%)" },
    { id: "rose", name: "Neon Rose", primary: "340 75% 55%", color: "hsl(340, 75%, 55%)" },
    { id: "emerald", name: "Cyber Emerald", primary: "142 71% 45%", color: "hsl(142, 71%, 45%)" },
];

export default function Settings() {
    const navigate = useNavigate();
    const [currentTheme, setCurrentTheme] = useState("blue");
    const { isSubscribed, subscribeToPush, unsubscribeFromPush } = usePushNotifications();

    useEffect(() => {
        const theme = localStorage.getItem("sooz-theme") || "blue";
        setCurrentTheme(theme);
        applyTheme(theme);
    }, []);

    const applyTheme = (themeId: string) => {
        const theme = THEMES.find(t => t.id === themeId);
        if (theme) {
            document.documentElement.style.setProperty("--primary", theme.primary);
            localStorage.setItem("sooz-theme", themeId);
            setCurrentTheme(themeId);
        }
    };

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.error("Error signing out:", error);
        } finally {
            Object.keys(localStorage).forEach((key) => {
                if (key.startsWith("sb-")) localStorage.removeItem(key);
            });
            window.location.href = "/auth";
        }
    };

    return (
        <div className="pb-20 min-h-screen bg-background">
            <div className="px-5 py-6">
                <div className="flex items-center gap-4 mb-8">
                    <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-2xl font-display font-bold">Settings</h1>
                </div>

                {/* Theme Section */}
                <section className="mb-8">
                    <h2 className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-4 px-1">Appearance</h2>
                    <div className="bg-card rounded-2xl border border-border/30 p-5">
                        <p className="text-sm font-medium mb-4">Accent Color</p>
                        <div className="flex items-center gap-3">
                            {THEMES.map((theme) => (
                                <button
                                    key={theme.id}
                                    onClick={() => applyTheme(theme.id)}
                                    className={cn(
                                        "w-12 h-12 rounded-full transition-all duration-200 relative flex items-center justify-center",
                                        currentTheme === theme.id ? "ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110" : "hover:scale-105"
                                    )}
                                    style={{ backgroundColor: theme.color }}
                                >
                                    {currentTheme === theme.id && (
                                        <Check className="w-5 h-5 text-white" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Display Section */}
                <section className="mb-8">
                    <h2 className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-4 px-1">Display</h2>
                    <div className="bg-card rounded-2xl border border-border/30 p-5">
                        <div className="flex items-center justify-between">
                            <span className="font-medium">Dark Mode</span>
                            <Switch
                                defaultChecked={document.documentElement.classList.contains("dark")}
                                onCheckedChange={(checked) => {
                                    if (checked) document.documentElement.classList.add("dark");
                                    else document.documentElement.classList.remove("dark");
                                    localStorage.setItem("sooz-mode", checked ? "dark" : "light");
                                }}
                            />
                        </div>
                    </div>
                </section>

                {/* Notifications Section */}
                <section className="mb-8">
                    <h2 className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-4 px-1">Notifications</h2>
                    <div className="bg-card rounded-2xl border border-border/30 p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">Push Notifications</p>
                                <p className="text-[13px] text-muted-foreground mt-0.5">Messages and calls</p>
                            </div>
                            <Switch
                                checked={isSubscribed}
                                onCheckedChange={() => isSubscribed ? unsubscribeFromPush() : subscribeToPush()}
                            />
                        </div>
                    </div>
                </section>

                {/* Account Section */}
                <section>
                    <h2 className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-4 px-1">Account</h2>
                    <div className="bg-card rounded-2xl border border-border/30 overflow-hidden">
                        <Button
                            variant="ghost"
                            className="w-full justify-start gap-3 h-14 text-destructive hover:text-destructive hover:bg-destructive/5 rounded-2xl"
                            onClick={handleLogout}
                        >
                            <LogOut className="w-5 h-5" />
                            <span className="font-bold">Log Out</span>
                        </Button>
                    </div>
                </section>
            </div>
        </div>
    );
}
