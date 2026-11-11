#!/usr/bin/env node
/**
 * Finds more Christian TikTok creators for SOOZ's library (src/data/christianTikTokLibrary.json), until
 * it has TARGET creators. Run daily by .github/workflows/refresh-christian-tiktoks.yml before the refresh.
 *
 * Where candidates come from: accounts that the library's creators mention in their videos (each video's
 * public embed page names them — churches, worship leaders, ministers they work with), and the `seeds`
 * list in the state file. Every candidate is checked on TikTok's public creator embed page and only
 * added when it is clearly Christian (most recent captions carry faith words / hashtags / scripture),
 * in English, active this year, big enough (Irish and UK accounts may be small), and shows nothing
 * adult, occult or anti-faith. Its kind (Worship, Gospel, Preaching, Bible, Devotional, Creators) is
 * guessed from its name, bio and captions, and its newest videos go straight into the library.
 *
 * State (queue, every verdict, `seeds`, and `approved`: accounts the owner asked for by name) lives in
 * data/creator-discovery.json, saved with the library, so nobody is checked twice. Stops after DISCOVERY_MINUTES. COVER_HINTS: where to leave the new videos'
 * cover links for the refresh's preview cards.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fetchVideoInfo } from "./tiktok-video.mjs";

const FILE = process.env.LIBRARY_FILE || new URL("../src/data/christianTikTokLibrary.json", import.meta.url);
const STATE = process.env.DISCOVERY_STATE || new URL("../data/creator-discovery.json", import.meta.url);
const MINUTES = Number(process.env.DISCOVERY_MINUTES || 30);
const TARGET = Number(process.env.TARGET || 2000);
const COVER_HINTS = process.env.COVER_HINTS || "";
const PER_CREATOR = 6;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = Date.now() + MINUTES * 60_000;

const lib = JSON.parse(readFileSync(FILE, "utf8"));
lib.kinds ??= {};
lib.checked ??= {};
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
state.queue ??= [];
state.checked ??= {};
state.harvested ??= {};
state.seeds ??= [];
/** Accounts the owner asked for by name (e.g. COZA): added without the caption test. */
state.approved ??= [];
const coverHints = {};

const known = () => new Set(Object.keys(lib.creators).map((h) => h.toLowerCase()));
let knownSet = known();
const norm = (h) => h.replace(/^@/, "").trim().toLowerCase();
const valid = (h) => /^[a-z0-9_.]{2,24}$/.test(h) && !/^\.|\.$/.test(h);
const enqueue = (h, front = false) => {
  h = norm(h);
  if (!valid(h) || knownSet.has(h) || state.checked[h] || state.queue.includes(h)) return;
  if (front) state.queue.unshift(h); else state.queue.push(h);
};

