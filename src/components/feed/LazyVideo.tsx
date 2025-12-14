import { useRef, useState, useEffect } from "react";
import { Play, Volume2, VolumeX, Loader2 } from "lucide-react";
import { useInView } from "react-intersection-observer";
import { useVideoStore } from "@/store/useVideoStore";

interface LazyVideoProps {
    src: string;
    id: string; // Unique ID for coordination
    onClick?: () => void;
}

export const LazyVideo = ({ src, id, onClick }: LazyVideoProps) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false); // Start with sound allowed, fallback if needed

    // Global store
    const { activeVideoId, setActiveVideo } = useVideoStore();

    const { ref, inView } = useInView({
        threshold: 0.6,         // Play when 60% visible (focused)
        triggerOnce: false,
        rootMargin: "0px",      // Only play when actually in viewport
    });

    // 1. When entering view, claim the active spot
    useEffect(() => {
        if (inView) {
            setActiveVideo(id);
        }
    }, [inView, id, setActiveVideo]);

    // 2. React to global state changes with Smart Autoplay
    useEffect(() => {
        if (!videoRef.current) return;

        if (activeVideoId === id) {
            // Sync mute state
            videoRef.current.muted = isMuted;

            // Attempt playback
            const playPromise = videoRef.current.play();
            if (playPromise !== undefined) {
                playPromise
                    .then(() => setIsPlaying(true))
                    .catch((err) => {
                        console.log("Autoplay blocked (likely mobile), falling back to muted:", err);
                        // Fallback: Mute and retry
                        if (!isMuted) {
                            setIsMuted(true);
                            if (videoRef.current) {
                                videoRef.current.muted = true;
                                videoRef.current.play()
                                    .then(() => setIsPlaying(true))
                                    .catch(() => setIsPlaying(false));
                            }
                        } else {
                            setIsPlaying(false);
                        }
                    });
            }
        } else {
            // Use pause() for immediate stop, load() would reset buffer which we don't want
            videoRef.current.pause();
            setIsPlaying(false);
        }
    }, [activeVideoId, id, isMuted]);

    const handleVideoClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onClick) {
            onClick();
        }
    };

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        const newMuted = !isMuted;
        setIsMuted(newMuted);
        if (videoRef.current) {
            videoRef.current.muted = newMuted;
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
                loop
                playsInline
                preload="auto"
                onLoadedData={() => setIsLoading(false)}
                onWaiting={() => setIsLoading(true)}
                onPlaying={() => setIsLoading(false)}
            />

            {/* Play button overlay - only if NOT playing and NOT loading */}
            {!isPlaying && !isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <div className="bg-white/20 backdrop-blur-sm rounded-full p-4">
                        <Play className="w-10 h-10 text-white fill-white" />
                    </div>
                </div>
            )}

            {/* Mute/Unmute Indicator/Toggle */}
            <button
                onClick={toggleMute}
                className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm p-2 rounded-full hover:bg-black/80 transition-colors z-20"
            >
                {isMuted ? (
                    <VolumeX className="w-4 h-4 text-white/90" />
                ) : (
                    <Volume2 className="w-4 h-4 text-white/90" />
                )}
            </button>

            {/* Gradient overlay for better text readability */}
            <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
        </div>
    );
};
