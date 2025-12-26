import { useRef, useState, useEffect } from "react";
import { Play, Volume2, VolumeX, Loader2 } from "lucide-react";
import { useInView } from "react-intersection-observer";
import { useVideoStore } from "@/store/useVideoStore";
import { useVideoCache } from "@/store/useVideoCache";

interface LazyVideoProps {
    src: string;
    id: string;
    onClick?: (currentTime: number) => void;
    startTime?: number;
}

export const LazyVideo = ({ src, id, onClick, startTime = 0 }: LazyVideoProps) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [isBuffering, setIsBuffering] = useState(false);

    const activeVideoId = useVideoStore((state) => state.activeVideoId);
    const setActiveVideo = useVideoStore((state) => state.setActiveVideo);
    const isActive = activeVideoId === id;

    const { ref } = useInView({
        threshold: 0.6, // Higher threshold ensures video is mostly visible (better for mobile)
        triggerOnce: false,
        onChange: (inView) => {
            if (inView) {
                // 1. Immediate Global State Update
                setActiveVideo(id);

                // 2. Optimistic Immediate Play (Don't wait for React render cycle)
                const video = videoRef.current;
                if (video) {
                    // Smart seek if start time provided
                    if (startTime > 0 && Math.abs(video.currentTime - startTime) > 0.5) {
                        video.currentTime = startTime;
                    }

                    video.muted = true; // Essential for mobile
                    video.play()
                        .then(() => setIsPlaying(true))
                        .catch((e) => {
                            console.log("Optimistic play failed, will retry in useEffect", e);
                        });
                }
            }
        }
    });

    // Robust Playback Logic with Sound Priority
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        if (isActive) {
            const playVideo = async () => {
                try {
                    // Always start MUTED for reliable mobile autoplay
                    if (video.paused) {
                        video.muted = true;
                        setIsMuted(true);
                        await video.play();
                        setIsPlaying(true);
                    }
                } catch (error) {
                    console.log("Autoplay failed", error);
                    setIsPlaying(false);
                }
            };

            playVideo();
        } else {
            video.pause();
            setIsPlaying(false);
        }
    }, [isActive]);

    // Handle click
    const handleTap = (e: React.MouseEvent) => {
        e.stopPropagation();

        if (!isPlaying) {
            setActiveVideo(id);
            const video = videoRef.current;
            if (video) {
                // On explicit interaction, ALWAYS enable sound
                video.muted = false;
                setIsMuted(false);
                video.play()
                    .then(() => setIsPlaying(true))
                    .catch(() => { });
            }
        } else {
            if (onClick) {
                onClick(videoRef.current?.currentTime || 0);
            } else {
                // If no handler provided (e.g. desktop), toggle pause by clearing active video
                setActiveVideo(null);
            }
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

    const getCachedUrl = useVideoCache((state) => state.getCachedUrl);
    const cachedSrc = getCachedUrl(src);
    const finalSrc = cachedSrc || src;

    return (
        <div
            ref={ref}
            className="w-full relative cursor-pointer bg-black overflow-hidden"
            onClick={handleTap}
        >
            <video
                ref={videoRef}
                src={finalSrc}
                className="w-full aspect-[9/16] object-contain"
                loop
                muted={isMuted} // Controlled by state now
                playsInline
                autoPlay={isActive}
                preload="auto"
                onWaiting={() => setIsBuffering(true)}
                onPlaying={() => setIsBuffering(false)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                // @ts-ignore - for older iOS support
                webkit-playsinline="true"
            />

            {/* Buffering spinner */}
            {isBuffering && isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                    <Loader2 className="w-10 h-10 text-white/80 animate-spin drop-shadow-lg" />
                </div>
            )}

            {/* Play button */}
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
