
import { useState, useEffect, useRef } from "react";
import { X, Heart, Send } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface StoryViewerProps {
    initialUserIndex: number;
    stories: any[]; // Grouped stories
    onClose: () => void;
}

export const StoryViewer = ({ initialUserIndex, stories, onClose }: StoryViewerProps) => {
    const [currentUserIndex, setCurrentUserIndex] = useState(initialUserIndex);
    const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Guard against index out of bounds
    const currentUser = stories[currentUserIndex];
    const invalidState = !currentUser || !currentUser.stories || currentUser.stories.length === 0 || currentUserIndex >= stories.length;

    useEffect(() => {
        if (invalidState) {
            onClose();
        }
    }, [invalidState, onClose]);

    if (invalidState) return null;

    const currentStory = currentUser.stories[currentStoryIndex];
    const isVideo = currentStory.media_type === 'video';

    useEffect(() => {
        setCurrentStoryIndex(0);
        setProgress(0);
    }, [currentUserIndex]);

    // Reset progress when story changes
    useEffect(() => {
        setProgress(0);
    }, [currentStoryIndex]);

    // Handle Image Timer
    useEffect(() => {
        if (isPaused || isVideo) return;

        const interval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) {
                    handleNext();
                    return 0;
                }
                return prev + 1; // 50ms * 100 steps = 5s duration
            });
        }, 50);

        return () => clearInterval(interval);
    }, [currentUserIndex, currentStoryIndex, isPaused, isVideo]);

    // Handle Video Pause/Play on Interaction
    useEffect(() => {
        if (!videoRef.current) return;

        if (isPaused) {
            videoRef.current.pause();
        } else {
            // Promise handling to avoid race conditions with load state
            videoRef.current.play().catch(() => {/* Ignore autoplay errors */ });
        }
    }, [isPaused]);

    const handleNext = () => {
        if (currentStoryIndex < currentUser.stories.length - 1) {
            // Next story for this user
            setCurrentStoryIndex(prev => prev + 1);
        } else if (currentUserIndex < stories.length - 1) {
            // Next user
            setCurrentUserIndex(prev => prev + 1);
        } else {
            // Done
            onClose();
        }
    };

    const handlePrev = () => {
        if (currentStoryIndex > 0) {
            setCurrentStoryIndex(prev => prev - 1);
        } else if (currentUserIndex > 0) {
            setCurrentUserIndex(prev => prev - 1);
        }
    };

    const handleVideoProgress = () => {
        if (videoRef.current && !isPaused) {
            const duration = videoRef.current.duration;
            const currentTime = videoRef.current.currentTime;
            if (duration > 0) {
                setProgress((currentTime / duration) * 100);
            }
        }
    };

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={currentUser.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                className="fixed inset-0 z-50 bg-black flex items-center justify-center"
            >
                {/* Background Blur */}
                <div
                    className="absolute inset-0 bg-cover bg-center blur-3xl opacity-30 scale-125 transition-all duration-500"
                    style={{ backgroundImage: `url(${currentStory.media_url})` }}
                />

                <div className="relative w-full h-full md:w-[400px] md:h-[85vh] md:rounded-3xl overflow-hidden bg-zinc-900 shadow-2xl">
                    {/* Progress Bars */}
                    <div className="absolute top-3 left-3 right-3 z-30 flex gap-1.5 h-1">
                        {currentUser.stories.map((_: any, idx: number) => (
                            <div key={idx} className="flex-1 bg-white/20 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-white transition-all duration-100 ease-linear"
                                    style={{
                                        width: idx < currentStoryIndex ? '100%' :
                                            idx === currentStoryIndex ? `${progress}%` : '0%'
                                    }}
                                />
                            </div>
                        ))}
                    </div>

                    {/* Header */}
                    <div className="absolute top-6 left-4 right-4 z-30 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Avatar className="w-9 h-9 border border-white/20 shadow-sm">
                                <AvatarImage src={currentUser.avatar} />
                                <AvatarFallback>{currentUser.username[0]}</AvatarFallback>
                            </Avatar>
                            <span className="text-white font-semibold text-sm drop-shadow-md">
                                {currentUser.username}
                            </span>
                            <span className="text-white/60 text-xs drop-shadow-md">
                                {new Date(currentStory.created_at).getHours()}h
                            </span>
                        </div>
                        <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10 rounded-full h-9 w-9">
                            <X className="w-5 h-5" />
                        </Button>
                    </div>

                    {/* Media Content */}
                    <div
                        className="absolute inset-0 z-0 bg-black flex items-center justify-center"
                        onMouseDown={() => setIsPaused(true)}
                        onMouseUp={() => setIsPaused(false)}
                        onTouchStart={() => setIsPaused(true)}
                        onTouchEnd={() => setIsPaused(false)}
                    >
                        {currentStory.media_type === 'video' ? (
                            <video
                                ref={videoRef}
                                key={currentStory.id} // Re-mount video on change
                                src={currentStory.media_url}
                                autoPlay
                                playsInline
                                className="w-full h-full object-cover"
                                onTimeUpdate={handleVideoProgress}
                                onEnded={handleNext}
                            />
                        ) : (
                            <img
                                src={currentStory.media_url}
                                className="w-full h-full object-cover"
                                alt="story"
                            />
                        )}
                    </div>

                    {/* Tappable Navigation Zones */}
                    <div className="absolute inset-y-0 left-0 w-1/3 z-10" onClick={handlePrev} />
                    <div className="absolute inset-y-0 right-0 w-1/3 z-10" onClick={handleNext} />

                    {/* Footer Interactions */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 pt-16 z-20 bg-gradient-to-t from-black/80 to-transparent">
                        <div className="flex items-center gap-3">
                            <Input
                                placeholder="Send message..."
                                className="flex-1 bg-transparent border-white/30 text-white placeholder:text-white/60 rounded-full h-11 focus-visible:ring-0 focus-visible:border-white/60"
                            />
                            <Button size="icon" variant="ghost" className="text-white hover:bg-white/10 h-11 w-11 rounded-full">
                                <Heart className="w-6 h-6" />
                            </Button>
                            <Button size="icon" variant="ghost" className="text-white hover:bg-white/10 h-11 w-11 rounded-full">
                                <Send className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};
