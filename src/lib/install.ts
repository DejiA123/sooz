import { supabase } from "@/integrations/supabase/client";
import { isIOS, isStandalone } from "./push";

/**
 * Getting SOOZ onto the Home Screen (owner's request: as close to "download the app" as a web app
 * can get, with no App Store fee) — and knowing, as well as a web page can, whether it's there.
 *
 * What each phone allows:
 *  - Android / desktop Chrome, Edge, Samsung Internet: the browser hands us an install prompt
 *    (`beforeinstallprompt`, caught in index.html before the app loads) → one tap on "Install".
 *  - iPhone / iPad: Apple gives web pages no install button at all — only Share → Add to Home Screen,
 *    so we show the exact steps for that browser (Safari; Chrome / Edge / Firefox on iOS 16.4+ too).
 *  - Inside Instagram / TikTok / Facebook / WhatsApp…: their built-in browsers can't add anything
 *    to the Home Screen, so we first open SOOZ in Safari / Chrome.
 *
 * How we know it's installed:
 *  1. This window IS the installed app (standalone) — certain.
 *  2. Android: the browser tells us (`appinstalled`, `getInstalledRelatedApps`), and the browser and
 *     the installed app share storage, so the note we leave (`sooz-app`) is seen by both.
 *  3. iPhone: Safari and the installed app share nothing, and Apple offers no way to ask. So every
 *     time the installed app opens signed in, it stamps the ACCOUNT (auth user metadata `sooz_app`,
 *     no database change needed) — and Safari, signed in to the same account, reads that. A stamp
 *     older than 45 days no longer counts (the app was probably removed).
 *  Before sign-in on an iPhone in Safari there is nothing to go on: we ask, and "I already have it" is remembered.
 */
export type InstallKind =
  | "installed"        // this is the installed app
  | "has-app"          // browser tab, but the app is on this phone / this account's phone
  | "prompt"           // one-tap install available
  | "ios-safari"       // Share → Add to Home Screen
  | "ios-browser"      // Chrome / Edge / Firefox on iPhone: their Share menu has it too
  | "in-app"           // Instagram / TikTok / Facebook… browser: open in Safari / Chrome first
  | "manual"           // Android / desktop without a prompt (yet): the browser's menu
  | "none";            // nothing to offer here

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type W = Window & { __soozInstall?: { event: BIP | null; installed: boolean } };
const w = window as W;
const NOTE = "sooz-app"; // { at: ms } — last time the installed app ran here / was installed here
const ASK = "sooz-install-ask"; // don't ask again before (ms)
const FRESH = 45 * 24 * 3600 * 1000;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());
export const onInstallChange = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

