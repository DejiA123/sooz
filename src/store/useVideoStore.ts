import { create } from 'zustand';

interface VideoState {
    activeVideoId: string | null;
    setActiveVideo: (id: string | null) => void;
    isGlobalMuted: boolean;
    setGlobalMuted: (muted: boolean) => void;
    /** Browsers only allow sound after the first tap; once the user has tapped, keep sound on. */
    soundUnlocked: boolean;
    setSoundUnlocked: (unlocked: boolean) => void;
}

export const useVideoStore = create<VideoState>((set) => ({
    activeVideoId: null,
    setActiveVideo: (id) => set({ activeVideoId: id }),
    isGlobalMuted: true,
    setGlobalMuted: (muted) => set({ isGlobalMuted: muted }),
    soundUnlocked: false,
    setSoundUnlocked: (unlocked) => set({ soundUnlocked: unlocked }),
}));
