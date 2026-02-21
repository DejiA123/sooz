import { create } from 'zustand';

interface ImageCacheEntry {
    blobUrl: string;
    timestamp: number;
    size?: number;
}

interface ImageCacheState {
    // Maps original URL -> Cache Entry with metadata
    cachedUrls: Record<string, ImageCacheEntry>;
    setCachedUrl: (originalUrl: string, blobUrl: string, size?: number) => void;
    getCachedUrl: (originalUrl: string) => string | undefined;
    revokeBlobUrl: (originalUrl: string) => void;
    cleanupOldCache: () => void;
    preloadImage: (url: string) => Promise<void>;
    getTotalCacheSize: () => number;
}

// Generous limits for image caching - images are typically smaller than videos
const MAX_CACHE_AGE_MS = 20 * 60 * 1000; // 20 minutes
const MAX_CACHE_SIZE_MB = 100; // 100MB max cache size for images
const MAX_CACHE_ENTRIES = 100; // Max number of cached images

export const useImageCache = create<ImageCacheState>((set, get) => ({
    cachedUrls: {},

    setCachedUrl: (originalUrl, blobUrl, size) => {
        const state = get();
        const entryCount = Object.keys(state.cachedUrls).length;

        // If we're at max entries, remove oldest
        if (entryCount >= MAX_CACHE_ENTRIES) {
            const oldestUrl = Object.entries(state.cachedUrls)
                .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0]?.[0];
            if (oldestUrl) {
                get().revokeBlobUrl(oldestUrl);
            }
        }

        set((state) => ({
            cachedUrls: {
                ...state.cachedUrls,
                [originalUrl]: {
                    blobUrl,
                    timestamp: Date.now(),
                    size,
                }
            }
        }));
    },

    getCachedUrl: (originalUrl) => {
        const entry = get().cachedUrls[originalUrl];
        if (!entry) return undefined;

        // Check if cache is still valid (not too old)
        const age = Date.now() - entry.timestamp;
        if (age > MAX_CACHE_AGE_MS) {
            return undefined;
        }

        return entry.blobUrl;
    },

    revokeBlobUrl: (originalUrl) => {
        const state = get();
        const entry = state.cachedUrls[originalUrl];

        if (entry) {
            try {
                URL.revokeObjectURL(entry.blobUrl);
            } catch (error) {
                console.error('Failed to revoke image blob URL:', error);
            }

            set({
                cachedUrls: Object.fromEntries(
                    Object.entries(state.cachedUrls).filter(([key]) => key !== originalUrl)
                )
            });
        }
    },

    preloadImage: async (url: string) => {
        const state = get();

        // Skip if already cached
        if (state.cachedUrls[url]) return;

        try {
            const response = await fetch(url, {
                headers: {
                    'Cache-Control': 'max-age=31536000',
                },
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            get().setCachedUrl(url, blobUrl, blob.size);
        } catch (error) {
            console.error(`Failed to preload image:`, error);
        }
    },

    cleanupOldCache: () => {
        const state = get();
        const now = Date.now();
        const entriesToRemove: string[] = [];

        // Find expired entries
        Object.entries(state.cachedUrls).forEach(([url, entry]) => {
            if (now - entry.timestamp > MAX_CACHE_AGE_MS) {
                entriesToRemove.push(url);
            }
        });

        // Also check total cache size
        const totalSize = get().getTotalCacheSize();
        if (totalSize > MAX_CACHE_SIZE_MB * 1024 * 1024) {
            // Sort by age (oldest first) and remove until under limit
            const sortedEntries = Object.entries(state.cachedUrls)
                .sort(([, a], [, b]) => a.timestamp - b.timestamp);

            let currentSize = totalSize;
            for (const [url, entry] of sortedEntries) {
                if (currentSize <= MAX_CACHE_SIZE_MB * 1024 * 1024) break;
                entriesToRemove.push(url);
                currentSize -= (entry.size || 0);
            }
        }

        // Revoke and remove
        if (entriesToRemove.length > 0) {
            entriesToRemove.forEach(url => get().revokeBlobUrl(url));
        }
    },

    getTotalCacheSize: () => {
        const state = get();
        return Object.values(state.cachedUrls).reduce((total, entry) => {
            return total + (entry.size || 0);
        }, 0);
    },
}));
