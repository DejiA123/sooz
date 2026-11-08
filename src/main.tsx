import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { startVideoPool } from "./lib/videoPool";

startVideoPool();

createRoot(document.getElementById("root")!).render(<App />);
