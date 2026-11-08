import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * People who join with Google or an emailed code get a placeholder profile from the database
 * ("user_1a2b3c4d", no name). The first time they sign in, fill in what we know: their Google
 * name and photo, and a readable username from their email. Runs in the app (users may update
 * their own profile), so no database change is needed.
 */
const PLACEHOLDER_USERNAME = /^user_[0-9a-f]{8}$/;
const doneKey = (id: string) => `sooz-profile-setup:${id}`;

export async function completeNewProfile(user: User): Promise<void> {
  try {
    if (localStorage.getItem(doneKey(user.id))) return;
  } catch { /* storage blocked — just run */ }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return;

  const meta = (user.user_metadata || {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const name = str(meta.full_name) || str(meta.name);
  const photo = str(meta.avatar_url) || str(meta.picture);

  const updates: { display_name?: string; avatar_url?: string; username?: string } = {};
  if (name && (!profile.display_name || profile.display_name === profile.username)) updates.display_name = name;
  if (photo && !profile.avatar_url) updates.avatar_url = photo;

  if (PLACEHOLDER_USERNAME.test(profile.username) && user.email) {
    const base = user.email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
    if (base.length >= 3) {
      const candidates = [base, ...Array.from({ length: 4 }, () => `${base.slice(0, 20)}${1000 + Math.floor(Math.random() * 9000)}`)];
      for (const candidate of candidates) {
        const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("username", candidate);
        if (count === 0) { updates.username = candidate; break; }
      }
    }
  }

  if (Object.keys(updates).length) {
    let { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
    // Someone grabbed that username at the same moment — keep the rest of the update.
    if (error?.code === "23505" && updates.username) {
      delete updates.username;
      ({ error } = await supabase.from("profiles").update(updates).eq("id", user.id));
    }
    if (error) return; // try again next sign-in
  }
  try { localStorage.setItem(doneKey(user.id), "1"); } catch { /* ignore */ }
}
