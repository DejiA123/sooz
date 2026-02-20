import { createClient } from "@supabase/supabase-js";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { execSync, spawn } from "child_process";
import * as dns from "dns";
import { promisify } from "util";

const resolve4 = promisify(dns.resolve4);
import youtubedl from "yt-dlp-exec";
import http from "http";
import net from "net";

const PROXY_PORT = 3001;
const CUSTOM_DNS = '8.8.8.8';

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
    console.log(`  Path: ${process.env.PATH}`);

    // Check for node (required for n-challenge)
    try {
        const nodePath = execSync("which node || where node", { encoding: "utf8" }).trim();
        const nodeVer = execSync("node -v", { encoding: "utf8" }).trim();
        console.log(`  ✅ Node: ${nodePath} (${nodeVer})`);

        // Detailed check: can we actually spawn node?
        const canSpawn = execSync("node -e \"console.log('spawn_ok')\"", { encoding: "utf8" }).trim();
        console.log(`  ✅ Node Spawn: ${canSpawn}`);
    } catch (e: any) {
        console.error("  ❌ Node: Not found in PATH. n-challenge solving will fail.");
    }

    // Check yt-dlp's view of the world
    try {
        const ytVersion = execSync("yt-dlp --version", { encoding: "utf8" }).trim();
        console.log(`  📊 yt-dlp version: ${ytVersion}`);

        // Let's see if python can find node (this is what yt-dlp uses internally via shutil.which)
        const pyNode = execSync("python3 -c \"import shutil; print(shutil.which('node') or 'not found')\"", { encoding: "utf8" }).trim();
        console.log(`  📊 Python sees node at: ${pyNode}`);

        // Verify yt-dlp actually detects JS runtimes — critical for n-challenge solving
        try {
            const jsCheck = execSync(
                `yt-dlp --list-extractors 2>&1 | head -1; python3 -c "import yt_dlp.jsinterp.jsinterp as ji; print('JSInterp OK')" 2>/dev/null || echo 'JSInterp not found'`,
                { encoding: "utf8", shell: '/bin/sh' }
            ).trim();
            console.log(`  📊 JSInterp: ${jsCheck}`);
        } catch (e) { /* non-critical */ }
    } catch (e: any) {
        console.error("  ❌ yt-dlp: Failed to get version info");
    }

    const hosts = [
        "google.com",
        "youtube.com",
        "youtube.com.", // Trailing dot bypass
        "www.youtube.com",
        "m.youtube.com",
        "youtu.be",
        "huggingface.co",
        "xhqpojnmcibkaydidnex.supabase.co"
    ];
    for (const host of hosts) {
        try {
            const start = Date.now();
            execSync(`getent hosts ${host}`, { stdio: "pipe" });
            console.log(`  ✅ DNS: ${host} resolved in ${Date.now() - start}ms`);
        } catch (e: any) {
            console.error(`  ❌ DNS: ${host} failed to resolve`);
        }
    }

    // Try custom DNS resolver (bypass provider)
    console.log(`📡 Testing Custom DNS (${CUSTOM_DNS})...`);
    try {
        const resolver = new dns.Resolver();
        resolver.setServers([CUSTOM_DNS]);
        const resolveAsync = promisify(resolver.resolve4.bind(resolver));
        const ips = await resolveAsync('www.youtube.com');
        console.log(`  ✅ Custom DNS: www.youtube.com -> ${ips[0]}`);
        return ips[0];
    } catch (e: any) {
        console.error(`  ❌ Custom DNS: Failed to resolve youtube.com via ${CUSTOM_DNS}: ${e.message}`);
        return null;
    }
}

/**
 * Creates a local HTTP proxy that uses a custom DNS resolver.
 * This bypasses broken system DNS in environments like Hugging Face.
 */