// ── Faith check (same words as the tiktok-import function) ──
const FAITH_WORDS = new Set(["jesus", "christ", "christian", "christians", "christianity", "bible", "biblical", "scripture", "scriptures", "gospel", "worship", "worshipping", "prayer", "prayers", "pray", "praying", "prayed", "church", "sermon", "pastor", "ministry", "psalm", "psalms", "proverbs", "amen", "hallelujah", "halleluyah", "alleluia", "savior", "saviour", "salvation", "resurrection", "devotional", "devotion", "yahweh", "jehovah", "messiah", "emmanuel", "immanuel", "testimony", "apostle", "disciple", "discipleship", "revival", "crucified", "calvary", "baptism", "baptized", "communion", "evangelist", "evangelism", "prophet", "prophetic", "righteousness", "repent", "repentance", "redeemed", "redemption", "deliverance", "anointing", "anointed", "intercession", "fellowship", "catholic", "mass", "rosary", "saint", "parish", "priest", "nun", "lent", "easter", "advent"]);
const WEAK_WORDS = new Set(["god", "lord", "blessed", "heaven", "grace", "holy", "kingdom", "praise", "verse", "faith", "spirit", "forgiven", "righteous", "zion", "risen", "glory"]);
const FAITH_PHRASES = ["holy spirit", "holy ghost", "born again", "word of god", "son of god", "lamb of god", "body of christ", "good news", "praise and worship", "bible verse", "bible study", "daily devotion", "the lord", "king of kings", "love of god", "god is good", "thank you god", "thank you lord", "praise god", "glory to god", "our father"];
const FAITH_TAG_STEMS = ["jesus", "christian", "bible", "gospel", "worship", "scripture", "holyspirit", "sermon", "psalm", "faith", "pray", "church", "godis", "godsword", "godslove", "godsgrace", "godfirst", "hallelujah", "amen", "devotion", "testimony", "salvation", "yahweh", "pastor", "ministry", "revival", "prophetic", "christ", "praise", "catholic", "rosary"];
const SCRIPTURE_REF = /\b(genesis|exodus|leviticus|deuteronomy|joshua|judges|ruth|samuel|kings|chronicles|ezra|nehemiah|esther|job|psalms?|proverbs|ecclesiastes|isaiah|jeremiah|lamentations|ezekiel|daniel|hosea|joel|amos|obadiah|jonah|micah|nahum|habakkuk|zephaniah|haggai|zechariah|malachi|matthew|mark|luke|john|acts|romans|corinthians|galatians|ephesians|philippians|colossians|thessalonians|timothy|titus|philemon|hebrews|james|peter|jude|revelation)\s+\d{1,3}(:\d{1,3})?/i;
const NSFW = ["nsfw", "porn", "onlyfans", "nude", "nudes", "naked", "sexy", "thirsttrap", "thirst trap", "xxx", "twerk", "stripper", "hookup", "18+", "only fans", "spicy"];
const REVIEW = ["atheist", "atheism", "exchristian", "ex-christian", "deconstruction", "deconstructing", "deconverted", "satanic", "satanism", "witchtok", "witchcraft", "tarot", "occult", "spellwork", "manifesting", "astrology", "horoscope", "zodiac", "paganism", "wicca", "wiccan", "luciferian", "religionisalie", "godisnotreal", "christianmemes", "religiousmemes", "mormon", "lds", "jehovahswitness", "jw.org", "islam", "muslim", "quran", "allah", "hindu", "krishna", "buddha", "buddhist", "sikh", "kabbalah", "scientology", "hebrewisraelite", "flatearth"];
const STRONG_NAME = /church|ministr|worship|gospel|jesus|christ|pastor|bible|prayer|pray|chapel|cathedral|parish|diocese|catholic|apostolic|pentecost|baptist|methodist|anglican|evangel|revival|choir|praise|faith|godly|scripture|psalm|kingdom|zion|sermon|preach|bishop|reverend|\brev\b|\bfr\b|priest|sister|monk|christian/i;

