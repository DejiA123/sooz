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

        // Fetch extra details (duration, views) in batches of 50
        const detailsMap = new Map();
        for (let i = 0; i < videoIds.length; i += 50) {
            const batch = videoIds.slice(i, i + 50);
            const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${batch.join(',')}&key=${youtubeApiKey}`;
            const detailsResponse = await fetch(detailsUrl);
            const detailsData = await detailsResponse.json();
            for (const d of (detailsData.items || [])) {
                detailsMap.set(d.id, d);
            }
        }

        console.log(`📡 Processing ${items.length} videos...`);
        let syncedCount = 0;

        for (const item of items) {
            const videoId = item.snippet.resourceId.videoId;
            const snippet = item.snippet;
            const detail = detailsMap.get(videoId) as any;

            const videoData = {
                youtube_id: videoId,
                title: snippet.title,
                description: snippet.description,
                thumbnail_url: snippet.thumbnails.high?.url || snippet.thumbnails.default?.url,
                duration: detail?.contentDetails?.duration ? parseISO8601Duration(detail.contentDetails.duration) : null,
                view_count: detail?.statistics?.viewCount ? parseInt(detail.statistics.viewCount) : 0,
                category: categorizeVideo(snippet.title),
                published_at: snippet.publishedAt,
                updated_at: new Date().toISOString(),
            };

            const { error } = await supabase
                .from('video_archive')
                .upsert(videoData, { onConflict: 'youtube_id' });

            if (error) {
                console.error(`Error upserting ${videoId}:`, error.message);
            } else {
                syncedCount++;
            }
        }

        return new Response(JSON.stringify({
            message: "Sync complete",
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
