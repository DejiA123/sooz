import { watchServiceWorker } from "./appUpdate";

// Single place that registers the service worker (offline + push notifications + silent app updates).
// Never registers in dev, Lovable preview, or iframes.
export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const host = window.location.hostname;
  const params = new URLSearchParams(window.location.search);
  let inIframe = false;
  try { inIframe = window.self !== window.top; } catch { inIframe = true; }
  const refused =
    !import.meta.env.PROD ||
    inIframe ||
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" || host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev") ||
    params.get("sw") === "off";

  if (refused) {
    navigator.serviceWorker.getRegistrations().then((regs) =>
      regs.forEach((r) => {
        if (r.active?.scriptURL.endsWith("/sw.js")) r.unregister();
      })
    );
    return;
  }

  const register = () => navigator.serviceWorker.register("/sw.js").then(watchServiceWorker).catch((err) => console.warn("SW registration failed", err));
  window.addEventListener("load", () => {
    // First visit: the worker's first job is downloading the whole app for offline use (several MB).
    // Give the first videos a head start, so that download doesn't slow them down.
    if (navigator.serviceWorker.controller) register();
    else setTimeout(register, 12000);
  });
}
