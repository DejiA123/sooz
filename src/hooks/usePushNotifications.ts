import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { enablePush, forgetPushOnThisPhone, pushStatus, syncPush, type PushStatus } from "@/lib/push";

/**
 * This phone's notification status for the signed-in person (see src/lib/push.ts). Once allowed, the
 * subscription is checked and renewed silently every time the app opens or comes back to the front.
 */
export const usePushNotifications = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<PushStatus>(() => pushStatus());

  useEffect(() => {
    if (!user) return;
    const run = () => {
      setStatus(pushStatus());
      syncPush(user.id).catch((err) => console.error("Push sync failed", err));
    };
    run();
    // People can turn notifications on in the phone's settings while SOOZ is in the background.
    const onShow = () => { if (document.visibilityState === "visible") run(); };
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [user]);

  /** Call straight from a tap (iPhone only asks from a tap). */
  const subscribeToPush = useCallback(async () => {
    if (!user) return pushStatus();
    const next = await enablePush(user.id).catch((err) => { console.error("Push enable failed", err); return pushStatus(); });
    setStatus(next);
    return next;
  }, [user]);

  const unsubscribeFromPush = useCallback(async () => {
    await forgetPushOnThisPhone();
    setStatus(pushStatus());
  }, []);

  return { status, isSubscribed: status === "on", subscribeToPush, unsubscribeFromPush };
};
