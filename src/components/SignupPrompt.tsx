import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bookmark, Heart, Loader2, MessageCircle, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { SoozLogo } from "@/components/brand/SoozLogo";
import { useAuth } from "@/hooks/useAuth";
import { googleAvailable, signInWithGoogle } from "@/lib/authProviders";
import { notePromptShown, promptShownRecently } from "@/lib/prompts";

/**
 * "Join SOOZ" — a friendly invitation for people watching without an account (like other video apps):
 * they can keep watching without one; this just tells them what an account adds. Shows by itself once
 * they've watched for a little while, never on the sign-in pages, over another pop-up, the camera or
 * a call. "Not now" waits a day, then 3 days, then a week.
 */
const QUIET = ["/auth", "/email-confirmation", "/forgot-password", "/update-password", "/about", "/terms", "/privacy", "/help"];
const KEY = "sooz-signup-ask"; // { until: number, times: number }
const WATCH_MS = 40_000; // time on screen before the first invitation

type Ask = { until: number; times: number };
const readAsk = (): Ask => { try { return { until: 0, times: 0, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { until: 0, times: 0 }; } };
const snooze = () => {
  const a = readAsk();
  const days = a.times === 0 ? 1 : a.times === 1 ? 3 : 7;
  try { localStorage.setItem(KEY, JSON.stringify({ until: Date.now() + days * 86_400_000, times: a.times + 1 })); } catch { /* storage blocked */ }
};

/** Official multi-colour Google "G". */
const GoogleG = () => (
  <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

const PERKS = [
  { icon: Heart, text: "Like videos and keep the ones you love" },
  { icon: MessageCircle, text: "Comment, message and call your church family" },
  { icon: Sparkles, text: "A feed that learns what lifts you up" },
  { icon: Bookmark, text: "Your likes and saves on every phone you use" },
];

export const SignupPrompt = () => {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [google, setGoogle] = useState(false);
  const [busy, setBusy] = useState(false);
  const watched = useRef(0);

  useEffect(() => { if (open) googleAvailable().then(setGoogle); }, [open]);
  useEffect(() => { if (user) setOpen(false); }, [user]);

  // Count time actually spent looking at SOOZ; invite once it's long enough and nothing else is open.
  useEffect(() => {
    if (loading || user || open || QUIET.some((p) => pathname.startsWith(p))) return;
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      watched.current += 2000;
      if (watched.current < WATCH_MS || readAsk().until > Date.now()) return;
      if (document.body.classList.contains("sooz-feed-covered") || document.querySelector("[role=dialog]") || promptShownRecently()) return;
      notePromptShown();
      setOpen(true);
    }, 2000);
    return () => clearInterval(t);
  }, [loading, user, open, pathname]);

  const later = () => { snooze(); setOpen(false); };
  const go = (mode: "signup" | "login") => { snooze(); setOpen(false); navigate(mode === "signup" ? "/auth?mode=signup" : "/auth"); };
  const withGoogle = async () => {
    setBusy(true);
    const { error } = await signInWithGoogle();
    setBusy(false);
    if (error) toast.error(error);
  };

  if (user) return null;
  return (
    <Drawer open={open} onOpenChange={(o) => { if (!o) later(); }}>
      <DrawerContent overlayClassName="z-[90]" className="sheet-auto z-[90] border-white/10 bg-[#121318] px-6 pb-[calc(env(safe-area-inset-bottom,0px)+18px)] text-white">
        <button type="button" aria-label="Not now" onClick={later} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-white/60 active:bg-white/10"><X className="h-5 w-5" /></button>
        <div className="mx-auto w-full max-w-sm">
          <div className="mt-4 flex justify-center"><SoozLogo className="h-[58px]" /></div>
          <DrawerTitle className="mt-4 text-center text-[22px] font-bold leading-tight">Join SOOZ</DrawerTitle>
          <DrawerDescription className="mt-1 text-center text-[14.5px] text-white/60">Free, and it takes less than a minute. You can keep watching without an account.</DrawerDescription>

          <ul className="mt-5 space-y-3">
            {PERKS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400/15"><Icon className="h-[18px] w-[18px] text-amber-400" /></span>
                <span className="text-[14.5px] leading-snug text-white/85">{text}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 space-y-2.5">
            <button type="button" onClick={() => go("signup")} className="h-[52px] w-full rounded-full bg-amber-400 text-[16px] font-bold text-[#1a1204] active:scale-[0.98]">Sign up</button>
            {google && (
              <button type="button" onClick={withGoogle} disabled={busy} className="flex h-[52px] w-full items-center justify-center gap-2.5 rounded-full border border-white/15 bg-white/[0.04] text-[15.5px] font-semibold text-white active:bg-white/10 disabled:opacity-70">
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleG />} Continue with Google
              </button>
            )}
          </div>
          <p className="mt-4 text-center text-[14px] text-white/60">
            Already have an account?{" "}
            <button type="button" onClick={() => go("login")} className="font-semibold text-amber-400">Log in</button>
          </p>
          <button type="button" onClick={later} className="mt-2 h-10 w-full rounded-full text-[14px] font-semibold text-white/50 active:bg-white/5">Not now</button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
