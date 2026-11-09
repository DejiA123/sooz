/**
 * SOOZ's For You "algorithm", TikTok-style — kept on this phone, so it works signed in or not.
 *
 * - Every video shown is remembered (`seen`), so For You never shows it again while there are
 *   videos you haven't seen (src/services/api/feed.ts).
 * - It learns what you like from how you watch: watched to the end / watched again, likes,
 *   comments, shares, reposts, follows, opening the creator or the full caption — and swiping
 *   away within a second or two, or "Not interested", counts against. That builds a score per
 *   creator, per kind of video (Worship, Gospel, Preaching, Bible… from the library's `kinds`) and
 *   per hashtag; old tastes slowly fade so it follows what you're into now.
 */
import { useEffect, useMemo, useRef } from "react";
import type { FeedPost } from "@/services/api/posts";
import type { TikTokVideo } from "@/services/api/tiktok";

export type TasteKind = "tiktok" | "post";
export interface TasteItem {
  kind: TasteKind;
  id: string;
  creator: string | null;
  caption?: string | null;
}

export const tasteOfVideo = (v: TikTokVideo): TasteItem => ({ kind: "tiktok", id: v.tiktok_id, creator: v.author_handle?.toLowerCase() ?? null, caption: v.title });
export const tasteOfPost = (p: FeedPost): TasteItem => ({ kind: "post", id: p.id, creator: p.user_id, caption: p.caption });

type Store = {
  v: 1;
  /** When the scores last faded (ms). */
  at: number;
  /** "t:{tiktokId}" / "p:{postId}" → when it was last on screen (minutes since 2024-01-01). */
  seen: Record<string, number>;
  /** Interest per creator, per kind of video, per hashtag. */
  c: Record<string, number>;
  k: Record<string, number>;
  t: Record<string, number>;
  /** How many of each creator's videos have been shown (for discovering new creators). */
  n: Record<string, number>;
};

const KEY = "sooz-taste-v1";
const EPOCH = Date.UTC(2024, 0, 1);
const MAX_SEEN = 8000;
/** Scores keep this much of their strength per day. */
const DAILY_FADE = 0.985;

const empty = (): Store => ({ v: 1, at: Date.now(), seen: {}, c: {}, k: {}, t: {}, n: {} });
let store: Store | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function load(): Store {
  if (store) return store;
  let s = empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Store;
      if (parsed && parsed.v === 1 && parsed.seen) s = { ...empty(), ...parsed };
    }
  } catch { /* storage blocked: start fresh */ }
  const days = (Date.now() - s.at) / 86_400_000;
  if (days > 0.25) {
    const f = Math.pow(DAILY_FADE, days);
    for (const m of [s.c, s.k, s.t]) {
      for (const key of Object.keys(m)) {
        m[key] *= f;
        if (Math.abs(m[key]) < 0.05) delete m[key];
      }
    }
    s.at = Date.now();
  }
  store = s;
  if (typeof window !== "undefined") {
    const flush = () => { if (document.visibilityState === "hidden") saveNow(); };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", saveNow);
  }
  return s;
}

function trim(m: Record<string, number>, max: number, by: (v: number) => number) {
  const keys = Object.keys(m);
  if (keys.length <= max) return;
  keys.sort((a, b) => by(m[b]) - by(m[a]));
  for (const key of keys.slice(max)) delete m[key];
}

function saveNow() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  const s = store;
  if (!s) return;
  trim(s.seen, MAX_SEEN, (v) => v); // forget the longest-ago first
  trim(s.c, 600, Math.abs);
  trim(s.t, 400, Math.abs);
  trim(s.n, 1500, (v) => v);
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage full: keep going in memory */ }
}

const changeListeners = new Set<() => void>();
function save() {
  if (!saveTimer) saveTimer = setTimeout(saveNow, 1000);
  changeListeners.forEach((fn) => fn());
}

