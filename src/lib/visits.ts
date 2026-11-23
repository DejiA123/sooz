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

// Scrolls and time on screen since the last call (numbers only — never which videos).
let pendingVideos = 0;
let pendingMs = 0;
let visibleSince = typeof document !== "undefined" && document.visibilityState === "visible" ? Date.now() : 0;
function takeScreenTime(): number {
  if (visibleSince) { const t = Date.now(); pendingMs += t - visibleSince; visibleSince = t; }
  const secs = Math.floor(pendingMs / 1000);
  pendingMs -= secs * 1000;
  return secs;
}
let lastVideo = "";
/** A video (TikTok or SOOZ post) came on screen in a feed — one scroll (the same one again in a row,
 *  e.g. when the quick-start screen is swapped for the full feed, isn't another). */
export function noteVideoViewed(key: string) { if (key === lastVideo) return; lastVideo = key; pendingVideos += 1; }
/** Robots, link previews and the hosts' own build / screenshot checks (headless browsers) aren't people. */
const isRobot = () => navigator.webdriver === true || /HeadlessChrome|bot\b|crawl|spider|slurp|Lighthouse|Prerender|PhantomJS|Puppeteer|Playwright|facebookexternalhit|WhatsApp\/|TelegramBot|Discordbot|vercel|lovable/i.test(navigator.userAgent);

/** Note this visit (cheap; safe to call often — the database merges calls within the same visit). */
export function trackVisit(newPage = false, flush = false) {
  if (import.meta.env.DEV || isRobot()) return;
  const now = Date.now();
  if (!newPage && !flush && now - last < 60_000) return; // at most once a minute unless the page changed
  last = now;
  source ??= sourceOf(); // the first page of this launch says where they came from
  const videos = pendingVideos;
  const seconds = takeScreenTime();
  pendingVideos = 0;
  if (flush && !videos && !seconds) return;
  supabase.rpc("track_visit" as never, {
    p_device: deviceId(), p_page: window.location.pathname, p_source: source,
    p_device_kind: deviceKind(), p_installed: standalone(), p_new_page: newPage,
    p_videos: videos, p_seconds: seconds,
  } as never).then(({ error }: { error: unknown }) => {
    if (error) { pendingVideos += videos; pendingMs += seconds * 1000; } // counted with the next call
  }, () => { pendingVideos += videos; pendingMs += seconds * 1000; /* offline: the next call counts it */ });
}

let started = false;
/** Open, return to the screen, every 2 minutes while on screen (for "on right now") and on leaving. */
export function startVisitTracking() {
  if (started || typeof window === "undefined") return;
  started = true;
  trackVisit();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") { visibleSince = Date.now(); trackVisit(); }
    else { trackVisit(false, true); visibleSince = 0; } // leaving: send this visit's scrolls / time now
  });
  setInterval(() => { if (document.visibilityState === "visible") trackVisit(); }, 2 * 60_000);
}
