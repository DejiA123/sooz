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
    const [hasInteracted, setHasInteracted] = useState(false);

    const { activeVideoId, setActiveVideo } = useVideoStore();
    const isActive = activeVideoId === id;

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

    // Play when active, pause when not
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        if (isActive && inView) {
            video.muted = true;
            const playPromise = video.play();
            if (playPromise !== undefined) {
                playPromise
                    .then(() => setIsPlaying(true))
                    .catch(() => setIsPlaying(false));
            }
        } else if (!isActive) {
            video.pause();
            setIsPlaying(false);
        }
    }, [isActive, inView]);

    // Handle tap to play
    const handleTap = (e: React.MouseEvent) => {
        e.stopPropagation();
        const video = videoRef.current;
        if (!video) return;

        setHasInteracted(true);

        if (!isPlaying) {
            video.muted = true;
            video.play()
                .then(() => {
                    setIsPlaying(true);
                    setActiveVideo(id);
                })
                .catch(() => onClick?.());
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
            {/* Key fix: Only the active/in-view video gets autoPlay */}
            <video
                ref={videoRef}
                src={src}
                className="w-full aspect-[4/5] object-cover"
                loop
                muted
                playsInline
                autoPlay={isActive && inView}
                preload="auto"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                webkit-playsinline="true"
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
