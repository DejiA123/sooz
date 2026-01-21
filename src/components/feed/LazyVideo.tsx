import { useRef, useState, useEffect } from "react";
import { Play, Volume2, VolumeX, Loader2 } from "lucide-react";
import { useInView } from "react-intersection-observer";
import { useVideoStore } from "@/store/useVideoStore";
import { useAutoplayUnlock } from "@/hooks/useAutoplayUnlock";
import { useVideoCache } from "@/store/useVideoCache";

interface LazyVideoProps {
    src: string;
    id: string;
    onClick?: (currentTime: number) => void;
    startTime?: number;
    priority?: boolean;
}

export const LazyVideo = ({ src, id, onClick, startTime = 0, priority = false }: LazyVideoProps) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isBuffering, setIsBuffering] = useState(false);
    const [hasAttemptedPlay, setHasAttemptedPlay] = useState(false);
    const { unlock } = useAutoplayUnlock();

    // Get cached URL if available for instant loading
    const { getCachedUrl } = useVideoCache();
    const cachedSrc = getCachedUrl(src) || src;

    // Use global mute state
    const isGlobalMuted = useVideoStore((state) => state.isGlobalMuted);
    const setGlobalMuted = useVideoStore((state) => state.setGlobalMuted);

    // Sync local mute with global state 
    // Effect to apply global mute state to video element whenever it changes or video reference changes
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.muted = isGlobalMuted;
        }
    }, [isGlobalMuted]);

    const activeVideoId = useVideoStore((state) => state.activeVideoId);
    const setActiveVideo = useVideoStore((state) => state.setActiveVideo);
    const isActive = activeVideoId === id;

    // Observer for Active Playing state (viewport threshold)
    const { ref } = useInView({
        threshold: 0.5,
        triggerOnce: false,
        onChange: (inView) => {
            if (inView) {
                setActiveVideo(id);

                const video = videoRef.current;
                if (video) {
                    if (startTime > 0 && Math.abs(video.currentTime - startTime) > 0.5) {
                        video.currentTime = startTime;
                    }
                    video.muted = isGlobalMuted;
                    video.play()
                        .then(() => setIsPlaying(true))
                        .catch(() => { });
                }
            } else {
                const currentActiveId = useVideoStore.getState().activeVideoId;
                if (currentActiveId === id) {
                    setActiveVideo(null);
                }
            }
        }
    });

    // New Observer for Preloading (Approaching viewport)
    // Triggers when video is within 1500px (3-4 posts ahead) - network-aware
    const [shouldPreload, setShouldPreload] = useState(false);
    const { ref: preloadRef } = useInView({
        rootMargin: '1500px 0px', // Increased from 600px for aggressive preloading
        threshold: 0,
        triggerOnce: true,
        onChange: (inView) => {
            if (inView) setShouldPreload(true);
        }
    });

    // Merge refs
    const setRefs = (node: HTMLDivElement | null) => {
        ref(node);
        preloadRef(node);
    };

    // Robust Playback Logic - aggressive autoplay for mobile
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        if (isActive) {
            const playVideo = async () => {
                try {
                    // Start with global mute setting
                    video.muted = isGlobalMuted;

                    // Multiple play attempts for mobile reliability
                    const attemptPlay = async (retries = 3) => {
                        for (let i = 0; i < retries; i++) {
                            try {
                                await video.play();
                                setIsPlaying(true);
                                setHasAttemptedPlay(true);
                                return;
                            } catch (e) {
                                // If unmuted autoplay fails (browser policy), try muting and playing
                                if (!video.muted) {
                                    video.muted = true;
                                    setGlobalMuted(true); // Fallback to global mute
                                    try {
                                        await video.play();
                                        setIsPlaying(true);
                                        setHasAttemptedPlay(true);
                                        return;
                                    } catch (err) {
                                        // Ignore
                                    }
                                }

                                if (i < retries - 1) {
                                    await new Promise(r => setTimeout(r, 100));
                                }
                            }
                        }
                        // If all retries fail, still mark as attempted
                        setHasAttemptedPlay(true);
                    };

                    await attemptPlay();
                } catch (error) {
                    console.log("Autoplay failed", error);
                    setIsPlaying(false);
                    setHasAttemptedPlay(true);
                }
            };

            playVideo();
        } else {
            video.pause();
            setIsPlaying(false);
        }
    }, [isActive, isGlobalMuted, setGlobalMuted]);

    // Handle click
    const handleTap = (e: React.MouseEvent) => {
        e.stopPropagation();

        // Unlock autoplay on first interaction
        unlock();

        if (!isPlaying) {
            setActiveVideo(id);
            const video = videoRef.current;
            if (video) {
                video.muted = isGlobalMuted;
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
            const newMutedState = !video.muted;
            video.muted = newMutedState;
            setGlobalMuted(newMutedState); // Update global state
        }
    };

    return (
        <div
            ref={setRefs}
            className="w-full relative cursor-pointer bg-black overflow-hidden"
            onClick={handleTap}
        >
            <video
                ref={videoRef}
                src={cachedSrc}
                className="w-full aspect-[9/16] object-contain"
                loop
                muted={isGlobalMuted}
                playsInline
                autoPlay={isActive}
                preload={priority || isActive || shouldPreload ? "auto" : "metadata"}
                onWaiting={() => setIsBuffering(true)}
                onPlaying={() => {
                    setIsPlaying(true);
                    setIsBuffering(false);
                }}
                onPlay={() => {
                    setIsPlaying(true);
                    setIsBuffering(false);
                }}
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

            {/* Only show play button if video has attempted to play but failed (rare edge case) */}
            {!isPlaying && hasAttemptedPlay && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20">
                    <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
                        <Play className="w-8 h-8 text-white fill-white" />
                    </div>
                </div>
            )}

            <button
                onClick={toggleMute}
                className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm p-2 rounded-full z-20 touch-manipulation"
            >
                {isGlobalMuted ? (
                    <VolumeX className="w-4 h-4 text-white" />
                ) : (
                    <Volume2 className="w-4 h-4 text-white" />
                )}
            </button>

            <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
        </div>
    );
};
