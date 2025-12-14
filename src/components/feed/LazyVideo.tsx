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

    // Play/pause based on active state - with retry logic
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        if (activeVideoId === id && inView) {
            // Force muted for autoplay to work on mobile
            video.muted = true;

            // Try to play with retry
            const attemptPlay = () => {
                video.play()
                    .then(() => setIsPlaying(true))
                    .catch(() => {
                        // Retry after a short delay
                        setTimeout(() => {
                            video.play()
                                .then(() => setIsPlaying(true))
                                .catch(() => setIsPlaying(false));
                        }, 100);
                    });
            };

            attemptPlay();
        } else {
            video.pause();
            setIsPlaying(false);
        }
    }, [activeVideoId, id, inView]);

    // Handle click - try to play if not playing
    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        const video = videoRef.current;
        if (!video) return;

        if (!isPlaying) {
            video.muted = true;
            video.play()
                .then(() => {
                    setIsPlaying(true);
                    setActiveVideo(id);
                })
                .catch(() => {
                    onClick?.();
                });
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
            onClick={handleClick}
        >
            <video
                ref={videoRef}
                src={src}
                className="w-full aspect-[4/5] object-cover"
                loop
                muted
                playsInline
                autoPlay
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
