/**
 * Visit counting for the admin Visitors page (owner-approved). One visit = a phone opening SOOZ; it
 * continues while the app is used and a new one starts after 30 minutes away (the database decides,
 * `track_visit()`). Anonymous visitors are just a random id kept on the phone — no IP, no location.
 */
import { supabase } from "@/integrations/supabase/client";

const DEVICE_KEY = "sooz-device";
function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) { id = crypto.randomUUID().replace(/-/g, ""); localStorage.setItem(DEVICE_KEY, id); }
    return id;
  } catch {
    return (window as Window & { __soozDevice?: string }).__soozDevice ??= crypto.randomUUID().replace(/-/g, "");
  }
}

const standalone = () => window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

function deviceKind(): string {
  const ua = navigator.userAgent;
  if (/iPad|Macintosh.*Mobile/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "iPad";
  if (/iPhone|iPod/.test(ua)) return "iPhone";
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? "Android" : "Android tablet";
  return "Computer";
}

/** Where this visit came from: the link's utm_source, the app it was opened in, or the referring site. */
function sourceOf(): string {
  const url = new URL(window.location.href);
  const utm = url.searchParams.get("utm_source");
  if (utm) return utm.slice(0, 40);
  if (standalone()) return "Home Screen app";
  const ua = navigator.userAgent;
  if (/Instagram/i.test(ua)) return "Instagram";
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return "Facebook";
  if (/musical_ly|BytedanceWebview|TikTok/i.test(ua)) return "TikTok";
  if (/Snapchat/i.test(ua)) return "Snapchat";
  if (/LinkedInApp/i.test(ua)) return "LinkedIn";
  let ref = "";
  try { ref = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : ""; } catch { /* bad referrer */ }
  if (ref && ref !== window.location.hostname) {
    if (/instagram/.test(ref)) return "Instagram";
    if (/facebook|fb\.com/.test(ref)) return "Facebook";
    if (/whatsapp|wa\.me/.test(ref)) return "WhatsApp";
    if (/google\./.test(ref)) return "Google";
    if (/tiktok/.test(ref)) return "TikTok";
    if (/youtube|youtu\.be/.test(ref)) return "YouTube";
    if (/^t\.co$|twitter|x\.com/.test(ref)) return "X";
    if (/bing\./.test(ref)) return "Bing";
    return ref.slice(0, 40);
  }
  if (/^\/(t|p)\//.test(url.pathname) || url.searchParams.has("tiktok")) return "Shared link";
  return "Direct";
}

let source: string | null = null;
let last = 0;
/** Note this visit (cheap; safe to call often — the database merges calls within the same visit). */
export function trackVisit(newPage = false) {
  if (import.meta.env.DEV) return;
  const now = Date.now();
  if (!newPage && now - last < 60_000) return; // at most once a minute unless the page changed
  last = now;
  source ??= sourceOf(); // the first page of this launch says where they came from
  supabase.rpc("track_visit" as never, {
    p_device: deviceId(), p_page: window.location.pathname, p_source: source,
    p_device_kind: deviceKind(), p_installed: standalone(), p_new_page: newPage,
  } as never).then(() => {}, () => { /* offline: the next call counts it */ });
}

let started = false;
/** Open, return to the screen, and every 2 minutes while on screen (for "on right now"). */
export function startVisitTracking() {
  if (started || typeof window === "undefined") return;
  started = true;
  trackVisit();
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") trackVisit(); });
  setInterval(() => { if (document.visibilityState === "visible") trackVisit(); }, 2 * 60_000);
}
