import { create } from 'zustand';

interface VideoCacheState {
    // Maps original URL -> Blob URL (blob:http://...)
    cachedUrls: Record<string, string>;
    setCachedUrl: (originalUrl: string, blobUrl: string) => void;
    getCachedUrl: (originalUrl: string) => string | undefined;
}

export const useVideoCache = create<VideoCacheState>((set, get) => ({
    cachedUrls: {},
    setCachedUrl: (originalUrl, blobUrl) =>
        set((state) => ({
            cachedUrls: { ...state.cachedUrls, [originalUrl]: blobUrl }
        })),
    getCachedUrl: (originalUrl) => get().cachedUrls[originalUrl],
}));
