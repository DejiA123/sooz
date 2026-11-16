import { create } from 'zustand';
import { saveSoundChoice } from '@/lib/soundPref';

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
    // Only the person's own choices go through here (sound button, tap, TikTok's button), so it's remembered;
    // the browser blocking sound uses soundBlocked() instead.
    setGlobalMuted: (muted) => { saveSoundChoice(muted); set({ isGlobalMuted: muted }); },
    soundUnlocked: false,
    setSoundUnlocked: (unlocked) => set({ soundUnlocked: unlocked }),
}));
