import { Outlet, useLocation } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { fetchForYouPage } from "@/services/api/feed";
import { cn } from "@/lib/utils";

export const MainLayout = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { pathname } = useLocation();
    // The home feed is full-screen video, so it gets its own immersive layout.
    const isFeed = pathname === "/" || pathname === "/index";

    useEffect(() => {
        if (!user) return;

        // Have the home feed ready for when the user comes back to Home.
        queryClient.prefetchInfiniteQuery({
            queryKey: ["feed", "foryou", user.id],
            queryFn: ({ pageParam }) => fetchForYouPage({ pageParam: pageParam as number, userId: user.id }),
            initialPageParam: 0,
            staleTime: 1000 * 60 * 2,
        });

        supabase.from("profiles").update({ updated_at: new Date().toISOString() }).eq("id", user.id)
            .then(({ error }) => { if (error) console.error("Error updating last seen:", error); });
    }, [user, queryClient]);

    // One tree for both layouts so the bottom nav (and its glass lens animation) never remounts.
    return (
        <div
            className={cn(
                isFeed
                    ? "h-[100dvh] overflow-hidden bg-black"
                    : "min-h-screen bg-background pb-[var(--bottom-nav-height)] pt-[calc(3.2rem+env(safe-area-inset-top,0px))] md:pt-0 md:pb-16"
            )}
        >
            <div className={cn("md:hidden", isFeed && "hidden")}>
                <TopBar />
            </div>

            <Sidebar />

            <div className={isFeed ? "h-full md:ml-64" : "md:ml-64 min-h-screen"}>
                <main className={isFeed ? "h-full w-full" : "w-full md:container md:max-w-lg lg:max-w-5xl mx-auto px-0 md:px-4 animate-fade-in md:py-8"}>
                    <Outlet />
                </main>
            </div>

            <div className="md:hidden">
                <BottomNav />
            </div>
        </div>
    );
};
