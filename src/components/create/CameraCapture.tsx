import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Video, RotateCw, X, Circle, Square } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CameraCaptureProps {
    mode: "photo" | "video";
    onCapture: (file: File) => void;
    onClose: () => void;
}

export const CameraCapture = ({ mode, onCapture, onClose }: CameraCaptureProps) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
    const [hasPermission, setHasPermission] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initialize camera
    useEffect(() => {
        startCamera();
        return () => {
            stopCamera();
        };
    }, [facingMode]);

    // Recording timer
    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;
        if (isRecording) {
            interval = setInterval(() => {
                setRecordingTime((prev) => {
                    // Auto-stop at 30 seconds for stories
                    if (prev >= 30) {
                        stopRecording();
                        return 30;
                    }
                    return prev + 1;
                });
            }, 1000);
        } else {
            setRecordingTime(0);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isRecording]);

    const startCamera = async () => {
        try {
            const constraints = {
                video: {
                    facingMode: facingMode,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: mode === "video"
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            mediaStreamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }

            setHasPermission(true);
            setError(null);
        } catch (err: any) {
            console.error("Camera access error:", err);
            setError("Could not access camera. Please check permissions.");
            setHasPermission(false);
            toast.error("Camera access denied. Please enable camera permissions in your browser settings.");
        }
    };

    const stopCamera = () => {
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
    };

    const switchCamera = () => {
        setFacingMode(prev => prev === "user" ? "environment" : "user");
    };

    const capturePhoto = () => {
        if (!videoRef.current) return;

        const canvas = document.createElement("canvas");
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        if (facingMode === "user") {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(videoRef.current, 0, 0);

        canvas.toBlob((blob) => {
            if (blob) {
                const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
                onCapture(file);
                stopCamera();
            }
        }, "image/jpeg", 0.95);
    };

    const startRecording = () => {
        if (!mediaStreamRef.current) return;

        chunksRef.current = [];

        try {
            const options = { mimeType: "video/webm" };
            const mediaRecorder = new MediaRecorder(mediaStreamRef.current, options);

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: "video/webm" });
                const file = new File([blob], `video-${Date.now()}.webm`, { type: "video/webm" });
                onCapture(file);
                stopCamera();
            };

            mediaRecorderRef.current = mediaRecorder;
            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Recording error:", err);
            toast.error("Failed to start recording");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    if (error) {
        return (
            <div className="relative w-full h-[500px] bg-black rounded-3xl flex flex-col items-center justify-center p-8 text-center">
                <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                    <Camera className="w-10 h-10 text-destructive" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Camera Access Required</h3>
                <p className="text-sm text-muted-foreground mb-6">{error}</p>
                <div className="flex gap-3">
                    <Button variant="secondary" onClick={onClose}>
                        Go Back
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="relative w-full h-[500px] bg-black rounded-3xl overflow-hidden">
            {/* Video Preview */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={cn("w-full h-full object-cover", facingMode === "user" && "scale-x-[-1]")}
            />

            {/* Overlay Controls */}
            <div className="absolute inset-0 flex flex-col">
                {/* Top Bar */}
                <div className="flex items-center justify-between p-4">
                    <Button
                        size="icon"
                        variant="ghost"
                        className="rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/70"
                        onClick={onClose}
                    >
                        <X className="w-5 h-5" />
                    </Button>

                    {/* Recording Timer */}
                    {isRecording && (
                        <div className="flex items-center gap-2 bg-red-500/90 text-white px-3 py-1.5 rounded-full backdrop-blur-md animate-pulse">
                            <div className="w-2 h-2 rounded-full bg-white" />
                            <span className="text-sm font-semibold">{formatTime(recordingTime)}</span>
                        </div>
                    )}

                    {/* Camera Switch */}
                    {!isRecording && (
                        <Button
                            size="icon"
                            variant="ghost"
                            className="rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/70"
                            onClick={switchCamera}
                        >
                            <RotateCw className="w-5 h-5" />
                        </Button>
                    )}
                </div>

                {/* Bottom Controls */}
                <div className="mt-auto p-8 flex items-center justify-center">
                    {mode === "photo" ? (
                        <Button
                            size="icon"
                            className="w-16 h-16 rounded-full bg-white hover:bg-white/90 shadow-lg"
                            onClick={capturePhoto}
                        >
                            <Circle className="w-8 h-8 text-black" strokeWidth={2} />
                        </Button>
                    ) : (
                        <Button
                            size="icon"
                            className={cn(
                                "w-16 h-16 rounded-full shadow-lg transition-all",
                                isRecording
                                    ? "bg-red-500 hover:bg-red-600"
                                    : "bg-white hover:bg-white/90"
                            )}
                            onClick={isRecording ? stopRecording : startRecording}
                        >
                            {isRecording ? (
                                <Square className="w-6 h-6 text-white fill-white" />
                            ) : (
                                <Circle className="w-8 h-8 text-red-500 fill-red-500" strokeWidth={2} />
                            )}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};
