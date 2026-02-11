
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// ── Configuration ──────────────────────────────────────────
const YOUTUBE_CHANNEL_ID = "UC35azCG6jqVkR2G8aH91v4A";
const YOUTUBE_API_KEY = process.env.VITE_YOUTUBE_API_KEY;

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Need service role for writing

const R2_ENDPOINT = process.env.VITE_R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.VITE_R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.VITE_R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.VITE_R2_BUCKET_NAME || 'media';
const R2_PUBLIC_URL = process.env.VITE_PUBLIC_R2_URL;

const REQUIRED_VARS = [
    { name: 'VITE_YOUTUBE_API_KEY', val: YOUTUBE_API_KEY },
    { name: 'VITE_SUPABASE_URL', val: SUPABASE_URL },
    { name: 'SUPABASE_SERVICE_ROLE_KEY', val: SUPABASE_SERVICE_ROLE_KEY },
    { name: 'VITE_R2_ENDPOINT', val: R2_ENDPOINT },
    { name: 'VITE_R2_ACCESS_KEY_ID', val: R2_ACCESS_KEY_ID },
    { name: 'VITE_R2_SECRET_ACCESS_KEY', val: R2_SECRET_ACCESS_KEY }
];

const missing = REQUIRED_VARS.filter(v => !v.val);
if (missing.length > 0) {
    console.error("❌ Missing environment variables:");
    missing.forEach(v => console.error(`   - ${v.name}`));
    console.info("\nPlease check your .env file or GitHub Repository Secrets.");
    process.exit(1);
}

// ── Clients ───────────────────────────────────────────
const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
const s3 = new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT!,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID!,
        secretAccessKey: R2_SECRET_ACCESS_KEY!,
    },
});

const YT_DLP_CMD = process.env.YT_DLP_PATH || 'yt-dlp';

// ── Utilities ──────────────────────────────────────────

async function checkYtDlp() {
    return new Promise((resolve) => {
        const proc = spawn(YT_DLP_CMD, ['--version']);
        proc.on('error', () => resolve(false));
        proc.on('close', (code) => resolve(code === 0));
    });
}

function categorizeVideo(title: string): string {
    const t = title.toLowerCase();
    if (t.includes("worship") || t.includes("praise")) return "worship";
    if (t.includes("bible study") || t.includes("bible class") || t.includes("teaching")) return "teaching";
    if (t.includes("conference") || t.includes("event") || t.includes("special") || t.includes("christmas") || t.includes("new year") || t.includes("easter")) return "event";
    if (t.includes("prayer") || t.includes("vigil")) return "sermon";
    return "sermon"; // default
}

async function fetchLatestVideosFromYouTube() {
    console.log("📺 Fetching latest videos from YouTube API...");
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${YOUTUBE_CHANNEL_ID}&type=video&order=date&maxResults=50&key=${YOUTUBE_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
        throw new Error(`YouTube API Error: ${data.error.message}`);
    }

    return data.items || [];
}

