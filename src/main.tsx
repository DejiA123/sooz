import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { startVideoPool } from "./lib/videoPool";
import { startTikTokGestures } from "./lib/tiktokPlayers";
import { applyReelUi } from "./lib/reelUi";
import { warmForYou } from "./services/api/feed";

startVideoPool();
startTikTokGestures();
applyReelUi();
// Home: start fetching the videos now, while the rest of the app is still loading.
if (window.location.pathname === "/") warmForYou();

createRoot(document.getElementById("root")!).render(<App />);

// Hide the splash once the app has drawn (the installed app also waits for the screen size to settle).
requestAnimationFrame(() => requestAnimationFrame(() => (window as Window & { __soozHideBoot?: () => void }).__soozHideBoot?.()));
