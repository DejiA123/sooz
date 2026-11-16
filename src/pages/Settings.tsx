import { useState } from "react";
import { ArrowLeft, ChevronRight, Loader2, LogOut, ThumbsUp } from "lucide-react";
import { appVersionLabel, applyUpdate, checkForUpdate } from "@/lib/appUpdate";
import { FeedbackSheet } from "@/components/feedback/FeedbackSheet";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { FamilySafeSetting } from "@/components/safety/FamilySafeSetting";
import { useIsAdmin } from "@/lib/admin";
import { useAuth } from "@/hooks/useAuth";
import { REEL_UI_DEFAULT, setReelUi, useReelUi, type ReelUi } from "@/lib/reelUi";
import { cn } from "@/lib/utils";
import { forgetPushOnThisPhone, isIOS } from "@/lib/push";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Bell } from "lucide-react";

/** Notifications on this phone: on, a one-tap "Turn on", or how to fix it (phones never let an app allow itself). */
const NotificationsSetting = () => {
  const { status, subscribeToPush } = usePushNotifications();
  const [busy, setBusy] = useState(false);
  const help: Record<typeof status, string> = {
    on: "On — messages and calls reach you even when SOOZ is closed.",
    ask: "Off — turn them on so you never miss a message or a call.",
    blocked: isIOS()
      ? "Blocked on this iPhone. Open the iPhone's Settings → Notifications → SOOZ and turn on Allow Notifications."
      : "Blocked for SOOZ in this browser. Open the site settings (the icon next to the address, or the browser's Settings → Site settings → Notifications) and allow SOOZ.",
    "home-screen": "iPhone only sends notifications to apps on the Home Screen: in Safari tap Share → Add to Home Screen, then open SOOZ from the icon.",
    unsupported: "This browser can't show notifications. Try SOOZ in Chrome, Safari (from the Home Screen on iPhone) or Edge.",
  };
  return (
    <>
      <p className="px-1 pt-4 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Notifications</p>
      <div className="flex items-start gap-3 rounded-2xl border border-border/20 bg-card p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-amber-400"><Bell className="h-[18px] w-[18px]" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold">{status === "on" ? "Notifications are on" : "Notifications are off"}</span>
          <span className="mt-0.5 block text-[12.5px] leading-snug text-muted-foreground">{help[status]}</span>
        </span>
        {status === "ask" && (
          <button type="button" disabled={busy} onClick={async () => { setBusy(true); await subscribeToPush(); setBusy(false); }}
            className="shrink-0 rounded-full bg-amber-400 px-4 py-2 text-[13.5px] font-bold text-[#1a1204] active:scale-95 disabled:opacity-60">
            Turn on
          </button>
        )}
      </div>
    </>
  );
};

/** Admin only: try the two looks of the feed's buttons on this phone (everyone else gets REEL_UI_DEFAULT). */
const VideoButtonsSetting = () => {
  const ui = useReelUi();
  const options: { value: ReelUi; label: string; hint: string }[] = [
    { value: "float", label: "Floating", hint: "Over the video, like TikTok" },
    { value: "dock", label: "Side panel", hint: "The earlier look" },
  ];
  return (
    <>
      <p className="px-1 pt-4 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Video buttons · admin</p>
      <div className="rounded-2xl border border-border/20 bg-card p-4">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Video buttons">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={ui === o.value}
              onClick={() => setReelUi(o.value)}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-left transition-colors",
                ui === o.value ? "border-primary bg-primary/10" : "border-border/30 bg-secondary/40 active:bg-secondary"
              )}
            >
              <span className="block text-[14px] font-semibold">{o.label}</span>
              <span className="block text-[12px] text-muted-foreground">{o.hint}</span>
            </button>
          ))}
        </div>
        <p className="mt-2.5 text-[12px] leading-snug text-muted-foreground">
          Only changes this phone. Everyone else sees {REEL_UI_DEFAULT === "float" ? "Floating" : "Side panel"}.
        </p>
      </div>
    </>
  );
};

/** The bottom of Settings: which version this is (like other apps), and a quick update check. */
const AppVersion = () => {
  const [state, setState] = useState<"idle" | "checking" | "latest" | "ready">("idle");
  const check = async () => {
    if (state === "checking") return;
    setState("checking");
    const [hasUpdate] = await Promise.all([checkForUpdate(), new Promise((r) => setTimeout(r, 600))]);
    setState(hasUpdate ? "ready" : "latest");
  };
  return (
    <div className="flex flex-col items-center gap-1.5 pt-8 text-center">
      <p className="text-[13px] tabular-nums text-muted-foreground">SOOZ {appVersionLabel()}</p>
      {state === "ready" ? (
        <button type="button" onClick={() => applyUpdate()} className="rounded-full bg-amber-400 px-4 py-1.5 text-[13px] font-bold text-[#1a1204] active:scale-95">Update now</button>
      ) : (
        <button type="button" onClick={check} disabled={state === "checking"} className="flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground/80 underline-offset-2 active:underline">
          {state === "checking" ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…</> : state === "latest" ? "You're on the latest version" : "Check for updates"}
        </button>
      )}
    </div>
  );
};

export default function Settings() {
  const navigate = useNavigate();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const { isAdmin } = useIsAdmin();
  const { user } = useAuth();
  const handleLogout = async () => {
    try { await forgetPushOnThisPhone(); await supabase.auth.signOut(); } catch (error) { console.error(error); }
    finally { Object.keys(localStorage).forEach((key) => { if (key.startsWith("sb-")) localStorage.removeItem(key); }); window.location.href = "/auth"; }
  };

  return (
    <div className="min-h-screen bg-background pb-[calc(var(--bottom-nav-height)+6rem)]">
      <div className="px-5 py-6">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-display font-bold">Settings</h1>
        </div>

        <div className="space-y-3">
          {/* Safety */}
          <p className="px-1 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Safety</p>
          <FamilySafeSetting />

          {isAdmin && <VideoButtonsSetting />}

          <NotificationsSetting />

          {/* Feedback */}
          <p className="px-1 pt-4 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Help us improve</p>
          <button type="button" onClick={() => setFeedbackOpen(true)} className="flex w-full items-center gap-3 rounded-2xl border border-border/20 bg-card p-4 text-left active:bg-secondary/40">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-sky-400"><ThumbsUp className="h-[18px] w-[18px]" /></span>
            <span className="flex-1">
              <span className="block text-[14px] font-semibold">Send feedback</span>
              <span className="block text-[12px] text-muted-foreground">👍 or 👎 and tell us why</span>
            </span>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>

          {/* Logout (only for signed-in people) */}
          {user && <div className="pt-4">
            <Button variant="ghost" className="w-full justify-start gap-3 h-14 text-destructive hover:text-destructive hover:bg-destructive/5 rounded-2xl" onClick={handleLogout}>
              <LogOut className="w-5 h-5" />
              <span className="font-bold">Log Out</span>
            </Button>
          </div>}

          <AppVersion />
        </div>
      </div>
      <FeedbackSheet open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </div>
  );
}