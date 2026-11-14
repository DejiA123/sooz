/**
 * Keeping SOOZ up to date — silently, like a native app (owner's request: no "Update now" pop-up).
 *
 * Spotting a new version (checked on open, on return to the app, on page changes at most every
 * 3 minutes and every 15 minutes):
 *  1. /version.json (written by every build) is newer than this copy's build;
 *  2. the service worker has downloaded the new version and is waiting (registerType "prompt");
 *  3. another tab already switched versions (controllerchange), so this page runs old code.
 *
 * Switching (the waiting worker takes over with SKIP_WAITING, then the page reloads) only happens
 * at moments nobody notices:
 *  • opening the app — index.html keeps the splash up ("Updating…") while it checks and switches,
 *    and this file does the same if the new version finishes downloading in the first seconds;
 *  • coming back after ≥ 60s away (a splash covers it), or while away (Android / desktop keep
 *    running); coming back after ≥ 30 min counts as opening the app;
 *  • changing page (the next page simply loads fresh);
 *  • at once if this old copy can't load a screen any more (its files were replaced).
 * Never during a call, the camera / Create / live, an upload or a message being sent, or (except on
 * a page change) while something typed would be lost. A switch that didn't take isn't retried for
 * 10 minutes, so it can never loop.
 *
 * Don't turn on skipWaiting in the worker itself: an old open page would lose its lazy-loaded screens.
 */

type Listener = (ready: boolean) => void;
type Moment = "launch" | "return" | "away" | "navigate" | "broken";

const listeners = new Set<Listener>();
let ready = false; // a newer version can be switched to right now
let newer = false; // a newer version exists (it may still be downloading)
let broken = false; // this copy failed to load one of its own screens
let registration: ServiceWorkerRegistration | null = null;
let applying = false;
let switchedUnderUs = false; // another tab moved to the new version: this page runs old code
let prevController: ServiceWorker | null = typeof navigator !== "undefined" ? navigator.serviceWorker?.controller ?? null : null;
const loadedAt = Date.now();
let interactedAt = 0;
let hiddenAt = 0;
let returnedAt = 0;
let returnedFromLongAway = false;
let lastCheck = 0;

const AWAY_MS = 60_000; // away this long → switch while away, or the moment they're back
const LONG_AWAY_MS = 30 * 60_000; // away this long → coming back counts as opening the app
const OPENING_MS = 10_000; // "just opened": nothing touched yet, within this long
const TRIED_KEY = "sooz-update-tried";
const QUIET_KEY = "sooz-quiet-boot";
const thisBuild = typeof __SOOZ_BUILD__ === "undefined" ? "dev" : __SOOZ_BUILD__;
const controlled = () => typeof navigator !== "undefined" && !!navigator.serviceWorker?.controller;
/** localStorage "sooz-update-debug" = "1" logs every step (for checking updates on a phone). */
const log = (...a: unknown[]) => { try { if (localStorage.getItem("sooz-update-debug") === "1") console.info("[sooz-update]", ...a); } catch { /* storage blocked */ } };

export const isUpdateReady = () => ready;
export function onUpdateReady(l: Listener) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

// ── Things that must not be interrupted ───────────────────────────────────────
const holds = new Map<symbol, string>();
/** Don't switch versions until the returned function is called (a call, an upload, a message being sent…). */
export function holdUpdates(reason: string): () => void {
  const key = Symbol(reason);
  holds.set(key, reason);
  return () => {
    if (!holds.delete(key) || holds.size) return;
    if (broken) tryApply("broken");
    else if (document.visibilityState === "hidden" && hiddenAt && Date.now() - hiddenAt >= AWAY_MS) tryApply("away");
  };
}

const NON_TEXT = /^(checkbox|radio|range|color|file|hidden|submit|button|reset|image)$/i;
/** Something typed that a reload would throw away. */
function typingSomething(): boolean {
  const a = document.activeElement as HTMLElement | null;
  if (a?.isContentEditable && a.textContent?.trim()) return true;
  for (const el of document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("textarea, input")) {
    if (el.tagName === "INPUT" && NON_TEXT.test((el as HTMLInputElement).type)) continue;
    if (el.disabled || el.readOnly || !el.value.trim() || !el.getClientRects().length) continue;
    return true;
  }
  return false;
}

