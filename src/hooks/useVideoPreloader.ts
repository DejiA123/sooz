import { useEffect, useRef } from 'react';
import { useVideoStore } from '@/store/useVideoStore';
import { useVideoCache } from '@/store/useVideoCache';
import { useNetworkSpeed } from './useNetworkSpeed';

interface Post {
    id: string;
    media_url: string | null;
    media_type: string | null;
}

// Use requestIdleCallback with fallback for browsers that don't support it
const requestIdleCallback = window.requestIdleCallback || ((cb: () => void) => setTimeout(cb, 1));

export const useVideoPreloader = (posts: Post[]) => {
    const activeVideoId = useVideoStore((state) => state.activeVideoId);
    const { cachedUrls, setCachedUrl, revokeBlobUrl, cleanupOldCache } = useVideoCache();
    const { preloadCount } = useNetworkSpeed();
    const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
    const preloadedIdsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!activeVideoId || posts.length === 0) return;

        // Find current index
        const currentIndex = posts.findIndex(p => p.id === activeVideoId);
        if (currentIndex === -1) return;

        // Get videos to preload based on network speed (1-5 videos)
        const postsToPreload = posts.slice(currentIndex + 1, currentIndex + 1 + preloadCount)
            .filter(p => p.media_type === 'video' && p.media_url);

        // Cleanup videos that are far behind current position (memory management)
        const farBehindPosts = posts.slice(Math.max(0, currentIndex - 10), currentIndex - 2);
        farBehindPosts.forEach(post => {
            if (post.media_url && cachedUrls[post.media_url]) {
                console.log(`🧹 Cleaning up old video cache: ${post.id}`);
                revokeBlobUrl(post.media_url);
                preloadedIdsRef.current.delete(post.id);
            }
        });

        // Preload videos using idle callback for non-blocking operation
        postsToPreload.forEach((post, index) => {
            if (!post.media_url) return;

            // Skip if already cached or currently preloading
            if (cachedUrls[post.media_url] || preloadedIdsRef.current.has(post.id)) return;

            // Mark as being preloaded
            preloadedIdsRef.current.add(post.id);

            // Use idle callback with priority (lower index = higher priority)
            const delay = index * 100; // Stagger preloads slightly

            requestIdleCallback(() => {
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

                        const response = await fetch(post.media_url!, {
                            signal: abortController.signal,
                            // Add cache headers for better performance
                            headers: {
                                'Cache-Control': 'max-age=31536000',
                            },
                        });

                        if (!response.ok) throw new Error(`HTTP ${response.status}`);

                        const blob = await response.blob();
                        const blobUrl = URL.createObjectURL(blob);

                        setCachedUrl(post.media_url!, blobUrl);
                        console.log(`✅ Cached video: ${post.id} (${(blob.size / 1024 / 1024).toFixed(2)}MB)`);
                    } catch (error: any) {
                        if (error.name === 'AbortError') {
                            console.log(`⏹️ Preload aborted: ${post.id}`);
                        } else {
                            console.error(`❌ Failed to preload video ${post.id}:`, error);
                        }
                        preloadedIdsRef.current.delete(post.id);
                    } finally {
                        abortControllersRef.current.delete(post.id);
                    }
                }, delay);
            });
        });

        // Cleanup function: abort ongoing preloads if activeVideoId changes
        return () => {
            abortControllersRef.current.forEach((controller, id) => {
                controller.abort();
                preloadedIdsRef.current.delete(id);
            });
            abortControllersRef.current.clear();
        };
    }, [activeVideoId, posts, cachedUrls, setCachedUrl, revokeBlobUrl, preloadCount]);

    // Periodic cleanup of very old cache entries (every 2 minutes)
    useEffect(() => {
        const interval = setInterval(() => {
            cleanupOldCache();
        }, 120000); // 2 minutes

        return () => clearInterval(interval);
    }, [cleanupOldCache]);
};
