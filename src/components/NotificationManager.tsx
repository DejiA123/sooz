import { useEffect } from "react";
import { toast } from "sonner";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAuth } from "@/hooks/useAuth";

export const NotificationManager = () => {
    const { subscribeToPush, isSubscribed } = usePushNotifications();
    const { user } = useAuth();

    useEffect(() => {
        // Only ask if user is logged in, not subscribed, and permission is default
        if (user && !isSubscribed && 'Notification' in window && Notification.permission === 'default') {
            const timer = setTimeout(() => {
                toast("Turn on notifications?", {
                    description: "So you never miss a message or a call.",
                    action: {
                        label: "Allow",
                        onClick: () => {
                            Notification.requestPermission().then(permission => {
                                if (permission === 'granted') {
                                    subscribeToPush();
                                }
                            });
                        }
                    },
                    duration: 10000, // 10s
                });
            }, 3000); // 3s delay on load

            return () => clearTimeout(timer);
        }
    }, [user, isSubscribed, subscribeToPush]);

    return null;
};
