import { useEffect } from 'react';
import { useVideoStore } from '@/store/useVideoStore';
import { useVideoCache } from '@/store/useVideoCache';

interface Post {
    id: string;
    media_url: string | null;
    media_type: string | null;
}

export const useVideoPreloader = (posts: Post[]) => {
    const activeVideoId = useVideoStore((state) => state.activeVideoId);
    const { cachedUrls, setCachedUrl } = useVideoCache();

    useEffect(() => {
        if (!activeVideoId || posts.length === 0) return;

        // Find current index
        const currentIndex = posts.findIndex(p => p.id === activeVideoId);
        if (currentIndex === -1) return;

        // Preload next 3 videos
        const postsToPreload = posts.slice(currentIndex + 1, currentIndex + 4);

        postsToPreload.forEach(async (post) => {
            if (post.media_type === 'video' && post.media_url) {
                // Skip if already cached
                if (cachedUrls[post.media_url]) return;

                try {
                    console.log(`Preloading video: ${post.id}`);
                    const response = await fetch(post.media_url);
                    const blob = await response.blob();
                    const blobUrl = URL.createObjectURL(blob);

                    setCachedUrl(post.media_url, blobUrl);
                    console.log(`Cached video: ${post.id}`);
                } catch (error) {
                    console.error(`Failed to preload video ${post.id}:`, error);
                }
            }
        });
    }, [activeVideoId, posts, cachedUrls, setCachedUrl]);
};
