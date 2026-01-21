import { useState, useRef, useEffect } from 'react';
import { useInView } from 'react-intersection-observer';

interface LazyImageProps {
    src: string;
    alt: string;
    className?: string;
    priority?: boolean;
    onLoad?: () => void;
}

export const LazyImage = ({ src, alt, className = '', priority = false, onLoad }: LazyImageProps) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [currentSrc, setCurrentSrc] = useState<string | undefined>(undefined);
    const imgRef = useRef<HTMLImageElement>(null);

    // Intersection observer for lazy loading
    const { ref: containerRef, inView } = useInView({
        rootMargin: '800px 0px', // Start loading when 800px away
        threshold: 0,
        triggerOnce: true,
    });

    // Start loading when in view or priority
    useEffect(() => {
        if ((inView || priority) && !isLoading && !isLoaded) {
            setIsLoading(true);
            setCurrentSrc(src);
        }
    }, [inView, priority, src, isLoading, isLoaded]);

    const handleLoad = () => {
        setIsLoaded(true);
        setIsLoading(false);
        onLoad?.();
    };

    const handleError = () => {
        setIsLoading(false);
        console.error(`Failed to load image: ${src}`);
    };

    return (
        <div
            ref={containerRef}
            className={`relative overflow-hidden bg-muted ${className}`}
            style={{ aspectRatio: '1/1' }}
        >
            {/* Blur placeholder while loading */}
            {!isLoaded && (
                <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-muted animate-pulse" />
            )}

            {/* Actual image */}
            {currentSrc && (
                <img
                    ref={imgRef}
                    src={currentSrc}
                    alt={alt}
                    className={`w-full h-full object-contain transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'
                        }`}
                    onLoad={handleLoad}
                    onError={handleError}
                    loading={priority ? 'eager' : 'lazy'}
                    decoding="async"
                />
            )}
        </div>
    );
};
