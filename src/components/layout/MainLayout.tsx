import { Outlet, useLocation } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { fetchForYouPage, FIRST_CURSOR, type FeedCursor } from "@/services/api/feed";
import { cn } from "@/lib/utils";
import { markChatsDelivered } from "@/services/api/chat";

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
            queryFn: ({ pageParam }) => fetchForYouPage({ pageParam: pageParam as FeedCursor, userId: user.id }),
            initialPageParam: FIRST_CURSOR,
            staleTime: 1000 * 60 * 2,
        });

        // "last seen" for chats, and "delivered" ticks for anything sent while the app was closed.
        const seen = () => {
            if (document.hidden) return;
            supabase.from("profiles").update({ updated_at: new Date().toISOString() }).eq("id", user.id)
                .then(({ error }) => { if (error) console.error("Error updating last seen:", error); });
            markChatsDelivered();
        };
        seen();
        document.addEventListener("visibilitychange", seen);
        const beat = setInterval(seen, 2 * 60 * 1000);

        // New messages anywhere in the app: they've reached this phone (double grey tick), and the
        // Inbox badge updates.
        let t = 0;
        const channel = supabase
            .channel(`inbox:${crypto.randomUUID().slice(0, 8)}`)
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => {
                if ((p.new as { sender_id?: string }).sender_id !== user.id) markChatsDelivered();
                clearTimeout(t);
                t = window.setTimeout(() => queryClient.invalidateQueries({ queryKey: ["chats", user.id] }), 400);
            })
            .subscribe();
        return () => {
            document.removeEventListener("visibilitychange", seen);
            clearInterval(beat);
            clearTimeout(t);
            supabase.removeChannel(channel);
        };
    }, [user, queryClient]);

    // Installed iPhone app: if the first page can't scroll, iOS lays the app out one status-bar
    // height too short (tab bar floats up) until some page scrolls. Home's feed scrolls inside its
    // own box, so give the page a 1px scroll (spacer below) and nudge it as the app opens/resumes.
    useEffect(() => {
        if (!isFeed) return;
        const nudge = () => {
            window.scrollTo(0, 1);
            requestAnimationFrame(() => window.scrollTo(0, 0));
        };
        const timers = [50, 400, 1200].map((ms) => setTimeout(nudge, ms));
        const onShow = () => { if (document.visibilityState === "visible") setTimeout(nudge, 50); };
        window.addEventListener("pageshow", onShow);
        document.addEventListener("visibilitychange", onShow);
        return () => {
            timers.forEach(clearTimeout);
            window.removeEventListener("pageshow", onShow);
            document.removeEventListener("visibilitychange", onShow);
        };
    }, [isFeed]);

    // One tree for both layouts so the bottom nav (and its glass lens animation) never remounts.
    return (
        <>
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
        {isFeed && <div aria-hidden className="h-px" />}
        </>
    );
};
