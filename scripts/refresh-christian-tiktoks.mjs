#!/usr/bin/env node
/**
 * Refreshes src/data/christianTikTokLibrary.json with the newest public videos from the trusted
 * Christian TikTok creators listed in that file ("creators": handle → name). Uses TikTok's public
 * creator embed page (the same one TikTok offers for websites), keeps the most recent videos per
 * creator, and drops anything private. Run daily by .github/workflows/refresh-christian-tiktoks.yml;
 * the app reads the file live from GitHub, so new videos show up without republishing.
 *
 * To add a creator: add  "handle": "Display name"  to "creators" in the JSON file.
 *
 * With COVERS_DIR set (the workflow checks out the "covers" branch there) it also saves a WhatsApp
 * link-preview card for every video — its cover picture, a play button and a SOOZ badge, 800×420 —
 * as tt/{id}.jpg. Shared SOOZ links show these (api/preview.ts), so previews never depend on
 * reaching TikTok at the moment someone shares. Needs `sharp` (SHARP_DIR, installed by the workflow).
 */
import { existsSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const FILE = process.env.LIBRARY_FILE || new URL("../src/data/christianTikTokLibrary.json", import.meta.url);
// Thousands of creators: each keeps only its newest few videos (The Power House's own accounts keep
// many), so the library the app downloads stays a few MB, and each run refreshes the creators checked
// longest ago (new ones first), so every creator is refreshed every few days.
const PER_CREATOR = 6;
const PER_CHURCH_CREATOR = 40;
const CHURCH = "Our church";
const CREATORS_PER_RUN = Number(process.env.CREATORS_PER_RUN || 700);
const LIKES_PER_RUN = Number(process.env.LIKES_PER_RUN || 350);
const CARDS_PER_RUN = 3000;
const COVERS_DIR = process.env.COVERS_DIR || "";
const COVER_LOOKUPS_PER_RUN = 300; // extra embed pages per run for older videos without a card yet
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** The whole caption (SOOZ shows two lines with "more", like TikTok), keeping its line breaks. */
const MAX_CAPTION = 300;
function cleanCaption(text) {
  let c = String(text || "").replace(/\r/g, "").replace(/[^\S\n]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (c.length > MAX_CAPTION) c = `${c.slice(0, MAX_CAPTION - 1).replace(/\s+\S*$/, "")}…`;
  return c;
}

const lib = JSON.parse(await readFile(FILE, "utf8"));
/** Where each video's cover picture is (TikTok's links expire after a couple of days, so cards are made the same run). */
const coverSrc = new Map();
// Cover links of videos the discovery step just added (scripts/discover-christian-creators.mjs).
if (process.env.COVER_HINTS && existsSync(process.env.COVER_HINTS)) {
  for (const [id, url] of Object.entries(JSON.parse(await readFile(process.env.COVER_HINTS, "utf8")))) coverSrc.set(id, url);
}
/** The cover link on a video's embed page (prefer a .jpeg copy). */
function coverFromEmbed(html, id) {
  const at = html.indexOf(`"id":"${id}"`);
  const item = at >= 0 ? html.slice(at, at + 30000) : "";
  const list = item.match(/"covers":\[([^\]]*)\]/)?.[1] ?? "";
  const urls = [...list.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => { try { return JSON.parse(`"${m[1]}"`); } catch { return ""; } }).filter(Boolean);
  return urls.find((u) => /\.jpe?g\?/i.test(u)) || urls[0] || "";
}
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
      const ok = found.filter((o) => !o.privateItem && (!o.authorUniqueId || o.authorUniqueId === handle));
      ok.forEach((o) => { const c = o.coverUrl || o.originCoverUrl; if (c) coverSrc.set(String(o.id), c); });
      return ok.map((o) => [String(o.id), handle, Number(o.width), Number(o.height), cleanCaption(o.desc)]);
    }
    await sleep(8000 * (attempt + 1)); // rate limited or busy: wait and try again
  }
  return null;
}

const before = JSON.stringify([lib.videos, lib.likes, lib.checked]);
let added = 0;
lib.checked ??= {};
const isChurch = (h) => lib.kinds?.[h] === CHURCH;
const keep = (h) => (isChurch(h) ? PER_CHURCH_CREATOR : PER_CREATOR);
// Creators with no videos yet first, then the church's, then whoever was checked longest ago.
const turn = Object.keys(lib.creators).sort((a, b) =>
  Number(byCreator.has(a)) - Number(byCreator.has(b))
  || Number(isChurch(b)) - Number(isChurch(a))
  || (lib.checked[a] ?? "").localeCompare(lib.checked[b] ?? ""),
).slice(0, CREATORS_PER_RUN);
const todayIs = new Date().toISOString().slice(0, 10);
for (const handle of turn) {
  const fresh = await recentVideos(handle);
  if (!fresh) { console.log(`${handle}: no answer, keeping what we have`); await sleep(2000); continue; }
  const old = byCreator.get(handle) ?? [];
  const ids = new Set(old.map((v) => v[0]));
  // Fresh copies win, but never swap a full caption for a shorter, cut-off one.
  const oldCaption = new Map(old.map((v) => [v[0], v[4]]));
  for (const v of fresh) { const was = oldCaption.get(v[0]); if (was && was.length > v[4].length) v[4] = was; }
  const merged = [...fresh, ...old].filter((v, i, all) => all.findIndex((x) => x[0] === v[0]) === i);
  merged.sort((a, b) => (BigInt(b[0]) > BigInt(a[0]) ? 1 : -1)); // TikTok ids grow over time: newest first
  byCreator.set(handle, merged.slice(0, keep(handle)));
  lib.checked[handle] = todayIs;
  const n = fresh.filter((v) => !ids.has(v[0])).length;
  added += n;
  console.log(`${handle}: ${fresh.length} recent, ${n} new`);
  await sleep(1500);
}

