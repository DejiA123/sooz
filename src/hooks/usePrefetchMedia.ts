import { useEffect, useRef } from 'react';
import { useVideoCache } from '@/store/useVideoCache';
import { useImageCache } from '@/store/useImageCache';

interface MediaItem {
    url: string;
    type: 'video' | 'image';
}

// Use requestIdleCallback with fallback for Safari/iOS
const requestIdleCallback = window.requestIdleCallback || ((cb: () => void) => setTimeout(cb, 1));
const cancelIdleCallback = window.cancelIdleCallback || ((id: number) => clearTimeout(id));

/**
 * Hook for aggressive page-level media prefetching.
 * Automatically starts prefetching media items when data is loaded,
 * for TikTok/Instagram-level instant loading.
 */
export const usePrefetchMedia = (items: MediaItem[], options?: {
    maxPrefetch?: number;
    delayBetweenItems?: number;
}) => {
    const { setCachedUrl: setVideoCached, getCachedUrl: getVideoCached } = useVideoCache();
    const { preloadImage, getCachedUrl: getImageCached } = useImageCache();

    const prefetchedRef = useRef<Set<string>>(new Set());
    const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
    const idleCallbacksRef = useRef<number[]>([]);

    const maxPrefetch = options?.maxPrefetch ?? 10;
    const delayBetweenItems = options?.delayBetweenItems ?? 50;

    useEffect(() => {
        if (items.length === 0) return;

        // Get items to prefetch (first N items that aren't already cached)
        const itemsToPrefetch = items
            .slice(0, maxPrefetch)
            .filter(item => {
                if (prefetchedRef.current.has(item.url)) return false;
                if (item.type === 'video' && getVideoCached(item.url)) return false;
                if (item.type === 'image' && getImageCached(item.url)) return false;
                return true;
            });

        // Prefetch using idle callbacks (non-blocking)
        itemsToPrefetch.forEach((item, index) => {
            prefetchedRef.current.add(item.url);

            const delay = index * delayBetweenItems;

            const idleId = requestIdleCallback(() => {
                setTimeout(async () => {
                    if (item.type === 'image') {
                        // Use the image cache preload method
                        await preloadImage(item.url);
                    } else if (item.type === 'video') {
                        // Prefetch video
                        const abortController = new AbortController();
                        abortControllersRef.current.set(item.url, abortController);

                        try {
                            const response = await fetch(item.url, {
                                signal: abortController.signal,
                                headers: {
                                    'Cache-Control': 'max-age=31536000',
                                },
                            });

                            if (!response.ok) throw new Error(`HTTP ${response.status}`);

                            const blob = await response.blob();
                            const blobUrl = URL.createObjectURL(blob);
                            setVideoCached(item.url, blobUrl, blob.size);
                            console.log(`🚀 Prefetched video: ${item.url.substring(0, 50)}...`);
                        } catch (error: unknown) {
                            const err = error as Error;
                            if (err.name !== 'AbortError') {
                                console.error(`Failed to prefetch video:`, error);
                            }
                            prefetchedRef.current.delete(item.url);
                        } finally {
                            abortControllersRef.current.delete(item.url);
                        }
                    }
                }, delay);
            }) as number;

            idleCallbacksRef.current.push(idleId);
        });

        // Cleanup function
        return () => {
            abortControllersRef.current.forEach(controller => controller.abort());
            abortControllersRef.current.clear();
            idleCallbacksRef.current.forEach(id => cancelIdleCallback(id));
            idleCallbacksRef.current = [];
        };
    }, [items, maxPrefetch, delayBetweenItems, setVideoCached, getVideoCached, preloadImage, getImageCached]);
};
