
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Heart, MessageCircle, UserPlus, Zap, Loader2 } from "lucide-react";
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
    content?: string;
}

export default function Activity() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            fetchActivity();
        }
    }, [user]);

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
            // Note: This requires a join on posts to filter by my user_id
            const { data: likes, error: likesError } = await supabase
                .from("likes")
                .select(`
          id,
          created_at,
          post_id,
          user:user_id(username, avatar_url),
          posts!inner(user_id)
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

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center pt-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="pb-20">
            <h1 className="text-2xl font-bold px-4 py-6 font-display">Activity</h1>
            <ScrollArea className="h-full">
                <div className="space-y-2 px-4">
                    {activities.length === 0 ? (
                        <div className="text-center text-muted-foreground py-10">
                            No recent activity
                        </div>
                    ) : (
                        activities.map((item) => (
                            <div
                                key={item.id}
                                className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-white/5 animate-scale-in hover:bg-white/5 transition-colors cursor-pointer"
                            >
                                <div className="relative">
                                    <Avatar className="w-12 h-12">
                                        <AvatarImage src={item.user.avatar_url || ""} className="object-cover" />
                                        <AvatarFallback>{item.user.username[0].toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div className={`absolute -bottom-1 -right-1 p-1 rounded-full border-2 border-card ${item.type === 'like' ? 'bg-red-500/10 text-red-500' : 'bg-purple-500/10 text-purple-500'
                                        }`}>
                                        {item.type === 'like' ? (
                                            <Heart className="w-3 h-3" strokeWidth={3} />
                                        ) : (
                                            <UserPlus className="w-3 h-3" strokeWidth={3} />
                                        )}
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm">
                                        <span className="font-semibold">{item.user.username}</span> {item.content}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                                    </p>
                                </div>
                                {item.post_id && (
                                    <div className="w-10 h-10 rounded-md bg-muted overflow-hidden flex-shrink-0">
                                        {/* Could fetch post thumbnail here if we had it easily available, or just a generic icon */}
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
