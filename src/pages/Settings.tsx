
import { useState, useEffect } from "react";
import { Check, Palette, Moon, ArrowLeft, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const THEMES = [
    { id: "blue", name: "Deep Blue (Default)", primary: "240 100% 27%" },

    { id: "rose", name: "Neon Rose", primary: "340 75% 55%" },
    { id: "emerald", name: "Cyber Emerald", primary: "142 71% 45%" },
];

export default function Settings() {
    const navigate = useNavigate();
    const [currentTheme, setCurrentTheme] = useState("blue");

    useEffect(() => {
        // Check local storage or current style
        const theme = localStorage.getItem("sooz-theme") || "blue";
        setCurrentTheme(theme);
        applyTheme(theme);
    }, []);

    const applyTheme = (themeId: string) => {
        const theme = THEMES.find(t => t.id === themeId);
        if (theme) {
            document.documentElement.style.setProperty("--primary", theme.primary);
            // We could also adjust ring colors, accents, etc.
            localStorage.setItem("sooz-theme", themeId);
            setCurrentTheme(themeId);
        }
    };

    const handleLogout = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            window.location.href = "/auth";
        } catch (error) {
            toast.error("Error logging out");
            console.error(error);
        }
    };

    return (
        <div className="pb-20 min-h-screen bg-background">
            <div className="px-4 py-6">
                <div className="flex items-center gap-4 mb-8">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-2xl font-bold font-display">Settings</h1>
                </div>

                <section className="space-y-6">
                    <div className="flex items-center gap-2 text-primary mb-4">
                        <Palette className="w-5 h-5" />
                        <h2 className="text-lg font-semibold">Appearance</h2>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {THEMES.map((theme) => (
                            <button
                                key={theme.id}
                                onClick={() => applyTheme(theme.id)}
                                className={cn(
                                    "flex items-center justify-between p-4 rounded-xl border transition-all",
                                    currentTheme === theme.id
                                        ? "bg-primary/10 border-primary"
                                        : "bg-card border-white/5 hover:bg-white/5"
                                )}
                            >
                                <div className="flex items-center gap-4">
                                    <div
                                        className="w-10 h-10 rounded-full shadow-lg"
                                        style={{ backgroundColor: `hsl(${theme.primary})` }}
                                    />
                                    <span className="font-medium">{theme.name}</span>
                                </div>
                                {currentTheme === theme.id && (
                                    <div className="bg-primary text-primary-foreground rounded-full p-1">
                                        <Check className="w-4 h-4" />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </section>

                <section className="space-y-6 mt-10">
                    <div className="flex items-center gap-2 text-primary mb-4">
                        <Moon className="w-5 h-5" />
                        <h2 className="text-lg font-semibold">Display</h2>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
                        <span className="font-medium">Dark Mode</span>
                        <button
                            onClick={() => {
                                const isDark = document.documentElement.classList.toggle("dark");
                                localStorage.setItem("sooz-mode", isDark ? "dark" : "light");
                            }}
                            className="w-12 h-6 bg-muted rounded-full relative transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-primary/50"
                        >
                            <div className="absolute left-1 top-1 w-4 h-4 rounded-full bg-foreground transition-transform duration-300 dark:translate-x-6" />
                        </button>
                    </div>
                </section>

                <section className="space-y-6 mt-10">
                    <div className="flex items-center gap-2 text-primary mb-4">
                        <LogOut className="w-5 h-5" />
                        <h2 className="text-lg font-semibold">Account</h2>
                    </div>
                    <Button
                        variant="destructive"
                        className="w-full justify-start gap-2"
                        onClick={handleLogout}
                    >
                        <LogOut className="w-4 h-4" />
                        Log Out
                    </Button>
                </section>
            </div>
        </div>
    );
}
