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

    useEffect(() => {
        if (isYouTube(src)) {
            setIsHls(false);
            return;
        }

        const hlsUrl = src;
        setIsHls(true);

        if (Hls.isSupported() && videoRef.current) {
            const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
            });

            hls.loadSource(hlsUrl);
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
            videoRef.current.src = hlsUrl;
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
