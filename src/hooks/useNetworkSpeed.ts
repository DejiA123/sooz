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

    useEffect(() => {
        const nav = navigator as NavigatorWithConnection;
        const connection = nav.connection || nav.mozConnection || nav.webkitConnection;

        const updateSpeed = () => {
            if (connection) {
                const effectiveType = connection.effectiveType;
                const saveData = connection.saveData;

                // If user has data saver on, treat as slow
                if (saveData) {
                    setSpeed('slow');
                    setIsSlowConnection(true);
                    return;
                }

                // Map effective type to our speed categories
                switch (effectiveType) {
                    case 'slow-2g':
                    case '2g':
                        setSpeed('slow');
                        setIsSlowConnection(true);
                        break;
                    case '3g':
                        setSpeed('medium');
                        setIsSlowConnection(false);
                        break;
                    case '4g':
                    default:
                        setSpeed('fast');
                        setIsSlowConnection(false);
                        break;
                }
            } else {
                // No Network Information API support - assume fast
                setSpeed('fast');
                setIsSlowConnection(false);
            }
        };

        updateSpeed();

        if (connection) {
            connection.addEventListener('change', updateSpeed);
            return () => connection.removeEventListener('change', updateSpeed);
        }
    }, []);

    // Calculate preload count based on speed
    const getPreloadCount = () => {
        switch (speed) {
            case 'slow':
                return 1;
            case 'medium':
                return 3;
            case 'fast':
            default:
                return 5;
        }
    };

    // Calculate preload margin (in pixels) for intersection observer
    const getPreloadMargin = () => {
        switch (speed) {
            case 'slow':
                return '400px';
            case 'medium':
                return '1000px';
            case 'fast':
            default:
                return '1500px';
        }
    };

    return {
        speed,
        isSlowConnection,
        preloadCount: getPreloadCount(),
        preloadMargin: getPreloadMargin(),
    };
};
