import { useEffect, useState, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import { ArrowDown, ArrowUp, Bell, Check, Compass, Download, Ellipsis, EllipsisVertical, Maximize, Share, SquarePlus, Zap } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { useAuth } from "@/hooks/useAuth";
import {
  confirmHasApp, forgetApp, inAppBrowser, installAskSnoozed, installKind, iosNewSafari, isAndroid, onInstallChange, openInBrowser, promptInstall,
  snoozeInstallAsk, startInstallWatch, syncInstallWithAccount, type InstallKind,
} from "@/lib/install";

const QUIET = ["/auth", "/email-confirmation", "/forgot-password", "/update-password"];
const OFFER: InstallKind[] = ["prompt", "ios-safari", "ios-browser", "in-app", "manual"];
const HINT = "sooz-open-app-hint";

export const useInstallKind = () => useSyncExternalStore(onInstallChange, installKind);
/** Open the "Get the app" card from anywhere (menu, settings). */
export const openInstallCard = () => window.dispatchEvent(new Event("sooz:get-app"));

const Step = ({ n, icon: Icon, children }: { n: number; icon: typeof Share; children: React.ReactNode }) => (
  <li className="flex items-center gap-3">
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[13px] font-extrabold text-[#1a1204]">{n}</span>
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.08]"><Icon className="h-5 w-5 text-amber-400" /></span>
    <span className="text-[15px] leading-snug">{children}</span>
  </li>
);

/**
 * "Get the SOOZ app": puts SOOZ on the Home Screen the quickest way each phone allows
 * (src/lib/install.ts) — one tap where the browser offers it, the exact steps on iPhone, and
 * "open in Safari / Chrome" first inside Instagram / TikTok / Facebook. Shows by itself once to
 * people using SOOZ in a browser (after they've had a look around), never inside the installed app,
 * and not to people who already have it — they get a short "open it from your Home Screen" note.
 */
export const InstallPrompt = () => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const kind = useInstallKind();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { startInstallWatch(); }, []);
  useEffect(() => { syncInstallWithAccount(user ?? null); }, [user]);

  // From the menu: always opens.
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener("sooz:get-app", on);
    return () => window.removeEventListener("sooz:get-app", on);
  }, []);

  // By itself: once they've used SOOZ for a little while (sooner inside another app's browser,
  // where little else works well).
  useEffect(() => {
    if (open || !OFFER.includes(kind) || installAskSnoozed() || QUIET.includes(pathname)) return;
    const t = setTimeout(() => {
      if (document.body.classList.contains("sooz-feed-covered") || document.querySelector("[role=dialog]")) return;
      setOpen(true);
    }, kind === "in-app" ? 8000 : 25000);
    return () => clearTimeout(t);
  }, [kind, pathname, open]);

  // They have the app but are in the browser: say so, now and then.
  useEffect(() => {
    if (kind !== "has-app" || QUIET.includes(pathname)) return;
    let last = 0;
    try { last = Number(localStorage.getItem(HINT) || 0); } catch { /* */ }
    if (Date.now() - last < 7 * 24 * 3600 * 1000) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(HINT, String(Date.now())); } catch { /* */ }
      toast("You have the SOOZ app", {
        description: "Open it from your Home Screen for full screen and notifications.",
        duration: 9000,
        action: { label: "I don't", onClick: () => { forgetApp(); setOpen(true); } },
      });
    }, 6000);
    return () => clearTimeout(t);
  }, [kind, pathname]);

  // Installed while the card was open (Android / desktop): done.
  useEffect(() => { if (open && (kind === "installed" || kind === "has-app")) setOpen(false); }, [kind, open]);

  const notNow = () => { snoozeInstallAsk(kind === "in-app" ? 1 : 3); setOpen(false); };
  const install = async () => {
    setBusy(true);
    const ok = await promptInstall().catch(() => false);
    setBusy(false);
    if (ok) { setOpen(false); toast.success("SOOZ is on your Home Screen", { description: "Open it from the new icon." }); }
    else snoozeInstallAsk(1);
  };
  const haveIt = () => { confirmHasApp(); setOpen(false); toast("Open SOOZ from your Home Screen", { description: "Look for the gold SOOZ icon." }); };

  if (kind === "installed") return null;
  const app = inAppBrowser();
  const browser = isAndroid() ? "Chrome" : "Safari";

  return (
    <Drawer open={open} onOpenChange={(o) => { if (!o) notNow(); }}>
      <DrawerContent overlayClassName="z-[90]" className="sheet-auto z-[90] border-white/10 bg-[#121318] px-6 pb-[calc(env(safe-area-inset-bottom,0px)+18px)] text-white">
        <div className="mx-auto w-full max-w-sm">
          <img src="/icon-192.png" alt="" className="mx-auto mt-3 h-[72px] w-[72px] rounded-[18px] shadow-lg" />
          <DrawerTitle className="mt-3 text-center text-[21px] font-bold">Get the SOOZ app</DrawerTitle>
          <DrawerDescription className="mt-1 text-center text-[14px] text-white/60">Free · no App Store needed · takes 10 seconds</DrawerDescription>

          <div className="mt-4 flex justify-center gap-5 text-[12.5px] font-medium text-white/70">
            <span className="flex items-center gap-1.5"><Maximize className="h-4 w-4 text-amber-400" /> Full screen</span>
            <span className="flex items-center gap-1.5"><Bell className="h-4 w-4 text-amber-400" /> Notifications</span>
            <span className="flex items-center gap-1.5"><Zap className="h-4 w-4 text-amber-400" /> Opens faster</span>
          </div>

          {kind === "prompt" && (
            <button type="button" disabled={busy} onClick={install} className="mt-6 flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-amber-400 text-[16px] font-bold text-[#1a1204] active:scale-[0.98] disabled:opacity-60">
              <Download className="h-5 w-5" /> Install SOOZ
            </button>
          )}

          {kind === "in-app" && (
            <>
              <p className="mt-5 text-center text-[14.5px] leading-snug text-white/70">
                You're inside {app}'s browser, which can't add apps. Open SOOZ in {browser} first — it takes one tap.
              </p>
              <button type="button" onClick={openInBrowser} className="mt-4 flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-amber-400 text-[16px] font-bold text-[#1a1204] active:scale-[0.98]">
                <Compass className="h-5 w-5" /> Open in {browser}
              </button>
              <p className="mt-2 text-center text-[12.5px] text-white/45">Nothing happened? Tap ••• at the top and choose "Open in browser".</p>
            </>
          )}

          {kind === "ios-safari" && (
            <ol className="mt-5 space-y-3">
              {iosNewSafari()
                ? <><Step n={1} icon={Ellipsis}>Tap <b>•••</b> at the bottom of Safari, then <b>Share</b></Step><Step n={2} icon={SquarePlus}>Scroll down and tap <b>Add to Home Screen</b></Step></>
                : <><Step n={1} icon={Share}>Tap <b>Share</b> at the bottom of Safari</Step><Step n={2} icon={SquarePlus}>Scroll down and tap <b>Add to Home Screen</b></Step></>}
              <Step n={3} icon={Check}>Tap <b>Add</b> — then open SOOZ from the gold icon</Step>
            </ol>
          )}
          {kind === "ios-browser" && (
            <ol className="mt-5 space-y-3">
              <Step n={1} icon={Share}>Tap <b>Share</b> next to the address at the top</Step>
              <Step n={2} icon={SquarePlus}>Scroll down and tap <b>Add to Home Screen</b></Step>
              <Step n={3} icon={Check}>Tap <b>Add</b> — then open SOOZ from the gold icon</Step>
            </ol>
          )}
          {(kind === "manual" || kind === "none" || kind === "has-app") && (
            <ol className="mt-5 space-y-3">
              <Step n={1} icon={EllipsisVertical}>Open your browser's <b>menu</b> (⋮ or ☰)</Step>
              <Step n={2} icon={SquarePlus}>Tap <b>Install app</b> or <b>Add to Home screen</b></Step>
              <Step n={3} icon={Check}>Confirm — then open SOOZ from the gold icon</Step>
            </ol>
          )}

          {(kind === "ios-safari" || kind === "ios-browser") && (
            <div className="mt-4 flex items-center justify-center gap-2 text-[13px] font-semibold text-amber-400">
              {kind === "ios-safari" ? <ArrowDown className="h-4 w-4 animate-bounce" /> : <ArrowUp className="h-4 w-4 animate-bounce" />}
              {kind === "ios-safari" ? "The button is in the bar below" : "The button is in the bar above"}
            </div>
          )}

          <div className="mt-4 flex gap-2">
            {kind !== "prompt" && kind !== "in-app" && (
              <button type="button" onClick={haveIt} className="h-11 flex-1 rounded-full bg-white/[0.08] text-[14.5px] font-semibold text-white/80 active:bg-white/15">I already have it</button>
            )}
            <button type="button" onClick={notNow} className="h-11 flex-1 rounded-full text-[14.5px] font-semibold text-white/70 active:bg-white/5">Not now</button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
