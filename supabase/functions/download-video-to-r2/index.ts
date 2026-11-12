import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
};

const MAX_DOWNLOAD_ATTEMPTS = 3;

// ── Innertube Client Configs ────────────────────────────────

interface ClientConfig {
    name: string;
    payload: Record<string, any>;
    headers: Record<string, string>;
}

function getClientConfigs(videoId: string): ClientConfig[] {
    return [
        {
            name: "IOS",
            payload: {
                videoId,
                context: {
                    client: {
                        clientName: "IOS",
                        clientVersion: "19.09.3",
                        deviceMake: "Apple",
                        deviceModel: "iPhone14,3",
                        hl: "en",
                        gl: "US",
                        utcOffsetMinutes: 0,
                    },
                },
            },
            headers: {
                "User-Agent": "com.google.ios.youtube/19.09.3 (iPhone14,3; U; CPU iOS 15_6 like Mac OS X)",
                "X-YouTube-Client-Name": "5",
                "X-YouTube-Client-Version": "19.09.3",
            },
        },
        {
            name: "ANDROID",
            payload: {
                videoId,
                context: {
                    client: {
                        clientName: "ANDROID",
                        clientVersion: "19.09.37",
                        androidSdkVersion: 30,
                        hl: "en",
                        gl: "US",
                        utcOffsetMinutes: 0,
                    },
                },
            },
            headers: {
                "User-Agent": "com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip",
                "X-YouTube-Client-Name": "3",
                "X-YouTube-Client-Version": "19.09.37",
            },
        },
        {
            name: "TV_EMBEDDED",
            payload: {
                videoId,
                context: {
                    client: {
                        clientName: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
                        clientVersion: "2.0",
                        hl: "en",
                        gl: "US",
                    },
                    thirdParty: {
                        embedUrl: "https://www.google.com",
                    },
                },
            },
            headers: {
                "User-Agent": "Mozilla/5.0",
            },
        },
    ];
}

async function tryInnertubeClient(
    youtubeId: string,
    config: ClientConfig
): Promise<{ url: string; contentLength: number } | null> {
    try {
        console.log(`🔍 [${config.name}] Trying...`);

        const response = await fetch(
            "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
            {
                method: "POST",
                headers: { "Content-Type": "application/json", ...config.headers },
                body: JSON.stringify(config.payload),
            }
        );

        if (!response.ok) {
            console.warn(`[${config.name}] HTTP ${response.status}`);
            return null;
        }

        const data = await response.json();
        const status = data.playabilityStatus?.status;
        const reason = data.playabilityStatus?.reason || "none";
        console.log(`[${config.name}] Status: ${status} | Reason: ${reason}`);

        if (status !== "OK") return null;

        const combined = data.streamingData?.formats || [];
        const adaptive = data.streamingData?.adaptiveFormats || [];
        console.log(`[${config.name}] Combined: ${combined.length}, Adaptive: ${adaptive.length}`);

        // Log all combined formats for debugging
        for (const f of combined) {
            console.log(`  itag=${f.itag} q=${f.qualityLabel || "?"} url=${!!f.url} cipher=${!!f.signatureCipher}`);
        }

        // Prefer itag 18 (360p) then 22 (720p)
        for (const itag of [18, 22]) {
            const fmt = combined.find((f: any) => f.itag === itag && f.url);
            if (fmt) {
                const size = parseInt(fmt.contentLength || "0");
                console.log(`✅ [${config.name}] Using itag ${itag} (${fmt.qualityLabel}) ${(size / 1024 / 1024).toFixed(1)} MB`);
                return { url: fmt.url, contentLength: size };
            }
        }

        // Any combined with direct URL
        const any = combined.find((f: any) => f.url);
        if (any) {
            const size = parseInt(any.contentLength || "0");
            console.log(`✅ [${config.name}] Fallback itag ${any.itag} (${any.qualityLabel})`);
            return { url: any.url, contentLength: size };
        }

        console.warn(`[${config.name}] No usable direct URL`);
        return null;
    } catch (err: any) {
        console.error(`[${config.name}] Error: ${err.message}`);
        return null;
    }
}

async function getVideoDownloadUrl(youtubeId: string): Promise<{ url: string; contentLength: number } | null> {
    for (const config of getClientConfigs(youtubeId)) {
        const result = await tryInnertubeClient(youtubeId, config);
        if (result) return result;
    }
    console.error(`❌ All clients failed for ${youtubeId}`);
    return null;
}

// ── AWS Signature V4 for R2 Upload ──────────────────────────

async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
    const keyData = key instanceof ArrayBuffer ? new Uint8Array(key) : key;
    const cryptoKey = await crypto.subtle.importKey(
        "raw", keyData.buffer as ArrayBuffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    return await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
}

