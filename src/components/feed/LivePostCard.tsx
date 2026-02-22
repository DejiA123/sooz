import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LivePlayer } from "../live/LivePlayer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Radio, Share2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const LivePostCard = () => {
    const [streamConfig, setStreamConfig] = useState<{ playback_url: string; status: string } | null>(null);
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const checkStatus = async () => {
            const { data } = await supabase
                .from('live_stream_config')
                .select('playback_url, status')
                .eq('status', 'live')
                .maybeSingle();

            if (data) {
                setStreamConfig(data);
            } else {
                setStreamConfig(null);
            }
        };

        checkStatus();

        const channel = supabase
            .channel('live_feed_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'live_stream_config' },
                () => checkStatus()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    if (!streamConfig || !isVisible) return null;

    return (
        <article className="mb-10 overflow-hidden bg-card border border-white/5 sm:rounded-[2.5rem] shadow-premium ring-2 ring-red-500/20 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex items-center justify-between p-4 px-5">
                <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10 ring-2 ring-red-500/20">
                        <AvatarImage src="/placeholder.svg" className="object-cover" />
                        <AvatarFallback className="bg-red-50 text-red-600 font-bold text-xs">LIVE</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <h3 className="font-display font-bold text-[15px] leading-tight tracking-tight">Main Sanctuary</h3>
                            <Badge variant="destructive" className="h-4 px-1.5 text-[8px] font-black uppercase tracking-widest animate-pulse border-none">
                                Live
                            </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground font-medium">Internal Stream Broadcast</p>
                    </div>
                </div>

                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                    <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
                </Button>
            </div>

            {/* Live Player Container */}
            <div className="relative w-full aspect-video bg-black overflow-hidden border-y border-white/5">
                <LivePlayer
                    src={streamConfig.playback_url}
                    className="rounded-none border-none shadow-none ring-0 h-full"
                    autoPlay={true}
                />

                {/* Live Overlays */}
                <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
                    <div className="px-2 py-1 bg-black/40 backdrop-blur-md rounded-lg border border-white/10 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-white uppercase tracking-wider">HLS Feed</span>
                    </div>
                </div>
            </div>

            {/* Footer / Interaction Space */}
            <div className="p-5 pt-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-5">
                        <div className="flex items-center gap-2 text-red-600">
                            <Radio className="w-6 h-6 animate-pulse" />
                            <span className="text-sm font-bold uppercase tracking-tight">Streaming Now</span>
                        </div>
                    </div>

                    <button
                        className="p-2 rounded-full hover:bg-secondary/50 transition-colors"
                        onClick={() => {
                            navigator.clipboard.writeText(window.location.href);
                            toast.success("Stream link copied!");
                        }}
                    >
                        <Share2 className="w-6 h-6 text-foreground" strokeWidth={2} />
                    </button>
                </div>

                <div className="space-y-2">
                    <p className="text-[15px] leading-relaxed">
                        <span className="font-bold mr-2 text-red-600">LIVE:</span>
                        <span className="text-foreground/90 font-medium">Join us live for the current session. Experience the broadcast in real-time with internal HLS streaming.</span>
                    </p>

                    <p className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-widest pt-1">
                        STARTED RECENTLY
                    </p>
                </div>
            </div>
        </article>
    );
};
