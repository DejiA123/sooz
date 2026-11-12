import { useEffect } from "react";
import { setThemeColor, STATUS_BAR } from "./theme";

/**
 * White pages (owner's request): Messages, open chats and profiles are white, with the phone's status
 * bar (clock, battery) white above them. Everywhere else stays black.
 *
 * The status bar's colour is the page's theme-color, so it changes as people move between pages.
 * Earlier work noted that changing it could make the installed iPhone app lay out one status-bar
 * height too short (the bottom bar floats up until the next page change). If that shows up, set
 * WHITE_STATUS_BAR to false: the pages stay white and the status bar stays black everywhere.
 */
export const WHITE_STATUS_BAR = true;
export const WHITE = "#ffffff";

let lightPages = 0;
let darkCovers = 0;

function apply() {
  if (typeof document === "undefined") return;
  // A full-screen dark screen on top (videos, camera, call, photo viewer) wins over a white page.
  const light = lightPages > 0 && darkCovers === 0;
  // The page behind everything turns white too, so the top of the screen is white even where the phone
  // takes its colour from the page instead of theme-color (newer Safari) or when pulled past the top.
  document.documentElement.classList.toggle("light-page", light);
  document.body.classList.toggle("light-page", light);
  setThemeColor(light && WHITE_STATUS_BAR ? WHITE : STATUS_BAR);
}

/** A white page: while it is shown, the bottom bar, top bar and status bar are white. */
export function useLightPage(active = true) {
  useEffect(() => {
    if (!active) return;
    lightPages++;
    apply();
    return () => { lightPages--; apply(); };
  }, [active]);
}

/** A full-screen dark screen (videos, camera, call, photo viewer): the status bar goes black under it. */
export function useDarkCover(active = true) {
  useEffect(() => {
    if (!active) return;
    darkCovers++;
    apply();
    return () => { darkCovers--; apply(); };
  }, [active]);
}