// Only creators still in the list, each with its newest few.
for (const h of [...byCreator.keys()]) {
  if (!lib.creators[h]) byCreator.delete(h);
  else byCreator.set(h, byCreator.get(h).slice(0, keep(h)));
}
for (const h of Object.keys(lib.checked)) if (!lib.creators[h]) delete lib.checked[h];
lib.videos = [...byCreator.values()].flat();
for (const v of lib.videos) if (v[4].length > MAX_CAPTION) v[4] = cleanCaption(v[4]); // older, longer captions too

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
  const cover = coverFromEmbed(html, id);
  if (cover) coverSrc.set(id, cover);
  await sleep(1500);
}
for (const id of Object.keys(lib.likes)) if (!allIds.includes(id)) { delete lib.likes[id]; delete lib.likesAt[id]; }

// ---- Link-preview cards (tt/{id}.jpg on the covers branch) ----
async function makeCard(sharp, buf) {
  const W = 800, H = 420;
  const bg = await sharp(buf).resize(W, H, { fit: "cover" }).blur(18).modulate({ brightness: 0.45 }).toBuffer();
  const fg = await sharp(buf).resize(W, H, { fit: "inside" }).toBuffer({ resolveWithObject: true });
  const play = Buffer.from(`<svg width="96" height="96" xmlns="http://www.w3.org/2000/svg"><circle cx="48" cy="48" r="44" fill="rgba(0,0,0,0.45)" stroke="rgba(255,255,255,0.9)" stroke-width="3"/><path d="M40 30 L68 48 L40 66 Z" fill="#fff"/></svg>`);
  const badge = Buffer.from(`<svg width="132" height="42" xmlns="http://www.w3.org/2000/svg"><rect width="132" height="42" rx="21" fill="rgba(5,7,11,0.8)"/><text x="66" y="29" font-family="DejaVu Sans, Arial, sans-serif" font-size="21" font-weight="700" letter-spacing="3" fill="#fbbf24" text-anchor="middle">SOOZ</text></svg>`);
  return sharp(bg).composite([
    { input: fg.data, left: Math.round((W - fg.info.width) / 2), top: Math.round((H - fg.info.height) / 2) },
    { input: play, left: (W - 96) / 2, top: (H - 96) / 2 },
    { input: badge, left: W - 132 - 16, top: H - 42 - 16 },
  ]).jpeg({ quality: 74, mozjpeg: true }).toBuffer();
}

if (COVERS_DIR) {
  let sharp = null;
  try { sharp = createRequire(path.join(process.env.SHARP_DIR || process.cwd(), "noop.js"))("sharp"); } catch { console.log("sharp not installed — skipping preview cards"); }
  if (sharp) {
    const dir = path.join(COVERS_DIR, "tt");
    mkdirSync(dir, { recursive: true });
    // Cards for videos no longer in the library are removed, so the branch doesn't keep growing.
    const wanted = new Set(allIds);
    let removed = 0;
    for (const f of readdirSync(dir)) if (f.endsWith(".jpg") && !wanted.has(f.slice(0, -4))) { unlinkSync(path.join(dir, f)); removed++; }
    if (removed) console.log(`Removed ${removed} cards of videos no longer in the library.`);
    // Videos whose cover link we already have (from today's creator pages) first.
    const missing = allIds.filter((id) => !existsSync(path.join(dir, `${id}.jpg`))).sort((a, b) => Number(coverSrc.has(b)) - Number(coverSrc.has(a)));
    let made = 0, lookups = 0, failed = 0;
    for (const id of missing) {
      if (made >= CARDS_PER_RUN) break;
      let src = coverSrc.get(id);
      if (!src) {
        if (lookups >= COVER_LOOKUPS_PER_RUN) continue;
        lookups++;
        const res = await fetch(`https://www.tiktok.com/embed/v2/${id}`, { headers: { "user-agent": UA } }).catch(() => null);
        const html = res?.ok ? await res.text() : "";
        if (/ratelimit/.test(html) && html.length < 200) { await sleep(20000); continue; }
        src = coverFromEmbed(html, id);
        await sleep(1500);
      }
      if (!src) { failed++; continue; }
      try {
        const img = await fetch(src, { headers: { "user-agent": UA, accept: "image/jpeg,image/png;q=0.9,image/*;q=0.5" } });
        if (!img.ok) { failed++; continue; }
        await writeFile(path.join(dir, `${id}.jpg`), await makeCard(sharp, Buffer.from(await img.arrayBuffer())));
        made++;
      } catch { failed++; }
    }
    console.log(`Preview cards: ${made} made, ${failed} failed, ${missing.length - made - failed} still to do (${lookups} pages looked up).`);
  }
}

if (JSON.stringify([lib.videos, lib.likes, lib.checked]) === before) {
  console.log("No changes — library left as it is.");
} else {
  lib.updated = new Date().toISOString().slice(0, 10);
  await writeFile(FILE, JSON.stringify(lib));
  console.log(`Done: ${added} new videos, ${lib.videos.length} in the library.`);
}
