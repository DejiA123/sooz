import { useEffect, useRef } from 'react';
import { useVideoStore } from '@/store/useVideoStore';
import { useVideoCache } from '@/store/useVideoCache';
import { useNetworkSpeed } from './useNetworkSpeed';

interface Post {
    id: string;
    media_url: string | null;
    media_type: string | null;
}

// Use requestIdleCallback with fallback for browsers that don't support it (Safari/iOS)
const requestIdleCallback = window.requestIdleCallback || ((cb: () => void) => setTimeout(cb, 1));
const cancelIdleCallback = window.cancelIdleCallback || ((id: number) => clearTimeout(id));

// Partial video size for quick start playback - TikTok style
const PARTIAL_VIDEO_SIZE = 1024 * 1024; // 1MB for instant start

export const useVideoPreloader = (posts: Post[]) => {
    const activeVideoId = useVideoStore((state) => state.activeVideoId);
    const { cachedUrls, setCachedUrl, revokeBlobUrl, cleanupOldCache } = useVideoCache();
    const { preloadCount, shouldReduceQuality } = useNetworkSpeed();
    const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
    const preloadedIdsRef = useRef<Set<string>>(new Set());
    const idleCallbacksRef = useRef<number[]>([]);

    useEffect(() => {
        if (!activeVideoId || posts.length === 0) return;

        // Find current index
        const currentIndex = posts.findIndex(p => p.id === activeVideoId);
        if (currentIndex === -1) return;

        // Get videos to preload based on network speed (3-8 videos ahead)
        const postsToPreload = posts.slice(currentIndex + 1, currentIndex + 1 + preloadCount)
            .filter(p => p.media_type === 'video' && p.media_url);

        // AGGRESSIVE cleanup: Only keep 5 videos behind current position for memory
        const keepBehindCount = 5;
        const farBehindPosts = posts.slice(0, Math.max(0, currentIndex - keepBehindCount));
        farBehindPosts.forEach(post => {
            if (post.media_url && cachedUrls[post.media_url]) {
                console.log(`🧹 Cleaning up old video cache: ${post.id}`);
                revokeBlobUrl(post.media_url);
                preloadedIdsRef.current.delete(post.id);
            }
        });

        // Cancel any pending preloads for videos that are now too far away
        const currentPreloadIds = new Set(postsToPreload.map(p => p.id));
        abortControllersRef.current.forEach((controller, id) => {
            if (!currentPreloadIds.has(id)) {
                controller.abort();
                preloadedIdsRef.current.delete(id);
                abortControllersRef.current.delete(id);
            }
        });

        // Preload videos using idle callback for non-blocking operation
        postsToPreload.forEach((post, index) => {
            if (!post.media_url) return;

            // Skip if already cached or currently preloading
            if (cachedUrls[post.media_url] || preloadedIdsRef.current.has(post.id)) return;

            // Mark as being preloaded
            preloadedIdsRef.current.add(post.id);

            // Stagger preloads with minimal delay (50ms apart for smooth loading)
            const delay = index * 50;

            const idleId = requestIdleCallback(() => {
                setTimeout(async () => {
                    // Double-check if still needed
                    if (cachedUrls[post.media_url!]) {
                        preloadedIdsRef.current.delete(post.id);
                        return;
                    }

                    // Create abort controller for this request
                    const abortController = new AbortController();
                    abortControllersRef.current.set(post.id, abortController);

                    try {
                        console.log(`⚡ Preloading video [${index + 1}/${preloadCount}]: ${post.id}`);

                        // For slow connections or when reducing quality, fetch partial video
                        // This gives instant playback start while rest loads in background
                        const fetchOptions: RequestInit = {
                            signal: abortController.signal,
                            headers: {
                                'Cache-Control': 'max-age=31536000',
                            },
                        };

                        // Try range request for partial loading (iOS Safari compatible)
                        if (shouldReduceQuality) {
                            fetchOptions.headers = {
                                ...fetchOptions.headers,
                                'Range': `bytes=0-${PARTIAL_VIDEO_SIZE}`,
                            };
                        }

                        const response = await fetch(post.media_url!, fetchOptions);

                        if (!response.ok && response.status !== 206) {
                            throw new Error(`HTTP ${response.status}`);
                        }

                        const blob = await response.blob();
                        const blobUrl = URL.createObjectURL(blob);

                        setCachedUrl(post.media_url!, blobUrl, blob.size);
                        console.log(`✅ Cached video: ${post.id} (${(blob.size / 1024 / 1024).toFixed(2)}MB)`);
                    } catch (error: unknown) {
                        const err = error as Error;
                        if (err.name === 'AbortError') {
                            console.log(`⏹️ Preload aborted: ${post.id}`);
                        } else {
                            console.error(`❌ Failed to preload video ${post.id}:`, error);
                        }
                        preloadedIdsRef.current.delete(post.id);
                    } finally {
                        abortControllersRef.current.delete(post.id);
                    }
                }, delay);
            }) as number;

            idleCallbacksRef.current.push(idleId);
        });

        // Cleanup function: abort ongoing preloads if activeVideoId changes
        return () => {
            abortControllersRef.current.forEach((controller, id) => {
                controller.abort();
                preloadedIdsRef.current.delete(id);
            });
            abortControllersRef.current.clear();

            // Cancel pending idle callbacks
            idleCallbacksRef.current.forEach(id => cancelIdleCallback(id));
            idleCallbacksRef.current = [];
        };
    }, [activeVideoId, posts, cachedUrls, setCachedUrl, revokeBlobUrl, preloadCount, shouldReduceQuality]);

    // Periodic cleanup of very old cache entries (every 2 minutes)
    useEffect(() => {
        const interval = setInterval(() => {
            cleanupOldCache();
        }, 120000); // 2 minutes

        return () => clearInterval(interval);
    }, [cleanupOldCache]);
};
