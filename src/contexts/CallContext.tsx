
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

type CallState = 'IDLE' | 'CALLING' | 'RINGING' | 'CONNECTED' | 'ENDED';

interface CallContextType {
    callState: CallState;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    callerInfo: { id: string; name: string; avatar: string | null } | null;
    startCall: (recipientId: string, recipientName: string, recipientAvatar: string | null, isVideo?: boolean) => Promise<void>;
    acceptCall: () => Promise<void>;
    rejectCall: () => void;
    endCall: () => void;
    toggleMute: () => void;
    toggleCamera: () => void;
    isMuted: boolean;
    isCameraOff: boolean;
    isVideoCall: boolean;
    isRemoteCameraOff: boolean;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const useCall = () => {
    const context = useContext(CallContext);
    if (!context) throw new Error('useCall must be used within a CallProvider');
    return context;
};

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun.ekiga.net' }
    ],
    iceCandidatePoolSize: 10,
};

export const CallProvider = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();
    const [callState, setCallState] = useState<CallState>('IDLE');
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [callerInfo, setCallerInfo] = useState<{ id: string; name: string; avatar: string | null } | null>(null);
    const [isVideoCall, setIsVideoCall] = useState(true); // Track if current/incoming call is video
    const [isRemoteCameraOff, setIsRemoteCameraOff] = useState(false);

    // For outgoing calls
    const [recipientId, setRecipientId] = useState<string | null>(null);

    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);

    // Initialization of PeerConnection
    const createPeerConnection = () => {
        if (peerConnection.current) return peerConnection.current;

        const pc = new RTCPeerConnection(ICE_SERVERS);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                const targetId = recipientId || callerInfo?.id;
                if (targetId) {
                    supabase.channel(`user:${targetId}`).send({
                        type: 'broadcast',
                        event: 'ice-candidate',
                        payload: { candidate: event.candidate, from: user?.id }
                    });
                }
            }
        };

        let remoteStreamTemp: MediaStream | null = null;

        pc.ontrack = (event) => {
            console.log('📹 Received remote track:', event.track.kind, event.streams);

            if (event.streams && event.streams[0]) {
                // Use the first stream from the event
                if (!remoteStreamTemp) {
                    remoteStreamTemp = event.streams[0];
                    console.log('📹 Setting remote stream (first time) with tracks:', remoteStreamTemp.getTracks().map(t => `${t.kind}: ${t.enabled}`));
                    setRemoteStream(remoteStreamTemp);
                } else {
                    // Just log subsequent tracks, don't re-set the stream
                    console.log('📹 Additional track received, not updating stream');
                }
            }
        };

        // Handle connection state changes
        pc.onconnectionstatechange = () => {
            console.log('📡 Connection state changed:', pc.connectionState);
            if (pc.connectionState === 'connected') {
                setCallState('CONNECTED');
            } else if (pc.connectionState === 'failed') {
                // Try to recover instead of ending immediately
                console.error('📡 Connection failed - attempting simple recovery (waiting)');
                // Don't call handleEnd() immediately, let it try to renegotiate or let user end it
            } else if (pc.connectionState === 'closed') {
                handleEnd();
            }
        };

        peerConnection.current = pc;
        return pc;
    };

    // Cleanup function
    const handleEnd = () => {
        setCallState('IDLE');
        setCallerInfo(null);
        setRecipientId(null);
        setRemoteStream(null);

        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
        }

        if (peerConnection.current) {
            peerConnection.current.close();
            peerConnection.current = null;
        }
    };

    const endCall = () => {
        const targetId = recipientId || callerInfo?.id;
        if (targetId) {
            supabase.channel(`user:${targetId}`).send({
                type: 'broadcast',
                event: 'end-call',
                payload: { from: user?.id }
            });
        }
        handleEnd();
    };

    const rejectCall = () => {
        if (callerInfo) {
            supabase.channel(`user:${callerInfo.id}`).send({
                type: 'broadcast',
                event: 'end-call',
                payload: { from: user?.id, reason: 'busy' }
            });
        }
        handleEnd();
    };

    const getMedia = async () => {
        try {
            console.log("🎥 Requesting media access...");
            // Try with ideal constraints first
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user' },
                    audio: { echoCancellation: true, noiseSuppression: true }
                });
                console.log("🎥 Media access granted (ideal)");
                setLocalStream(stream);
                return stream;
            } catch (e) {
                console.log("🎥 Initial media request failed, trying fallback...", e);
                // Fallback to basic constraints
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                console.log("🎥 Media access granted (fallback)");
                setLocalStream(stream);
                return stream;
            }
        } catch (err) {
            console.error("Error accessing media devices", err);
            toast.error("Could not access camera/microphone. Please check permissions.");
            return null;
        }
    };

    const startCall = async (id: string, name: string, avatar: string | null, isVideo: boolean = true) => {
        setRecipientId(id);
        const stream = await getMedia();
        if (!stream) return;

        // If audio-only, disable video track immediately
        if (!isVideo) {
            stream.getVideoTracks().forEach(track => track.enabled = false);
            setIsCameraOff(true);
        } else {
            setIsCameraOff(false);
        }

        setCallState('CALLING');
        setCallerInfo({ id, name, avatar }); // Re-using callerInfo for outgoing call display info too for simplicity, or just use separate

        const pc = createPeerConnection();
        if (!pc) return;

        console.log('📹 Adding local tracks to peer connection:', stream.getTracks().map(t => `${t.kind}: ${t.enabled}`));
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Send Offer
        if (user) {
            supabase.channel(`user:${id}`).send({
                type: 'broadcast',
                event: 'call-offer',
                payload: {
                    offer,
                    from: user.id,
                    callerName: user.user_metadata?.username || 'User',
                    callerAvatar: user.user_metadata?.avatar_url,
                    isVideo,
                    isCameraOff: !isVideo // Initial state depending on start mode
                }
            });

            // Send push notification for incoming call
            supabase.functions.invoke('push-notifications', {
                body: {
                    type: 'chat_message',
                    toUserId: id,
                    title: `Incoming ${isVideo ? 'Video' : 'Audio'} Call`,
                    body: `${user.user_metadata?.username || 'Someone'} is calling you`,
                    url: '/chat'
                }
            }).then(({ error }) => {
                if (error) console.error("Error sending call notification:", error);
            });
        }
    };

    const acceptCall = async () => {
        if (!callerInfo) return;
        setRecipientId(callerInfo.id); // Set the other person as recipient context

        const stream = await getMedia();
        if (!stream) return;

        setCallState('CONNECTED');

        const pc = createPeerConnection();
        if (!pc) return;

        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        // Note: setRemoteDescription was called in the event listener when offer arrived? 
        // No, we need to handle that pending offer.
        // Actually, we usually setRemoteDescription immediately when RINGING starts so we can setLocalDescription now.
        // But we need the offer object.
        // Let's store pending offer in a ref.
    };

    const pendingOffer = useRef<RTCSessionDescriptionInit | null>(null);

    // Subscribe to signaling
    useEffect(() => {
        if (!user) return;

        const channel = supabase.channel(`user:${user.id}`)
            .on('broadcast', { event: 'call-offer' }, async ({ payload }) => {
                if (callState !== 'IDLE') {
                    // Busy
                    supabase.channel(`user:${payload.from}`).send({
                        type: 'broadcast',
                        event: 'end-call',
                        payload: { from: user.id, reason: 'busy' }
                    });
                    return;
                }

                setCallerInfo({
                    id: payload.from,
                    name: payload.callerName,
                    avatar: payload.callerAvatar
                });
                setIsVideoCall(payload.isVideo !== false); // Default to true if missing
                setIsRemoteCameraOff(payload.isCameraOff || !payload.isVideo);
                setCallState('RINGING');
                pendingOffer.current = payload.offer;

                // Initialize PC immediately to prepare answer?
                // Or wait for accept.
            })
            .on('broadcast', { event: 'call-answer' }, async ({ payload }) => {
                if (callState === 'CALLING' && peerConnection.current) {
                    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
                    setIsRemoteCameraOff(payload.isCameraOff || false);
                    setCallState('CONNECTED');
                }
            })
            .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
                if (peerConnection.current && peerConnection.current.remoteDescription) {
                    try {
                        await peerConnection.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
                    } catch (e) {
                        console.error("Error adding Ice Candidate", e);
                    }
                }
            })
            .on('broadcast', { event: 'end-call' }, () => {
                handleEnd();
                toast.info("Call ended");
            })
            .on('broadcast', { event: 'camera-toggle' }, ({ payload }) => {
                setIsRemoteCameraOff(payload.isCameraOff);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, callState]);

    // Implementation of Accept Logic with access to pendingOffer
    const handleAcceptCall = async () => {
        if (!callerInfo || !pendingOffer.current) return;
        setRecipientId(callerInfo.id);

        const stream = await getMedia();
        if (!stream) return;

        // Respect the incoming call type
        if (!isVideoCall) {
            stream.getVideoTracks().forEach(track => track.enabled = false);
            setIsCameraOff(true);
        } else {
            setIsCameraOff(false);
        }

        const pc = createPeerConnection(); // Should ensure PC exists
        if (!pc) return;

        console.log('📹 Adding local tracks (answering side):', stream.getTracks().map(t => `${t.kind}: ${t.enabled}`));
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        await pc.setRemoteDescription(new RTCSessionDescription(pendingOffer.current));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        setCallState('CONNECTED');

        // Send Answer
        supabase.channel(`user:${callerInfo.id}`).send({
            type: 'broadcast',
            event: 'call-answer',
            payload: {
                answer,
                from: user?.id,
                isCameraOff: !isVideoCall // Matches local decision
            }
        });
    };

    const toggleMute = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
            setIsMuted(!isMuted);
        }
    };

    const toggleCamera = () => {
        if (localStream) {
            localStream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
            const newState = !isCameraOff;
            setIsCameraOff(newState);

            // Signal change
            const targetId = recipientId || callerInfo?.id;
            if (targetId) {
                supabase.channel(`user:${targetId}`).send({
                    type: 'broadcast',
                    event: 'camera-toggle',
                    payload: { isCameraOff: newState, from: user?.id }
                });
            }
        }
    };

    return (
        <CallContext.Provider value={{
            callState,
            localStream,
            remoteStream,
            callerInfo,
            startCall,
            acceptCall: handleAcceptCall,
            rejectCall,
            endCall,
            toggleMute,
            toggleCamera,
            isMuted,
            isCameraOff,
            isVideoCall,
            isRemoteCameraOff
        }}>
            {children}
        </CallContext.Provider>
    );
};