// ── Saved to the account too (src/lib/tasteSync.ts), so it follows the viewer to any phone ──
export type TasteStore = Store;
/** Called whenever the taste changes. */
export function onTasteChange(fn: () => void): () => void {
  changeListeners.add(fn);
  return () => { changeListeners.delete(fn); };
}
/** A copy to save on the account (only the most recent `maxSeen` videos, to keep it small). */
export function tasteSnapshot(maxSeen = 3000): Store {
  const s = load();
  const seen = Object.entries(s.seen).sort((a, b) => b[1] - a[1]).slice(0, maxSeen);
  return { ...s, seen: Object.fromEntries(seen) };
}
/** Brings in the account's copy: everything seen on either phone, and the newer scores win. */
export function mergeTaste(remote: Partial<Store> | null | undefined) {
  if (!remote || remote.v !== 1) return;
  const s = load();
  const remoteNewer = (remote.at ?? 0) > s.at;
  for (const [key, at] of Object.entries(remote.seen ?? {})) s.seen[key] = Math.max(s.seen[key] ?? 0, at);
  for (const name of ["c", "k", "t"] as const) {
    const theirs = remote[name] ?? {};
    for (const key of new Set([...Object.keys(s[name]), ...Object.keys(theirs)])) {
      const mine = s[name][key];
      const other = theirs[key];
      s[name][key] = mine == null ? other : other == null ? mine : remoteNewer ? other : mine;
    }
  }
  for (const [key, n] of Object.entries(remote.n ?? {})) s.n[key] = Math.max(s.n[key] ?? 0, n);
  s.at = Math.max(s.at, remote.at ?? 0);
  saveNow();
}

// ── Kinds of video (Worship, Gospel, Preaching…), per creator, from the TikTok library ──
const categories = new Map<string, string>();
export function setCategories(kinds: Record<string, string> | undefined) {
  if (!kinds) return;
  for (const [handle, kind] of Object.entries(kinds)) categories.set(handle.toLowerCase(), kind);
}
export const categoryOf = (creator: string | null | undefined) => (creator ? categories.get(creator.toLowerCase()) ?? null : null);

