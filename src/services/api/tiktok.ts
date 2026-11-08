import { supabase } from "@/integrations/supabase/client";

/**
 * Christian TikTok videos, played through TikTok's official embed player
 * (https://www.tiktok.com/player/v1/{id}). Only rows a curator (or the faith filter on a
 * trusted creator) approved are returned — see supabase/functions/tiktok-import.
 */
export interface TikTokVideo {
  id: string;
  tiktok_id: string;
  url: string;
  author_name: string | null;
  author_handle: string | null;
  author_url: string | null;
  title: string | null;
  thumbnail_url: string | null;
  thumbnail_width: number | null;
  thumbnail_height: number | null;
  faith_tags: string[];
  created_at: string;
}

const COLUMNS =
  "id, tiktok_id, url, author_name, author_handle, author_url, title, thumbnail_url, thumbnail_width, thumbnail_height, faith_tags, created_at";

// If the migration has not been applied yet, stop asking for a table that is not there.
let tableUnavailable = false;

export async function fetchApprovedTikToks(page: number, size: number): Promise<{ videos: TikTokVideo[]; hasMore: boolean }> {
  if (tableUnavailable) return { videos: [], hasMore: false };
  const from = page * size;
  const { data, error } = await supabase
    .from("tiktok_videos")
    .select(COLUMNS)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .range(from, from + size - 1);

  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01" || /does not exist|schema cache/i.test(error.message)) {
      tableUnavailable = true;
    } else {
      console.warn("Christian TikTok feed unavailable:", error.message);
    }
    return { videos: [], hasMore: false };
  }
  return { videos: (data || []) as TikTokVideo[], hasMore: (data || []).length === size };
}

/** Official TikTok embed player URL with TikTok's own UI trimmed so SOOZ's overlay can take over. */
export function tiktokPlayerUrl(tiktokId: string): string {
  const params = new URLSearchParams({
    autoplay: "1",
    loop: "1",
    controls: "1",
    progress_bar: "0",
    play_button: "1",
    volume_control: "0",
    fullscreen_button: "0",
    timestamp: "0",
    music_info: "0",
    description: "0",
    rel: "0",
    native_context_menu: "0",
    closed_caption: "0",
  });
  return `https://www.tiktok.com/player/v1/${encodeURIComponent(tiktokId)}?${params}`;
}

export type TikTokImportResult = {
  url: string;
  status: "approved" | "pending" | "rejected" | "duplicate" | "error" | "needs_override";
  message: string;
  tiktok_id?: string;
  title?: string | null;
  author?: string | null;
};

export async function importTikToks(urls: string[], force = false): Promise<{ results: TikTokImportResult[]; isCurator: boolean }> {
  const { data, error } = await supabase.functions.invoke("tiktok-import", { body: { action: "import", urls, force } });
  if (error) throw new Error(error.message || "Could not reach the TikTok import service");
  if (data?.error) throw new Error(data.error);
  return data as { results: TikTokImportResult[]; isCurator: boolean };
}

// TikTok's CDN thumbnail links expire; when one fails we ask the backend to fetch fresh metadata.
const pendingRefresh = new Set<string>();
const refreshed = new Set<string>();
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

export function requestTikTokRefresh(id: string) {
  if (refreshed.has(id)) return;
  refreshed.add(id);
  pendingRefresh.add(id);
  if (refreshTimer) return;
  refreshTimer = setTimeout(() => {
    const ids = [...pendingRefresh].slice(0, 20);
    pendingRefresh.clear();
    refreshTimer = null;
    supabase.functions.invoke("tiktok-import", { body: { action: "refresh", ids } }).catch(() => {});
  }, 1500);
}
