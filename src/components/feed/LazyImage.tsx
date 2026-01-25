import { useState, useRef, useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import { useImageCache } from '@/store/useImageCache';
import { AlertTriangle, Image as ImageIcon } from 'lucide-react';

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
    const [hasError, setHasError] = useState(false);
    const [currentSrc, setCurrentSrc] = useState<string | undefined>(undefined);
    const imgRef = useRef<HTMLImageElement>(null);

    // Get cached URL if available for instant loading
    const { getCachedUrl, preloadImage } = useImageCache();
    const cachedSrc = getCachedUrl(src);

    // AGGRESSIVE intersection observer for lazy loading - TikTok style
    const { ref: containerRef, inView } = useInView({
        rootMargin: '2000px 0px', // Start loading when 2000px away (was 800px)
        threshold: 0,
        triggerOnce: true,
    });

    // Preload observer - even further ahead for caching
    const { ref: preloadRef, inView: inPreloadView } = useInView({
        rootMargin: '3000px 0px', // Start caching when 3000px away
        threshold: 0,
        triggerOnce: true,
    });

    // Merge refs
    const setRefs = (node: HTMLDivElement | null) => {
        containerRef(node);
        preloadRef(node);
    };

    // Start caching when far from viewport
    useEffect(() => {
        if (inPreloadView && !cachedSrc) {
            preloadImage(src);
        }
    }, [inPreloadView, src, cachedSrc, preloadImage]);

    // Start loading when in view or priority
    useEffect(() => {
        if ((inView || priority) && !isLoading && !isLoaded && !hasError) {
            setIsLoading(true);
            // Use cached URL if available, otherwise use original
            setCurrentSrc(cachedSrc || src);
        }
    }, [inView, priority, src, isLoading, isLoaded, cachedSrc, hasError]);

    // Update src if cached URL becomes available while loading
    useEffect(() => {
        if (cachedSrc && isLoading && !isLoaded) {
            setCurrentSrc(cachedSrc);
        }
    }, [cachedSrc, isLoading, isLoaded]);

    const handleLoad = () => {
        setIsLoaded(true);
        setIsLoading(false);
        onLoad?.();
    };

    const handleError = () => {
        setIsLoading(false);
        setHasError(true);
        console.error(`Failed to load image: ${src}`);
    };

    return (
        <div
            ref={setRefs}
            className={`relative overflow-hidden bg-muted ${className}`}
            style={{ aspectRatio: '1/1' }}
        >
            {/* Error State */}
            {hasError && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground/50">
                    <ImageIcon className="w-8 h-8 opacity-50" />
                </div>
            )}

            {/* Blur placeholder while loading */}
            {!isLoaded && !hasError && (
                <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-muted animate-pulse" />
            )}

            {/* Actual image */}
            {currentSrc && !hasError && (
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
                    // @ts-ignore - fetchpriority is valid but not in React types
                    fetchpriority={priority ? 'high' : 'auto'}
                />
            )}
        </div>
    );
};
