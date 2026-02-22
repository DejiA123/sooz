import { useEffect, useRef, useState } from "react";
import { Loader2, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import Hls from "hls.js";

interface LivePlayerProps {
    src: string;
    poster?: string;
    className?: string;
    autoPlay?: boolean;
}

export const LivePlayer = ({ src, poster, className, autoPlay = true }: LivePlayerProps) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isHls, setIsHls] = useState(false);

    const isYouTube = (url: string) => {
        return url.includes("youtu.be") || url.includes("youtube.com");
    };

    // Extract YouTube video ID from various URL formats
    const getYouTubeEmbedUrl = (url: string) => {
        const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|live\/))([\w-]+)/);
        if (match) {
            return `https://www.youtube.com/embed/${match[1]}?autoplay=${autoPlay ? 1 : 0}&rel=0`;
        }
        return url;
    };

    const isInternal = (url: string) => url.includes('live/index.m3u8') || url.includes('.r2.dev');

    useEffect(() => {
        if (isYouTube(src)) {
            setIsHls(false);
            return;
        }

        const isInternalStream = isInternal(src);
        setIsHls(true);

        // Custom MSE Player for internal WebM browser streams
        if (isInternalStream && window.MediaSource) {
            const mediaSource = new MediaSource();
            if (videoRef.current) {
                videoRef.current.src = URL.createObjectURL(mediaSource);
            }

            let sourceBuffer: SourceBuffer | null = null;
            let isFetching = false;
            let lastFetchedChunk: string | null = null;
            let pollInterval: NodeJS.Timeout | null = null;
            let gapJumperInterval: NodeJS.Timeout | null = null;
            const queue: ArrayBuffer[] = [];
            let isAppending = false;
            let isActive = true;

            const fetchM3U8 = async (url: string) => {
                const res = await fetch(`${url}?t=${Date.now()}`);
                if (!res.ok) throw new Error("Stream offline");
                const text = await res.text();
                const lines = text.split('\n');
                let initUrl = null;
                const chunkUrls = [];
                for (const line of lines) {
                    if (line.startsWith('#EXT-X-MAP:URI="')) {
                        const match = line.match(/URI="(.*)"/);
                        if (match) initUrl = match[1];
                    } else if (line && !line.startsWith('#')) {
                        chunkUrls.push(line);
                    }
                }
                return { initUrl, chunkUrls };
            };

            const processQueue = async () => {
                if (isAppending || queue.length === 0 || !sourceBuffer || sourceBuffer.updating || !isActive) return;
                isAppending = true;
                try {
                    const buffer = queue.shift();
                    if (buffer) {
                        sourceBuffer.appendBuffer(buffer);
                        await new Promise(r => {
                            sourceBuffer!.addEventListener('updateend', r, { once: true });
                        });

                        if (videoRef.current && videoRef.current.paused && autoPlay) {
                            videoRef.current.play().catch(e => console.log("Autoplay blocked", e));
                        }

                        // Prevent Out of Memory by clearing ancient buffer segments
                        if (sourceBuffer.buffered.length > 0 && videoRef.current) {
                            const current = videoRef.current.currentTime;
                            const start = sourceBuffer.buffered.start(0);
                            if (current - start > 60 && !sourceBuffer.updating) {
                                try { sourceBuffer.remove(start, current - 30); } catch (e) { }
                            }
                        }
                    }
                } catch (e) {
                    console.error("Append error", e);
                } finally {
                    isAppending = false;
                    processQueue();
                }
            };

            mediaSource.addEventListener('sourceopen', async () => {
                if (!isActive) return;
                try {
                    // We standardise on VP8 for broad compatibility of WebM internal streams
                    const mime = 'video/webm; codecs="vp8, opus"';
                    const fallbackMime = 'video/webm; codecs="vp8"';

                    if (MediaSource.isTypeSupported(mime)) {
                        sourceBuffer = mediaSource.addSourceBuffer(mime);
                    } else if (MediaSource.isTypeSupported(fallbackMime)) {
                        sourceBuffer = mediaSource.addSourceBuffer(fallbackMime);
                    } else {
                        sourceBuffer = mediaSource.addSourceBuffer('video/webm');
                    }

                    // Native WebM timecodes mean we use default 'segments' mode.
                    sourceBuffer.mode = 'segments';

                    const { initUrl, chunkUrls } = await fetchM3U8(src);

                    if (initUrl) {
                        const initRes = await fetch(initUrl);
                        const initBuffer = await initRes.arrayBuffer();
                        queue.push(initBuffer);
                    }

                    for (const chunk of chunkUrls) {
                        if (chunk === initUrl) continue;
                        const res = await fetch(chunk);
                        const buf = await res.arrayBuffer();
                        queue.push(buf);
                        lastFetchedChunk = chunk;
                    }
                    processQueue();
                    setIsLoading(false);
                    setError(null);

                    // Aggressive Gap Jumper to solve the 4-second freeze for late joiners
                    gapJumperInterval = setInterval(() => {
                        if (!videoRef.current || !sourceBuffer || sourceBuffer.buffered.length === 0 || !isActive) return;

                        const current = videoRef.current.currentTime;
                        const ranges = sourceBuffer.buffered;
                        let isInsideAnyRange = false;

                        for (let i = 0; i < ranges.length; i++) {
                            if (current >= ranges.start(i) && current <= ranges.end(i)) {
                                isInsideAnyRange = true;
                                break;
                            }
                        }

                        // If video has fallen into a void (e.g. between the 4s init chunk and 20s live chunk)
                        // Or if the video is stuck behind the very first available live chunk
                        if (!isInsideAnyRange || current < ranges.start(ranges.length - 1)) {
                            // Find the absolute latest chunk and jump slightly past its start
                            const latestStart = ranges.start(ranges.length - 1);
                            const latestEnd = ranges.end(ranges.length - 1);

                            // Only jump if we are significantly behind the newest chunk
                            if (current < latestStart || (latestEnd - current > 10)) {
                                const target = Math.max(latestStart + 0.5, latestEnd - 5);
                                if (Math.abs(videoRef.current.currentTime - target) > 0.5) {
                                    videoRef.current.currentTime = target;
                                    if (videoRef.current.paused && autoPlay) {
                                        videoRef.current.play().catch(e => console.log("Gap Jumper Autoplay block", e));
                                    }
                                }
                            }
                        }
                    }, 500);

                    pollInterval = setInterval(async () => {
                        if (isFetching || !isActive) return;
                        isFetching = true;
                        try {
                            const { chunkUrls: newChunks } = await fetchM3U8(src);
                            const newUrls = [];
                            let foundLast = false;
                            for (const c of newChunks) {
                                if (foundLast) newUrls.push(c);
                                if (c === lastFetchedChunk) foundLast = true;
                            }

                            if (!foundLast && lastFetchedChunk && newChunks.length > 0) {
                                // Stream lagged behind, fast forward to newest chunks
                                newUrls.push(...newChunks.slice(-2));
                            } else if (!lastFetchedChunk) {
                                newUrls.push(...newChunks);
                            }

                            for (const chunk of newUrls) {
                                const res = await fetch(chunk);
                                const buf = await res.arrayBuffer();
                                queue.push(buf);
                                lastFetchedChunk = chunk;
                            }
                            processQueue();
                        } catch (e) {
                            console.error("Poll error", e);
                            // Only set error if it repeatedly fails, maybe stream ended
                        } finally {
                            isFetching = false;
                        }
                    }, 2500); // Poll more aggressively than 4s to prevent starving the buffer

                } catch (e) {
                    console.error("MSE Error", e);
                    setError("Stream unavailable");
                    setIsLoading(false);
                }
            });

            return () => {
                isActive = false;
                if (pollInterval) clearInterval(pollInterval);
                if (gapJumperInterval) clearInterval(gapJumperInterval);
                if (mediaSource.readyState === 'open') {
                    try { mediaSource.endOfStream(); } catch (e) { }
                }
            };
        }

        // Fallback for standard HLS (e.g. externally generated streams)
        if (Hls.isSupported() && videoRef.current) {
            const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
                xhrSetup: (xhr, url) => {
                    if (url.includes('.m3u8')) {
                        const spacer = url.includes('?') ? '&' : '?';
                        xhr.open('GET', `${url}${spacer}t=${Date.now()}`, true);
                    }
                }
            });

            hls.loadSource(src);
            hls.attachMedia(videoRef.current);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                setIsLoading(false);
                if (autoPlay) {
                    videoRef.current?.play().catch(() => {
                        console.log("Autoplay blocked");
                    });
                }
            });

            hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.error("Fatal network error encountered, try to recover");
                            hls.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.error("Fatal media error encountered, try to recover");
                            hls.recoverMediaError();
                            break;
                        default:
                            console.error("Fatal error, cannot recover");
                            hls.destroy();
                            setError("Stream unavailable");
                            break;
                    }
                }
            });

            return () => {
                hls.destroy();
            };
        } else if (videoRef.current?.canPlayType("application/vnd.apple.mpegurl")) {
            // Built-in HLS support (Safari)
            videoRef.current.src = src;
            videoRef.current.addEventListener("loadedmetadata", () => {
                setIsLoading(false);
                if (autoPlay) {
                    videoRef.current?.play();
                }
            });
        }
    }, [src, autoPlay]);

    const embedUrl = getYouTubeEmbedUrl(src);

    return (
        <div className={cn("relative w-full aspect-video bg-black rounded-xl overflow-hidden group shadow-2xl ring-1 ring-white/10", className)}>
            {isYouTube(src) ? (
                <iframe
                    src={embedUrl}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    onLoad={() => setIsLoading(false)}
                    onError={() => setError("Stream unavailable")}
                />
            ) : (
                <video
                    ref={videoRef}
                    poster={poster}
                    className="w-full h-full object-cover"
                    playsInline
                    muted={autoPlay} // Autoplay often requires muted
                    controls
                />
            )}

            {/* Loading Overlay */}
            {isLoading && !error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10 pointer-events-none">
                    <Loader2 className="w-10 h-10 text-white animate-spin" />
                </div>
            )}

            {/* Error Overlay */}
            {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 text-white pointer-events-none text-center p-4">
                    <Radio className="w-10 h-10 text-destructive mb-2 opacity-50" />
                    <p className="text-sm font-medium">{error}</p>
                    <p className="text-xs text-white/50 mt-1">Check your connection or try again later</p>
                </div>
            )}

            {/* Live Indicator */}
            {!isLoading && !error && (
                <div className="absolute top-4 left-4 px-2 py-1 bg-destructive rounded-md flex items-center gap-1.5 shadow-lg animate-pulse z-20 pointer-events-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-white block" />
                    <span className="text-[10px] font-bold text-white tracking-wider uppercase">LIVE</span>
                </div>
            )}
        </div>
    );
};
