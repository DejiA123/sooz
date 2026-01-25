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

        // Preload videos using idle callback - DISABLED for now to ensure strictly one video loads at a time
        // The user reported slow loading connections, so we rely solely on LazyVideo loading the active video.
        /*
        postsToPreload.forEach((post, index) => {
            if (!post.media_url) return;

            // Skip if already cached or currently preloading
            if (cachedUrls[post.media_url] || preloadedIdsRef.current.has(post.id)) return;

            // ... (preloading logic disabled)
        });
        */

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
