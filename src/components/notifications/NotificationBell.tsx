import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

export const NotificationBell = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!user) return;

        fetchUnreadCount();

        // Subscribe to new notifications
        const channel = supabase
            .channel('public:notifications')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
                () => {
                    setUnreadCount(prev => prev + 1);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const fetchUnreadCount = async () => {
        try {
            const { count, error } = await supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user?.id)
                .eq('is_read', false);

            if (error) throw error;
            setUnreadCount(count || 0);
        } catch (error) {
            console.error("Error fetching unread notifications:", error);
        }
    };

    return (
        <Button
            variant="ghost"
            size="icon"
            className="relative text-muted-foreground hover:text-primary transition-colors"
            onClick={() => navigate("/notifications")}
        >
            <Bell className="w-6 h-6" />
            {unreadCount > 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-background">
                    {unreadCount > 9 ? "9+" : unreadCount}
                </span>
            )}
        </Button>
    );
};
