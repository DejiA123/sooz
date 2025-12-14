import { useRef, useState, useEffect } from "react";
import { Play, Volume2, VolumeX, Loader2 } from "lucide-react";
import { useInView } from "react-intersection-observer";

interface LazyVideoProps {
    src: string;
    onClick?: () => void;
}

export const LazyVideo = ({ src, onClick }: LazyVideoProps) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);

    const { ref, inView } = useInView({
        threshold: 0.5,         // Play when 50% visible
        triggerOnce: false,
        rootMargin: "100px",    // Start loading 100px before entering viewport
    });

    // Play/pause based on visibility
    useEffect(() => {
        if (!videoRef.current) return;

        if (inView) {
            const playPromise = videoRef.current.play();
            if (playPromise !== undefined) {
                playPromise
                    .then(() => setIsPlaying(true))
                    .catch(() => {
                        // Autoplay was prevented - show play button
                        setIsPlaying(false);
                    });
            }
        } else {
            videoRef.current.pause();
            setIsPlaying(false);
        }
    }, [inView]);

    const handleVideoClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onClick) {
            onClick();
        }
    };

    return (
        <div
            ref={ref}
            className="w-full relative group cursor-pointer bg-gradient-to-b from-zinc-900 to-black rounded-lg overflow-hidden"
            onClick={handleVideoClick}
        >
            {/* Loading spinner */}
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <Loader2 className="w-8 h-8 text-white/50 animate-spin" />
                </div>
            )}

            {/* Video element */}
            <video
                ref={videoRef}
                src={src}
                className="w-full aspect-[4/5] object-cover"
                muted
                loop
                playsInline
                preload="auto"
                onLoadedData={() => setIsLoading(false)}
                onWaiting={() => setIsLoading(true)}
                onPlaying={() => setIsLoading(false)}
            />

            {/* Play button overlay - shows when paused */}
            {!isPlaying && !isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <div className="bg-white/20 backdrop-blur-sm rounded-full p-4">
                        <Play className="w-10 h-10 text-white fill-white" />
                    </div>
                </div>
            )}

            {/* Video indicator badge */}
            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1">
                <Play className="w-3 h-3 text-white fill-white" />
                <span className="text-white text-xs font-medium">Video</span>
            </div>

            {/* Muted indicator */}
            <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm p-2 rounded-full">
                <VolumeX className="w-4 h-4 text-white/70" />
            </div>

            {/* Gradient overlay for better text readability */}
            <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
        </div>
    );
};
