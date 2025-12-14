import { create } from 'zustand';

interface VideoState {
    activeVideoId: string | null;
    setActiveVideo: (id: string | null) => void;
}

export const useVideoStore = create<VideoState>((set) => ({
    activeVideoId: null,
    setActiveVideo: (id) => set({ activeVideoId: id }),
}));
