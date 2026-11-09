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
const PER_CREATOR = 40;
const LIKES_PER_RUN = 350;
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** The whole caption (SOOZ shows two lines with "more", like TikTok), keeping its line breaks. */
const MAX_CAPTION = 600;
function cleanCaption(text) {
  let c = String(text || "").replace(/\r/g, "").replace(/[^\S\n]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (c.length > MAX_CAPTION) c = `${c.slice(0, MAX_CAPTION - 1).replace(/\s+\S*$/, "")}…`;
  return c;
}

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
        .map((o) => [String(o.id), handle, Number(o.width), Number(o.height), cleanCaption(o.desc)]);
    }
    await sleep(8000 * (attempt + 1)); // rate limited or busy: wait and try again
  }
  return null;
}

const before = JSON.stringify([lib.videos, lib.likes]);
let added = 0;
for (const handle of Object.keys(lib.creators)) {
  const fresh = await recentVideos(handle);
  if (!fresh) { console.log(`${handle}: no answer, keeping what we have`); await sleep(2000); continue; }
  const old = byCreator.get(handle) ?? [];
  const ids = new Set(old.map((v) => v[0]));
  // Fresh copies win, but never swap a full caption for a shorter, cut-off one.
  const oldCaption = new Map(old.map((v) => [v[0], v[4]]));
  for (const v of fresh) { const was = oldCaption.get(v[0]); if (was && was.length > v[4].length) v[4] = was; }
  const merged = [...fresh, ...old].filter((v, i, all) => all.findIndex((x) => x[0] === v[0]) === i);
  merged.sort((a, b) => (BigInt(b[0]) > BigInt(a[0]) ? 1 : -1)); // TikTok ids grow over time: newest first
  byCreator.set(handle, merged.slice(0, PER_CREATOR));
  const n = fresh.filter((v) => !ids.has(v[0])).length;
  added += n;
  console.log(`${handle}: ${fresh.length} recent, ${n} new`);
  await sleep(2500);
}

lib.videos = [...byCreator.values()].flat();

// TikTok's like count for each video (shown on SOOZ's own heart) and its full caption. Each video's
// public embed page has both; a few hundred per day, oldest-checked first, so every count stays fresh
// within a few days.
lib.likes ??= {};
lib.likesAt ??= {};
const today = new Date().toISOString().slice(0, 10);
const starterIds = [...(await readFile(new URL("../src/data/christianTikTokStarter.ts", import.meta.url), "utf8")).matchAll(/\/video\/(\d+)/g)].map((m) => m[1]);
const allIds = [...new Set([...lib.videos.map((v) => v[0]), ...starterIds])];
const due = allIds.filter((id) => lib.likesAt[id] !== today).sort((a, b) => (lib.likesAt[a] ?? "").localeCompare(lib.likesAt[b] ?? "")).slice(0, LIKES_PER_RUN);
for (const id of due) {
  const res = await fetch(`https://www.tiktok.com/embed/v2/${id}`, { headers: { "user-agent": UA } }).catch(() => null);
  const html = res?.ok ? await res.text() : "";
  if (/ratelimit/.test(html) && html.length < 200) { await sleep(20000); continue; }
  const m = html.match(new RegExp(`"id":"${id}"[\\s\\S]{0,4000}?"diggCount":(\\d+)`)) || html.match(/"diggCount":(\d+)/);
  if (m) { lib.likes[id] = Number(m[1]); lib.likesAt[id] = today; }
  const t = html.match(new RegExp(`"id":"${id}","text":"((?:[^"\\\\]|\\\\.)*)"`));
  const row = t && lib.videos.find((v) => v[0] === id);
  if (row) { try { const full = cleanCaption(JSON.parse(`"${t[1]}"`)); if (full) row[4] = full; } catch { /* odd text: keep ours */ } }
  await sleep(2500);
}
for (const id of Object.keys(lib.likes)) if (!allIds.includes(id)) { delete lib.likes[id]; delete lib.likesAt[id]; }

if (JSON.stringify([lib.videos, lib.likes]) === before) {
  console.log("No changes — library left as it is.");
  process.exit(0);
}
lib.updated = new Date().toISOString().slice(0, 10);
await writeFile(FILE, JSON.stringify(lib));
console.log(`Done: ${added} new videos, ${lib.videos.length} in the library.`);
