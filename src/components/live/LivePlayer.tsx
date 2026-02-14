import { useRef, useState } from "react";
import ReactPlayer from 'react-player';
import { Loader2, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

interface LivePlayerProps {
    src: string;
    poster?: string;
    className?: string;
    autoPlay?: boolean;
}

export const LivePlayer = ({ src, poster, className, autoPlay = true }: LivePlayerProps) => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    return (
        <div className={cn("relative w-full aspect-video bg-black rounded-xl overflow-hidden group", className)}>
            <ReactPlayer
                url={src}
                width="100%"
                height="100%"
                playing={autoPlay}
                controls
                onReady={() => setIsLoading(false)}
                onError={() => setError("Stream unavailable")}
                config={{
                    youtube: {
                        playerVars: { showinfo: 1 }
                    }
                }}
            />

            {/* Loading Overlay */}
            {isLoading && !error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10 pointer-events-none">
                    <Loader2 className="w-10 h-10 text-white animate-spin" />
                </div>
            )}

            {/* Error Overlay */}
            {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 text-white pointer-events-none">
                    <Radio className="w-10 h-10 text-red-500 mb-2 opacity-50" />
                    <p className="text-sm font-medium">{error}</p>
                </div>
            )}

            {/* Live Indicator (Optional, YouTube has its own) */}
            {!isLoading && !error && (
                <div className="absolute top-4 left-4 px-2 py-1 bg-red-600 rounded-md flex items-center gap-1.5 shadow-lg animate-pulse z-20 pointer-events-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-white block" />
                    <span className="text-[10px] font-bold text-white tracking-wider uppercase">LIVE</span>
                </div>
            )}
        </div>
    );
};