/** Tried to switch from this very build a moment ago and we're still on it: don't try again yet. */
function recentlyTried(): boolean {
  try {
    const t = JSON.parse(sessionStorage.getItem(TRIED_KEY) || "null") as { from?: string; at?: number } | null;
    return !!t && t.from === thisBuild && Date.now() - (t.at ?? 0) < 10 * 60_000;
  } catch { return false; }
}

function canApply(moment: Moment): boolean {
  if (!ready || applying || recentlyTried() || holds.size) return false;
  if (document.body.classList.contains("sooz-feed-covered")) return false; // camera / Create / live
  // Leaving a page throws its typing away anyway; anywhere else, never lose what someone typed.
  if (moment !== "navigate" && moment !== "broken" && typingSomething()) return false;
  return true;
}

function tryApply(moment: Moment): boolean {
  if (!canApply(moment)) { log("not now", moment, { ready, applying, holds: [...holds.values()] }); return false; }
  log("switching", moment);
  // The splash covers the switch when people are looking at the app; on a page change the next page
  // just loads; while away nobody sees it.
  applyUpdate({ quiet: moment === "navigate" || moment === "broken", cover: moment === "return" || moment === "launch" });
  return true;
}

/** The app was just opened (or brought back after a long time) and nobody has touched it yet. */
function openingMoment(): Moment | null {
  const since = returnedFromLongAway && returnedAt ? returnedAt : loadedAt;
  if (Date.now() - since >= OPENING_MS || interactedAt >= since) return null;
  return since === loadedAt ? "launch" : "return";
}

function markReady() {
  if (!ready) {
    ready = true;
    listeners.forEach((l) => l(true));
  }
  if (broken) { tryApply("broken"); return; }
  if (document.visibilityState === "hidden") {
    if (hiddenAt && Date.now() - hiddenAt >= AWAY_MS) tryApply("away");
    return;
  }
  // Opening the app (or back after a long time) and nothing touched yet: switch now, under the splash.
  const opening = openingMoment();
  if (opening) tryApply(opening);
}

function markNewer() {
  log("newer version found", { controlled: controlled(), waiting: !!registration?.waiting });
  if (!newer) newer = true;
  // Not run by a service worker: a reload fetches the new version straight away.
  if (!controlled() || switchedUnderUs) markReady();
  else if (registration?.waiting) markReady();
  else registration?.update().catch(() => {});
}

/** Called by registerSW once the service worker is registered. */
export function watchServiceWorker(reg: ServiceWorkerRegistration) {
  registration = reg;
  const consider = () => { if (reg.waiting && controlled()) markReady(); };
  reg.addEventListener("updatefound", () => {
    const incoming = reg.installing;
    incoming?.addEventListener("statechange", () => { if (incoming.state === "installed") consider(); });
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    const was = prevController;
    prevController = navigator.serviceWorker.controller;
    log("controllerchange", { applying, was: !!was });
    if (applying) return; // already reloading
    // The new version took over (from another tab, or the opening check gave up waiting for it): this
    // page still runs the old one, so it reloads at the next quiet moment (or at once if a screen fails).
    if (was) { switchedUnderUs = true; markReady(); }
  });
  consider();
}

async function checkVersionFile() {
  if (import.meta.env.DEV || thisBuild === "dev") return;
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return;
    const { build } = (await res.json()) as { build?: string };
    if (build && build !== thisBuild) markNewer();
  } catch { /* offline */ }
}

function check() {
  lastCheck = Date.now();
  if (ready) { markReady(); return; }
  registration?.update().catch(() => {});
  checkVersionFile();
}

/** Settings → "Check for updates": true when a newer version is ready to switch to. */
export async function checkForUpdate(): Promise<boolean> {
  if (ready) return true;
  try { await registration?.update(); } catch { /* offline */ }
  await checkVersionFile();
  if (!ready && registration?.waiting && controlled()) markReady();
  return ready || newer;
}

