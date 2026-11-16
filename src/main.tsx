import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { startVideoPool } from "./lib/videoPool";
import { startTikTokGestures } from "./lib/tiktokPlayers";
import { probeSoundAutoplay } from "./lib/soundAutoplay";
import { applyReelUi } from "./lib/reelUi";
import { warmForYou } from "./services/api/feed";

function start() {
  startVideoPool();
  startTikTokGestures();
  probeSoundAutoplay(); // start with sound where the browser allows it, like TikTok
  applyReelUi();
  // Home: start fetching the videos now, while the rest of the app is still loading.
  if (window.location.pathname === "/") warmForYou();

  createRoot(document.getElementById("root")!).render(<App />);

  // Hide the splash once the app has drawn (the installed app also waits for the screen size to settle).
  requestAnimationFrame(() => requestAnimationFrame(() => (window as Window & { __soozHideBoot?: () => void }).__soozHideBoot?.()));
}

// Opening the app first checks for a newer version (index.html, at most 0.7s): when there is one,
// it switches before this old copy starts.
const opening = (window as Window & { __soozStart?: Promise<void> }).__soozStart;
if (opening) opening.then(start); else start();
