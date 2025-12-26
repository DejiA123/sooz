import { useState, useEffect } from "react";

const AUTOPLAY_UNLOCK_KEY = "sooz-autoplay-unlocked";

/**
 * Hook to manage autoplay unlock state for mobile browsers.
 * Mobile browsers (especially Safari) require user interaction before allowing video autoplay.
 * This hook tracks whether the user has interacted to unlock autoplay.
 */
export const useAutoplayUnlock = () => {
    const [isUnlocked, setIsUnlocked] = useState(() => {
        // Check if autoplay was previously unlocked in this session
        if (typeof window !== "undefined") {
            return localStorage.getItem(AUTOPLAY_UNLOCK_KEY) === "true";
        }
        return false;
    });

    const unlock = () => {
        setIsUnlocked(true);
        if (typeof window !== "undefined") {
            localStorage.setItem(AUTOPLAY_UNLOCK_KEY, "true");
        }
    };

    return { isUnlocked, unlock };
};
