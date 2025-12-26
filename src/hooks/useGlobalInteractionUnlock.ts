import { useEffect, useRef } from "react";

const INTERACTION_KEY = "sooz-user-interacted";

/**
 * Hook to detect any user interaction and trigger video autoplay.
 * Mobile browsers require a user gesture before allowing video playback.
 * This hook listens for ANY interaction (touch, scroll, click) and triggers
 * a callback to start video playback.
 */
export const useGlobalInteractionUnlock = (onUnlock: () => void) => {
    const hasUnlocked = useRef(false);

    useEffect(() => {
        // Check if already unlocked this session
        if (sessionStorage.getItem(INTERACTION_KEY) === "true") {
            hasUnlocked.current = true;
            // Still trigger on mount in case videos need to play
            setTimeout(() => onUnlock(), 100);
            return;
        }

        const handleInteraction = () => {
            if (hasUnlocked.current) return;

            hasUnlocked.current = true;
            sessionStorage.setItem(INTERACTION_KEY, "true");

            // Trigger the unlock callback
            onUnlock();

            // Remove all listeners after first interaction
            cleanup();
        };

        const cleanup = () => {
            document.removeEventListener("touchstart", handleInteraction);
            document.removeEventListener("touchend", handleInteraction);
            document.removeEventListener("click", handleInteraction);
            document.removeEventListener("scroll", handleInteraction, true);
            document.removeEventListener("wheel", handleInteraction);
            document.removeEventListener("keydown", handleInteraction);
        };

        // Listen for various interaction types
        document.addEventListener("touchstart", handleInteraction, { passive: true });
        document.addEventListener("touchend", handleInteraction, { passive: true });
        document.addEventListener("click", handleInteraction, { passive: true });
        document.addEventListener("scroll", handleInteraction, { passive: true, capture: true });
        document.addEventListener("wheel", handleInteraction, { passive: true });
        document.addEventListener("keydown", handleInteraction, { passive: true });

        return cleanup;
    }, [onUnlock]);
};
