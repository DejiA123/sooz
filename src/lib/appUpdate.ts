/**
 * "A new version of SOOZ is ready" — spotting updates and applying them.
 *
 * Two signals, so it works everywhere:
 *  1. The service worker downloads a new version in the background and waits (registerType
 *     "prompt"); "Update now" tells it to take over and reloads into the new version.
 *  2. Every build writes /version.json with its build id; the app compares it with its own
 *     (covers browsers without a service worker).
 * Checked when the app opens, whenever it comes back to the screen, and every 30 minutes.
 * An old version that can't load a screen any more (its files were replaced) also asks to update.
 */


type Listener = (ready: boolean) => void;
const listeners = new Set<Listener>();
let ready = false;
let registration: ServiceWorkerRegistration | null = null;
let applying = false;

const announce = () => {
  if (ready) return;
  ready = true;
  listeners.forEach((l) => l(true));
};

export const isUpdateReady = () => ready;
export function onUpdateReady(l: Listener) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** Called by registerSW once the service worker is registered. */
export function watchServiceWorker(reg: ServiceWorkerRegistration) {
  registration = reg;
  if (reg.waiting && navigator.serviceWorker.controller) announce();
  reg.addEventListener("updatefound", () => {
    const incoming = reg.installing;
    incoming?.addEventListener("statechange", () => {
      if (incoming.state === "installed" && navigator.serviceWorker.controller) announce();
    });
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (applying) window.location.reload();
  });
}

async function checkVersionFile() {
  if (import.meta.env.DEV || typeof __SOOZ_BUILD__ === "undefined") return;
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return;
    const { build } = (await res.json()) as { build?: string };
    if (build && build !== __SOOZ_BUILD__) {
      registration?.update().catch(() => {}); // fetch the new files in the background too
      announce();
    }
  } catch { /* offline */ }
}

/** Settings → "Check for updates": true when a newer version is ready (the update pop-up shows too). */
export async function checkForUpdate(): Promise<boolean> {
  if (ready) return true;
  try { await registration?.update(); } catch { /* offline */ }
  await checkVersionFile();
  if (!ready && registration?.waiting && navigator.serviceWorker.controller) announce();
  return ready;
}

/** This copy of the app: "v1.0.0 (2611121039)" — the build number is the build time (UTC, yyMMddHHmm). */
export function appVersionLabel(): string {
  const version = typeof __SOOZ_VERSION__ === "undefined" ? "1.0.0" : __SOOZ_VERSION__;
  const build = typeof __SOOZ_BUILD__ === "undefined" ? "" : __SOOZ_BUILD__;
  const m = build.match(/^\d{2}(\d{2})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? `v${version} (${m.slice(1).join("")})` : `v${version} (dev)`;
}

const check = () => {
  if (ready) return;
  registration?.update().catch(() => {});
  checkVersionFile();
};

let started = false;
export function startUpdateChecks() {
  if (started || typeof window === "undefined") return;
  started = true;
  setTimeout(check, 5000);
  setInterval(check, 30 * 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
  // An old version whose screen files were replaced by a newer release.
  const stale = (msg: string) => /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk [\w-]+ failed/i.test(msg);
  window.addEventListener("error", (e) => { if (stale(String(e.message || ""))) announce(); });
  window.addEventListener("unhandledrejection", (e) => { if (stale(String((e.reason as Error)?.message || e.reason || ""))) announce(); });
}

/** "Update now": switch to the new version (waits for it to finish downloading first). */
export async function applyUpdate() {
  applying = true;
  const reg = registration;
  if (reg) {
    try { await reg.update(); } catch { /* offline: use what we have */ }
    // The new version may still be downloading: give it a moment to be ready.
    for (let i = 0; i < 60 && !reg.waiting && (reg.installing || i < 8); i++) {
      await new Promise((r) => setTimeout(r, 250));
    }
    if (reg.waiting) {
      reg.waiting.postMessage({ type: "SKIP_WAITING" }); // the page reloads when the new version takes over
      setTimeout(() => window.location.reload(), 4000); // …or anyway, if that signal never comes
      return;
    }
  }
  window.location.reload();
}
