import { supabase } from "@/integrations/supabase/client";

export interface VideoItem {
    id: string;
    youtube_id: string;
    title: string;
    description: string | null;
    thumbnail_url: string | null;
    r2_video_url: string | null;
    duration: string | null;
    published_at: string | null;
    view_count: number;
    category: string;
    is_featured: boolean;
    created_at: string;
}

// ── YouTube Channel Config ──────────────────────────────────────────
const YOUTUBE_CHANNEL_ID = "UC35azCG6jqVkR2G8aH91v4A";
const YOUTUBE_CHANNEL_HANDLE = "@thepowerhouseintl";
// YouTube Data API v3 key — set in .env as VITE_YOUTUBE_API_KEY
const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY || "";

// ── Cache for fetched videos ────────────────────────────────────────
let cachedVideos: VideoItem[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 1000 * 60 * 15; // 15 min cache

// ── YouTube Data API Integration ────────────────────────────────────

interface YouTubeSearchItem {
    id: { videoId: string };
    snippet: {
        title: string;
        description: string;
        publishedAt: string;
        thumbnails: {
            high?: { url: string };
            medium?: { url: string };
            default?: { url: string };
        };
        liveBroadcastContent: string;
    };
}

interface YouTubeVideoDetails {
    id: string;
    contentDetails: {
        duration: string; // ISO 8601 e.g. "PT1H23M45S"
    };
    statistics: {
        viewCount: string;
    };
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

function categorizeVideo(title: string): string {
    const t = title.toLowerCase();
    if (t.includes("worship") || t.includes("praise")) return "worship";
    if (t.includes("bible study") || t.includes("bible class") || t.includes("teaching")) return "teaching";
    if (t.includes("conference") || t.includes("event") || t.includes("special") || t.includes("christmas") || t.includes("new year") || t.includes("easter")) return "event";
    if (t.includes("prayer") || t.includes("vigil")) return "sermon";
    return "sermon"; // default
}

async function fetchFromYouTubeAPI(): Promise<VideoItem[]> {
    if (!YOUTUBE_API_KEY) return [];

    try {
        // Step 1: Search for all videos on the channel (max 50 per request, paginated)
        const allItems: YouTubeSearchItem[] = [];
        let nextPageToken = "";

        // Fetch up to 200 videos (4 pages of 50)
        for (let page = 0; page < 4; page++) {
            const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
            searchUrl.searchParams.set("part", "snippet");
            searchUrl.searchParams.set("channelId", YOUTUBE_CHANNEL_ID);
            searchUrl.searchParams.set("type", "video");
            searchUrl.searchParams.set("order", "date");
            searchUrl.searchParams.set("maxResults", "50");
            searchUrl.searchParams.set("key", YOUTUBE_API_KEY);
            if (nextPageToken) searchUrl.searchParams.set("pageToken", nextPageToken);

            const res = await fetch(searchUrl.toString());

            if (!res.ok) {
                const errText = await res.text();
                console.error("YouTube API Search Error:", res.status);
                break;
            }

            const data = await res.json();
            allItems.push(...(data.items || []));
            nextPageToken = data.nextPageToken || "";
            if (!nextPageToken) break;
        }

        if (allItems.length === 0) {
            return [];
        }

        // Step 2: Get video details (duration, view count) in batches of 50
        const videoIds = allItems.map((item) => item.id.videoId);
        const detailsMap = new Map<string, YouTubeVideoDetails>();

        for (let i = 0; i < videoIds.length; i += 50) {
            const batch = videoIds.slice(i, i + 50);
            const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
            detailsUrl.searchParams.set("part", "contentDetails,statistics");
            detailsUrl.searchParams.set("id", batch.join(","));
            detailsUrl.searchParams.set("key", YOUTUBE_API_KEY);

            const res = await fetch(detailsUrl.toString());
            if (res.ok) {
                const data = await res.json();
                for (const item of data.items || []) {
                    detailsMap.set(item.id, item);
                }
            }
        }

        // Step 3: Combine into VideoItem array
        return allItems
            .filter((item) => item.snippet.liveBroadcastContent !== "upcoming")
            .map((item, index) => {
                const details = detailsMap.get(item.id.videoId);
                const thumbnail =
                    item.snippet.thumbnails.high?.url ||
                    item.snippet.thumbnails.medium?.url ||
                    item.snippet.thumbnails.default?.url ||
                    `https://img.youtube.com/vi/${item.id.videoId}/hqdefault.jpg`;

                return {
                    id: item.id.videoId,
                    youtube_id: item.id.videoId,
                    title: item.snippet.title,
                    description: item.snippet.description,
                    thumbnail_url: thumbnail,
                    r2_video_url: null,
                    duration: details ? parseISO8601Duration(details.contentDetails.duration) : null,
                    published_at: item.snippet.publishedAt,
                    view_count: details ? parseInt(details.statistics.viewCount || "0") : 0,
                    category: categorizeVideo(item.snippet.title),
                    is_featured: index < 5, // First 5 most recent = featured
                    created_at: item.snippet.publishedAt,
                };
            });
    } catch (error) {
        console.error("YouTube API error:", error);
        return [];
    }
}

// ── Fallback sample videos ──────────────────────────────────────────
// Used when YouTube API key is not configured
const SAMPLE_VIDEOS: VideoItem[] = [
    {
        id: "1",
        youtube_id: "sample1",
        title: "Sunday Service - Walking in Divine Purpose",
        description: "Join us for a powerful Sunday service as Pastor shares insights on discovering and walking in your divine purpose. Ephesians 3:20.",
        thumbnail_url: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        r2_video_url: null,
        duration: "1:45:30",
        published_at: "2026-02-09T10:00:00Z",
        view_count: 1250,
        category: "sermon",
        is_featured: true,
        created_at: "2026-02-09T10:00:00Z",
    },
    {
        id: "2",
        youtube_id: "sample2",
        title: "Midweek Bible Study - The Power of Faith",
        description: "A deep dive into the scriptures exploring the transformative power of faith in our daily lives.",
        thumbnail_url: "https://img.youtube.com/vi/jNQXAC9IVRw/hqdefault.jpg",
        r2_video_url: null,
        duration: "58:15",
        published_at: "2026-02-07T19:00:00Z",
        view_count: 890,
        category: "teaching",
        is_featured: false,
        created_at: "2026-02-07T19:00:00Z",
    },
    {
        id: "3",
        youtube_id: "sample3",
        title: "Praise & Worship Night - February 2026",
        description: "An evening of powerful praise and worship.",
        thumbnail_url: "https://img.youtube.com/vi/9bZkp7q19f0/hqdefault.jpg",
        r2_video_url: null,
        duration: "2:10:00",
        published_at: "2026-02-05T18:00:00Z",
        view_count: 2100,
        category: "worship",
        is_featured: true,
        created_at: "2026-02-05T18:00:00Z",
    },
    {
        id: "4",
        youtube_id: "sample4",
        title: "Youth Conference 2026 - Session 1",
        description: "The Power House International Youth Conference. Be inspired, be empowered, be transformed.",
        thumbnail_url: "https://img.youtube.com/vi/kJQP7kiw5Fk/hqdefault.jpg",
        r2_video_url: null,
        duration: "1:30:00",
        published_at: "2026-02-03T14:00:00Z",
        view_count: 3400,
        category: "event",
        is_featured: false,
        created_at: "2026-02-03T14:00:00Z",
    },
    {
        id: "5",
        youtube_id: "sample5",
        title: "Sunday Service - Commitment to God's Kingdom",
        description: "Our message and mission: Commitment to God's kingdom and its Advancement. Matthew 6:33.",
        thumbnail_url: "https://img.youtube.com/vi/RgKAFK5djSk/hqdefault.jpg",
        r2_video_url: null,
        duration: "1:55:20",
        published_at: "2026-02-02T10:00:00Z",
        view_count: 1800,
        category: "sermon",
        is_featured: true,
        created_at: "2026-02-02T10:00:00Z",
    },
    {
        id: "6",
        youtube_id: "sample6",
        title: "Prayer Meeting - Breakthrough Prayers",
        description: "Join us for a powerful prayer session.",
        thumbnail_url: "https://img.youtube.com/vi/OPf0YbXqDm0/hqdefault.jpg",
        r2_video_url: null,
        duration: "1:15:45",
        published_at: "2026-01-30T20:00:00Z",
        view_count: 950,
        category: "sermon",
        is_featured: false,
        created_at: "2026-01-30T20:00:00Z",
    },
];

// ── Public API ──────────────────────────────────────────────────────

async function getAllVideos(): Promise<VideoItem[]> {
    // Return cached data if still fresh
    if (cachedVideos && Date.now() - cacheTimestamp < CACHE_TTL) {
        return cachedVideos;
    }

    // 1. Try YouTube API
    const apiVideos = await fetchFromYouTubeAPI();

    // 2. Try Supabase database for R2 links
    let dbVideos: Record<string, string> = {};
    try {
        const { data } = await supabase
            .from("video_archive" as any)
            .select("youtube_id, r2_video_url")
            .not("r2_video_url", "is", null);

        if (data) {
            data.forEach((v: any) => {
                dbVideos[v.youtube_id] = v.r2_video_url;
            });
        }
    } catch (e) {
        console.warn("Could not fetch R2 links from database:", e);
    }

    // 3. Merge or fallback
    if (apiVideos.length > 0) {
        // Enrich API results with R2 links from DB
        const enriched = apiVideos.map(v => ({
            ...v,
            r2_video_url: dbVideos[v.youtube_id] || null
        }));
        cachedVideos = enriched;
        cacheTimestamp = Date.now();
        return enriched;
    }

    // 4. Full DB fallback if API fails
    try {
        const { data, error } = await supabase
            .from("video_archive" as any)
            .select("*")
            .order("published_at", { ascending: false });

        if (!error && data && data.length > 0) {
            const videos = data as unknown as VideoItem[];
            cachedVideos = videos;
            cacheTimestamp = Date.now();
            return videos;
        }
    } catch {
        // table doesn't exist yet
    }

    // Fallback to samples
    cachedVideos = SAMPLE_VIDEOS;
    cacheTimestamp = Date.now();
    return SAMPLE_VIDEOS;
}

export async function fetchVideos(
    category?: string,
    searchQuery?: string
): Promise<VideoItem[]> {
    const allVideos = await getAllVideos();
    let filtered = [...allVideos];

    if (category && category !== "all") {
        filtered = filtered.filter((v) => v.category === category);
    }

    if (searchQuery?.trim()) {
        const q = searchQuery.trim().toLowerCase();
        filtered = filtered.filter(
            (v) =>
                v.title.toLowerCase().includes(q) ||
                v.description?.toLowerCase().includes(q)
        );
    }

    return filtered;
}

export async function fetchFeaturedVideos(): Promise<VideoItem[]> {
    const allVideos = await getAllVideos();
    return allVideos.filter((v) => v.is_featured).slice(0, 5);
}

export function getYouTubeEmbedUrl(youtubeId: string): string {
    return `https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1`;
}

export function getYouTubeWatchUrl(youtubeId: string): string {
    return `https://www.youtube.com/watch?v=${youtubeId}`;
}

export function formatViewCount(count: number): string {
    if (count >= 1000000) return (count / 1000000).toFixed(1) + "M";
    if (count >= 1000) return (count / 1000).toFixed(1) + "K";
    return count.toString();
}

export function formatPublishedDate(dateStr: string | null): string {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
}

export const VIDEO_CATEGORIES = [
    { value: "all", label: "All Videos", emoji: "📺" },
    { value: "sermon", label: "Sermons", emoji: "📖" },
    { value: "worship", label: "Worship", emoji: "🎵" },
    { value: "teaching", label: "Bible Study", emoji: "📚" },
    { value: "event", label: "Events", emoji: "🎉" },
];

export const CHANNEL_ID = YOUTUBE_CHANNEL_ID;
export const CHANNEL_HANDLE = YOUTUBE_CHANNEL_HANDLE;
