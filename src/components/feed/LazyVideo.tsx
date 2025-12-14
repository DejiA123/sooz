import { useRef, useState, useEffect } from "react";
import { Play, Volume2, VolumeX } from "lucide-react";
import { useInView } from "react-intersection-observer";
import { useVideoStore } from "@/store/useVideoStore";

interface LazyVideoProps {
    src: string;
    id: string;
    onClick?: () => void;
}

export const LazyVideo = ({ src, id, onClick }: LazyVideoProps) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(true);

    const { activeVideoId, setActiveVideo } = useVideoStore();

    // Simple visibility check - play when 50% visible
    const { ref, inView } = useInView({
        threshold: 0.5,
        triggerOnce: false,
    });

    // Claim active spot when in view
    useEffect(() => {
        if (inView) {
            setActiveVideo(id);
        }
    }, [inView, id, setActiveVideo]);

    // Play/pause based on active state
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        if (activeVideoId === id) {
            video.muted = true; // Always muted for autoplay
            video.play()
                .then(() => setIsPlaying(true))
                .catch(() => setIsPlaying(false));
        } else {
            video.pause();
            setIsPlaying(false);
        }
    }, [activeVideoId, id]);

    // Manual play on click (for mobile where autoplay fails)
    const handlePlayClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        const video = videoRef.current;
        if (!video) return;

        if (isPlaying) {
            // If already playing, open the onClick modal
            onClick?.();
        } else {
            // If not playing, try to play manually
            video.muted = true;
            video.play()
                .then(() => {
                    setIsPlaying(true);
                    setActiveVideo(id);
                })
                .catch((err) => {
                    console.error("Manual play failed:", err);
                    // If even manual play fails, open modal as fallback
                    onClick?.();
                });
        }
    };

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        const video = videoRef.current;
        if (!video) return;

        const newMuted = !isMuted;
        setIsMuted(newMuted);
        video.muted = newMuted;
    };

    return (
        <div
            ref={ref}
            className="w-full relative group cursor-pointer bg-black rounded-lg overflow-hidden"
            onClick={handlePlayClick}
        >
            {/* Video element */}
            <video
                ref={videoRef}
                src={src}
                className="w-full aspect-[4/5] object-cover"
                loop
                muted
                playsInline
                preload="auto"
            />

            {/* Play button - show when not playing */}
            {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="bg-white/20 backdrop-blur-sm rounded-full p-4">
                        <Play className="w-10 h-10 text-white fill-white" />
                    </div>
                </div>
            )}

            {/* Mute toggle */}
            <button
                onClick={toggleMute}
                className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm p-2 rounded-full z-20"
            >
                {isMuted ? (
                    <VolumeX className="w-4 h-4 text-white" />
                ) : (
                    <Volume2 className="w-4 h-4 text-white" />
                )}
            </button>

            {/* Gradient */}
            <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
        </div>
    );
};
