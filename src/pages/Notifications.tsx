import { useState, useEffect } from "react";
import { Bell, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Notification {
    id: string;
    type: string;
    actor_id: string;
    content: string;
    is_read: boolean;
    created_at: string;
    actor?: {
        username: string;
        avatar_url: string | null;
    };
}

export default function Notifications() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        fetchNotifications();
    }, [user]);

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user?.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;

            // Fetch actors
            if (data) {
                const actorIds = [...new Set(data.map(n => n.actor_id).filter(Boolean))];
                const { data: actors } = await supabase
                    .from('profiles')
                    .select('id, username, avatar_url')
                    .in('id', actorIds);

                const actorMap = Object.fromEntries(actors?.map(a => [a.id, a]) || []);

                const enriched = data.map(n => ({
                    ...n,
                    actor: actorMap[n.actor_id]
                }));
                setNotifications(enriched);
            }

        } catch (error) {
            console.error("Error fetching notifications:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', user?.id);

            if (error) throw error;

            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            toast.success("All notifications marked as read");
        } catch (error) {
            toast.error("Failed to mark all as read");
        }
    };

    const handleClick = async (notification: Notification) => {
        // Mark as read if not
        if (!notification.is_read) {
            await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', notification.id);
            setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n));
        }

        // Navigate
        // TODO: Map types to routes (message -> chat, like -> post)
        if (notification.type === 'message') {
            navigate('/chat');
        } else if (notification.type === 'like' || notification.type === 'comment') {
            // navigate to post? For now just profile
            if (notification.actor?.username) {
                navigate(`/profile/${notification.actor.username}`);
            }
        }
    };

    return (
        <div className="pb-20">
            <div className="p-4 border-b border-white/5 bg-background/50 backdrop-blur-xl flex items-center justify-between">
                <h1 className="text-xl font-bold">Notifications</h1>
                <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
                    <Check className="w-4 h-4 mr-1" /> Mark all read
                </Button>
            </div>

            {loading ? (
                <div className="h-40 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : notifications.length === 0 ? (
                <div className="text-center text-muted-foreground py-20">
                    <div className="w-16 h-16 bg-muted rounded-full mx-auto mb-4 flex items-center justify-center">
                        <Bell className="w-8 h-8 opacity-50" />
                    </div>
                    <p>No notifications yet</p>
                </div>
            ) : (
                <div className="divide-y divide-white/5">
                    {notifications.map((n) => (
                        <div
                            key={n.id}
                            onClick={() => handleClick(n)}
                            className={cn(
                                "flex items-start gap-4 p-4 hover:bg-white/5 cursor-pointer transition-colors",
                                !n.is_read && "bg-primary/5"
                            )}
                        >
                            <Avatar className="w-10 h-10 border border-white/10">
                                <AvatarImage src={n.actor?.avatar_url || undefined} className="object-cover" />
                                <AvatarFallback>{n.actor?.username?.[0]}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <p className="text-sm">
                                    <span className="font-semibold">{n.actor?.username}</span>{" "}
                                    {n.content}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                                </p>
                            </div>
                            {!n.is_read && (
                                <div className="w-2 h-2 bg-primary rounded-full mt-2" />
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
