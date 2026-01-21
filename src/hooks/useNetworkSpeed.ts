import { useState, useEffect } from 'react';

type NetworkSpeed = 'slow' | 'medium' | 'fast';
type EffectiveType = 'slow-2g' | '2g' | '3g' | '4g';

interface NetworkInformation extends EventTarget {
    effectiveType?: EffectiveType;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
    addEventListener(type: 'change', listener: () => void): void;
    removeEventListener(type: 'change', listener: () => void): void;
}

interface NavigatorWithConnection extends Navigator {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
}

export const useNetworkSpeed = () => {
    const [speed, setSpeed] = useState<NetworkSpeed>('fast');
    const [isSlowConnection, setIsSlowConnection] = useState(false);
    const [shouldReduceQuality, setShouldReduceQuality] = useState(false);

    useEffect(() => {
        const nav = navigator as NavigatorWithConnection;
        const connection = nav.connection || nav.mozConnection || nav.webkitConnection;

        const updateSpeed = () => {
            if (connection) {
                const effectiveType = connection.effectiveType;
                const saveData = connection.saveData;
                const downlink = connection.downlink; // Mbps

                // If user has data saver on, treat as slow
                if (saveData) {
                    setSpeed('slow');
                    setIsSlowConnection(true);
                    setShouldReduceQuality(true);
                    return;
                }

                // Map effective type to our speed categories
                switch (effectiveType) {
                    case 'slow-2g':
                    case '2g':
                        setSpeed('slow');
                        setIsSlowConnection(true);
                        setShouldReduceQuality(true);
                        break;
                    case '3g':
                        setSpeed('medium');
                        setIsSlowConnection(false);
                        // Reduce quality if downlink is very low (< 1 Mbps)
                        setShouldReduceQuality(downlink !== undefined && downlink < 1);
                        break;
                    case '4g':
                    default:
                        setSpeed('fast');
                        setIsSlowConnection(false);
                        setShouldReduceQuality(false);
                        break;
                }
            } else {
                // No Network Information API support - assume fast (common on iOS Safari)
                // iOS Safari doesn't support Network Information API, so we default to aggressive loading
                setSpeed('fast');
                setIsSlowConnection(false);
                setShouldReduceQuality(false);
            }
        };

        updateSpeed();

        if (connection) {
            connection.addEventListener('change', updateSpeed);
            return () => connection.removeEventListener('change', updateSpeed);
        }
    }, []);

    // Calculate preload count based on speed - AGGRESSIVE for TikTok-level performance
    const getPreloadCount = () => {
        switch (speed) {
            case 'slow':
                return 3; // Was 1, now preload 3 videos even on slow connections
            case 'medium':
                return 5; // Was 3, now preload 5 videos
            case 'fast':
            default:
                return 8; // Was 5, now preload 8 videos for instant scrolling
        }
    };

    // Calculate preload margin (in pixels) for intersection observer - AGGRESSIVE
    const getPreloadMargin = () => {
        switch (speed) {
            case 'slow':
                return '800px'; // Was 400px - start loading earlier even on slow networks
            case 'medium':
                return '2000px'; // Was 1000px - preload 4-5 posts ahead
            case 'fast':
            default:
                return '3000px'; // Was 1500px - preload 6-8 posts ahead for instant
        }
    };

    return {
        speed,
        isSlowConnection,
        shouldReduceQuality,
        preloadCount: getPreloadCount(),
        preloadMargin: getPreloadMargin(),
    };
};
