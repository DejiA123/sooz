/**
 * TikToks that TikTok's player said it can't play here (deleted, made private, or blocked in the
 * viewer's country — TikTok shows "Video currently unavailable"). Remembered on this device for a
 * week so the feed stops offering them; after that they get another chance (region blocks lift).
 */
const KEY = "sooz-tt-dead";
const WEEK = 7 * 24 * 3600 * 1000;

let dead: Record<string, number> | null = null;

function load(): Record<string, number> {
  if (dead) return dead;
  dead = {};
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const now = Date.now();
      for (const [id, at] of Object.entries(JSON.parse(raw) as Record<string, number>)) {
        if (typeof at === "number" && now - at < WEEK) dead[id] = at;
      }
    }
  } catch { /* storage blocked */ }
  return dead;
}

export function isDeadTikTok(tiktokId: string): boolean {
  return tiktokId in load();
}

export function markDeadTikTok(tiktokId: string): void {
  const d = load();
  if (d[tiktokId]) return;
  d[tiktokId] = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* full or blocked */ }
}