function startLocalDnsProxy() {
    const resolver = new dns.Resolver();
    resolver.setServers([CUSTOM_DNS]);
    const resolve4Async = promisify(resolver.resolve4.bind(resolver));

    const server = http.createServer((req, res) => {
        res.writeHead(405);
        res.end("Method not allowed. Use CONNECT for SSL tunneling.");
    });

    server.on('connect', async (req, clientSocket, head) => {
        const url = req.url || "";
        const [host, port] = url.split(':');
        const targetPort = parseInt(port || '443');

        try {
            // Resolve host via custom DNS
            let targetIp = host;
            if (!net.isIP(host)) {
                try {
                    const ips = await resolve4Async(host);
                    targetIp = ips[0];
                    // console.log(`[Proxy] Resolved ${host} -> ${targetIp}`);
                } catch (err: any) {
                    console.error(`[Proxy] DNS Error for ${host}: ${err.message}`);
                    clientSocket.end();
                    return;
                }
            }

            const serverSocket = net.connect(targetPort, targetIp, () => {
                // console.log(`[Proxy] Connected to ${host} (${targetIp}):${targetPort}`);
                clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
                serverSocket.write(head);
                serverSocket.pipe(clientSocket);
                clientSocket.pipe(serverSocket);
            });

            serverSocket.on('error', (err) => {
                if (host.includes('youtube') || host.includes('googlevideo') || host.includes('youtu.be')) {
                    console.error(`[Proxy] Target Connection Error for ${host}: ${err.message}`);
                }
                clientSocket.end();
            });

            clientSocket.on('error', (err) => {
                // console.error(`[Proxy] Client Connection Error: ${err.message}`);
                serverSocket.end();
            });

        } catch (e: any) {
            console.error(`[Proxy] CONNECT error: ${e.message}`);
            clientSocket.end();
        }
    });

    server.listen(PROXY_PORT, '127.0.0.1', () => {
        console.log(`📡 Local DNS Proxy started on http://127.0.0.1:${PROXY_PORT} (DNS: ${CUSTOM_DNS})`);
    });

    return server;
}

