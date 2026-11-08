import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { startVideoPool } from "./lib/videoPool";
import { startTikTokGestures } from "./lib/tiktokPlayers";

startVideoPool();
startTikTokGestures();

createRoot(document.getElementById("root")!).render(<App />);

// Hide the splash once the app has drawn (the installed app also waits for the screen size to settle).
requestAnimationFrame(() => requestAnimationFrame(() => (window as Window & { __soozHideBoot?: () => void }).__soozHideBoot?.()));
