import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LivePlayer } from "./LivePlayer";
import { Radio, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export const LiveBanner = () => {
    const [streamConfig, setStreamConfig] = useState<{ playback_url: string; status: string } | null>(null);
    const [isVisible, setIsVisible] = useState(true);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        const checkStatus = async () => {
            // In a real scenario, we might use Realtime subscription here
            // But checking on mount is good enough for now, or polling.
            const { data } = await supabase
                .from('live_stream_config')
                .select('playback_url, status')
                .eq('status', 'live')
                .maybeSingle();

            if (data) {
                setStreamConfig(data);
                setIsExpanded(true); // Auto expand if live
            }
        };

        checkStatus();

        // Optional: Poll every 30s
        const interval = setInterval(checkStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    if (!streamConfig || !isVisible) return null;

    return (
        <div className="mb-6 animate-in slide-in-from-top-4 duration-500">
            {isExpanded ? (
                <div className="relative rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
                    <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-10 flex justify-between items-start pointer-events-none">
                        <div>
                            <h3 className="text-white font-bold text-lg drop-shadow-md">Sunday Service Live</h3>
                            <p className="text-white/80 text-xs">Watch live from Sanctuary</p>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-white hover:bg-white/20 pointer-events-auto"
                            onClick={() => setIsExpanded(false)}
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>

                    <LivePlayer
                        src={streamConfig.playback_url}
                        poster="/placeholder.svg" // We could fetch a dynamic thumbnail
                        autoPlay={true}
                    />
                </div>
            ) : (
                <div
                    className="flex items-center justify-between p-4 bg-red-600 text-white rounded-xl shadow-lg cursor-pointer hover:bg-red-700 transition-colors"
                    onClick={() => setIsExpanded(true)}
                >
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-full animate-pulse">
                            <Radio className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="font-bold text-sm">We are Live!</p>
                            <p className="text-xs text-white/80">Tap to watch the stream</p>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" className="bg-white/10 border-white/20 hover:bg-white/20 text-white">
                        Watch
                    </Button>
                </div>
            )}
        </div>
    );
};
