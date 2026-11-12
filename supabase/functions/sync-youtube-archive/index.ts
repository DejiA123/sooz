import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
};

const YOUTUBE_CHANNEL_ID = "UC35azCG6jqVkR2G8aH91v4A";

function categorizeVideo(title: string): string {
    const t = title.toLowerCase();
    if (t.includes("worship") || t.includes("praise")) return "worship";
    if (t.includes("bible study") || t.includes("bible class") || t.includes("teaching")) return "teaching";
    if (t.includes("conference") || t.includes("event") || t.includes("special") || t.includes("christmas") || t.includes("new year") || t.includes("easter")) return "event";
    if (t.includes("prayer") || t.includes("vigil")) return "sermon";
    return "sermon"; // default
}

function parseISO8601Duration(iso: string): string {
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return "";
    const h = match[1] ? parseInt(match[1]) : 0;
    const m = match[2] ? parseInt(match[2]) : 0;
    const s = match[3] ? parseInt(match[3]) : 0;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
}

/** Anyone can refresh the archive (owner's request), but each refresh spends SOOZ's daily YouTube
 *  quota, so one runs at most every COOLDOWN_MIN minutes; in between people just get "up to date".
 *  The scheduled job (service key) and moderators skip the wait. */
const COOLDOWN_MIN = 10;

async function isPrivileged(req: Request): Promise<boolean> {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return false;
    if (token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return true;
    const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/is_moderator`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "", "Content-Type": "application/json" },
        body: "{}",
    });
    return r.ok && (await r.json().catch(() => false)) === true;
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: corsHeaders
        });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const youtubeApiKey = Deno.env.get("YOUTUBE_API_KEY");

        if (!youtubeApiKey) {
            throw new Error("YOUTUBE_API_KEY not configured");
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Refreshed in the last few minutes (every sync stamps updated_at): nothing to do yet.
        if (!(await isPrivileged(req))) {
            const { data: last } = await supabase.from("video_archive").select("updated_at")
                .order("updated_at", { ascending: false }).limit(1).maybeSingle();
            const age = last?.updated_at ? Date.now() - Date.parse(last.updated_at) : Infinity;
            if (age < COOLDOWN_MIN * 60_000) {
                return new Response(JSON.stringify({ message: "The archive is already up to date", synced: 0, upToDate: true }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }
        }

        console.log("📺 Fetching ALL videos from YouTube channel...");
        const uploadsPlaylistId = YOUTUBE_CHANNEL_ID.replace(/^UC/, 'UU');

        // Paginate through ALL uploads
        let allItems: any[] = [];
        let nextPageToken = '';
        
        do {
            const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=50${nextPageToken ? '&pageToken=' + nextPageToken : ''}&key=${youtubeApiKey}`;
            const playlistResponse = await fetch(playlistUrl);
            const playlistData = await playlistResponse.json();

            if (playlistData.error) {
                throw new Error(`YouTube API Error: ${playlistData.error.message}`);
            }

            allItems = allItems.concat(playlistData.items || []);
            nextPageToken = playlistData.nextPageToken || '';
            console.log(`📡 Fetched ${allItems.length} videos so far...`);
        } while (nextPageToken);

        const items = allItems;
        const videoIds = items.map((item: any) => item.snippet.resourceId.videoId);

        if (videoIds.length === 0) {
            return new Response(JSON.stringify({ message: "No videos found" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        // Fetch extra details (duration, views) in batches of 50, eight requests at a time.
        const detailsMap = new Map();
        const idBatches: string[][] = [];
        for (let i = 0; i < videoIds.length; i += 50) idBatches.push(videoIds.slice(i, i + 50));
        for (let i = 0; i < idBatches.length; i += 8) {
            await Promise.all(idBatches.slice(i, i + 8).map(async (batch) => {
                const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${batch.join(',')}&key=${youtubeApiKey}`;
                const detailsData = await (await fetch(detailsUrl)).json().catch(() => ({}));
                for (const d of (detailsData.items || [])) detailsMap.set(d.id, d);
            }));
        }

        console.log(`📡 Processing ${items.length} videos...`);

        // One row per video (a playlist can list a video twice; one batch can't save the same row twice).
        const rows = new Map<string, Record<string, unknown>>();
        const now = new Date().toISOString();
        for (const item of items) {
            const videoId = item.snippet?.resourceId?.videoId;
            const snippet = item.snippet;
            // Private / deleted videos stay in a channel's list with no picture: leave them out.
            if (!videoId || !snippet?.thumbnails || /^(Private|Deleted) video$/.test(snippet.title ?? "")) continue;
            const detail = detailsMap.get(videoId) as any;
            rows.set(videoId, {
                youtube_id: videoId,
                title: snippet.title,
                description: snippet.description,
                thumbnail_url: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || null,
                duration: detail?.contentDetails?.duration ? parseISO8601Duration(detail.contentDetails.duration) : null,
                view_count: detail?.statistics?.viewCount ? parseInt(detail.statistics.viewCount) : 0,
                category: categorizeVideo(snippet.title),
                published_at: snippet.publishedAt,
                updated_at: now,
            });
        }

        // Saved 500 at a time (one at a time took longer than a function may run, so big channels
        // were cut off halfway). Only these columns change; r2_video_url and the rest are kept.
        const all = [...rows.values()];
        let syncedCount = 0;
        for (let i = 0; i < all.length; i += 500) {
            const batch = all.slice(i, i + 500);
            const { error } = await supabase.from("video_archive").upsert(batch, { onConflict: "youtube_id" });
            if (!error) { syncedCount += batch.length; continue; }
            console.error(`Batch ${i / 500 + 1} failed (${error.message}); saving it one by one`);
            for (const row of batch) {
                const { error: rowError } = await supabase.from("video_archive").upsert(row, { onConflict: "youtube_id" });
                if (rowError) console.error(`Error upserting ${row.youtube_id}:`, rowError.message);
                else syncedCount++;
            }
        }

        return new Response(JSON.stringify({
            message: "Archive updated from YouTube",
            processed: items.length,
            synced: syncedCount
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error: any) {
        console.error("Sync error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
});
