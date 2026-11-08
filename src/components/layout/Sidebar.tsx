import { lazy, Suspense, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Sparkles, Home, Heart, User, PlusSquare, Search, Menu, MoreHorizontal, Settings as SettingsIcon, ActivitySquare, Bookmark, Moon, Sun, MessageSquareWarning, LogOut, MessageCircle, Code2, PlayCircle, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
const CreateModal = lazy(() => import("@/components/create/CreateModal").then((m) => ({ default: m.CreateModal })));
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePrefetch } from "@/hooks/usePrefetch";

export const Sidebar = () => {
    const location = useLocation();
    const { user } = useAuth();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const { prefetchProfile } = usePrefetch();

    // Helper to determine if a link is active
    const isActive = (path: string) => location.pathname === path;

    const navItems = [
        { icon: Home, label: "Home", path: "/" },
        { icon: Search, label: "Discover", path: "/discover" },
        { icon: Sparkles, label: "Christian TikTok", path: "/tiktok" },
        { icon: MessageCircle, label: "Messages", path: "/chat" },
        { icon: Heart, label: "Notifications", path: "/activity" },
        { icon: PlusSquare, label: "Create", path: "#", isCreate: true },
        { icon: User, label: "Profile", path: "/profile/me" },
    ];

    const handleCreateClick = () => {
        if (!user) {
            window.location.href = "/auth";
            return;
        }
        setShowCreateModal(true);
    };

    const handlePrefetch = (item: any) => {
        if (item.label === "Profile" && user?.user_metadata?.username) {
            prefetchProfile(user.user_metadata.username);
        }
    };

    return (
        <>
            <aside className="hidden md:flex flex-col fixed left-0 top-0 z-50 h-screen w-64 bg-background border-r border-border px-4 py-6">
                {/* Logo */}
                <div className="mb-4 px-1 flex justify-center">
                    <img
                        src="/sooz-logo-v3.png"
                        alt="SOOZ"
                        className="h-24 w-auto object-contain"
                    />
                </div>

                {/* Navigation Items */}
                <nav className="flex-1 flex flex-col gap-2">
                    {navItems.map((item) => {
                        if (item.isCreate) {
                            return (
                                <button
                                    key={item.label}
                                    onClick={handleCreateClick}
                                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-secondary/50 transition-colors group text-foreground"
                                >
                                    <item.icon className="w-6 h-6 group-hover:scale-105 transition-transform" />
                                    <span className="font-medium text-base">{item.label}</span>
                                </button>
                            );
                        }

                        return (
                            <Link
                                key={item.label}
                                to={item.path}
                                onMouseEnter={() => handlePrefetch(item)}
                                className={cn(
                                    "flex items-center gap-4 p-3 rounded-lg hover:bg-secondary/50 transition-colors group",
                                    isActive(item.path) ? "font-bold text-foreground" : "font-medium text-foreground"
                                )}
                            >
                                <item.icon
                                    className={cn(
                                        "w-6 h-6 group-hover:scale-105 transition-transform",
                                        isActive(item.path) ? "fill-foreground" : ""
                                    )}
                                    strokeWidth={isActive(item.path) ? 2.5 : 2}
                                />
                                <span className="text-base">{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* Bottom Actions (More) */}
                <div className="mt-auto px-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-4 p-3 rounded-lg hover:bg-secondary/50 transition-colors w-full text-left data-[state=open]:bg-secondary/50 outline-none">
                                <Menu className="w-6 h-6" />
                                <span className="font-medium text-base">More</span>
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" side="top" className="w-64 p-2 rounded-xl backdrop-blur-xl bg-background/95 border-white/10 shadow-xl mb-4 ml-4">
                            <DropdownMenuItem asChild>
                                <Link to="/settings" className="flex items-center gap-3 p-3 cursor-pointer rounded-lg focus:bg-secondary/50">
                                    <SettingsIcon className="w-5 h-5" />
                                    <span>Settings</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link to="/activity" className="flex items-center gap-3 p-3 cursor-pointer rounded-lg focus:bg-secondary/50">
                                    <ActivitySquare className="w-5 h-5" />
                                    <span>Your activity</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link to="/analytics" className="flex items-center gap-3 p-3 cursor-pointer rounded-lg focus:bg-secondary/50">
                                    <BarChart3 className="w-5 h-5 text-primary" />
                                    <span>App Analytics</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link to="/archive" className="flex items-center gap-3 p-3 cursor-pointer rounded-lg focus:bg-secondary/50">
                                    <PlayCircle className="w-5 h-5" />
                                    <span>Video Archive</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toast("Saved posts coming soon!")} className="flex items-center gap-3 p-3 cursor-pointer rounded-lg focus:bg-secondary/50">
                                <Bookmark className="w-5 h-5" />
                                <span>Saved</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => {
                                    const isDark = document.documentElement.classList.toggle("dark");
                                    localStorage.setItem("sooz-mode", isDark ? "dark" : "light");
                                    toast.success(isDark ? "Dark mode enabled" : "Light mode enabled");
                                }}
                                className="flex items-center gap-3 p-3 cursor-pointer rounded-lg focus:bg-secondary/50"
                            >
                                <Moon className="w-5 h-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 hidden dark:block" />
                                <Sun className="w-5 h-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 block dark:hidden" />
                                <Moon className="w-5 h-5" />
                                <span>Switch appearance</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toast("Report submitted thanks!")} className="flex items-center gap-3 p-3 cursor-pointer rounded-lg focus:bg-secondary/50">
                                <MessageSquareWarning className="w-5 h-5" />
                                <span>Report a problem</span>
                            </DropdownMenuItem>

                            <div className="h-px bg-border my-2 mx-1" />

                            <DropdownMenuItem onClick={() => toast("Switch accounts coming soon!")} className="flex items-center gap-3 p-3 cursor-pointer rounded-lg focus:bg-secondary/50">
                                <span className="pl-8">Switch accounts</span>
                            </DropdownMenuItem>

                            <div className="h-px bg-border my-2 mx-1" />

                            <DropdownMenuItem
                                onClick={async () => {
                                    await supabase.auth.signOut();
                                    window.location.href = "/auth";
                                }}
                                className="flex items-center gap-3 p-3 cursor-pointer rounded-lg focus:bg-secondary/50 hover:text-red-500 focus:text-red-500"
                            >
                                <span className="pl-8">Log out</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </aside>

            {showCreateModal && (
                <Suspense fallback={null}>
                    <CreateModal
                        isOpen
                        onClose={() => setShowCreateModal(false)}
                        onPostCreated={() => window.location.reload()}
                    />
                </Suspense>
            )}
        </>
    );
};

