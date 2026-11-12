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
 */
export const WHITE = "#ffffff";

let lightPages = 0;
let darkCovers = 0;
let shown: boolean | null = null; // what the phone was last told: true = white
let shield: HTMLElement | null = null;
let queued = false;
let again = 0;

/** A fresh top layer in the strip's colour (see above). Above everything, never takes a tap. */
function placeShield() {
  shield?.remove();
  shield = document.createElement("div");
  shield.className = shown ? "status-shield status-shield--light" : "status-shield";
  shield.setAttribute("aria-hidden", "true");
  // Beside <body>, not inside it: nothing the app does to the body (pop-ups making the rest of the
  // page inert, transforms) can hide it from the phone or put another layer above it.
  document.documentElement.appendChild(shield);
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
  // Once more when the new page has settled (its own layers have appeared): costs nothing if the
  // phone already has the right colour.
  window.clearTimeout(again);
  again = window.setTimeout(placeShield, 350);
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
