import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { fetchPosts } from "@/services/api/posts";

export const MainLayout = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!user) return;

        // Prefetch home feed so it's ready instantly when visiting Home
        queryClient.prefetchInfiniteQuery({
            queryKey: ['posts', user.id],
            queryFn: ({ pageParam }) => fetchPosts({ pageParam, userId: user.id }),
            initialPageParam: 0,
            staleTime: 1000 * 60 * 5,
        });

        const updateLastSeen = async () => {
            try {
                await supabase.from('profiles').update({
                    updated_at: new Date().toISOString()
                }).eq('id', user.id);
            } catch (error) {
                console.error("Error updating last seen:", error);
            }
        };

        updateLastSeen();
    }, [user, queryClient]);

    return (
        <div className="min-h-screen bg-background pb-20 pt-[calc(3.2rem+env(safe-area-inset-top,0px))] md:pt-0 md:pb-0">
            <div className="md:hidden">
                <TopBar />
            </div>

            <Sidebar />

            <div className="md:ml-64 min-h-screen">
                <main className="w-full md:container md:max-w-lg lg:max-w-5xl mx-auto px-0 md:px-4 animate-fade-in md:py-8">
                    {/* Add a Suspense boundary here specifically for route transitions */}
                    {/* fallback={null} ensures no loading spinner is shown, just empty content or previous content until ready? */}
                    {/* React Router doesn't keep previous content with Suspense unless using useTransition. */}
                    {/* Standard Suspense unmounts old, mounts new. fallback=null means blank space. */}
                    {/* This satisfies "I don't want to see that loading circle". */}
                    <Outlet />
                </main>
            </div>

            <div className="md:hidden">
                <BottomNav />
            </div>
        </div>
    );
};