/** Hashtags worth learning from (not the ones everyone adds to every video). */
const GENERIC_TAGS = new Set(["fyp", "fy", "fypシ", "foryou", "foryoupage", "viral", "trending", "tiktok", "xyzbca", "capcut", "explore", "explorepage", "reels", "foryourpage", "parati", "duet", "stitch"]);
export function hashtags(caption: string | null | undefined): string[] {
  if (!caption) return [];
  const out: string[] = [];
  for (const m of caption.matchAll(/#([\p{L}\p{N}_]{2,40})/gu)) {
    const tag = m[1].toLowerCase();
    if (!GENERIC_TAGS.has(tag) && !out.includes(tag)) out.push(tag);
    if (out.length >= 6) break;
  }
  return out;
}

export const tasteKey = (kind: TasteKind, id: string) => `${kind === "tiktok" ? "t" : "p"}:${id}`;
const now = () => Math.round((Date.now() - EPOCH) / 60_000);

/** When this video was last on screen (ms), or null if never. */
export function seenAt(kind: TasteKind, id: string): number | null {
  const m = load().seen[tasteKey(kind, id)];
  return m == null ? null : EPOCH + m * 60_000;
}
export const isSeen = (kind: TasteKind, id: string) => seenAt(kind, id) != null;

function markSeen(item: TasteItem) {
  const s = load();
  const key = tasteKey(item.kind, item.id);
  if (s.seen[key] == null && item.creator) s.n[item.creator] = (s.n[item.creator] ?? 0) + 1;
  s.seen[key] = now();
  save();
}

/** Nudge the scores for this video's creator, kind and hashtags. */
function learn(item: TasteItem, delta: number) {
  if (!delta) return;
  const s = load();
  const clamp = (v: number) => Math.max(-30, Math.min(30, v));
  if (item.creator) s.c[item.creator] = clamp((s.c[item.creator] ?? 0) + delta);
  const kind = item.kind === "tiktok" ? categoryOf(item.creator) : "SOOZ posts";
  if (kind) s.k[kind] = clamp((s.k[kind] ?? 0) + delta * 0.6);
  for (const tag of hashtags(item.caption)) s.t[tag] = clamp((s.t[tag] ?? 0) + delta * 0.4);
  save();
}

export type TasteAction = "like" | "unlike" | "comment" | "openComments" | "share" | "openShare" | "repost" | "profile" | "follow" | "more";
const ACTION_WEIGHT: Record<TasteAction, number> = {
  like: 2.5, unlike: -2.5, comment: 2, openComments: 1, share: 3, openShare: 0.6, repost: 3, profile: 1.5, follow: 3, more: 0.7,
};
export function engage(item: TasteItem, action: TasteAction) {
  learn(item, ACTION_WEIGHT[action]);
}

/** "Not interested": far fewer like this (and never this one again). */
export function notInterested(item: TasteItem) {
  markSeen(item);
  learn(item, -6);
  saveNow();
}

/** How much this viewer is likely to enjoy it, from what they've watched (about -4.6 … +4.6). */
export function interest(item: TasteItem): number {
  const s = load();
  const c = item.creator ? s.c[item.creator] ?? 0 : 0;
  const kind = item.kind === "tiktok" ? categoryOf(item.creator) : "SOOZ posts";
  const k = kind ? s.k[kind] ?? 0 : 0;
  const tags = hashtags(item.caption);
  const t = tags.length ? tags.reduce((sum, tag) => sum + (s.t[tag] ?? 0), 0) / Math.sqrt(tags.length) : 0;
  return 2.4 * Math.tanh(c / 4) + 1.3 * Math.tanh(k / 6) + 0.9 * Math.tanh(t / 4);
}

/** How many of this creator's videos have been shown so far. */
export const exposure = (creator: string | null | undefined) => (creator ? load().n[creator] ?? 0 : 0);

/** Has this phone learnt anything yet? */
export const hasTaste = () => Object.keys(load().c).length > 0;

/**
 * Watches one slide: marks it seen when it comes on screen, and when it leaves, learns from how
 * it was watched. The slide reports `played()` (it really started), `progress(0…1)` and `ended()`
 * (watched to the end — TikToks loop, so each end counts).
 */
export function useTasteWatch(item: TasteItem | null, active: boolean) {
  const itemRef = useRef(item);
  itemRef.current = item;
  const st = useRef({ open: false, since: 0, dwell: 0, played: false, frac: 0, ends: 0 });

  const finish = () => {
    const s = st.current;
    const it = itemRef.current;
    if (!s.open || !it) return;
    if (s.since) { s.dwell += Date.now() - s.since; s.since = 0; }
    s.open = false;
    const secs = s.dwell / 1000;
    let w: number;
    if (s.ends > 0) w = 1 + Math.min(s.ends - 1, 2) * 0.4; // watched it all (and again)
    else if (s.frac >= 0.85) w = 0.9;
    else if (s.frac >= 0.5) w = 0.4;
    else if (s.frac > 0) w = secs < 2 ? -0.6 : secs < 4 ? -0.2 : 0;
    else if (it.kind === "post") w = secs >= 12 ? 0.5 : secs >= 6 ? 0.25 : secs < 1.5 ? -0.4 : 0; // a photo needs only a look
    else w = secs >= 20 ? 0.7 : secs >= 10 ? 0.4 : secs >= 5 ? 0.1 : secs < 2 ? -0.6 : -0.15;
    if (!s.played && w < 0) w = 0; // it never started (slow / unavailable): not the viewer's verdict
    learn(it, w);
  };

  useEffect(() => {
    const s = st.current;
    if (active) {
      if (!s.open && itemRef.current) {
        st.current = { open: true, since: Date.now(), dwell: 0, played: itemRef.current.kind === "post", frac: 0, ends: 0 };
        markSeen(itemRef.current);
      } else if (s.open && !s.since) s.since = Date.now(); // back from the background
      return;
    }
    if (!s.open) return;
    if (s.since) { s.dwell += Date.now() - s.since; s.since = 0; }
    if (typeof document !== "undefined" && document.hidden) return; // app in the background: carry on later
    finish();
  }, [active]);

  useEffect(() => () => finish(), []);

  return useMemo(() => ({
    played: () => { st.current.played = true; },
    progress: (f: number) => { if (Number.isFinite(f)) st.current.frac = Math.max(st.current.frac, Math.min(1, f)); },
    ended: () => { if (st.current.open) { st.current.ends += 1; st.current.frac = 1; st.current.played = true; } },
  }), []);
}

/** Age in days of a TikTok, from its ID (TikTok IDs start with the upload time), or null. */
export function tiktokAgeDays(id: string): number | null {
  try {
    const secs = Number(BigInt(id) >> BigInt(32));
    const nowSecs = Date.now() / 1000;
    if (secs > 1_400_000_000 && secs < nowSecs + 86_400) return Math.max(0, (nowSecs - secs) / 86_400);
  } catch { /* not a number */ }
  return null;
}
