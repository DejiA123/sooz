import { supabase } from "@/integrations/supabase/client";

/** How many SOOZ comments a TikTok has (null if unknown, e.g. comments aren't switched on yet). */
export async function countTikTokComments(tiktokId: string): Promise<number | null> {
  const { count, error } = await supabase.from("tiktok_comments").select("id", { count: "exact", head: true }).eq("tiktok_id", tiktokId);
  return error ? null : count ?? 0;
}
