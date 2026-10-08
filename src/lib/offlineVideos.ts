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
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    if (total && onProgress) onProgress(Math.round((got / total) * 100));
  }
  const blob = new Blob(chunks as BlobPart[], { type: res.headers.get("content-type") || "video/mp4" });
  const c = await caches.open(CACHE);
  await c.put(url, new Response(blob, { headers: { "Content-Type": blob.type, "Content-Length": String(blob.size) } }));
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
