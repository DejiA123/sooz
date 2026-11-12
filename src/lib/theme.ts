/** SOOZ is dark only (the light look was removed at the owner's request). */
export const STATUS_BAR = "#05070b";

/** Colour of the phone's status bar / browser chrome. Only src/lib/statusBar.ts changes it (white pages). */
export function setThemeColor(color: string) {
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color);
}

export function applyDarkMode() {
  const root = document.documentElement;
  root.classList.add("dark");
  root.style.colorScheme = "dark";
  try { localStorage.removeItem("sooz-mode"); } catch { /* storage blocked */ }
}
