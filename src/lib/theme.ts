export type ColorMode = "dark" | "light";

const KEY = "sooz-mode";
const STATUS_BAR = { dark: "#05070b", light: "#faf8f4" } as const;

/** Dark is the default; light only when the user picked it. */
export function getColorMode(): ColorMode {
  try {
    return localStorage.getItem(KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

/** Colour of the phone's status bar / browser chrome. */
export function setThemeColor(color: string) {
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color);
}

export function applyColorMode(mode: ColorMode) {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.style.colorScheme = mode;
  setThemeColor(STATUS_BAR[mode]);
}

export function setColorMode(mode: ColorMode) {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* private mode — still applies for this visit */
  }
  applyColorMode(mode);
}
