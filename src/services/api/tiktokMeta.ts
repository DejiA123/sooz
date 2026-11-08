/**
 * TikToks that TikTok's player can't play here (deleted, made private, or blocked in the viewer's
 * country — TikTok shows "Video currently unavailable"). Remembered on this device so the feed stops
 * offering them: a week when TikTok reported an error, a day when its player just stayed silent on
 * screen (region blocks lift, and a bad connection can look like silence).
 */
const KEY = "sooz-tt-dead-v2"; // v1 also held videos wrongly judged while off screen — forget those
const DAY = 24 * 3600 * 1000;

let dead: Record<string, number> | null = null; // id → when to try it again

function load(): Record<string, number> {
  if (dead) return dead;
  dead = {};
  try {
    localStorage.removeItem("sooz-tt-dead");
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
