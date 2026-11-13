import { supabase } from "@/integrations/supabase/client";
import { urlBase64ToUint8Array, VAPID_PUBLIC_KEY } from "@/utils/pushParams";

/**
 * Push notifications. No website or web app can switch notifications on by itself: every phone and
 * browser only allows them after the person taps "Allow" on the system's own question, and iPhone
 * only offers web notifications in apps added to the Home Screen (iOS 16.4+), asked from a tap. So
 * SOOZ asks at a good moment with one tap, keeps the subscription alive silently once allowed, and
 * shows how to fix it when it can't (blocked, or iPhone Safari).
 */

export const isIOS = () =>
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

export const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

/**
 * What this phone can do right now:
 * - "on": allowed (the subscription is kept up to date silently)
 * - "ask": supported and not asked yet (or asked and dismissed)
 * - "blocked": the person (or the phone) said no; only the phone's settings can change it
 * - "home-screen": iPhone / iPad in Safari — notifications need SOOZ added to the Home Screen
 * - "unsupported": this browser has no web notifications
 */
export type PushStatus = "on" | "ask" | "blocked" | "home-screen" | "unsupported";

export function pushStatus(): PushStatus {
  if (typeof window === "undefined") return "unsupported";
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) return isIOS() && !isStandalone() ? "home-screen" : "unsupported";
  if (Notification.permission === "granted") return "on";
  if (Notification.permission === "denied") return "blocked";
  return "ask";
}

/** Save this phone's subscription for the signed-in person (one row per phone, keyed by endpoint). */
async function save(userId: string, sub: PushSubscription) {
  const keys = sub.toJSON().keys;
  if (!keys?.p256dh || !keys?.auth) throw new Error("No push keys");
  const { error } = await supabase
    .from("push_subscriptions" as never)
    .upsert({ user_id: userId, endpoint: sub.endpoint, p256dh: keys.p256dh, auth: keys.auth, last_used: new Date().toISOString() } as never, { onConflict: "endpoint" });
  if (error) throw error;
}

const sameKey = (sub: PushSubscription, want: Uint8Array) => {
  const k = sub.options?.applicationServerKey;
  if (!k) return true;
  const have = new Uint8Array(k as ArrayBuffer);
  return have.length === want.length && have.every((b, i) => b === want[i]);
};

/**
 * Once allowed: make sure this phone has a working subscription saved for this person. Runs on every
 * open, so a subscription the phone dropped or renewed, or a new SOOZ key, is fixed without asking.
 */
export async function syncPush(userId: string): Promise<boolean> {
  if (pushStatus() !== "on") return false;
  const reg = await navigator.serviceWorker.ready;
  const want = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub, want)) {
    await supabase.from("push_subscriptions" as never).delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe().catch(() => {});
    sub = null;
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: want });
  await save(userId, sub);
  return true;
}

/**
 * Ask the phone for permission and subscribe. Call it straight from a tap, before any other await:
 * iPhone only shows its question when it comes directly from the person's tap.
 */
export async function enablePush(userId: string): Promise<PushStatus> {
  if (pushStatus() !== "ask" && pushStatus() !== "on") return pushStatus();
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return pushStatus();
  await syncPush(userId);
  return "on";
}

/**
 * Before signing out: stop this phone getting the account's notifications (messages, calls…), so the
 * next person to use it doesn't see them. The phone keeps its permission; signing in again re-subscribes.
 */
export async function forgetPushOnThisPhone(): Promise<void> {
  try {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await supabase.from("push_subscriptions" as never).delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  } catch { /* signing out goes ahead anyway */ }
}

/** "Not now": don't ask again for a few days. */
const SNOOZE_KEY = "sooz-push-ask";
export function snoozePushAsk(days: number) {
  try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + days * 86_400_000)); } catch { /* storage blocked */ }
}
export function pushAskSnoozed(): boolean {
  try { return Number(localStorage.getItem(SNOOZE_KEY) || 0) > Date.now(); } catch { return false; }
}

/** The number on SOOZ's Home Screen icon (unread chats), where the phone supports it. */
export function setIconBadge(count: number) {
  const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  try {
    if (count > 0) nav.setAppBadge?.(count)?.catch(() => {});
    else nav.clearAppBadge?.()?.catch(() => {});
  } catch { /* not supported */ }
}

/**
 * After a like, comment, reply or follow: the database records it in the other person's Activity, and
 * this asks the notification service to send them the phone notification. It only ever sends this
 * person's own recent activity, each once, so it's safe to call often (calls close together are merged).
 */
let activityTimer: ReturnType<typeof setTimeout> | undefined;
export function notifyActivity() {
  clearTimeout(activityTimer);
  activityTimer = setTimeout(() => {
    supabase.functions.invoke("push-notifications", { body: { type: "activity" } }).catch(() => { /* Activity still shows it */ });
  }, 1500);
}
