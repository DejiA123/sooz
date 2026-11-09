import { supabase } from "@/integrations/supabase/client";
import { CHRISTIAN_CREATORS, STARTER_TIKTOKS } from "@/data/christianTikTokStarter";

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
  /** TikTok's like count (from the library, refreshed daily) — shown on SOOZ's heart. */
  likes?: number | null;
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

const CREATOR_NAMES = new Map(CHRISTIAN_CREATORS.map((c) => [c.handle, c.name]));

/**
 * The hand-picked starter videos as feed items, so every viewer sees Christian TikToks in For You
 * straight away — even before a curator has imported them into the database.
 */
export function starterTikToks(): TikTokVideo[] {
  return STARTER_TIKTOKS.flatMap((t) => {
    const m = t.url.match(/tiktok\.com\/@([^/]+)\/video\/(\d+)/);
    if (!m) return [];
    const [, handle, id] = m;
    return [{
      id: `starter-${id}`,
      tiktok_id: id,
      url: t.url,
      author_name: CREATOR_NAMES.get(handle) ?? null,
      author_handle: handle,
      author_url: `https://www.tiktok.com/@${handle}`,
      title: t.caption,
      thumbnail_url: null,
      thumbnail_width: t.size?.[0] ?? null,
      thumbnail_height: t.size?.[1] ?? null,
      faith_tags: [],
      created_at: "2026-01-01T00:00:00Z",
    }];
  });
}

/**
 * Official TikTok embed player URL. TikTok's own play, progress and sound controls stay on.
 * `autoplay=1` only works together with `muted=1`: phones block videos that try to start with sound
 * (TikTok then reports AUTOPLAY_ERROR and waits for a tap). Same parameters as Mux's tiktok-video-element.
 */
export function tiktokPlayerUrl(tiktokId: string): string {
  const params = new URLSearchParams({
    autoplay: "1",
    muted: "1",
    loop: "1",
    controls: "1",
    progress_bar: "1",
    play_button: "1",
    volume_control: "1",
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requestTikTokRefresh(id: string) {
  if (!UUID.test(id) || refreshed.has(id)) return; // starter videos aren't database rows
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
