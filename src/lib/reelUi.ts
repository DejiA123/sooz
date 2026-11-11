import { useSyncExternalStore } from "react";

/**
 * How the feed's like / comment / save / share buttons look.
 *
 * - "float": the buttons float over the video like the TikTok app. TikTok's player frame is made taller
 *   than the video, with the extra out of sight, so TikTok's own name strip, logo, play bar and button
 *   column are never seen (see `.tiktok-player--float` in index.css) and SOOZ draws its own pause icon
 *   and progress line.
 * - "dock": the earlier look — a solid side panel that covers TikTok's button column.
 *
 * BACKUP: to give everyone the side panel again, change the one word below to "dock". Admins can also
 * switch just their own phone in Settings → Video buttons, to compare the two.
 */
export type ReelUi = "float" | "dock";
export const REEL_UI_DEFAULT: ReelUi = "float";

const KEY = "sooz-reel-ui";
const listeners = new Set<() => void>();

function read(): ReelUi {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "float" || v === "dock") return v;
  } catch { /* storage blocked */ }
  return REEL_UI_DEFAULT;
}

let current: ReelUi = typeof window === "undefined" ? REEL_UI_DEFAULT : read();

/** Tells the stylesheet which look is on (`html[data-reel-ui]`). */
export function applyReelUi(): void {
  if (typeof document !== "undefined") document.documentElement.dataset.reelUi = current;
}

export const getReelUi = (): ReelUi => current;

/** Choose a look for this phone (`null` = whatever everyone gets). */
export function setReelUi(ui: ReelUi | null): void {
  try {
    if (ui && ui !== REEL_UI_DEFAULT) localStorage.setItem(KEY, ui);
    else localStorage.removeItem(KEY);
  } catch { /* storage blocked */ }
  current = ui ?? REEL_UI_DEFAULT;
  applyReelUi();
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function useReelUi(): ReelUi {
  return useSyncExternalStore(subscribe, getReelUi, () => REEL_UI_DEFAULT);
}
