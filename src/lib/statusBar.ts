import { useLayoutEffect } from "react";
import { setThemeColor, STATUS_BAR } from "./theme";

/**
 * The strip behind the phone's clock and battery (owner's request, like TikTok): **white on Messages,
 * open chats and profiles, black everywhere else** — in the Home Screen app and in any browser.
 *
 * Nothing on a web page can paint that strip; each phone picks its colour from the page, and they
 * don't all read the same thing. So every one of these is kept in step, in one go, before the screen
 * is drawn:
 *
 *  - `theme-color` — Android (Chrome and the installed app), Safari up to iOS 18.
 *  - the page's own background (`light-page` on html and body) — iPhone on iOS 26 and later ignores
 *    theme-color and uses this…
 *  - …unless a full-width `position: fixed` / `sticky` layer touches the top of the screen: then it
 *    takes that layer's colour, and only looks again when such a layer is added or removed
 *    (WebKit `LocalFrameView::fixedContainerEdges`). That is what made the strip lag a page behind:
 *    the app's top bar, the Messages page and every sheet are such layers, a blurred one counts as
 *    "no single colour" (the strip keeps whatever the page was at that moment), and a screen-sized one
 *    means "keep the colour you had". So SOOZ puts its own layer on top of them all — `.status-shield`,
 *    12px, see-through, in the strip's colour — and **swaps it for a new one on every change**, which
 *    is exactly what makes the iPhone look again. Where an iPhone / iPad won't re-read a layer after
 *    the first touch, removing the old one drops it back to the page's background, which is right too.
 *
 * No fade (owner's request: the strip should change with the page, like TikTok). The iPhone paints a
 * layer's colour with its own strip view, and cross-fades that view for 0.1s whenever its colour
 * changes (WebKit `WKColorExtensionView`) — but shows it at once, with no fade, if it was hidden; and
 * with no layer at the top the strip is simply the page's background, which changes at once too. So
 * half a second after a change, while the page is at its top, the shield shrinks to a narrow one
 * (`--rest`): too narrow to count as a layer, but still on top, so the phone finds no layer, hides its
 * strip view and shows the page's background — the same colour. The next change then appears at once.
 * As soon as the page is scrolled the full-width shield comes back (same colour, so nothing shows),
 * because without it the iPhone lets the page's content scroll, blurred, under the clock.
 */
/** Set to false to keep the full-width shield all the time (the strip then fades for 0.1s on a change). */
const REST_AT_TOP = true;
export const WHITE = "#ffffff";

let lightPages = 0;
let darkCovers = 0;
let shown: boolean | null = null; // what the phone was last told: true = white
let shield: HTMLElement | null = null;
let resting = false; // the narrow shield is in place
let queued = false;
let settle = 0;

/** The page (not a box inside it) is at its top, so nothing can scroll under the strip. */
const atTop = () => (window.scrollY || document.documentElement.scrollTop || 0) <= 2;

/** A fresh top layer in the strip's colour (see above). Above everything, never takes a tap. */
function placeShield(rest = false) {
  shield?.remove();
  resting = rest;
  shield = document.createElement("div");
  shield.className = `status-shield${shown ? " status-shield--light" : ""}${rest ? " status-shield--rest" : ""}`;
  shield.setAttribute("aria-hidden", "true");
  // Beside <body>, not inside it: nothing the app does to the body (pop-ups making the rest of the
  // page inert, transforms) can hide it from the phone or put another layer above it.
  document.documentElement.appendChild(shield);
}

/** Once things are still and the page is at its top: the narrow shield, ready for a change with no fade. */
function rest(after: number) {
  window.clearTimeout(settle);
  if (!REST_AT_TOP) return;
  settle = window.setTimeout(() => { if (!resting && atTop()) placeShield(true); }, after);
}

function apply(force = false) {
  if (typeof document === "undefined") return;
  // A full-screen dark screen on top (videos, camera, call, photo viewer) wins over a white page.
  const light = lightPages > 0 && darkCovers === 0;
  if (!force && light === shown) return;
  shown = light;
  document.documentElement.classList.toggle("light-page", light);
  document.body.classList.toggle("light-page", light);
  setThemeColor(light ? WHITE : STATUS_BAR);
  placeShield();
  rest(500);
}

/** Several pages / screens can change in one go (leave Messages, open a profile): tell the phone once. */
function changed() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => { queued = false; apply(); });
}

if (typeof document !== "undefined") {
  apply(true);
  // Coming back to the app (or a page restored from the back-forward cache): say it again.
  const back = () => { if (document.visibilityState === "visible") apply(true); };
  document.addEventListener("visibilitychange", back);
  window.addEventListener("pageshow", back);
  // Scrolled: the full-width shield keeps the strip solid over the page. Back at the top: rest again.
  window.addEventListener("scroll", () => {
    if (!atTop()) { window.clearTimeout(settle); if (resting) placeShield(); }
    else if (!resting) rest(400);
  }, { passive: true });
}

/** A white page: while it is shown, the status bar strip, the top bar and the bottom bar are white. */
export function useLightPage(active = true) {
  useLayoutEffect(() => {
    if (!active) return;
    lightPages++;
    changed();
    return () => { lightPages--; changed(); };
  }, [active]);
}

/** A full-screen dark screen (videos, camera, call, photo viewer): the status bar goes black under it. */
export function useDarkCover(active = true) {
  useLayoutEffect(() => {
    if (!active) return;
    darkCovers++;
    changed();
    return () => { darkCovers--; changed(); };
  }, [active]);
}