async function downloadVideo(videoId: string, hasFfmpeg: boolean): Promise<string> {
    const outputTemplate = `temp_${videoId}.%(ext)s`;
    // Use youtu.be short link because diagnostics show youtube.com is blocked via DNS on HF
    const url = `https://youtu.be/${videoId}`;

    // Format selection
    const format = hasFfmpeg
        ? "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]"
        : "best[height<=720][ext=mp4]/best";

    const cookieFile = "cookies.txt";
    const currentDir = process.cwd();
    const hasCookies = fs.existsSync(cookieFile);

    console.log(`📂 Current directory: ${currentDir}`);
    // console.log(`📁 Files in directory: ${fs.readdirSync('.').join(', ')}`);

    if (hasCookies) {
        console.log(`🍪 Using cookies from ${path.resolve(cookieFile)}`);
    } else {
        console.warn(`⚠️ No cookies.txt found in ${path.resolve(cookieFile)}. Files present: ${fs.readdirSync('.').filter(f => !f.startsWith('.')).join(', ')}`);
    }

    if (hasCookies) {
        try {
            const stats = fs.statSync(cookieFile);
            console.log(`📊 cookies.txt size: ${stats.size} bytes`);
        } catch (e) {
            console.error(`❌ Could not get stats for cookies.txt: ${e}`);
        }
    }

    const systemYtDlp = "/usr/local/bin/yt-dlp";
    const ytDlpPath = fs.existsSync(systemYtDlp) ? systemYtDlp : "yt-dlp";

    const poToken = getEnv("YOUTUBE_PO_TOKEN");
    const visitorData = getEnv("YOUTUBE_VISITOR_DATA");

    if (!poToken) {
        console.warn("⚠️ YOUTUBE_PO_TOKEN is MISSING. Cloud downloads will likely fail without it.");
    }

    // Download stages — ordered by reliability.
    // IMPORTANT: Do NOT use skip=hls,dash. When n-challenge fails, YouTube falls back to
    // HLS/DASH formats. Skipping those leaves only thumbnail images, causing the
    // "Only images are available" error. Let yt-dlp pick from whatever is available.
    const stages = [
        {
            // TV client doesn't require n-challenge solving at all — most reliable
            name: "Stage 1: TV Client (No n-challenge needed)",
            clients: "tv",
            useCookies: true,
            extraArgs: [] as string[],
            format: hasFfmpeg ? "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" : "best[ext=mp4]/best"
        },
        {
            // Web+TV hybrid — uses Node.js for n-challenge if available
            name: "Stage 2: Web/TV Hybrid",
            clients: "web,tv",
            useCookies: true,
            extraArgs: [] as string[],
            format: hasFfmpeg ? "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" : "best[ext=mp4]/best"
        },
        {
            // Broad fallback — try all non-cookie clients plus mweb, accept any format
            name: "Stage 3: Broad Fallback (all clients)",
            clients: "tv,mweb,web",
            useCookies: true,
            extraArgs: ["--compat-options", "no-youtube-unavailable-videos"],
            format: "b" // 'b' = best pre-merged, suppresses the -f best warning
        }
    ];

    for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        console.log(`\n🔄 [Download Stage ${i + 1}] ${stage.name}`);

        // Build extractor args. Note: NO skip=hls,dash — that strips valid formats.
        let extractorArgs = `youtube:player-client=${stage.clients};js_runtime=node`;

        if (poToken) {
            // Apply PO_TOKEN to ALL clients in the current stage
            const stageClients = stage.clients.split(",");
            const poMappings = stageClients.map(c => {
                if (poToken.includes('.')) return poToken; // Already prefixed (e.g. tv.gvs+TOKEN)
                return `${c.trim()}.gvs+${poToken}`;
            }).join(",");
            extractorArgs += `;po_token=${poMappings}`;
        }
        if (visitorData) {
            extractorArgs += `;visitor_data=${visitorData}`;
        }

        const args = [
            url,
            "--format", stage.format,
            "--output", outputTemplate,
            "--no-playlist",
            "--force-ipv4",
            "--js-runtimes", "node:/usr/local/bin/node",   // Node must be explicitly enabled for EJS
            "--remote-components", "ejs:github",            // Download EJS solver scripts if not bundled
            "--proxy", `http://127.0.0.1:${PROXY_PORT}`,
            ...(stage.useCookies && hasCookies ? ["--cookies", cookieFile] : []),
            "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "--extractor-args", extractorArgs,
            "--no-check-certificates",
            "--geo-bypass",
            "--sleep-requests", "1",
            // Using yt-dlp's built-in downloader (no aria2c) because aria2c's 16 parallel
            // connections through the HTTP CONNECT proxy cause ECONNRESET on googlevideo.com
            "--concurrent-fragments", "1",
            "--no-part",
            ...stage.extraArgs,
            "--verbose"
        ];

        try {
            const localFile = await new Promise<string>((resolve, reject) => {
                const proc = spawn(ytDlpPath, args, { env: process.env });
                let errorOutput = "";

                proc.stdout.on("data", (data: any) => {
                    const line = data.toString().trim();
                    if (line.includes("[download]")) process.stdout.write(`\r${line}`);
                });

                proc.stderr.on("data", (data: any) => {
                    errorOutput += data.toString();
                });

                proc.on("close", (code: number) => {
                    process.stdout.write("\n");
                    if (code === 0) {
                        const files = fs.readdirSync(".").filter(f => f.startsWith(`temp_${videoId}.`));
                        if (files.length === 0) reject(new Error("File not found"));
                        else resolve(files[0]);
                    } else {
                        console.error(`\n❌ yt-dlp failed (Stage ${i + 1}):`);
                        console.error(errorOutput);
                        reject(new Error(`Exit ${code}`));
                    }
                });
            });

            return localFile;
        } catch (e: any) {
            console.warn(`⚠️ Stage ${i + 1} failed: ${e.message}`);
            if (i === stages.length - 1) throw new Error("All download stages failed");
            console.log("⏭️  Trying next stage...");
        }
    }
    throw new Error("Download failed");
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

    // Ensure yt-dlp uses node for reliable JS challenges (QuickJS is broken on HF)
    process.env.YT_DLP_JS_RUNTIME = "node";

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
    startLocalDnsProxy();

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