const ua = navigator.userAgent;
export const isAndroid = () => /Android/i.test(ua);
/** Built-in browsers of other apps: they can't add to the Home Screen. */
export const inAppBrowser = (): string | null => {
  const m = ua.match(/Instagram|FBAN|FBAV|FB_IAB|musical_ly|BytedanceWebview|TikTok|Snapchat|Line\/|Twitter|LinkedInApp|Pinterest|WhatsApp|GSA\//i);
  if (!m) return null;
  const k = m[0].toLowerCase();
  return k.startsWith("insta") ? "Instagram" : k.startsWith("fb") ? "Facebook" : /musical|bytedance|tiktok/.test(k) ? "TikTok" : k.startsWith("snap") ? "Snapchat"
    : k.startsWith("whats") ? "WhatsApp" : k.startsWith("twit") ? "X" : k.startsWith("linked") ? "LinkedIn" : k.startsWith("pin") ? "Pinterest" : k.startsWith("gsa") ? "the Google app" : "this app";
};
const iosOtherBrowser = () => /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(ua);
/** Safari 26+ (iOS 26): Share moved inside the ••• button. */
export const iosNewSafari = () => { const m = ua.match(/Version\/(\d+)/); return !!m && Number(m[1]) >= 26; };

const readNote = (): number => { try { return Number(JSON.parse(localStorage.getItem(NOTE) || "{}").at) || 0; } catch { return 0; } };
const writeNote = (at = Date.now()) => { try { localStorage.setItem(NOTE, JSON.stringify({ at })); } catch { /* storage blocked */ } };
const fresh = (at: number) => at > 0 && Date.now() - at < FRESH;

let accountAt = 0; // from the signed-in account (iPhone: the only link between Safari and the app)
let related = false; // Android: the browser says the app is installed

export function installKind(): InstallKind {
  if (isStandalone()) return "installed";
  if (w.__soozInstall?.installed || related || fresh(accountAt)) return "has-app";
  // Android shares storage between the browser and the installed app; on iPhone this note only
  // exists if they told us "I already have it".
  if (fresh(readNote()) && !w.__soozInstall?.event) return "has-app";
  if (inAppBrowser()) return "in-app";
  if (w.__soozInstall?.event) return "prompt";
  if (isIOS()) return iosOtherBrowser() ? "ios-browser" : "ios-safari";
  if (isAndroid()) return "manual";
  return "none"; // desktop without a prompt: nothing useful to say
}

/** One-tap install (Android / desktop). Resolves true if they accepted. */
export async function promptInstall(): Promise<boolean> {
  const e = w.__soozInstall?.event;
  if (!e) return false;
  await e.prompt();
  const { outcome } = await e.userChoice;
  if (w.__soozInstall) w.__soozInstall.event = null; // a prompt can be used once
  if (outcome === "accepted") { writeNote(); if (w.__soozInstall) w.__soozInstall.installed = true; }
  changed();
  return outcome === "accepted";
}

/** "I already have it" (iPhone Safari can't know by itself). */
export function confirmHasApp() { writeNote(); changed(); }
/** They say it's gone (or never was): forget, so the steps show again. */
export function forgetApp() { try { localStorage.removeItem(NOTE); } catch { /* */ } accountAt = 0; related = false; if (w.__soozInstall) w.__soozInstall.installed = false; changed(); }

export const installAskSnoozed = () => { try { return Date.now() < Number(localStorage.getItem(ASK) || 0); } catch { return false; } };
export const snoozeInstallAsk = (days: number) => { try { localStorage.setItem(ASK, String(Date.now() + days * 24 * 3600 * 1000)); } catch { /* */ } };

/** Open this page in the phone's real browser, from inside Instagram / TikTok / Facebook… */
export function openInBrowser() {
  const { host, pathname, search } = window.location;
  if (isAndroid()) window.location.href = `intent://${host}${pathname}${search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(window.location.href)};end`;
  else window.location.href = `x-safari-https://${host}${pathname}${search}`; // iOS 17+
}

type Meta = { sooz_app?: { at?: number; os?: string } } | undefined;

/** Call when the signed-in account is known (and when it changes). */
export function syncInstallWithAccount(user: { id: string; user_metadata?: Record<string, unknown> } | null) {
  const meta = (user?.user_metadata as Meta)?.sooz_app;
  const at = Number(meta?.at) || 0;
  if (isStandalone()) {
    writeNote();
    // Stamp the account at most once a week (it's part of the sign-in token).
    if (user && Date.now() - at > 7 * 24 * 3600 * 1000) {
      void supabase.auth.updateUser({ data: { sooz_app: { at: Date.now(), os: isIOS() ? "ios" : isAndroid() ? "android" : "desktop" } } }).catch(() => {});
    }
    return;
  }
  // The stamp says where it was installed: an iPhone's stamp means nothing to an Android browser.
  const here = isIOS() ? "ios" : isAndroid() ? "android" : "desktop";
  const next = user && meta?.os === here ? at : 0;
  if (next !== accountAt) { accountAt = next; changed(); }
}

/** Start listening (once, at app start). */
export function startInstallWatch() {
  w.__soozInstall ??= { event: null, installed: false };
  window.addEventListener("sooz:install-change", changed);
  if (isStandalone()) writeNote();
  const nav = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> };
  nav.getInstalledRelatedApps?.().then((apps) => { if (apps?.length) { related = true; writeNote(); changed(); } }).catch(() => {});
}
