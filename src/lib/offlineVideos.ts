// Videos saved for offline viewing live in the browser's Cache Storage.
const CACHE = "sooz-offline-videos";

export async function isSavedOffline(url: string) {
  if (!("caches" in window)) return false;
  const c = await caches.open(CACHE);
  return !!(await c.match(url));
}

export async function saveForOffline(url: string, onProgress?: (pct: number) => void) {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`);
  const total = Number(res.headers.get("content-length")) || 0;
  let got = 0;
  // Stream straight into storage so large sermons don't fill the phone's memory
  const counted = res.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, ctrl) {
      got += chunk.length;
      if (total && onProgress) onProgress(Math.round((got / total) * 100));
      ctrl.enqueue(chunk);
    },
  }));
  const c = await caches.open(CACHE);
  await c.put(url, new Response(counted, { headers: { "Content-Type": res.headers.get("content-type") || "video/mp4", ...(total ? { "Content-Length": String(total) } : {}) } }));
}

export async function removeOffline(url: string) {
  const c = await caches.open(CACHE);
  await c.delete(url);
}

/** Returns a local playable URL if the video was saved, else null. */
export async function getOfflineSrc(url: string) {
  if (!("caches" in window)) return null;
  const c = await caches.open(CACHE);
  const r = await c.match(url);
  return r ? URL.createObjectURL(await r.blob()) : null;
}
