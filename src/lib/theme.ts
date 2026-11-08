/** SOOZ is dark only (the light look was removed at the owner's request). */
const STATUS_BAR = "#05070b";

/** Colour of the phone's status bar / browser chrome. */
export function setThemeColor(color: string) {
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color);
}

export function applyDarkMode() {
  const root = document.documentElement;
  root.classList.add("dark");
  root.style.colorScheme = "dark";
  setThemeColor(STATUS_BAR);
  try { localStorage.removeItem("sooz-mode"); } catch { /* storage blocked */ }
}
