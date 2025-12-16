import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Heart, UserPlus, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

interface ActivityItem {
    id: string;
    type: "like" | "comment" | "follow";
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
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!authLoading && !user) {
            navigate("/auth");
            return;
        }
        if (user) {
            fetchActivity();
        }
    }, [user, authLoading, navigate]);

    const fetchActivity = async () => {
        try {
            if (!user) return;

            // Fetch new followers
            const { data: follows, error: followsError } = await supabase
                .from("follows")
                .select(`
          id,
          created_at,
          follower:follower_id(username, avatar_url)
        `)
                .eq("following_id", user.id)
                .order("created_at", { ascending: false })
                .limit(20);

            if (followsError) throw followsError;

            // Fetch likes on my posts
            const { data: likes, error: likesError } = await supabase
                .from("likes")
                .select(`
          id,
          created_at,
          post_id,
          user:user_id(username, avatar_url),
          posts!inner(user_id, media_url, media_type)
        `)
                .eq("posts.user_id", user.id)
                .neq("user_id", user.id) // Don't show my own likes
                .order("created_at", { ascending: false })
                .limit(20);

            if (likesError) throw likesError;

            // Transform and combine
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

            const allActivities = [...followActivities, ...likeActivities].sort(
                (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );

            setActivities(allActivities as ActivityItem[]);
        } catch (error) {
            console.error("Error fetching activity:", error);
        } finally {
            setLoading(false);
        }
    };

    if (authLoading || (loading && user)) {
        return (
            <div className="h-full flex items-center justify-center pt-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="pb-20">
            <h1 className="text-xl font-bold px-4 py-4">Notifications</h1>
            <ScrollArea className="h-[calc(100vh-140px)]">
                <div className="space-y-1 px-2">
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
                                    <div className={`absolute -bottom-1 -right-1 p-0.5 rounded-full border-2 border-background ${item.type === 'like' ? 'bg-red-500 text-white' : 'bg-purple-500 text-white'
                                        }`}>
                                        {item.type === 'like' ? (
                                            <Heart className="w-2.5 h-2.5 fill-current" />
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
