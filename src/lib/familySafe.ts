/**
 * Family-safe mode (Settings → Safety), for parents: leaves out anything with strong language or adult
 * themes, and anything someone has reported that a moderator hasn't cleared yet — in For You,
 * Following and comments. A parent's 4-digit PIN is needed to turn it off. It stays on for this phone
 * even when someone signs out, and it's kept on the account so it follows the child to other phones.
 */
import { useSyncExternalStore } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const KEY = "sooz-family-safe";
const db = supabase as unknown as SupabaseClient;
type State = { on: boolean; pin: string | null };

function read(): State {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null") as State | null;
    if (s && typeof s.on === "boolean") return s;
  } catch { /* storage blocked */ }
  return { on: false, pin: null };
}
let state: State = typeof window === "undefined" ? { on: false, pin: null } : read();
let accountUser: string | null = null;
const listeners = new Set<() => void>();
function set(next: State) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
  listeners.forEach((fn) => fn());
  window.dispatchEvent(new CustomEvent("sooz:family-safe", { detail: next.on }));
}
async function saveToAccount() {
  if (!accountUser) return;
  await db.from("user_preferences").upsert(
    { user_id: accountUser, family_safe: state.on, family_pin_hash: state.pin, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
}

export const familySafeOn = () => state.on;
export function useFamilySafe(): boolean {
  return useSyncExternalStore((fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; }, () => state.on, () => false);
}

async function hashPin(pin: string): Promise<string> {
  const bytes = new TextEncoder().encode(`sooz-family-safe:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function turnOnFamilySafe(pin: string) {
  set({ on: true, pin: await hashPin(pin) });
  await saveToAccount();
}
/** Turns it off if the PIN is right. */
export async function turnOffFamilySafe(pin: string): Promise<boolean> {
  if (state.pin && (await hashPin(pin)) !== state.pin) return false;
  set({ on: false, pin: null });
  await saveToAccount();
  return true;
}

/** At sign-in: whichever of this phone and the account has it on wins (a child can't escape it by signing in elsewhere). */
export function applyAccountFamilySafe(userId: string, row: { family_safe?: boolean; family_pin_hash?: string | null } | null) {
  accountUser = userId;
  if (row?.family_safe && !state.on) set({ on: true, pin: row.family_pin_hash ?? null });
  else if (state.on && !row?.family_safe) saveToAccount();
}

// ── What family-safe mode leaves out ──
// Whole words only, so Bible words stay ("hell", "blood", "damnation" are fine).
const WORDS = [
  "fuck", "fucking", "fucked", "motherfucker", "shit", "shitty", "bitch", "bitches", "bastard", "asshole", "dick", "pussy", "cock",
  "cunt", "slut", "whore", "hoe", "thot", "porn", "porno", "nude", "nudes", "naked", "sex", "sexy", "sexual", "horny", "onlyfans",
  "twerk", "twerking", "stripper", "hookup", "boobs", "booty", "nsfw", "xxx", "18+", "weed", "cocaine", "meth", "drunk",
  "kys", "suicide", "selfharm", "gore", "murder", "nigga", "nigger", "faggot", "retard",
];
const WORD_RE = new RegExp(`(^|[^\\p{L}\\p{N}])(${WORDS.map((w) => w.replace(/[+]/g, "\\+")).join("|")})s?(?=$|[^\\p{L}\\p{N}])`, "iu");
const TAG_RE = /#(?:\w*)(porn|nsfw|onlyfans|sexy|nude|twerk|thirsttrap)\w*/i;

/** True when this text has strong language or adult themes. */
export function unsafeText(text: string | null | undefined): boolean {
  if (!text) return false;
  return WORD_RE.test(text) || TAG_RE.test(text);
}
