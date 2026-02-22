import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPresignedUploadUrl } from "@/integrations/s3/client";
import { Button } from "@/components/ui/button";
import { Loader2, Camera, CameraOff, Radio, StopCircle, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LiveStudioProps {
    onStreamStarted?: (url: string) => void;
    onStreamEnded?: () => void;
}

export const LiveStudio = ({ onStreamStarted, onStreamEnded }: LiveStudioProps) => {
    const [isStreaming, setIsStreaming] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [streamDuration, setStreamDuration] = useState(0);
    const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<number>(0);
    const playlistRef = useRef<string[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const configIdRef = useRef<string | null>(null);

    // Clear resources on unmount
    useEffect(() => {
        return () => {
            stopPreview();
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const startPreview = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                },
                audio: true
            });
            setPreviewStream(stream);
            if (videoRef.current) videoRef.current.srcObject = stream;
        } catch (err) {
            console.error("Failed to get media devices:", err);
            toast.error("Could not access camera/microphone");
        }
    };

    const stopPreview = () => {
        if (previewStream) {
            previewStream.getTracks().forEach(track => track.stop());
            setPreviewStream(null);
        }
    };

    const uploadChunk = async (blob: Blob, index: number) => {
        const fileName = `live/chunks/chunk_${Date.now()}_${index}.ts`;
        try {
            const { signedUrl, publicUrl } = await getPresignedUploadUrl(fileName, "video/MP2T");

            await fetch(signedUrl, {
                method: "PUT",
                body: blob,
                headers: { "Content-Type": "video/MP2T" }
            });

            return publicUrl;
        } catch (err) {
            console.error("Chunk upload failed:", err);
            return null;
        }
    };

    const updatePlaylist = async (newChunkUrl: string) => {
        playlistRef.current.push(newChunkUrl);
        // Keep only last 5 chunks for low latency
        if (playlistRef.current.length > 5) {
            playlistRef.current.shift();
        }

        const playlistContent = [
            "#EXTM3U",
            "#EXT-X-VERSION:3",
            "#EXT-X-TARGETDURATION:5",
            "#EXT-X-MEDIA-SEQUENCE:" + (chunksRef.current - playlistRef.current.length),
            ...playlistRef.current.flatMap(url => [
                "#EXTINF:4.0,",
                url
            ])
        ].join("\n");

        try {
            const fileName = `live/index.m3u8`;
            const { signedUrl, publicUrl } = await getPresignedUploadUrl(fileName, "application/vnd.apple.mpegurl");

            await fetch(signedUrl, {
                method: "PUT",
                body: playlistContent,
                headers: { "Content-Type": "application/vnd.apple.mpegurl" }
            });

            return publicUrl;
        } catch (err) {
            console.error("Playlist upload failed:", err);
            return null;
        }
    };

    const startStreaming = async () => {
        if (!previewStream) return;

        setIsLoading(true);
        chunksRef.current = 0;
        playlistRef.current = [];

        try {
            // Check for supported types
            const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=h264')
                ? 'video/webm;codecs=h264'
                : 'video/webm';

            const recorder = new MediaRecorder(previewStream, {
                mimeType,
                videoBitsPerSecond: 2500000 // 2.5 Mbps
            });

            recorder.ondataavailable = async (e) => {
                if (e.data.size > 0) {
                    const chunkUrl = await uploadChunk(e.data, chunksRef.current++);
                    if (chunkUrl) {
                        const m3u8Url = await updatePlaylist(chunkUrl);
                        if (chunksRef.current === 1 && m3u8Url) {
                            // Fetch config ID if we don't have it
                            if (!configIdRef.current) {
                                const { data } = await supabase
                                    .from('live_stream_config')
                                    .select('id')
                                    .limit(1)
                                    .maybeSingle();
                                if (data) configIdRef.current = data.id;
                            }

                            // On first chunk, update database status
                            const query = supabase
                                .from('live_stream_config')
                                .update({
                                    status: 'live',
                                    playback_url: m3u8Url,
                                    updated_at: new Date().toISOString()
                                });

                            if (configIdRef.current) {
                                await query.eq('id', configIdRef.current);
                            } else {
                                await query.eq('is_active', true);
                            }

                            onStreamStarted?.(m3u8Url);
                        }
                    }
                }
            };

            // Capture data in 4s intervals
            recorder.start(4000);
            mediaRecorderRef.current = recorder;
            setIsStreaming(true);

            timerRef.current = setInterval(() => {
                setStreamDuration(d => d + 1);
            }, 1000);

            toast.success("Stream started!");
        } catch (err) {
            console.error("Failed to start recorder:", err);
            toast.error("Failed to start streaming");
        } finally {
            setIsLoading(false);
        }
    };

    const stopStreaming = async () => {
        setIsLoading(true);
        try {
            if (mediaRecorderRef.current) {
                mediaRecorderRef.current.stop();
            }
            if (timerRef.current) clearInterval(timerRef.current);

            const query = supabase
                .from('live_stream_config')
                .update({
                    status: 'offline',
                    updated_at: new Date().toISOString()
                });

            if (configIdRef.current) {
                await query.eq('id', configIdRef.current);
            } else {
                await query.eq('is_active', true);
            }

            setIsStreaming(false);
            setStreamDuration(0);
            toast.info("Stream ended");
            onStreamEnded?.();
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const formatTime = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hrs > 0 ? hrs + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="relative aspect-video bg-black rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
                <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className={cn("w-full h-full object-cover", !previewStream && "hidden")}
                />

                {!previewStream && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-4">
                        <CameraOff className="w-12 h-12 opacity-20" />
                        <p className="text-sm font-medium">Camera preview is off</p>
                        <Button variant="outline" size="sm" onClick={startPreview} className="rounded-xl">
                            Enable Camera
                        </Button>
                    </div>
                )}

                {isStreaming && (
                    <div className="absolute top-4 left-4 flex items-center gap-3 z-10">
                        <div className="bg-red-600 text-white px-3 py-1 rounded-full flex items-center gap-2 animate-pulse shadow-lg ring-4 ring-red-600/20">
                            <span className="w-2 h-2 rounded-full bg-white" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">LIVE</span>
                        </div>
                        <div className="bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full text-[10px] font-bold border border-white/10">
                            {formatTime(streamDuration)}
                        </div>
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-4">
                {isStreaming ? (
                    <Button
                        size="lg"
                        variant="destructive"
                        className="h-14 rounded-2xl text-lg font-bold shadow-lg shadow-red-500/20 active:scale-[0.98] transition-all"
                        onClick={stopStreaming}
                        disabled={isLoading}
                    >
                        {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><StopCircle className="w-6 h-6 mr-2" /> Stop Stream</>}
                    </Button>
                ) : (
                    <Button
                        size="lg"
                        className="h-14 rounded-2xl text-lg font-bold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
                        onClick={startStreaming}
                        disabled={isLoading || !previewStream}
                    >
                        {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Radio className="w-6 h-6 mr-2" /> Start Internal Stream</>}
                    </Button>
                )}

                <div className="grid grid-cols-2 gap-3">
                    <Button
                        variant="outline"
                        className="h-12 rounded-xl text-xs font-semibold"
                        onClick={previewStream ? stopPreview : startPreview}
                        disabled={isStreaming || isLoading}
                    >
                        {previewStream ? "Turn Camera Off" : "Turn Camera On"}
                    </Button>
                    <Button
                        variant="outline"
                        className="h-12 rounded-xl text-xs font-semibold"
                        onClick={() => {
                            stopPreview();
                            startPreview();
                        }}
                        disabled={isStreaming || isLoading}
                    >
                        <RefreshCcw className="w-4 h-4 mr-2" /> Reset Camera
                    </Button>
                </div>
            </div>

            <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                    <span className="font-bold text-primary mr-1 italic">Note:</span>
                    Going live will use your device's camera and upload chunks to Cloudflare R2.
                    Ensure you have a stable internet connection for high-quality streaming.
                </p>
            </div>
        </div>
    );
};
