import { useRef, useState, useEffect } from "react";
import { Play } from "lucide-react";
import { useInView } from "react-intersection-observer";

interface LazyVideoProps {
    src: string;
    onClick?: () => void;
}

export const LazyVideo = ({ src, onClick }: LazyVideoProps) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const { ref, inView } = useInView({
        threshold: 0.5,
        triggerOnce: false,
    });

    // Play/pause based on visibility
    useEffect(() => {
        if (!videoRef.current) return;

        if (inView) {
            videoRef.current.play().catch(() => {
                // Autoplay was prevented, that's ok
            });
        } else {
            videoRef.current.pause();
        }
    }, [inView]);

    return (
        <div
            ref={ref}
            className="w-full h-full relative group cursor-pointer"
            onClick={onClick}
        >
            <video
                ref={videoRef}
                src={inView ? src : undefined}
                poster={`${src}#t=0.1`} // Use first frame as poster
                className="w-full h-full object-cover"
                muted
                loop
                playsInline
                preload="none"
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-black/30 rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="w-6 h-6 text-white fill-white" />
                </div>
            </div>
            <div className="absolute bottom-3 right-3 bg-black/50 p-1.5 rounded-full">
                <Play className="w-3 h-3 text-white fill-white" />
            </div>
        </div>
    );
};
