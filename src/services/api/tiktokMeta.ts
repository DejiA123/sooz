/**
 * Videos to leave out of the feed. The app no longer skips or hides TikToks by itself (the owner
 * wants every video to just play), so nothing records here any more; loading clears the lists that
 * older versions saved, so those videos come back.
 */
const KEY = "sooz-tt-dead-v3"; // auto-skip was removed: forget every earlier list
const DAY = 24 * 3600 * 1000;

let dead: Record<string, number> | null = null; // id → when to try it again

function load(): Record<string, number> {
  if (dead) return dead;
  dead = {};
  try {
    ["sooz-tt-dead", "sooz-tt-dead-v2"].forEach((k) => localStorage.removeItem(k));
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const now = Date.now();
      for (const [id, until] of Object.entries(JSON.parse(raw) as Record<string, number>)) {
        if (typeof until === "number" && until > now) dead[id] = until;
      }
    }
  } catch { /* storage blocked */ }
  return dead;
}

export function isDeadTikTok(tiktokId: string): boolean {
  const until = load()[tiktokId];
  return !!until && until > Date.now();
}

export function markDeadTikTok(tiktokId: string, days: number): void {
  const d = load();
  d[tiktokId] = Math.max(d[tiktokId] ?? 0, Date.now() + days * DAY);
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* full or blocked */ }
}
