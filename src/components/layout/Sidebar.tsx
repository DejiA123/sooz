import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Compass, Heart, User, PlusSquare, Search, MessageCircle, Menu, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import CreatePostModal from "@/components/feed/CreatePostModal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";

export const Sidebar = () => {
    const location = useLocation();
    const { user } = useAuth();
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Helper to determine if a link is active
    const isActive = (path: string) => location.pathname === path;

    const navItems = [
        { icon: Home, label: "Home", path: "/" },
        { icon: Search, label: "Search", path: "/discover" },
        { icon: Compass, label: "Explore", path: "/discover" }, // Mapping both to discover for now
        { icon: MessageCircle, label: "Messages", path: "/messages" }, // Placeholder
        { icon: Heart, label: "Notifications", path: "/activity" },
        { icon: PlusSquare, label: "Create", path: "#", isCreate: true },
        { icon: User, label: "Profile", path: "/profile/me" },
    ];

    return (
        <>
            <aside className="hidden md:flex flex-col fixed left-0 top-0 z-50 h-screen w-64 bg-background border-r border-border px-4 py-6">
                {/* Logo */}
                <div className="mb-10 px-2">
                    <img
                        src="/sooz-logo-v3.svg"
                        alt="SOOZ"
                        className="h-8 w-auto object-contain"
                    />
                </div>

                {/* Navigation Items */}
                <nav className="flex-1 flex flex-col gap-2">
                    {navItems.map((item) => {
                        if (item.isCreate) {
                            return (
                                <button
                                    key={item.label}
                                    onClick={() => setShowCreateModal(true)}
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
                    <button className="flex items-center gap-4 p-3 rounded-lg hover:bg-secondary/50 transition-colors w-full text-left">
                        <Menu className="w-6 h-6" />
                        <span className="font-medium text-base">More</span>
                    </button>
                </div>
            </aside>

            <CreatePostModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onPostCreated={() => window.location.reload()}
            />
        </>
    );
};
