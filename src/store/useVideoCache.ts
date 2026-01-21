import { create } from 'zustand';

interface CacheEntry {
    blobUrl: string;
    timestamp: number;
    size?: number;
}

interface VideoCacheState {
    // Maps original URL -> Cache Entry with metadata
    cachedUrls: Record<string, CacheEntry>;
    setCachedUrl: (originalUrl: string, blobUrl: string, size?: number) => void;
    getCachedUrl: (originalUrl: string) => string | undefined;
    revokeBlobUrl: (originalUrl: string) => void;
    cleanupOldCache: () => void;
    getTotalCacheSize: () => number;
}

// Increased limits for TikTok-level instant loading
const MAX_CACHE_AGE_MS = 15 * 60 * 1000; // 15 minutes (was 10)
const MAX_CACHE_SIZE_MB = 300; // 300MB max cache size (was 200)

export const useVideoCache = create<VideoCacheState>((set, get) => ({
    cachedUrls: {},

    setCachedUrl: (originalUrl, blobUrl, size) =>
        set((state) => ({
            cachedUrls: {
                ...state.cachedUrls,
                [originalUrl]: {
                    blobUrl,
                    timestamp: Date.now(),
                    size,
                }
            }
        })),

    getCachedUrl: (originalUrl) => {
        const entry = get().cachedUrls[originalUrl];
        if (!entry) return undefined;

        // Check if cache is still valid (not too old)
        const age = Date.now() - entry.timestamp;
        if (age > MAX_CACHE_AGE_MS) {
            // Cache expired, clean it up
            get().revokeBlobUrl(originalUrl);
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
                console.log(`🗑️ Revoked blob URL for: ${originalUrl.substring(0, 50)}...`);
            } catch (error) {
                console.error('Failed to revoke blob URL:', error);
            }

            set({
                cachedUrls: Object.fromEntries(
                    Object.entries(state.cachedUrls).filter(([key]) => key !== originalUrl)
                )
            });
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
            console.log(`🧹 Cleaning up ${entriesToRemove.length} old cache entries`);
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
