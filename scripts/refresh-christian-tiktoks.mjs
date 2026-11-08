#!/usr/bin/env node
/**
 * Refreshes src/data/christianTikTokLibrary.json with the newest public videos from the trusted
 * Christian TikTok creators listed in that file ("creators": handle → name). Uses TikTok's public
 * creator embed page (the same one TikTok offers for websites), keeps the most recent videos per
 * creator, and drops anything private. Run daily by .github/workflows/refresh-christian-tiktoks.yml;
 * the app reads the file live from GitHub, so new videos show up without republishing.
 *
 * To add a creator: add  "handle": "Display name"  to "creators" in the JSON file.
 */
import { readFile, writeFile } from "node:fs/promises";

const FILE = new URL("../src/data/christianTikTokLibrary.json", import.meta.url);
const PER_CREATOR = 30;
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const lib = JSON.parse(await readFile(FILE, "utf8"));
const byCreator = new Map();
for (const v of lib.videos) {
  if (!byCreator.has(v[1])) byCreator.set(v[1], []);
  byCreator.get(v[1]).push(v);
}

async function recentVideos(handle) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`https://www.tiktok.com/embed/@${encodeURIComponent(handle)}`, { headers: { "user-agent": UA } }).catch(() => null);
    const html = res?.ok ? await res.text() : "";
    const m = html.match(/<script id="__FRONTITY_CONNECT_STATE__"[^>]*>([\s\S]*?)<\/script>/);
    if (m) {
      const found = [];
      const walk = (o) => {
        if (Array.isArray(o)) return o.forEach(walk);
        if (!o || typeof o !== "object") return;
        if (/^\d{15,25}$/.test(String(o.id ?? "")) && "desc" in o && o.width && o.height) found.push(o);
        Object.values(o).forEach(walk);
      };
      walk(JSON.parse(m[1]));
      return found
        .filter((o) => !o.privateItem && (!o.authorUniqueId || o.authorUniqueId === handle))
        .map((o) => {
          let caption = String(o.desc || "").replace(/\s+/g, " ").trim();
          if (caption.length > 120) caption = `${caption.slice(0, 117).replace(/\s+\S*$/, "")}…`;
          return [String(o.id), handle, Number(o.width), Number(o.height), caption];
        });
    }
    await sleep(8000 * (attempt + 1)); // rate limited or busy: wait and try again
  }
  return null;
}

let added = 0;
for (const handle of Object.keys(lib.creators)) {
  const fresh = await recentVideos(handle);
  if (!fresh) { console.log(`${handle}: no answer, keeping what we have`); await sleep(2000); continue; }
  const old = byCreator.get(handle) ?? [];
  const ids = new Set(old.map((v) => v[0]));
  const merged = [...fresh, ...old].filter((v, i, all) => all.findIndex((x) => x[0] === v[0]) === i);
  merged.sort((a, b) => (BigInt(b[0]) > BigInt(a[0]) ? 1 : -1)); // TikTok ids grow over time: newest first
  byCreator.set(handle, merged.slice(0, PER_CREATOR));
  const n = fresh.filter((v) => !ids.has(v[0])).length;
  added += n;
  console.log(`${handle}: ${fresh.length} recent, ${n} new`);
  await sleep(2500);
}

lib.videos = [...byCreator.values()].flat();
lib.updated = new Date().toISOString().slice(0, 10);
await writeFile(FILE, JSON.stringify(lib));
console.log(`Done: ${added} new videos, ${lib.videos.length} in the library.`);