function analyze(text) {
  const lower = ` ${text.toLowerCase()} `.replace(/oh my god|omg|my god!|god damn|goddamn/g, " ");
  const tags = [...lower.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((m) => m[1]);
  const words = lower.replace(/#[\p{L}\p{N}_]+/gu, " ").split(/[^\p{L}\p{N}'+-]+/u).filter(Boolean);
  let strong = 0, weak = 0;
  for (const w of words) { const b = w.replace(/'s$/, ""); if (FAITH_WORDS.has(b)) strong++; else if (WEAK_WORDS.has(b)) weak++; }
  for (const p of FAITH_PHRASES) if (lower.includes(p)) strong++;
  for (const t of tags) { if (t.startsWith("christmas")) continue; if (FAITH_TAG_STEMS.some((s) => t.startsWith(s) || t.endsWith(s))) strong++; }
  if (SCRIPTURE_REF.test(lower)) strong++;
  const has = (terms) => terms.filter((t) => (t.includes(" ") || t.includes("+") || t.includes(".") ? lower.includes(t) : words.includes(t) || tags.some((tag) => tag === t || tag.startsWith(t))));
  return { faith: strong >= 1 || weak >= 2, nsfw: has(NSFW).length, review: has(REVIEW), words, tags };
}

const EN = new Set(["the", "and", "you", "to", "of", "is", "in", "my", "your", "for", "this", "it", "me", "i", "we", "our", "be", "with", "that", "on", "are", "he", "his", "will", "what", "who", "not", "but", "have", "all", "so", "just", "when", "can", "him", "know", "love", "day", "today", "how", "do", "was"]);
const OTHER = new Set(["de", "la", "que", "el", "y", "en", "los", "las", "del", "por", "con", "para", "una", "es", "mi", "dios", "señor", "senhor", "deus", "não", "você", "com", "uma", "est", "le", "les", "des", "et", "pour", "une", "der", "die", "und", "ist", "nicht", "mit", "ich", "het", "een", "di", "che", "il", "per", "na", "ng", "sa", "ang", "mga", "yang", "dan", "untuk", "ini", "aku", "kamu", "tuhan", "ako", "ka"]);
function english(words) {
  let en = 0, other = 0;
  for (const w of words) { if (EN.has(w)) en++; else if (OTHER.has(w)) other++; }
  if (en + other < 2) return null; // too short to tell
  return en >= 2 && en > other * 1.5;
}

const IE = /ireland|irish|éire|eire|dublin|cork|galway|limerick|belfast|derry|waterford|kilkenny|wexford|sligo|donegal|kerry|mayo|meath|kildare|wicklow|athlone|drogheda|dundalk|navan|tralee|ennis|carlow|letterkenny|newry|lisburn|🇮🇪|n\.? ?ireland/i;
const UK = /\buk\b|united kingdom|england|london|manchester|birmingham|liverpool|leeds|glasgow|edinburgh|cardiff|bristol|sheffield|nottingham|leicester|newcastle|wales|scotland|britain|british|🇬🇧|🏴|essex|kent|surrey|brighton|coventry|reading|oxford|cambridge/i;
const US = /\busa\b|\bu\.s\.|united states|america|texas|california|florida|georgia|atlanta|dallas|houston|nashville|tennessee|new york|nyc|chicago|los angeles|\bla\b|ohio|carolina|virginia|alabama|arizona|oklahoma|kentucky|louisiana|michigan|🇺🇸|tulsa|charlotte|orlando|phoenix|seattle|denver|detroit/i;
const region = (t) => (IE.test(t) ? "IE" : UK.test(t) ? "UK" : US.test(t) ? "US" : null);

function kindOf(text) {
  const t = text.toLowerCase();
  const score = (re) => (t.match(re) || []).length;
  const k = {
    Worship: score(/worship|song|music|singer|sing|praise|choir|album|single|lyrics|acoustic|cover|band|musician|psalmist/g),
    Gospel: score(/gospel|choir|gospelmusic|praise team/g) * 1.3,
    Preaching: score(/sermon|preach|pastor|church|sunday service|message|bishop|evangelist|ministry|teaching|apostle|prophet/g),
    Bible: score(/bible|scripture|verse|apologetic|theolog|book of|chapter|study/g),
    Devotional: score(/devotion|prayer|pray|encourag|daily|morning|night prayer|rosary|reflection|quiet time/g),
  };
  const best = Object.entries(k).sort((a, b) => b[1] - a[1])[0];
  return best[1] >= 2 ? best[0] : "Creators";
}

async function embed(handle) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let res;
    try { res = await fetch(`https://www.tiktok.com/embed/@${encodeURIComponent(handle)}`, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(25000) }); } catch (e) { res = null; console.log(`  ${handle}: ${e?.name || e}`); }
    if (!res) { await sleep(5000); continue; }
    if (res.status === 404) return { missing: true };
    const html = await res.text().catch(() => "");
    if (/ratelimit/i.test(html) && html.length < 500) { await sleep(60000); continue; }
    const m = html.match(/<script id="__FRONTITY_CONNECT_STATE__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) { if (res.ok || res.status === 400) return { missing: true }; await sleep(10000 * (attempt + 1)); continue; }
    const st = JSON.parse(m[1]);
    const data = st?.source?.data?.[`/embed/@${handle}`] ?? Object.values(st?.source?.data ?? {}).find((d) => d?.userInfo);
    if (!data?.userInfo || data.isError) return { missing: true, code: data?.errorCode };
    return { user: data.userInfo, videos: (data.videoList ?? []).filter((v) => !v.privateItem) };
  }
  return null;
}

/** The real usernames of accounts mentioned in a creator's videos (from each video's public page). */
async function harvest(handle, vids) {
  for (const v of vids.filter((x) => String(x.desc || "").includes("@")).slice(0, 12)) {
    const info = await fetchVideoInfo(String(v.id), handle, UA);
    if (info.status === "slow") { await sleep(20000); continue; }
    for (const u of info.mentions ?? []) enqueue(u);
    await sleep(700);
  }
}

const ageDays = (id) => { try { return (Date.now() / 1000 - Number(BigInt(id) >> 32n)) / 86400; } catch { return 9999; } };

async function check(handle, ownerApproved = false) {
  const r = await embed(handle);
  if (!r) return { ok: false, why: "no answer", retry: true };
  if (r.missing) return { ok: false, why: "no such account" };
  const u = r.user;
  const vids = r.videos;
  const followers = Number(u.followerCount || 0);
  const bio = `${u.nickname || ""} ${u.signature || ""}`;
  const captions = vids.map((v) => String(v.desc || ""));
  const all = `${bio} ${captions.join(" ")}`;
  const where = region(bio) || region(captions.join(" "));
  if (vids.length < 3) return { ok: false, why: `only ${vids.length} public videos`, followers };
  const newest = Math.min(...vids.map((v) => ageDays(String(v.id))));
  if (newest > 400) return { ok: false, why: "inactive", followers };
  const per = captions.map((c) => analyze(c));
  const bioA = analyze(bio);
  if (per.some((a) => a.nsfw) || bioA.nsfw) return { ok: false, why: "nsfw words", followers };
  // Accounts the owner asked for by name only need to exist, be active and be clean.
  if (ownerApproved) return { ok: true, name: String(u.nickname || handle).trim() || handle, kind: kindOf(all), verified: !!u.verified, vids, followers, where };
  const review = new Set([...bioA.review, ...per.flatMap((a) => a.review)]);
  if (review.size >= 1) return { ok: false, why: `review: ${[...review].join(",")}`, followers };
  const withText = per.filter((a) => a.words.length + a.tags.length > 0);
  const faithy = withText.filter((a) => a.faith).length;
  const ratio = withText.length ? faithy / withText.length : 0;
  const strongName = STRONG_NAME.test(bio) || STRONG_NAME.test(handle);
  const enVotes = [english(bioA.words), ...per.map((a) => english(a.words))].filter((x) => x !== null);
  const enShare = enVotes.length ? enVotes.filter(Boolean).length / enVotes.length : 0;
  const minFollowers = where === "IE" || where === "UK" ? 300 : strongName ? 1500 : 3000;
  const faithOk = (ratio >= 0.5 && faithy >= 3) || (strongName && ratio >= 0.3 && faithy >= 2);
  const info = { followers, ratio: +ratio.toFixed(2), en: +enShare.toFixed(2), where, n: vids.length };
  if (!faithOk) return { ok: false, why: "not clearly Christian", ...info };
  if (enVotes.length >= 2 && enShare < 0.6) return { ok: false, why: "not English", ...info };
  if (enVotes.length < 2 && !where) return { ok: false, why: "language unclear", ...info };
  if (followers < minFollowers) return { ok: false, why: `small (${followers})`, ...info };
  await harvest(handle, vids);
  return { ok: true, name: String(u.nickname || handle).trim() || handle, kind: kindOf(all), verified: !!u.verified, vids, ...info };
}


const MAX_CAPTION = 300;
const clean = (t) => {
  let c = String(t || "").replace(/\r/g, "").replace(/[^\S\n]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (c.length > MAX_CAPTION) c = `${c.slice(0, MAX_CAPTION - 1).replace(/\s+\S*$/, "")}…`;
  return c;
};

function add(handle, res, vids) {
  lib.creators[handle] = res.name;
  lib.kinds[handle] = res.kind;
  const newest = vids.filter((v) => v.width && v.height).sort((a, b) => (BigInt(b.id) > BigInt(a.id) ? 1 : -1)).slice(0, PER_CREATOR);
  for (const v of newest) {
    lib.videos.push([String(v.id), handle, Number(v.width), Number(v.height), clean(v.desc)]);
    const cover = v.coverUrl || v.originCoverUrl;
    if (cover) coverHints[String(v.id)] = cover;
  }
  lib.checked[handle] = new Date().toISOString().slice(0, 10);
  knownSet = known();
}

// Creators the admin trusted on the Christian TikTok page (table tiktok_trusted_creators, read through
// the public trusted_creator_handles() function): added whatever earlier verdict they had.
const SUPABASE_URL = "https://xhqpojnmcibkaydidnex.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhocXBvam5tY2lia2F5ZGlkbmV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzMjAzNTcsImV4cCI6MjA4MDg5NjM1N30.DkKg7S_xOEyGR2R9TtjBKzqoDACzZUYkA8BcFw6qylw"; // public key, as in the app
try {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/trusted_creator_handles`, {
    method: "POST", body: "{}", signal: AbortSignal.timeout(20000),
    headers: { apikey: SUPABASE_ANON, authorization: `Bearer ${SUPABASE_ANON}`, "content-type": "application/json" },
  });
  const rows = res.ok ? await res.json() : [];
  let fresh = 0;
  for (const { handle } of rows) {
    const h = norm(String(handle || ""));
    if (!valid(h) || knownSet.has(h)) continue;
    if (!state.approved.includes(h)) state.approved.push(h);
    if (state.checked[h] && state.checked[h] !== "ok") delete state.checked[h]; // the owner vouched for them
    fresh++;
  }
  console.log(`Trusted creators from the app: ${rows.length} (${fresh} not in the library yet).`);
} catch (e) { console.log("Couldn't read trusted creators:", e.message); }

for (const s of [...state.seeds, ...state.approved]) enqueue(s, true);
// The library's own creators are sources: who they mention — looked at again every two weeks, as new
// videos bring new names.
const today = new Date().toISOString().slice(0, 10);
const due = (h) => !state.harvested[h] || state.harvested[h] === 1 || (Date.now() - Date.parse(state.harvested[h])) / 86_400_000 >= 14;
for (const h of Object.keys(lib.creators)) if (due(h)) state.queue.push(`=${h}`);

// …and every new video in the library (hundreds a day) is a source too, so discovery never runs dry:
// names written in its caption straight away, and the exact accounts it tags (its embed page) once.
state.harvestedVideos ??= {};
const libIds = new Set(lib.videos.map((v) => v[0]));
const videoHandle = new Map(lib.videos.map((v) => [v[0], v[1]]));
for (const id of Object.keys(state.harvestedVideos)) if (!libIds.has(id)) delete state.harvestedVideos[id];
for (const v of lib.videos) for (const m of String(v[4] || "").matchAll(/(?<![A-Za-z0-9._])@([A-Za-z0-9._]{2,24})/g)) enqueue(m[1]); // not e-mail addresses
const VIDEO_LOOKUPS = Number(process.env.VIDEO_LOOKUPS || 600);
for (const v of lib.videos.filter((x) => !state.harvestedVideos[x[0]] && String(x[4] || "").includes("@")).slice(0, VIDEO_LOOKUPS)) state.queue.push(`#${v[0]}`);

let checkedNow = 0, addedNow = 0;
const save = () => {
  writeFileSync(STATE, JSON.stringify({ ...state, queue: state.queue.filter((x) => !x.startsWith("#") && !x.startsWith("=")) }));
  writeFileSync(FILE, JSON.stringify(lib));
  if (COVER_HINTS) writeFileSync(COVER_HINTS, JSON.stringify(coverHints));
};
async function worker() {
  while (state.queue.length && Date.now() < until) {
    let h = state.queue.shift();
    // Past the target, only accounts the owner asked for are still added.
    if (Object.keys(lib.creators).length >= TARGET && !state.approved.includes(h)) { if (!state.queue.some((x) => state.approved.includes(x))) break; continue; }
    if (h.startsWith("#")) {
      const id = h.slice(1);
      if (state.harvestedVideos[id]) continue;
      const info = await fetchVideoInfo(id, videoHandle.get(id), UA);
      if (info.status === "slow") { await sleep(20000); continue; } // try again another day
      for (const u of info.mentions ?? []) enqueue(u);
      if (info.status === "ok" || info.status === "gone") state.harvestedVideos[id] = 1;
      await sleep(700);
      continue;
    }
    if (h.startsWith("=")) {
      h = h.slice(1);
      if (!due(h)) continue;
      const r = await embed(h);
      if (r?.videos) { await harvest(h, r.videos); state.harvested[h] = today; }
      await sleep(800);
      continue;
    }
    if (state.checked[h] || knownSet.has(h)) continue;
    const res = await check(h, state.approved.includes(h));
    if (res.retry) { state.queue.push(h); await sleep(15000); continue; }
    state.checked[h] = res.ok ? "ok" : res.why;
    checkedNow++;
    if (res.ok) {
      add(h, res, res.vids);
      state.harvested[h] = today;
      addedNow++;
      console.log(`+ ${h} (${res.name}) ${res.kind}${res.where ? ` ${res.where}` : ""} · ${res.followers} followers`);
    }
    if (checkedNow % 25 === 0) save();
    await sleep(1000);
  }
}
await Promise.all([worker(), worker(), worker()]);
save();
console.log(`Discovery: checked ${checkedNow}, added ${addedNow}; ${Object.keys(lib.creators).length} creators in the library, ${state.queue.length} still to check.`);
