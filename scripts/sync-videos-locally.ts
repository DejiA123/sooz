import { createClient } from "@supabase/supabase-js";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { execSync } from "child_process";
import youtubedl from "yt-dlp-exec";
import http from "http";

// Configure dotenv
dotenv.config();

// --- Configuration ---
// Helper to get and trim env vars, including stripping quotes and trailing slashes
const getEnv = (name: string) => {
    let val = (process.env[name] || "").trim();
    // Aggressively strip any surrounding quotes (single or double)
    val = val.replace(/^["']+/, '').replace(/["']+$/, '');
    val = val.replace(/\/$/, ''); // Strip trailing slash
    return val.trim();
};

let SUPABASE_URL = getEnv("VITE_SUPABASE_URL");
const SUPABASE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("VITE_SUPABASE_SERVICE_ROLE_KEY");
const R2_ENDPOINT = getEnv("VITE_R2_ENDPOINT");
const R2_ACCESS_KEY_ID = getEnv("VITE_R2_ACCESS_KEY_ID");
const R2_SECRET_ACCESS_KEY = getEnv("VITE_R2_SECRET_ACCESS_KEY");
const R2_BUCKET_NAME = "media";
const R2_PUBLIC_URL_BASE = "https://pub-e59dafe72724404d8ae7af425d1dfbdc.r2.dev";

// Ensure URL has protocol
if (SUPABASE_URL && !SUPABASE_URL.startsWith("http")) {
    console.log(`⚠️ Adding missing https:// to Supabase URL`);
    SUPABASE_URL = `https://${SUPABASE_URL}`;
}

// Debug logging (Safe: only shows existence, length, and hex of suspicious chars)
console.log("🛠️ Environment Check:");
console.log(`  Supabase URL: ${SUPABASE_URL ? "✅ Detected" : "❌ Missing"} (${SUPABASE_URL.length} chars)`);
if (SUPABASE_URL) {
    const hex = Buffer.from(SUPABASE_URL).toString('hex').match(/.{1,2}/g)?.join(' ') || "";
    console.log(`  URL Hex: ${hex.substring(hex.length - 12)} (tail)`);
}
console.log(`  Supabase Key: ${SUPABASE_KEY ? "✅ Detected" : "❌ Missing"} (${SUPABASE_KEY.length} chars)`);
console.log(`  R2 Endpoint:  ${R2_ENDPOINT ? "✅ Detected" : "❌ Missing"}`);

// Upload tuning — generous timeouts for large video files
const PART_SIZE = 10 * 1024 * 1024;           // 10 MB per part (smaller for better stability)
const QUEUE_SIZE = 1;                          // 1 concurrent part upload (minimize connection pressure)
const REQUEST_TIMEOUT_MS = 15 * 60 * 1000;     // 15 minutes per HTTP request
const CONNECTION_TIMEOUT_MS = 60 * 1000;       // 60 seconds to establish connection
const SOCKET_TIMEOUT_MS = 15 * 60 * 1000;      // 15 minutes socket idle timeout

if (!SUPABASE_URL || !SUPABASE_KEY || !R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    console.error("❌ Missing environment variables. Please check .env file.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const s3Client = new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
    requestHandler: new NodeHttpHandler({
        requestTimeout: REQUEST_TIMEOUT_MS,
        connectionTimeout: CONNECTION_TIMEOUT_MS,
        socketTimeout: SOCKET_TIMEOUT_MS,
    }),
    maxAttempts: 5,
    forcePathStyle: true, // Required for Cloudflare R2 DNS stability
});

async function checkFfmpeg() {
    try {
        execSync("ffmpeg -version", { stdio: "ignore" });
        return true;
    } catch (e) {
        return false;
    }
}

async function runDiagnostics() {
    console.log("🔍 Running Network Diagnostics...");
    const hosts = ["google.com", "youtube.com", "www.youtube.com", "xhqpojnmcibkaydidnex.supabase.co"];
    for (const host of hosts) {
        try {
            const start = Date.now();
            // Try both getent and ping to see if anything works
            execSync(`getent hosts ${host}`, { stdio: "pipe" });
            console.log(`  ✅ DNS: ${host} resolved in ${Date.now() - start}ms`);
        } catch (e: any) {
            console.error(`  ❌ DNS: ${host} failed to resolve: ${e.message}`);
            // Fallback test with ping
            try {
                execSync(`ping -c 1 -W 2 ${host}`, { stdio: "pipe" });
                console.log(`  ✅ PING: ${host} worked (DNS might be tricky)`);
            } catch (p: any) {
                console.error(`  ❌ PING: ${host} also failed`);
            }
        }
    }
}

async function downloadVideo(videoId: string, hasFfmpeg: boolean): Promise<string> {
    const outputTemplate = `temp_${videoId}.%(ext)s`;
    const url = `https://www.youtube.com/watch?v=${videoId}`;

    // Format selection
    const format = hasFfmpeg
        ? "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]"
        : "best[height<=720][ext=mp4]/best[height<=720]";

    console.log(`📥 Downloading ${videoId}... (ffmpeg: ${hasFfmpeg})`);

    try {
        await youtubedl(url, {
            format: format,
            output: outputTemplate,
            noPlaylist: true,
            forceIpv4: true, // Crucial for cloud environments with broken IPv6
        });

        // Find the downloaded file
        const files = fs.readdirSync(".").filter(f => f.startsWith(`temp_${videoId}.`));
        if (files.length === 0) throw new Error("File not found after download");

        return files[0];
    } catch (e: any) {
        throw new Error(`Download failed: ${e.message}`);
    }
}

async function uploadToR2(filePath: string, videoId: string, title: string): Promise<string> {
    const fileSize = fs.statSync(filePath).size;
    const key = `videos/${videoId}.mp4`;

    // Sanitize title for filename
    const safeTitle = title.replace(/[^a-z0-9]/gi, "_").substring(0, 50);
    const filename = `${safeTitle}.mp4`;
    const sizeMB = (fileSize / (1024 * 1024)).toFixed(1);

    console.log(`☁️ Uploading ${filePath} (${sizeMB} MB) to R2 as ${key}...`);

    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
        attempt++;
        const fileStream = fs.createReadStream(filePath);

        try {
            const upload = new Upload({
                client: s3Client,
                params: {
                    Bucket: R2_BUCKET_NAME,
                    Key: key,
                    Body: fileStream,
                    ContentType: "video/mp4",
                    ContentDisposition: `attachment; filename="${filename}"`,
                },
                partSize: PART_SIZE,
                queueSize: QUEUE_SIZE,
                leavePartsOnError: false,
            });

            upload.on("httpUploadProgress", (progress) => {
                if (progress.loaded && progress.total) {
                    const pct = ((progress.loaded / progress.total) * 100).toFixed(1);
                    const loadedMB = (progress.loaded / (1024 * 1024)).toFixed(1);
                    const totalMB = (progress.total / (1024 * 1024)).toFixed(1);
                    console.log(`   ⬆️  ${loadedMB} / ${totalMB} MB (${pct}%) — part ${progress.part || "?"}`);
                }
            });

            await upload.done();
            return `${R2_PUBLIC_URL_BASE}/${key}`;
        } catch (e: any) {
            console.error(`   ⚠️ Attempt ${attempt} failed: ${e.message}`);
            if (attempt >= maxAttempts) throw e;
            console.log(`   🔄 Retrying in 5 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    throw new Error("Upload failed after maximum retries");
}


const SYNC_POLLING_INTERVAL_MS = process.env.SYNC_POLLING_INTERVAL_MS ? parseInt(process.env.SYNC_POLLING_INTERVAL_MS) : null;
const PORT = process.env.PORT || 7860; // Default for Hugging Face

async function main() {
    console.log(`🚀 Starting ${SYNC_POLLING_INTERVAL_MS ? "Cloud" : "local"} video sync...`);

    // Basic HTTP server to satisfy Cloud platform health checks (like Hugging Face)
    http.createServer((req, res) => {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Sync Runner is Active\n");
    }).listen(PORT, () => {
        console.log(`📡 Health check server listening on port ${PORT}`);
    });

    const hasFfmpeg = await checkFfmpeg();
    if (!hasFfmpeg) console.warn("⚠️ ffmpeg not found. Quality might be limited.");

    await runDiagnostics();

    while (true) {
        // Fetch pending videos
        const { data: videos, error } = await supabase
            .from("video_archive")
            .select("id, youtube_id, title")
            .is("r2_video_url", null)
            .order("published_at", { ascending: false })
            .limit(10);

        if (error) {
            console.error("❌ Database error:", error.message);
            if (!SYNC_POLLING_INTERVAL_MS) process.exit(1);
        } else if (videos && videos.length > 0) {
            console.log(`📋 Found ${videos.length} pending videos.`);

            for (const video of videos) {
                console.log(`\n🎬 Processing: ${video.title} (${video.youtube_id})`);
                let localFile = "";

                try {
                    localFile = await downloadVideo(video.youtube_id, hasFfmpeg);
                    console.log(`✅ Downloaded to ${localFile}`);

                    const r2Url = await uploadToR2(localFile, video.youtube_id, video.title);
                    console.log(`✅ Uploaded to ${r2Url}`);

                    const { error: updateError } = await supabase
                        .from("video_archive")
                        .update({ r2_video_url: r2Url, updated_at: new Date().toISOString() })
                        .eq("id", video.id);

                    if (updateError) throw updateError;
                    console.log(`✅ Database updated!`);

                } catch (e: any) {
                    console.error(`❌ Failed to process ${video.title}:`, e.message);
                } finally {
                    if (localFile && fs.existsSync(localFile)) {
                        fs.unlinkSync(localFile);
                        console.log(`🧹 Cleaned up ${localFile}`);
                    }
                }
            }
        } else {
            console.log("✅ No pending videos found.");
        }

        if (!SYNC_POLLING_INTERVAL_MS) break;

        console.log(`\n💤 Sleeping for ${SYNC_POLLING_INTERVAL_MS / 1000 / 60} minutes...`);
        await new Promise(resolve => setTimeout(resolve, SYNC_POLLING_INTERVAL_MS));
    }
}

main();
