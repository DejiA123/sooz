
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
        isVideoCall,
        isRemoteCameraOff
    } = useCall();

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const remoteAudioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (localVideoRef.current && localStream) {
            console.log('🎥 Attaching local stream to video element');
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream, callState]);

    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            console.log('🎥 Attaching remote stream to video element, tracks:', remoteStream.getTracks().map(t => `${t.kind}: ${t.enabled}`));
            remoteVideoRef.current.srcObject = remoteStream;

            // Set volume to maximum
            remoteVideoRef.current.volume = 1.0;

            // Check audio tracks
            const audioTracks = remoteStream.getAudioTracks();
            console.log('🔊 Audio tracks:', audioTracks.map(t => `enabled: ${t.enabled}, muted: ${t.muted}`));

            // Explicitly call play() to ensure video starts
            remoteVideoRef.current.play().catch(err => {
                console.error('🎥 Error playing remote video:', err);
            });
        } else {
            console.log('🎥 No remote stream or ref:', { hasRef: !!remoteVideoRef.current, hasStream: !!remoteStream });
        }
    }, [remoteStream, callState]);

    // Separate audio handling for reliability
    useEffect(() => {
        if (remoteAudioRef.current && remoteStream) {
            console.log('🔊 Attaching audio stream to audio element');
            remoteAudioRef.current.srcObject = remoteStream;
            remoteAudioRef.current.volume = 1.0;

            // Attempt to play
            const playAudio = async () => {
                try {
                    // Try setting sink ID if available (Chrome/Android)
                    // @ts-ignore
                    if (typeof remoteAudioRef.current.setSinkId === 'function') {
                        // @ts-ignore
                        await remoteAudioRef.current.setSinkId('default');
                    }

                    await remoteAudioRef.current?.play();
                    console.log('🔊 Audio playback started successfully');
                } catch (err) {
                    console.error('🔊 Error playing audio:', err);
                    // If failed (likely autoplay policy), try again on next interaction
                    toast.error("Audio blocked. Tap screen to unmute.");

                    const resumeAudio = () => {
                        if (remoteAudioRef.current) {
                            remoteAudioRef.current.play()
                                .then(() => console.log('🔊 Audio resumed by user interaction'))
                                .catch(e => console.error('🔊 Resume failed:', e));
                        }
                    };

                    document.addEventListener('click', resumeAudio, { once: true });
                    document.addEventListener('touchstart', resumeAudio, { once: true });
                }
            };
            playAudio();
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
                {(() => {
                    console.log('🎥 Render decision:', { hasRemoteStream: !!remoteStream, isRemoteCameraOff, isVideoCall });
                    return remoteStream && !isRemoteCameraOff ? (
                        <>
                            <video
                                ref={remoteVideoRef}
                                autoPlay
                                playsInline
                                muted={true}
                                onLoadedMetadata={() => console.log('🎥 Remote video metadata loaded')}
                                onPlay={() => console.log('🎥 Remote video started playing')}
                                onError={(e) => console.error('🎥 Remote video error:', e)}
                                className="w-full h-full object-cover"
                            />
                            {/* Separate audio element for reliable audio playback - using opacity-0 instead of hidden to prevent throttling */}
                            <audio
                                ref={remoteAudioRef}
                                autoPlay
                                playsInline
                                controls={false}
                                className="absolute pointer-events-none opacity-0 w-1 h-1"
                            />
                        </>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-white/50 gap-4">
                            <Avatar className="w-32 h-32 border-4 border-white/5 animate-pulse">
                                <AvatarImage src={callerInfo?.avatar || undefined} />
                                <AvatarFallback className="text-4xl">{callerInfo?.name?.[0]}</AvatarFallback>
                            </Avatar>
                            <p className="text-xl animate-pulse">
                                {remoteStream ? (isVideoCall ? 'Camera Off' : 'Audio Call') : (isVideoCall ? 'Calling...' : 'Audio Calling...')}
                            </p>
                        </div>
                    );
                })()}

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
