/**
 * The shape (width / height) and cover image of a TikTok, from TikTok's public oEmbed endpoint.
 * Used to size the player box exactly like the video, so TikTok's player never pads it with a
 * blurred copy (square and landscape TikToks included). Cached on the device; if TikTok can't be
 * reached from the app, callers fall back to the usual 9:16.
 */
export interface TikTokMeta {
  ratio?: number; // width / height
  thumbnail?: string;
}

const KEY = "sooz-tt-meta:";
const memory = new Map<string, TikTokMeta>();
const pending = new Map<string, Promise<TikTokMeta>>();
let unavailable = false;

function readCache(id: string): TikTokMeta | undefined {
  if (memory.has(id)) return memory.get(id);
  try {
    const raw = localStorage.getItem(KEY + id);
    if (raw) {
      const meta = JSON.parse(raw) as TikTokMeta;
      memory.set(id, meta);
      return meta;
    }
  } catch { /* storage blocked */ }
  return undefined;
}

export function cachedTikTokMeta(id: string): TikTokMeta | undefined {
  return readCache(id);
}

export function loadTikTokMeta(id: string, url: string): Promise<TikTokMeta> {
  const cached = readCache(id);
  if (cached) return Promise.resolve(cached);
  if (unavailable) return Promise.resolve({});
  const inflight = pending.get(id);
  if (inflight) return inflight;

  const p = fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, { mode: "cors", credentials: "omit" })
    .then((res) => (res.ok ? res.json() : null))
    .then((data: { thumbnail_width?: number; thumbnail_height?: number; thumbnail_url?: string } | null) => {
      const w = Number(data?.thumbnail_width);
      const h = Number(data?.thumbnail_height);
      // The cover's ratio, kept within sensible bounds (very wide 2:1 … very tall 1:2.2).
      const meta: TikTokMeta = {
        ratio: w > 0 && h > 0 ? Math.min(2, Math.max(0.45, w / h)) : undefined,
        thumbnail: data?.thumbnail_url || undefined,
      };
      if (meta.ratio) {
        memory.set(id, meta);
        try { localStorage.setItem(KEY + id, JSON.stringify({ ratio: meta.ratio })); } catch { /* full */ }
      }
      return meta;
    })
    .catch(() => {
      unavailable = true; // blocked or offline: stop asking this visit
      return {} as TikTokMeta;
    })
    .finally(() => pending.delete(id));
  pending.set(id, p);
  return p;
}
