import { useEffect, useState, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Heart, UserPlus, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { LazyImage } from "@/components/feed/LazyImage";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow, isToday, isThisWeek } from "date-fns";

interface ActivityItem {
    id: string;
    type: "like" | "comment" | "follow" | "missed_call" | "message" | "incoming_call" | "outgoing_call";
    created_at: string;
    user: {
        username: string;
        avatar_url: string | null;
    };
    post_id?: string;
    post_media?: {
        url: string | null;
        type: string | null;
    };
    content?: string;
}

export default function Activity() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const scrollRef = useRef<HTMLDivElement>(null);

    // Scroll to top on mount
    useEffect(() => {
        window.scrollTo(0, 0);
        if (scrollRef.current?.parentElement) {
            scrollRef.current.parentElement.scrollTop = 0;
        }
    }, []);

    const { data: activities = [], isLoading } = useQuery({
        queryKey: ['activity', user?.id],
        queryFn: async () => {
            if (!user) return [];

            // Execute independent queries in PARALLEL for maximum speed
            const [notificationsResult, followsResult, likesResult] = await Promise.all([
                // 1. Fetch from 'notifications' table
                supabase
                    .from('notifications')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(50),

                // 2. Fetch Legacy Activities (Follows)
                supabase
                    .from("follows")
                    .select(`id, created_at, follower:follower_id(username, avatar_url)`)
                    .eq("following_id", user.id)
                    .order("created_at", { ascending: false })
                    .limit(20),

                // 3. Fetch Legacy Activities (Likes)
                supabase
                    .from("likes")
                    .select(`
                        id, created_at, post_id, 
                        user:user_id(username, avatar_url),
                        posts!inner(user_id, media_url, media_type)
                    `)
                    .eq("posts.user_id", user.id)
                    .neq("user_id", user.id)
                    .order("created_at", { ascending: false })
                    .limit(20)
            ]);

            const notifications = notificationsResult.data;
            const follows = followsResult.data;
            const likes = likesResult.data;

            if (notificationsResult.error) throw notificationsResult.error;

            // Fetch actors for notifications if needed
            let notifItems: ActivityItem[] = [];
            if (notifications && notifications.length > 0) {
                const actorIds = [...new Set(notifications.map(n => n.actor_id).filter(Boolean))];

                // Fetch profiles for actors
                const { data: actors } = await supabase
                    .from('profiles')
                    .select('id, username, avatar_url')
                    .in('id', actorIds);

                const actorMap = Object.fromEntries(actors?.map(a => [a.id, a]) || []);

                notifItems = notifications.map(n => {
                    const actor = actorMap[n.actor_id!];
                    return {
                        id: n.id,
                        type: n.type as any,
                        created_at: n.created_at,
                        user: {
                            username: actor?.username || 'Unknown',
                            avatar_url: actor?.avatar_url || null
                        },
                        post_id: n.reference_id || undefined,
                        content: n.content
                    };
                });
            }

            const followActivities = (follows || []).map(f => ({
                id: f.id,
                type: "follow" as const,
                created_at: f.created_at,
                // @ts-ignore
                user: f.follower,
                content: "started following you."
            }));

            const likeActivities = (likes || []).map(l => ({
                id: l.id,
                type: "like" as const,
                created_at: l.created_at,
                // @ts-ignore
                user: l.user,
                post_id: l.post_id,
                post_media: {
                    // @ts-ignore
                    url: l.posts?.media_url,
                    // @ts-ignore
                    type: l.posts?.media_type
                },
                content: "liked your post."
            }));

            const allActivities = [...notifItems, ...followActivities, ...likeActivities]
                .filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i)
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            return allActivities as ActivityItem[];
        },
        enabled: !!user,
        staleTime: 1000 * 60 * 5, // Cache for 5 mins
    });

    const groupedActivities = useMemo(() => {
        const groups: Record<string, ActivityItem[]> = {
            "Today": [],
            "This Week": [],
            "Earlier": []
        };

        activities.forEach(activity => {
            const date = new Date(activity.created_at);
            if (isToday(date)) {
                groups["Today"].push(activity);
            } else if (isThisWeek(date)) {
                groups["This Week"].push(activity);
            } else {
                groups["Earlier"].push(activity);
            }
        });

        return Object.entries(groups).filter(([_, items]) => items.length > 0);
    }, [activities]);

    const ActivitySkeleton = () => (
        <div className="space-y-6 px-4 pt-4">
            {[1, 2, 3].map((g) => (
                <div key={g} className="space-y-4">
                    <Skeleton className="h-4 w-20 rounded-full bg-white/5" />
                    {[1, 2].map((i) => (
                        <div key={i} className="flex items-center gap-4 py-1">
                            <Skeleton className="w-12 h-12 rounded-full bg-white/5" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-3/4 bg-white/5" />
                                <Skeleton className="h-3 w-1/4 bg-white/5" />
                            </div>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );

    return (
        <div className="min-h-screen bg-background pb-32">
            {/* Premium Header */}
            <header className="sticky top-0 z-50 pwa-fixed-top">
                <div className="glass border-b-0 px-6 py-5 flex items-center justify-between shadow-glass">
                    <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
                        Activity
                    </h1>
                </div>
            </header>

            <ScrollArea className="h-[calc(100vh-80px)]">
                <div ref={scrollRef} className="px-4 pt-4">
                    {isLoading ? (
                        <ActivitySkeleton />
                    ) : activities.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 text-center">
                            <div className="w-16 h-16 rounded-full bg-secondary/30 flex items-center justify-center mb-4">
                                <Heart className="w-8 h-8 text-muted-foreground/30" />
                            </div>
                            <h3 className="text-lg font-bold">No activity yet</h3>
                            <p className="text-sm text-muted-foreground max-w-[200px]">
                                When people like or comment on your posts, you'll see them here.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {groupedActivities.map(([groupName, items]) => (
                                <section key={groupName} className="space-y-4">
                                    <h2 className="text-[13px] font-bold uppercase tracking-widest text-muted-foreground/50 px-2">
                                        {groupName}
                                    </h2>
                                    <div className="space-y-1">
                                        {items.map((item) => (
                                            <div
                                                key={item.id}
                                                onClick={() => {
                                                    if (item.type === 'follow') {
                                                        navigate(`/profile/${item.user.username}`);
                                                    } else if (item.post_id) {
                                                        navigate(`/post/${item.post_id}`);
                                                    } else if (['incoming_call', 'outgoing_call', 'missed_call'].includes(item.type)) {
                                                        navigate(`/profile/${item.user.username}`);
                                                    }
                                                }}
                                                className="flex items-center gap-4 p-3 rounded-[1.25rem] hover:bg-white/[0.03] active:bg-white/[0.05] transition-all cursor-pointer group relative active:scale-[0.98]"
                                            >
                                                <div className="relative flex-shrink-0">
                                                    <Avatar className="w-12 h-12 border border-white/10 ring-2 ring-transparent group-hover:ring-primary/20 transition-all duration-500">
                                                        <AvatarImage src={item.user.avatar_url || ""} className="object-cover" />
                                                        <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">{item.user.username[0].toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                    <div className={cn(
                                                        "absolute -bottom-0.5 -right-0.5 p-1 rounded-full border-2 border-background shadow-lg",
                                                        item.type === 'like' ? 'bg-red-500' :
                                                            item.type === 'missed_call' ? 'bg-red-500' : 'bg-primary'
                                                    )}>
                                                        {item.type === 'like' ? (
                                                            <Heart className="w-2 h-2 text-white fill-current" />
                                                        ) : ['missed_call', 'incoming_call', 'outgoing_call'].includes(item.type) ? (
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.05 12.05 0 0 0 .57 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.05 12.05 0 0 0 2.81.57A2 2 0 0 1 22 16.92z" /></svg>
                                                        ) : (
                                                            <UserPlus className="w-2 h-2 text-white" />
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex-1 min-w-0 pr-2">
                                                    <p className="text-[14px] leading-snug">
                                                        <span className="font-bold hover:underline">{item.user.username}</span>{" "}
                                                        <span className="text-foreground/80">{item.content}</span>
                                                    </p>
                                                    <p className="text-[12px] text-muted-foreground/50 font-medium mt-1">
                                                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                                                    </p>
                                                </div>
                                                {item.post_media?.url ? (
                                                    <div className="w-12 h-12 rounded-[0.75rem] overflow-hidden bg-muted flex-shrink-0 border border-white/10 relative shadow-sm group-hover:scale-105 transition-transform duration-500">
                                                        {item.post_media.type === 'video' ? (
                                                            <div className="w-full h-full bg-black flex items-center justify-center">
                                                                <div className="w-full h-full bg-gradient-to-br from-primary/10 to-transparent" />
                                                                <Play className="w-3 h-3 text-white absolute inset-0 m-auto fill-white/80" />
                                                            </div>
                                                        ) : (
                                                            <LazyImage src={item.post_media.url} className="w-full h-full object-cover" alt="Post" priority />
                                                        )}
                                                    </div>
                                                ) : item.type === 'follow' ? (
                                                    <Button size="sm" variant="secondary" className="h-8 rounded-full px-4 text-xs font-bold bg-white/5 hover:bg-white/10 border-0">
                                                        Profile
                                                    </Button>
                                                ) : null}
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            ))}
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
