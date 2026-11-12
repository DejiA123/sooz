import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Bell, Share, SquarePlus } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAuth } from "@/hooks/useAuth";
import { pushAskSnoozed, snoozePushAsk } from "@/lib/push";

/** Pages where a card would get in the way (signing in, the camera's own screens…). */
const QUIET = ["/auth", "/email-confirmation", "/forgot-password", "/update-password"];

/**
 * Asks once, at a calm moment after sign-in, to turn notifications on — a clear card whose button
 * shows the phone's own "Allow" question in the same tap (phones never let an app allow itself).
 * On iPhone / iPad in Safari, where web notifications don't exist, it explains adding SOOZ to the
 * Home Screen instead. "Not now" waits a few days; once allowed or blocked it never shows again
 * (Settings → Notifications shows how to fix a block).
 */
export const NotificationManager = () => {
  const { user } = useAuth();
  const { status, subscribeToPush } = usePushNotifications();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || open || pushAskSnoozed() || QUIET.includes(pathname)) return;
    if (status !== "ask" && status !== "home-screen") return;
    const t = setTimeout(() => {
      // Not over the camera, a call or another sheet.
      if (document.body.classList.contains("sooz-feed-covered") || document.querySelector("[role=dialog]")) return;
      setOpen(true);
    }, 4000);
    return () => clearTimeout(t);
  }, [user, status, pathname, open]);

  const notNow = () => {
    snoozePushAsk(status === "home-screen" ? 7 : 3);
    setOpen(false);
  };

  const turnOn = async () => {
    setBusy(true);
    const result = await subscribeToPush(); // the phone's question appears now, from this tap
    setBusy(false);
    setOpen(false);
    if (result === "on") toast.success("Notifications are on", { description: "You'll hear about messages and calls even when SOOZ is closed." });
    else if (result === "blocked") toast("Notifications are off", { description: "You can turn them on any time in Settings → Notifications." });
    else snoozePushAsk(3);
  };

  if (!user || (status !== "ask" && status !== "home-screen")) return null;

  return (
    <Drawer open={open} onOpenChange={(o) => { if (!o) notNow(); }}>
      <DrawerContent overlayClassName="z-[90]" className="z-[90] border-white/10 bg-[#121318] px-6 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] text-white">
        <div className="mx-auto mt-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-400/15">
          <Bell className="h-8 w-8 text-amber-400" />
        </div>
        <DrawerTitle className="mt-4 text-center text-[20px] font-bold">
          {status === "home-screen" ? "Get notifications on your iPhone" : "Turn on notifications"}
        </DrawerTitle>
        {status === "home-screen" ? (
          <>
            <p className="mx-auto mt-2 max-w-xs text-center text-[14.5px] leading-snug text-white/70">
              iPhone only sends notifications to apps on your Home Screen. Add SOOZ there, open it from the icon, and we'll ask.
            </p>
            <ol className="mx-auto mt-5 w-full max-w-xs space-y-3 text-[15px]">
              <li className="flex items-center gap-3"><Share className="h-5 w-5 shrink-0 text-amber-400" /><span>Tap <b>Share</b> in Safari's toolbar</span></li>
              <li className="flex items-center gap-3"><SquarePlus className="h-5 w-5 shrink-0 text-amber-400" /><span>Choose <b>Add to Home Screen</b>, then <b>Add</b></span></li>
              <li className="flex items-center gap-3"><Bell className="h-5 w-5 shrink-0 text-amber-400" /><span>Open SOOZ from the new icon</span></li>
            </ol>
            <button type="button" onClick={notNow} className="mt-6 h-12 w-full rounded-full bg-amber-400 text-[16px] font-bold text-[#1a1204] active:scale-[0.98]">Got it</button>
          </>
        ) : (
          <>
            <p className="mx-auto mt-2 max-w-xs text-center text-[14.5px] leading-snug text-white/70">
              Know straight away when someone messages or calls you — even when SOOZ is closed.
            </p>
            <button type="button" disabled={busy} onClick={turnOn} className="mt-6 h-12 w-full rounded-full bg-amber-400 text-[16px] font-bold text-[#1a1204] active:scale-[0.98] disabled:opacity-60">
              Turn on notifications
            </button>
            <p className="mt-2 text-center text-[12.5px] text-white/45">Your phone will ask you to Allow.</p>
            <button type="button" onClick={notNow} className="mt-2 h-11 w-full rounded-full text-[15px] font-semibold text-white/70 active:bg-white/5">Not now</button>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
};
