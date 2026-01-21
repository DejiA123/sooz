import React, { createContext, useContext, useState, useEffect } from 'react';

// This context helps us track which video is currently "active" in the viewport
// and allows us to trigger preloading for the next item(s).

interface FeedVideoContextType {
    activeVideoId: string | null;
    setActiveVideoId: (id: string | null) => void;
    registerVideo: (id: string, url: string) => void;
}

const FeedVideoContext = createContext<FeedVideoContextType | undefined>(undefined);

export const FeedVideoProvider = ({ children }: { children: React.ReactNode }) => {
    const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
    const [videoMap, setVideoMap] = useState<Map<string, string>>(new Map());

    const registerVideo = (id: string, url: string) => {
        if (!videoMap.has(id)) {
            setVideoMap(prev => new Map(prev).set(id, url));
        }
    };

    // Simple preloading logic:
    // When activeVideoId changes, find the "next" video URL (this implies we know the order)
    // In a dynamic feed, order is hard to know in Context without passing an index.
    // ALTERNATIVE: Just expose the active ID, and individual components check if they are "next"
    // But individual components don't know their neighbors easily.

    // Better strategy for "TikTok speed":
    // Components register themselves with an index? 
    // Or we just rely on the existing "LazyVideo" priority prop if we can pass it down.

    // Let's stick to a simpler approach first:
    // Just keep track of the active video ID globally here (or in Zustand store we already have).

    // Actually, we already have useVideoStore! We don't need a new context if we just extend that.

    return (
        <FeedVideoContext.Provider value={{ activeVideoId, setActiveVideoId, registerVideo }}>
            {children}
        </FeedVideoContext.Provider>
    );
};

export const useFeedVideo = () => {
    const context = useContext(FeedVideoContext);
    if (!context) throw new Error("useFeedVideo must be used within provider");
    return context;
};
