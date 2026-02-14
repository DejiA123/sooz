import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { urlBase64ToUint8Array, VAPID_PUBLIC_KEY } from '@/utils/pushParams';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export const usePushNotifications = () => {
    const { user } = useAuth();
    const [subscription, setSubscription] = useState<PushSubscription | null>(null);
    const [isSubscribed, setIsSubscribed] = useState(false);

    useEffect(() => {
        // Check local status
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            navigator.serviceWorker.ready.then((registration: any) => {
                registration.pushManager.getSubscription().then((sub: PushSubscription | null) => {
                    if (sub) {
                        setSubscription(sub);
                        setIsSubscribed(true);
                    }
                });
            });
        }
    }, []);

    const subscribeToPush = async () => {
        if (!user) {
            toast.error("You must be logged in to enable notifications");
            return;
        }

        if (!('serviceWorker' in navigator)) {
            toast.error("Push notifications are not supported in this browser");
            return;
        }

        try {
            const registration: any = await navigator.serviceWorker.ready;
            console.log('Service Worker ready:', registration);

            // Check if permission is granted
            const permission = await Notification.requestPermission();
            console.log('Notification permission:', permission);

            if (permission !== 'granted') {
                toast.error("Please allow notifications in your browser settings");
                return;
            }

            // 1. Subscribe to Browser Push Manager
            console.log('Attempting to subscribe with VAPID key:', VAPID_PUBLIC_KEY);
            const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });

            console.log('Browser Subscription:', sub);

            // 2. Save to Database
            const keys = sub.toJSON().keys;
            if (!keys || !keys.p256dh || !keys.auth) {
                throw new Error("Failed to generate keys");
            }

            const { error } = await supabase
                // @ts-ignore
                .from('push_subscriptions')
                .upsert({
                    user_id: user.id,
                    endpoint: sub.endpoint,
                    p256dh: keys.p256dh,
                    auth: keys.auth,
                    last_used: new Date().toISOString()
                }, { onConflict: 'endpoint' });

            if (error) {
                console.error("Supabase error:", error);
                throw error;
            }

            setSubscription(sub);
            setIsSubscribed(true);
            toast.success("Notifications enabled!", {
                description: "You will now receive updates when the app is closed."
            });

        } catch (error: any) {
            console.error("Failed to subscribe:", error);
            console.error("Error name:", error.name);
            console.error("Error message:", error.message);
            toast.error(`Failed to enable notifications: ${error.name}`);
        }
    };

    const unsubscribeFromPush = async () => {
        if (!subscription) return;

        // 1. Unsubscribe from Browser
        await subscription.unsubscribe();

        // 2. Remove from Database
        if (supabase) { // check if supabase is initialized, fallback if not? It is imported above.
            // @ts-ignore
            await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
        }

        setSubscription(null);
        setIsSubscribed(false);
        toast.info("Notifications disabled");
    };

    return {
        isSubscribed,
        subscribeToPush,
        unsubscribeFromPush
    };
};
