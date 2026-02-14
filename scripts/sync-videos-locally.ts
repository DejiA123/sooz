import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { execSync } from "child_process";
import youtubedl from "yt-dlp-exec";

// Configure dotenv
dotenv.config();

// --- Configuration ---
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY; // Prefer service role key for writes
const R2_ENDPOINT = process.env.VITE_R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.VITE_R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.VITE_R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = "media"; // Hardcoded corresponding to bucket setup
const R2_PUBLIC_URL_BASE = "https://pub-e59dafe72724404d8ae7af425d1dfbdc.r2.dev";

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
});

async function checkFfmpeg() {
    try {
        execSync("ffmpeg -version", { stdio: "ignore" });
        return true;
    } catch (e) {
        return false;
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
            // Add other flags if needed
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
    const fileContent = fs.readFileSync(filePath);
    const ext = path.extname(filePath).replace(".", "");
    const key = `videos/${videoId}.mp4`; // Always store as mp4 structure if possible

    // Sanitize title for filename
    const safeTitle = title.replace(/[^a-z0-9]/gi, "_").substring(0, 50);
    const filename = `${safeTitle}.mp4`;

    console.log(`☁️ Uploading ${filePath} to R2 as ${key}...`);

    await s3Client.send(new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: fileContent,
        ContentType: "video/mp4",
        ContentDisposition: `attachment; filename="${filename}"`,
    }));

    return `${R2_PUBLIC_URL_BASE}/${key}`;
}

async function main() {
    console.log("🚀 Starting local video sync...");

    const hasFfmpeg = await checkFfmpeg();
    if (!hasFfmpeg) console.warn("⚠️ ffmpeg not found. Quality might be limited to 720p/360p single files.");

    // Fetch pending videos
    // Only fetching 1 at a time to keep it simple and stable
    const { data: videos, error } = await supabase
        .from("video_archive")
        .select("id, youtube_id, title")
        .is("r2_video_url", null)
        .order("published_at", { ascending: false })
        .limit(10);

    if (error) {
        console.error("❌ Database error:", error.message);
        process.exit(1);
    }

    if (videos.length === 0) {
        console.log("✅ No pending videos found.");
        process.exit(0);
    }

    console.log(`📋 Found ${videos.length} pending videos.`);

    for (const video of videos) {
        console.log(`\n🎬 Processing: ${video.title} (${video.youtube_id})`);
        let localFile = "";

        try {
            localFile = await downloadVideo(video.youtube_id, hasFfmpeg);
            console.log(`✅ Downloaded to ${localFile}`);

            const r2Url = await uploadToR2(localFile, video.youtube_id, video.title);
            console.log(`✅ Uploaded to ${r2Url}`);

            // Update DB
            const { error: updateError } = await supabase
                .from("video_archive")
                .update({ r2_video_url: r2Url })
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
}

main();
