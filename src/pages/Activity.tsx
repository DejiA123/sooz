import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Heart, UserPlus, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

interface ActivityItem {
    id: string;
    type: "like" | "comment" | "follow" | "missed_call" | "message";
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
    const { user, loading: authLoading } = useAuth();
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

            // 1. Fetch from 'notifications' table
            const { data: notifications, error: notifError } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (notifError) throw notifError;

            // Fetch actors for notifications
            let notifItems: ActivityItem[] = [];
            if (notifications && notifications.length > 0) {
                const actorIds = [...new Set(notifications.map(n => n.actor_id).filter(Boolean))];
                const { data: actors } = await supabase
                    .from('profiles')
                    .select('id, username, avatar_url')
                    .in('id', actorIds);

                const actorMap = Object.fromEntries(actors?.map(a => [a.id, a]) || []);

                notifItems = notifications.map(n => {
                    const actor = actorMap[n.actor_id];
                    return {
                        id: n.id,
                        type: n.type as any,
                        created_at: n.created_at,
                        user: {
                            username: actor?.username || 'Unknown',
                            avatar_url: actor?.avatar_url || null
                        },
                        post_id: n.post_id || undefined,
                        content: n.content
                    };
                });
            }

            // 2. Fetch Legacy Activities
            const { data: follows, error: followsError } = await supabase
                .from("follows")
                .select(`id, created_at, follower:follower_id(username, avatar_url)`)
                .eq("following_id", user.id)
                .order("created_at", { ascending: false })
                .limit(20);
            if (followsError) throw followsError;

            const { data: likes, error: likesError } = await supabase
                .from("likes")
                .select(`
                    id, created_at, post_id, 
                    user:user_id(username, avatar_url),
                    posts!inner(user_id, media_url, media_type)
                `)
                .eq("posts.user_id", user.id)
                .neq("user_id", user.id)
                .order("created_at", { ascending: false })
                .limit(20);
            if (likesError) throw likesError;

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

    // Removed blocking spinner to allow instant navigation
    // if (authLoading || (loading && user)) { ... }

    return (
        <div className="pb-20">
            <h1 className="text-xl font-bold px-4 py-4">Notifications</h1>
            <ScrollArea className="h-[calc(100vh-140px)]">
                <div ref={scrollRef} className="space-y-1 px-2">
                    {activities.length === 0 ? (
                        <div className="text-center text-muted-foreground py-10 text-sm">
                            No recent activity
                        </div>
                    ) : (
                        activities.map((item) => (
                            <div
                                key={item.id}
                                onClick={() => {
                                    if (item.type === 'follow') {
                                        navigate(`/profile/${item.user.username}`);
                                    } else if (item.post_id) {
                                        navigate(`/post/${item.post_id}`);
                                    }
                                }}
                                className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group"
                            >
                                <div className="relative">
                                    <Avatar className="w-10 h-10 border border-white/10">
                                        <AvatarImage src={item.user.avatar_url || ""} className="object-cover" />
                                        <AvatarFallback>{item.user.username[0].toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div className={`absolute -bottom-1 -right-1 p-0.5 rounded-full border-2 border-background ${item.type === 'like' ? 'bg-red-500 text-white' :
                                        item.type === 'missed_call' ? 'bg-red-500 text-white' : 'bg-purple-500 text-white'
                                        }`}>
                                        {item.type === 'like' ? (
                                            <Heart className="w-2.5 h-2.5 fill-current" />
                                        ) : item.type === 'missed_call' ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-phone-missed"><line x1="23" x2="17" y1="1" y2="7" /><line x1="17" x2="23" y1="1" y2="7" /><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.05 12.05 0 0 0 .57 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.05 12.05 0 0 0 2.81.57A2 2 0 0 1 22 16.92z" /></svg>
                                        ) : (
                                            <UserPlus className="w-2.5 h-2.5" />
                                        )}
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm truncate">
                                        <span className="font-semibold">{item.user.username}</span> <span className="text-muted-foreground">{item.content}</span>
                                    </p>
                                    <p className="text-xs text-muted-foreground/60 mt-0.5">
                                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                                    </p>
                                </div>
                                {item.post_media?.url && (
                                    <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex-shrink-0 border border-white/10 relative">
                                        {item.post_media.type === 'video' ? (
                                            <div className="w-full h-full bg-black flex items-center justify-center">
                                                {/* Ideally we'd show a thumbnail here, but raw video works if we disable controls/autoplay */}
                                                <video
                                                    src={item.post_media.url}
                                                    className="w-full h-full object-cover opacity-80"
                                                    muted
                                                    playsInline
                                                />
                                                <Play className="w-3 h-3 text-white absolute inset-0 m-auto fill-white/50" />
                                            </div>
                                        ) : (
                                            <img src={item.post_media.url} className="w-full h-full object-cover" alt="Post" />
                                        )}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
