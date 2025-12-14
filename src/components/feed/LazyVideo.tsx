import { useRef, useState, useEffect, useCallback } from "react";
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

    const activeVideoId = useVideoStore((state) => state.activeVideoId);
    const setActiveVideo = useVideoStore((state) => state.setActiveVideo);
    const isActive = activeVideoId === id;

    const { ref, inView } = useInView({
        threshold: 0.5,
        triggerOnce: false,
    });

    // Force play function
    const forcePlay = useCallback(async () => {
        const video = videoRef.current;
        if (!video) return false;

        video.muted = true;
        try {
            await video.play();
            setIsPlaying(true);
            return true;
        } catch {
            setIsPlaying(false);
            return false;
        }
    }, []);

    // When scrolling into view, claim active spot
    useEffect(() => {
        if (inView) {
            setActiveVideo(id);
        }
    }, [inView, id]); // Removed setActiveVideo from deps - it's stable from zustand

    // Play when active, pause when not
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        if (isActive) {
            forcePlay();
        } else {
            video.pause();
            setIsPlaying(false);
        }
    }, [isActive, forcePlay]);

    // Handle tap
    const handleTap = async (e: React.MouseEvent) => {
        e.stopPropagation();

        if (!isPlaying) {
            setActiveVideo(id);
            await forcePlay();
        } else {
            onClick?.();
        }
    };

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        const video = videoRef.current;
        if (video) {
            video.muted = !video.muted;
            setIsMuted(video.muted);
        }
    };

    return (
        <div
            ref={ref}
            className="w-full relative group cursor-pointer bg-black rounded-lg overflow-hidden"
            onClick={handleTap}
        >
            <video
                ref={videoRef}
                src={src}
                className="w-full aspect-[4/5] object-cover"
                loop
                muted
                playsInline
                preload="auto"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
            />

            {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="bg-white/20 backdrop-blur-sm rounded-full p-4">
                        <Play className="w-10 h-10 text-white fill-white" />
                    </div>
                </div>
            )}

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

            <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
        </div>
    );
};
