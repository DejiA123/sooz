/**
 * Keeps the For You taste (src/lib/taste.ts) on the viewer's account (`user_preferences.taste`), so
 * a new phone knows what they've already watched and what they enjoy. Brought in at sign-in, saved
 * at most once a minute while it changes and whenever the app goes to the background.
 */
import { useEffect } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { mergeTaste, onTasteChange, tasteSnapshot, type TasteStore } from "@/lib/taste";
import { applyAccountFamilySafe } from "@/lib/familySafe";

const UPLOAD_EVERY_MS = 60_000;
const db = supabase as unknown as SupabaseClient; // user_preferences isn't in the generated types yet

export function useAccountSync() {
  const { user } = useAuth();
  const uid = user?.id ?? null;

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    let ready = false;
    let dirty = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const upload = async () => {
      if (timer) { clearTimeout(timer); timer = null; }
      if (!dirty || !ready) return;
      dirty = false;
      const { error } = await db.from("user_preferences")
        .upsert({ user_id: uid, taste: tasteSnapshot(), updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) dirty = true; // try again next time
    };
    const schedule = () => {
      dirty = true;
      if (!timer && ready) timer = setTimeout(upload, UPLOAD_EVERY_MS);
    };
    const onHide = () => { if (document.visibilityState === "hidden") upload(); };

    (async () => {
      const { data } = await db.from("user_preferences").select("taste, family_safe, family_pin_hash").eq("user_id", uid).maybeSingle();
      if (cancelled) return;
      if (data?.taste) mergeTaste(data.taste as unknown as TasteStore);
      applyAccountFamilySafe(uid, data ?? null);
      ready = true;
      dirty = true; // send this phone's part back so both copies match
      timer = setTimeout(upload, 5_000);
    })();

    const off = onTasteChange(schedule);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      cancelled = true;
      off();
      document.removeEventListener("visibilitychange", onHide);
      upload();
    };
  }, [uid]);
}
