import { useRef, useState, useEffect } from "react";
import { Play, Volume2, VolumeX, Loader2 } from "lucide-react";
import { useInView } from "react-intersection-observer";
import { useVideoStore } from "@/store/useVideoStore";
import { useVideoCache } from "@/store/useVideoCache";
import { useAutoplayUnlock } from "@/hooks/useAutoplayUnlock";

interface LazyVideoProps {
    src: string;
    id: string;
    onClick?: (currentTime: number) => void;
    startTime?: number;
}

export const LazyVideo = ({ src, id, onClick, startTime = 0 }: LazyVideoProps) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isBuffering, setIsBuffering] = useState(false);
    const [hasAttemptedPlay, setHasAttemptedPlay] = useState(false);
    const { unlock } = useAutoplayUnlock();

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

                    video.muted = isGlobalMuted; // Use global mute preference
                    video.play()
                        .then(() => setIsPlaying(true))
                        .catch((e) => {
                            console.log("Optimistic play failed, will retry in useEffect", e);
                        });
                }
            } else {
                // Stop playing if scrolled out of view
                const currentActiveId = useVideoStore.getState().activeVideoId;
                if (currentActiveId === id) {
                    setActiveVideo(null);
                }
            }
        }
    });

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
    }, [isActive, isGlobalMuted]); // Re-run if global mute changes? No, only on active change. But we handle mute sync in other effect.

    // Handle click
    const handleTap = (e: React.MouseEvent) => {
        e.stopPropagation();

        // Unlock autoplay on first interaction
        unlock();

        if (!isPlaying) {
            setActiveVideo(id);
            const video = videoRef.current;
            if (video) {
                // On explicit interaction to play, we usually want sound if previously unmuted,
                // or if it was the FIRST interaction, maybe unmute?
                // User said: "after the user unmutes the first video, let the other videos be automatically unmuted"
                // Tapping to play usually doesn't imply unmute unless it's a specific "Tap to unmute" overlay.
                // But for TikTok style, tapping pauses/plays. 
                // Let's keep tap as play/pause. Use the mute button for unmute.
                // UNLESS the prompt implies tap should unmute? "unmute the first video with their volume button"
                // Let's stick to explicit mute button for unmuting to be safe, or just ensure global state is respected.

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

    const getCachedUrl = useVideoCache((state) => state.getCachedUrl);
    const setCachedUrl = useVideoCache((state) => state.setCachedUrl);
    const cachedSrc = getCachedUrl(src);
    const [localSrc, setLocalSrc] = useState<string>(cachedSrc || src);

    // Aggressive Preloading
    useEffect(() => {
        if (cachedSrc) {
            setLocalSrc(cachedSrc);
            return;
        }

        let isMounted = true;
        const controller = new AbortController();

        const preloadVideo = async () => {
            try {
                const response = await fetch(src, { signal: controller.signal });
                const blob = await response.blob();
                if (isMounted) {
                    const blobUrl = URL.createObjectURL(blob);
                    setCachedUrl(src, blobUrl);
                    setLocalSrc(blobUrl);
                }
            } catch (error) {
                // Silently fail preloading and fallback to stream
                console.log("Preload failed", error);
            }
        };

        // Only preload if we are within valid range (simple logic: usually eager load)
        // Or just let it load.
        preloadVideo();

        return () => {
            isMounted = false;
            controller.abort();
        };
    }, [src, cachedSrc, setCachedUrl]);

    return (
        <div
            ref={ref}
            className="w-full relative cursor-pointer bg-black overflow-hidden"
            onClick={handleTap}
        >
            <video
                ref={videoRef}
                src={localSrc}
                className="w-full aspect-[9/16] object-contain"
                loop
                muted={isGlobalMuted}
                playsInline
                autoPlay={isActive}
                preload="auto"
                onWaiting={() => setIsBuffering(true)}
                onPlaying={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                // @ts-ignore - for older iOS support
                webkit-playsinline="true"
            />

            {/* Removed buffering spinner as per user request */}

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
                className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm p-2 rounded-full z-20"
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