async function sha256hex(data: Uint8Array | string): Promise<string> {
    const buf = typeof data === "string" ? new TextEncoder().encode(data) : data;
    const hash = await crypto.subtle.digest("SHA-256", buf.buffer as ArrayBuffer);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function uploadToR2(
    videoData: Uint8Array,
    key: string,
    endpoint: string,
    accessKeyId: string,
    secretAccessKey: string,
    bucketName: string,
): Promise<void> {
    const now = new Date();
    const dateStamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const shortDate = dateStamp.substring(0, 8);
    const region = "auto";
    const service = "s3";

    const url = new URL(`${endpoint}/${bucketName}/${key}`);
    const host = url.host;
    const payloadHash = await sha256hex(videoData);

    const canonicalHeaders = `content-type:video/mp4\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${dateStamp}\n`;
    const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";

    const canonicalRequest = ["PUT", `/${bucketName}/${key}`, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
    const credentialScope = `${shortDate}/${region}/${service}/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", dateStamp, credentialScope, await sha256hex(canonicalRequest)].join("\n");

    const kDate = await hmacSha256(new TextEncoder().encode("AWS4" + secretAccessKey), shortDate);
    const kRegion = await hmacSha256(kDate, region);
    const kService = await hmacSha256(kRegion, service);
    const kSigning = await hmacSha256(kService, "aws4_request");

    const sigBuf = await hmacSha256(kSigning, stringToSign);
    const signature = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, "0")).join("");
    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const resp = await fetch(url.toString(), {
        method: "PUT",
        headers: {
            "Content-Type": "video/mp4",
            "Host": host,
            "X-Amz-Content-Sha256": payloadHash,
            "X-Amz-Date": dateStamp,
            "Authorization": authorization,
        },
        body: videoData.buffer as ArrayBuffer,
    });

    if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`R2 upload failed (${resp.status}): ${errText}`);
    }
    console.log(`✅ Uploaded ${key} to R2`);
}

// ── Main Handler ────────────────────────────────────────────

/** Only the scheduled job (service key) or a SOOZ moderator may run this — it spends the YouTube
 *  quota and storage. Everyone else gets 403. */
async function mayRun(req: Request): Promise<boolean> {
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
    if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (!(await mayRun(req))) {
        return new Response(JSON.stringify({ error: "Not allowed" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    try {
        // Check for debug mode
        const body = await req.json().catch(() => ({}));
        if (body.debug) {
            const testId = body.videoId || "tOCMup62HtE";
            const diagnostics: any[] = [];

            for (const config of getClientConfigs(testId)) {
                try {
                    const resp = await fetch(
                        "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
                        {
                            method: "POST",
                            headers: { "Content-Type": "application/json", ...config.headers },
                            body: JSON.stringify(config.payload),
                        }
                    );
                    const data = await resp.json();
                    const combined = data.streamingData?.formats || [];
                    diagnostics.push({
                        client: config.name,
                        httpStatus: resp.status,
                        playability: data.playabilityStatus?.status,
                        reason: data.playabilityStatus?.reason || null,
                        combinedFormats: combined.length,
                        adaptiveFormats: (data.streamingData?.adaptiveFormats || []).length,
                        formats: combined.map((f: any) => ({
                            itag: f.itag,
                            quality: f.qualityLabel,
                            hasUrl: !!f.url,
                            hasCipher: !!f.signatureCipher,
                        })),
                    });
                } catch (e: any) {
                    diagnostics.push({ client: config.name, error: e.message });
                }
            }

            return new Response(JSON.stringify({ diagnostics }, null, 2), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const r2Endpoint = Deno.env.get("R2_ENDPOINT");
        const r2AccessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
        const r2SecretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
        const r2BucketName = Deno.env.get("R2_BUCKET_NAME") || "media";
        const r2PublicUrl = Deno.env.get("R2_PUBLIC_URL");

        if (!r2Endpoint || !r2AccessKeyId || !r2SecretAccessKey || !r2PublicUrl) {
            throw new Error("Missing R2 config: R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_URL");
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Find ONE video without an R2 URL
        const { data: videos, error: fetchError } = await supabase
            .from("video_archive")
            .select("id, youtube_id, title, download_attempts")
            .is("r2_video_url", null)
            .lt("download_attempts", MAX_DOWNLOAD_ATTEMPTS)
            .order("published_at", { ascending: true })
            .limit(1);

        if (fetchError) throw new Error(`DB error: ${fetchError.message}`);

        if (!videos || videos.length === 0) {
            return new Response(JSON.stringify({ message: "No videos pending", status: "idle" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const video = videos[0];
        console.log(`🎬 Processing: "${video.title}" (${video.youtube_id})`);

        // Increment attempts
        await supabase
            .from("video_archive")
            .update({ download_attempts: (video.download_attempts || 0) + 1 })
            .eq("id", video.id);

        // Get download URL
        const dlInfo = await getVideoDownloadUrl(video.youtube_id);

        if (!dlInfo) {
            return new Response(JSON.stringify({
                message: `No download URL found for ${video.youtube_id}`,
                status: "skipped",
                attempts: (video.download_attempts || 0) + 1,
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Skip if > 200 MB
        if (dlInfo.contentLength > 200 * 1024 * 1024) {
            return new Response(JSON.stringify({
                message: `Video too large (${(dlInfo.contentLength / 1024 / 1024).toFixed(0)} MB)`,
                status: "skipped",
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Download the video
        console.log(`📥 Downloading...`);
        const videoResp = await fetch(dlInfo.url);
        if (!videoResp.ok) throw new Error(`Video fetch failed: ${videoResp.status}`);

        const videoData = new Uint8Array(await videoResp.arrayBuffer());
        const sizeMB = (videoData.length / (1024 * 1024)).toFixed(1);
        console.log(`📦 Downloaded ${sizeMB} MB. Uploading to R2...`);

        // Upload to R2
        const r2Key = `videos/${video.youtube_id}.mp4`;
        await uploadToR2(videoData, r2Key, r2Endpoint, r2AccessKeyId, r2SecretAccessKey, r2BucketName);
        const publicUrl = `${r2PublicUrl}/${r2Key}`;

        // Update DB
        await supabase
            .from("video_archive")
            .update({ r2_video_url: publicUrl, updated_at: new Date().toISOString() })
            .eq("id", video.id);

        console.log(`🎉 Done: ${video.title}`);
        return new Response(JSON.stringify({
            message: "Video downloaded and uploaded to R2",
            video: video.title,
            r2_url: publicUrl,
            sizeMB,
            status: "success",
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error: any) {
        console.error("Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
});
