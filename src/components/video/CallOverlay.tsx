
import React, { useEffect, useRef } from 'react';
import { useCall } from '@/contexts/CallContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export const CallOverlay = () => {
    const {
        callState,
        localStream,
        remoteStream,
        callerInfo,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleCamera,
        isMuted,
        isCameraOff,
        isVideoCall
    } = useCall();

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream, callState]);

    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream, callState]);

    if (callState === 'IDLE') return null;

    // INCOMING CALL SCREEN
    if (callState === 'RINGING') {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in">
                <div className="flex flex-col items-center gap-6 p-8 rounded-3xl bg-card border border-white/10 shadow-2xl max-w-sm w-full">
                    <div className="relative">
                        <Avatar className="w-24 h-24 border-4 border-primary/20 animate-pulse">
                            <AvatarImage src={callerInfo?.avatar || undefined} />
                            <AvatarFallback>{callerInfo?.name?.[0]}</AvatarFallback>
                        </Avatar>
                        <div className="absolute inset-0 rounded-full animate-ping bg-primary/20" />
                    </div>

                    <div className="text-center">
                        <h2 className="text-2xl font-bold">{callerInfo?.name}</h2>
                        <p className="text-muted-foreground">Incoming {isVideoCall ? 'video' : 'audio'} call...</p>
                    </div>

                    <div className="flex items-center gap-4 mt-4">
                        <Button
                            size="lg"
                            variant="destructive"
                            className="rounded-full w-16 h-16 p-0 hover:scale-110 transition-transform"
                            onClick={rejectCall}
                        >
                            <PhoneOff className="w-8 h-8" />
                        </Button>
                        <Button
                            size="lg"
                            className="rounded-full w-16 h-16 p-0 bg-green-500 hover:bg-green-600 hover:scale-110 transition-transform text-white"
                            onClick={acceptCall}
                        >
                            <Phone className="w-8 h-8 fill-current" />
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // ACTIVE CALL / OUTGOING SCREEN
    return (
        <div className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col">
            {/* Main Video Area (Remote or Self if just calling) */}
            <div className="relative flex-1 bg-black">
                {remoteStream ? (
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-white/50 gap-4">
                        <Avatar className="w-32 h-32 border-4 border-white/5 animate-pulse">
                            <AvatarImage src={callerInfo?.avatar || undefined} />
                            <AvatarFallback>{callerInfo?.name?.[0]}</AvatarFallback>
                        </Avatar>
                        <p className="text-xl animate-pulse">{isVideoCall ? 'Calling...' : 'Audio Calling...'}</p>
                    </div>
                )}

                {/* Local Video (PiP) */}
                <div className={cn(
                    "absolute top-4 right-4 w-32 md:w-48 aspect-[9/16] bg-black rounded-lg overflow-hidden border border-white/10 shadow-xl transition-all",
                    !remoteStream && "inset-0 w-full h-full rounded-none border-none opacity-30 blur-sm pointer-events-none" // Fade background slightly if logic requires?
                )}>
                    {/* Actually for 'Calling' state we might want to see ourselves full screen properly until connected */}
                    {/* Let's stick to PiP always for consistency for now, or simplify. */}
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover mirror-mode"
                    />
                </div>
            </div>

            {/* Controls Bar */}
            <div className="h-24 bg-black/20 backdrop-blur-lg flex items-center justify-center gap-6 pb-safe">
                <Button
                    variant={isCameraOff ? "destructive" : "secondary"}
                    size="lg"
                    className="rounded-full w-14 h-14"
                    onClick={toggleCamera}
                >
                    {isCameraOff ? <VideoOff /> : <Video />}
                </Button>

                <Button
                    variant="destructive"
                    size="lg"
                    className="rounded-full w-16 h-16"
                    onClick={endCall}
                >
                    <PhoneOff className="w-8 h-8" />
                </Button>

                <Button
                    variant={isMuted ? "destructive" : "secondary"}
                    size="lg"
                    className="rounded-full w-14 h-14"
                    onClick={toggleMute}
                >
                    {isMuted ? <MicOff /> : <Mic />}
                </Button>
            </div>

            <style>{`
                .mirror-mode { transform: scaleX(-1); }
            `}</style>
        </div>
    );
};