/** This copy of the app: "v1.0.0 (2611121039)" — the build number is the build time (UTC, yyMMddHHmm). */
export function appVersionLabel(): string {
  const version = typeof __SOOZ_VERSION__ === "undefined" ? "1.0.0" : __SOOZ_VERSION__;
  const m = thisBuild.match(/^\d{2}(\d{2})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? `v${version} (${m.slice(1).join("")})` : `v${version} (dev)`;
}

/** A page change: switch to the new version now if one is ready (the next page loads fresh). */
export function noteNavigation() {
  if (tryApply("navigate")) return;
  if (Date.now() - lastCheck > 3 * 60_000) check();
}

let started = false;
export function startUpdateChecks() {
  if (started || typeof window === "undefined") return;
  started = true;
  const touched = () => { interactedAt = Date.now(); };
  window.addEventListener("pointerdown", touched, { capture: true, passive: true });
  window.addEventListener("keydown", touched, { capture: true, passive: true });

  setTimeout(check, 2500);
  setInterval(() => { if (document.visibilityState === "visible") check(); }, 15 * 60_000);

  let awayTimer: ReturnType<typeof setTimeout> | undefined;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      hiddenAt = Date.now();
      clearTimeout(awayTimer);
      // Android / desktop keep the page running: switch while they're away.
      awayTimer = setTimeout(() => { if (document.visibilityState === "hidden") tryApply("away"); }, AWAY_MS);
      return;
    }
    clearTimeout(awayTimer);
    const away = hiddenAt ? Date.now() - hiddenAt : 0;
    hiddenAt = 0;
    returnedAt = Date.now();
    returnedFromLongAway = away >= LONG_AWAY_MS;
    if (away >= AWAY_MS && tryApply("return")) return;
    check();
  });

  // An old copy whose screen files were replaced by a newer release: it can't go on, switch now.
  const stale = (msg: string) => /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk [\w-]+ failed|Unable to preload CSS/i.test(msg);
  const onBroken = () => { broken = true; markNewer(); if (!ready && !controlled()) markReady(); tryApply("broken"); };
  window.addEventListener("error", (e) => { if (stale(String(e.message || ""))) onBroken(); });
  window.addEventListener("unhandledrejection", (e) => { if (stale(String((e.reason as Error)?.message || e.reason || ""))) onBroken(); });
  window.addEventListener("vite:preloadError", onBroken);
}

/** The splash, shown over the app while it switches versions (the new copy opens on the same splash). */
function showCover() {
  if (document.getElementById("sooz-update-cover")) return;
  const c = document.createElement("div");
  c.id = "sooz-update-cover";
  c.className = "boot boot--updating";
  c.setAttribute("role", "img");
  c.setAttribute("aria-label", "Updating SOOZ");
  c.appendChild(document.createElement("i"));
  c.appendChild(document.createElement("span")).textContent = "Updating…";
  document.body.appendChild(c);
}
function reloadNow(opts: { quiet?: boolean; cover?: boolean }) {
  log("reloading into the new version");
  try {
    sessionStorage.setItem(TRIED_KEY, JSON.stringify({ from: thisBuild, at: Date.now() }));
    if (opts.quiet) sessionStorage.setItem(QUIET_KEY, String(Date.now())); // the next page opens without the splash
  } catch { /* storage blocked */ }
  if (opts.cover) showCover();
  window.location.reload();
}

/**
 * Switch to the new version (Settings' "Update now", or automatically at a quiet moment): reload, and
 * index.html hands over to the new version before the app starts, then reloads once more into it.
 * (Telling the waiting version to take over from here, while this page may be loading a screen
 * through the old one, can leave Chrome stuck until the old one times out — so the handover only
 * ever happens on a fresh page that isn't loading anything else.)
 */
export async function applyUpdate(opts: { quiet?: boolean; cover?: boolean } = {}) {
  if (applying) return;
  applying = true;
  const reg = registration;
  log("apply", { waiting: !!reg?.waiting, controlled: controlled(), switchedUnderUs });
  if (reg && controlled() && !switchedUnderUs && !reg.waiting) {
    // Settings' "Update now" before the download finished: give it a moment.
    try { await reg.update(); } catch { /* offline: use what we have */ }
    for (let i = 0; i < 60 && !reg.waiting && (reg.installing || i < 8); i++) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  reloadNow(opts);
}