async function getVideoDetails(videoIds: string[]) {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${videoIds.join(',')}&key=${YOUTUBE_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    return data.items || [];
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

async function downloadVideo(videoId: string): Promise<string> {
    const tempPath = path.join(process.cwd(), 'temp_videos');
    if (!fs.existsSync(tempPath)) fs.mkdirSync(tempPath);

    const outputPath = path.join(tempPath, `${videoId}.mp4`);
    const cookiesPath = path.join(tempPath, 'cookies.txt');

    // Handle cookies from environment variable if available
    const cookiesEnv = process.env.YOUTUBE_COOKIES;
    if (cookiesEnv) {
        fs.writeFileSync(cookiesPath, cookiesEnv);
    }

    console.log(`📥 Downloading video ${videoId} (Bypass v1.5 - THE FINAL FRONTIER)...`);

    return new Promise((resolve, reject) => {
        const args = [
            `https://www.youtube.com/watch?v=${videoId}`,
            '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            '-o', outputPath,
            '--no-playlist',
            '--no-part',
            '--extractor-args', 'youtube:player_client=web,ios;player_skip=configs,js;skip=hls,dash',
            '--add-header', 'User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            '--add-header', 'Accept-Language:en-US,en;q=0.9',
            '--force-ipv4',
            '--sleep-requests', '3',
            '--sleep-interval', '5'
        ];

        if (cookiesEnv) {
            args.push('--cookies', cookiesPath);
        }

        console.log(`DEBUG: Executing ${YT_DLP_CMD} ${args.join(' ')}`);

        const proc = spawn(YT_DLP_CMD, args);
        let errorOutput = '';

        proc.stdout.on('data', (data) => {
            const line = data.toString();
            if (line.includes('[download]')) {
                process.stdout.write(`\r${line.trim()}`);
            } else {
                console.log(line.trim());
            }
        });

        proc.stderr.on('data', (data) => {
            const line = data.toString();
            errorOutput += line;
            console.error(`yt-dlp stderr: ${line.trim()}`);
        });

        proc.on('close', (code) => {
            console.log('\n');
            if (code === 0) {
                resolve(outputPath);
            } else {
                // Ignore "Premiere" errors
                if (errorOutput.includes('Premieres in')) {
                    console.log(`⏳ Video ${videoId} is a premiere. Skipping for now...`);
                    resolve(''); // Skip without error
                    return;
                }
                console.error(`❌ yt-dlp failed with code ${code}. Stderr: ${errorOutput}`);
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                reject(new Error(`yt-dlp exited with code ${code}`));
            }
        });
    });
}

async function uploadToR2(filePath: string, videoId: string): Promise<string> {
    console.log(`📤 Uploading ${videoId}.mp4 to R2...`);
    const fileContent = fs.readFileSync(filePath);
    const key = `videos/${videoId}.mp4`;

    await s3.send(new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: fileContent,
        ContentType: 'video/mp4',
    }));

    return `${R2_PUBLIC_URL}/${key}`;
}

// ── Main Sync Loop ─────────────────────────────────────

async function sync() {
    const hasYtDlp = await checkYtDlp();
    if (!hasYtDlp) {
        console.error("❌ yt-dlp not found! Please install it to use this script.");
        console.info("Windows: winget install yt-dlp");
        console.info("Mac: brew install yt-dlp");
        return;
    }

    try {
        const youtubeVideos = await fetchLatestVideosFromYouTube();
        if (youtubeVideos.length === 0) {
            console.log("No videos found on channel.");
            return;
        }

        const videoIds = youtubeVideos.map((v: any) => v.id.videoId);
        const details = await getVideoDetails(videoIds);
        const detailsMap = new Map(details.map((d: any) => [d.id, d]));

        console.log(`🔄 Found ${youtubeVideos.length} videos. Checking database...`);

        for (const ytVideo of youtubeVideos) {
            const videoId = ytVideo.id.videoId;
            const snippet = ytVideo.snippet;

            // Check if exists
            const { data: existing } = await supabase
                .from('video_archive')
                .select('*')
                .eq('youtube_id', videoId)
                .single();

            if (existing?.r2_video_url) {
                console.log(`✅ ${videoId} already synced. Skipping.`);
                continue;
            }

            console.log(`\n🚀 Syncing: ${snippet.title}`);

            try {
                const videoFile = await downloadVideo(videoId);
                const r2Url = await uploadToR2(videoFile, videoId);

                const videoDetail = detailsMap.get(videoId) as any;
                const duration = videoDetail?.contentDetails?.duration ? parseISO8601Duration(videoDetail.contentDetails.duration) : null;
                const views = videoDetail?.statistics?.viewCount ? parseInt(videoDetail.statistics.viewCount) : 0;

                const videoData = {
                    youtube_id: videoId,
                    title: snippet.title,
                    description: snippet.description,
                    thumbnail_url: snippet.thumbnails.high?.url || snippet.thumbnails.default?.url,
                    r2_video_url: r2Url,
                    duration,
                    view_count: views,
                    category: categorizeVideo(snippet.title),
                    published_at: snippet.publishedAt,
                };

                const { error } = await supabase
                    .from('video_archive')
                    .upsert(videoData, { onConflict: 'youtube_id' });

                if (error) throw error;

                console.log(`✨ Successfully synced ${videoId} to R2 and Database!`);

                // Cleanup temp file
                fs.unlinkSync(videoFile);

            } catch (err: any) {
                console.error(`❌ Failed to sync ${videoId}:`, err.message);
            }
        }

        console.log("\n🏁 Sync complete!");

    } catch (err: any) {
        console.error("❌ Sync failed:", err.message);
    }
}

sync();
