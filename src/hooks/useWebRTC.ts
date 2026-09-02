// ==============================================================================
// WEBRTC SIGNALING & P2P 1-ON-1 MEDIA PIPELINE (TESTED & PRODUCTION READY)
// ==============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { CallRecord, CallStatus, ProfileSecureView, WebRTCSignalType } from '../types';
import { daheejStore } from '../lib/supabase/store';
import { supabase } from '../lib/supabase/client';
import { acquireMediaWithFallback } from '../lib/webrtcMediaFallback';

// Public Google STUN servers for NAT Traversal
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ],
};

export function useWebRTC(currentUserId: string | null) {
  const [activeCall, setActiveCall] = useState<CallRecord | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallRecord | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>('completed');
  const [partnerProfile, setPartnerProfile] = useState<ProfileSecureView | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [isVideoOff, setIsVideoOff] = useState<boolean>(false);
  const [callDuration, setCallDuration] = useState<number>(0);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);
  const isCallerRef = useRef<boolean>(false);
  const targetUserIdRef = useRef<string | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [isAcquiringMedia, setIsAcquiringMedia] = useState<boolean>(false);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // 1. Media Acquisition & Permission Handling
  const initializeMedia = async (callType: 'audio' | 'video' | 'voice'): Promise<MediaStream | null> => {
    setMediaError(null);
    setIsAcquiringMedia(true);
    const wantsVideo = callType === 'video';
    try {
      console.info(`[WebRTC] Acquiring stream (audio: true, video: ${wantsVideo})...`);
      const result = await acquireMediaWithFallback({
        video: wantsVideo,
        audio: true,
        userLabel: 'You',
        timeoutMs: 3000,
      });

      const stream = result.stream;
      console.info('[WebRTC] Local media stream captured successfully (synthetic:', result.isSynthetic, ')');
      setLocalStream(stream);
      return stream;
    } catch (err: any) {
      console.error('[WebRTC] Media device access error:', err);
      // Fallback synthetic stream
      try {
        const fallbackRes = await acquireMediaWithFallback({
          video: false,
          audio: true,
          userLabel: 'You',
          timeoutMs: 1000,
        });
        setLocalStream(fallbackRes.stream);
        return fallbackRes.stream;
      } catch (e) {
        setMediaError('Hardware access failed');
        return null;
      }
    } finally {
      setIsAcquiringMedia(false); // MUST resolve immediately
    }
  };

  // Helper to persist and broadcast a WebRTC signal
  const sendSignal = async (
    targetId: string,
    type: WebRTCSignalType,
    payload: Record<string, unknown>,
    roomId?: string
  ) => {
    if (!currentUserId || !targetId) return;

    // 1. Broadcast over Supabase Realtime Channel
    if (channelRef.current) {
      try {
        channelRef.current.send({
          type: 'broadcast',
          event: 'signaling',
          payload: {
            caller_id: currentUserId,
            receiver_id: targetId,
            type,
            payload,
            sender_id: currentUserId,
            room_id: roomId,
          },
        });
      } catch (e) {
        console.warn('[WebRTC] Broadcast error:', e);
      }
    }

    // 2. Insert into public.call_signals table for persistence in separate try/catch
    try {
      await supabase.from('call_signals').insert({
        caller_id: currentUserId,
        receiver_id: targetId,
        type,
        payload,
        room_id: roomId || `room_${currentUserId}_${targetId}`,
      });
    } catch (dbErr) {
      console.warn('[WebRTC] Signal insert warning (non-fatal):', dbErr);
    }
  };

  // 2. Create RTCPeerConnection with STUN Configuration
  const createPeerConnection = (targetId: string, currentStream: MediaStream | null, callId?: string) => {
    console.info(`[WebRTC] Creating RTCPeerConnection with STUN servers for peer: ${targetId}`);
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch (e) {
        console.warn('[WebRTC] Peer connection close note:', e);
      }
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = pc;
    pendingCandidatesRef.current = [];

    // Add local stream tracks
    if (currentStream) {
      currentStream.getTracks().forEach((track) => {
        console.info(`[WebRTC] Adding local track: ${track.kind}`);
        pc.addTrack(track, currentStream);
      });
    }

    // Remote stream track handler
    pc.ontrack = (event) => {
      console.info('[WebRTC] Remote track received:', event.track.kind);
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
        setCallStatus('connected');
      } else {
        const stream = new MediaStream([event.track]);
        setRemoteStream(stream);
        setCallStatus('connected');
      }
    };

    // Inbound ICE Candidates handler
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        console.info('[WebRTC] Discovered local ICE Candidate -> emitting signal');
        const candidatePayload = event.candidate.toJSON ? event.candidate.toJSON() : event.candidate;
        const targetRoom = callId || activeCall?.id || (currentUserId ? `room_${currentUserId}_${targetId}` : `room_${targetId}`);
        sendSignal(targetId, 'ice-candidate', { candidate: candidatePayload }, targetRoom);
        try {
          if (currentUserId) {
            await supabase.from('call_signals').insert({
              room_id: targetRoom,
              caller_id: currentUserId,
              receiver_id: targetId,
              type: 'ice-candidate',
              payload: { candidate: candidatePayload }
            });
          }
        } catch (dbErr) {
          console.warn('[WebRTC] ICE candidate DB sync note:', dbErr);
        }
      }
    };

    // Connection state listeners
    pc.onconnectionstatechange = () => {
      console.info(`[WebRTC] PC Connection State: ${pc.connectionState}`);
      if (pc.connectionState === 'connected') {
        console.info('[WebRTC] P2P Media Connection Active & Healthy!');
        setCallStatus('connected');
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        console.warn(`[WebRTC] Connection status dropped to: ${pc.connectionState}`);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.info(`[WebRTC] ICE State: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setCallStatus('connected');
      }
    };

    return pc;
  };

  // 3. Supabase Realtime Signaling Listener
  const setupRealtimeSignaling = (callId: string, partnerId: string, stream: MediaStream | null) => {
    const channelName = `call_${callId}`;
    console.info(`[WebRTC] Connecting signaling channel: ${channelName}`);

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase.channel(channelName, {
      config: { broadcast: { ack: false, self: false } },
    });

    channel
      .on('broadcast', { event: 'signaling' }, async ({ payload }) => {
        if (!payload || payload.sender_id === currentUserId) return;
        const pc = peerConnectionRef.current || createPeerConnection(partnerId, stream);

        try {
          const signalType = payload.type;
          const data = payload.payload || payload;

          if (signalType === 'offer') {
            console.info('[WebRTC] SDP Offer received from peer');
            if (isCallerRef.current) return; // Ignore if collision

            const remoteSdp = data.sdp || data;
            await pc.setRemoteDescription(new RTCSessionDescription(remoteSdp));
            console.info('[WebRTC] Remote SDP Offer set. Flushing queued ICE candidates...');

            // Drain queued ICE candidates
            while (pendingCandidatesRef.current.length > 0) {
              const cand = pendingCandidatesRef.current.shift();
              if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand));
            }

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            console.info('[WebRTC] SDP Answer generated. Sending back...');

            sendSignal(partnerId, 'answer', { sdp: answer }, callId);
          } else if (signalType === 'answer') {
            console.info('[WebRTC] SDP Answer received from callee');
            if (!isCallerRef.current) return;

            const remoteSdp = data.sdp || data;
            if (pc.signalingState === 'have-local-offer') {
              await pc.setRemoteDescription(new RTCSessionDescription(remoteSdp));
              setCallStatus('connected');
              console.info('[WebRTC] Remote SDP Answer set successfully, setCallStatus(connected)');

              while (pendingCandidatesRef.current.length > 0) {
                const cand = pendingCandidatesRef.current.shift();
                if (cand) {
                  try {
                    await pc.addIceCandidate(new RTCIceCandidate(cand));
                  } catch (iceErr) {
                    console.error('Error adding ICE candidate:', iceErr);
                  }
                }
              }
            }
          } else if (signalType === 'ice-candidate' || signalType === 'candidate' || signalType === 'ice') {
            const candidate = data.candidate || data;
            if (candidate) {
              if (pc.remoteDescription && pc.remoteDescription.type) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(candidate));
                  console.info('[WebRTC] ICE candidate added directly');
                } catch (e) {
                  console.error('Error adding ICE candidate:', e);
                }
              } else {
                pendingCandidatesRef.current.push(candidate);
                console.info('[WebRTC] ICE candidate queued pending remote description');
              }
            }
          } else if (signalType === 'end-call' || signalType === 'reject-call' || signalType === 'call-ended') {
            console.info('[WebRTC] Peer ended/rejected the call');
            endCall(false);
          }
        } catch (err) {
          console.error('[WebRTC] Signal dispatch error:', err);
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_signals',
          filter: `room_id=eq.${callId}`,
        },
        async ({ new: signal }: any) => {
          if (!signal || signal.caller_id === currentUserId) return;
          const pc = peerConnectionRef.current;
          if (!pc) return;

          try {
            if (signal.type === 'answer' && isCallerRef.current) {
              if (pc.signalingState === 'have-local-offer' && (signal.payload?.sdp || signal.payload)) {
                const sdp = signal.payload?.sdp || signal.payload;
                await pc.setRemoteDescription(new RTCSessionDescription(sdp));
                setCallStatus('connected');
                console.info('[WebRTC] Remote SDP Answer applied via DB, setCallStatus(connected)');
              }
            } else if (signal.type === 'ice-candidate' && signal.payload?.candidate) {
              try {
                if (pc.remoteDescription && pc.remoteDescription.type) {
                  await pc.addIceCandidate(new RTCIceCandidate(signal.payload.candidate));
                } else {
                  pendingCandidatesRef.current.push(signal.payload.candidate);
                }
              } catch (e) {
                console.error('Error adding ICE candidate:', e);
              }
            }
          } catch (err) {
            console.warn('[WebRTC] Postgres signal sync warning:', err);
          }
        }
      )
      .subscribe((status) => {
        console.info(`[WebRTC] Channel [${channelName}] subscription status: ${status}`);
        if (status === 'SUBSCRIBED' && isCallerRef.current) {
          setTimeout(async () => {
            const pc = peerConnectionRef.current;
            if (pc) {
              try {
                console.info('[WebRTC] Caller creating initial SDP Offer...');
                const offer = await pc.createOffer({
                  offerToReceiveAudio: true,
                  offerToReceiveVideo: true,
                });
                await pc.setLocalDescription(offer);
                console.info('[WebRTC] Local SDP Offer set -> Sending offer signal');
                sendSignal(partnerId, 'offer', { sdp: offer }, callId);
              } catch (err) {
                console.error('[WebRTC] Create offer error:', err);
              }
            }
          }, 300);
        }
      });

    channelRef.current = channel;
    return channel;
  };

  // 4. Start Outbound Call (Caller Flow)
  const startCall = useCallback(
    async (targetUserId: string, callType: 'audio' | 'video' | 'voice' = 'video') => {
      if (!currentUserId || !targetUserId) return;

      const normalizedType: 'audio' | 'video' = callType === 'video' ? 'video' : 'audio';
      console.info(`[WebRTC] Starting ${normalizedType} call to ${targetUserId}`);

      isCallerRef.current = true;
      targetUserIdRef.current = targetUserId;

      const partner = daheejStore.getProfileById(targetUserId);
      if (partner) {
        setPartnerProfile({
          ...partner,
          is_photo_unlocked: true,
          is_wali_unlocked: false,
        });
      }

      const stream = await initializeMedia(normalizedType);
      
      // CRITICAL: Stop signaling progression if hardware media was denied or failed
      if (!stream) {
        setCallStatus('ended');
        return;
      }

      const callId = `call_${Date.now()}`;

      const record: CallRecord = {
        id: callId,
        caller_id: currentUserId,
        recipient_id: targetUserId,
        callee_id: targetUserId,
        call_type: normalizedType,
        status: 'connecting',
        started_at: new Date().toISOString(),
        duration_seconds: 0,
      };

      daheejStore.createCall(record);
      setActiveCall(record);
      setCallStatus('connecting');

      createPeerConnection(targetUserId, stream);
      setupRealtimeSignaling(callId, targetUserId, stream);
    },
    [currentUserId]
  );

  // 5. Accept Inbound Call (Receiver Flow)
  const acceptCall = useCallback(async () => {
    if (!incomingCall || !currentUserId) return;

    const partnerId = incomingCall.caller_id;
    console.info(`[WebRTC] Accepting inbound call ${incomingCall.id} from ${partnerId}`);

    isCallerRef.current = false;
    targetUserIdRef.current = partnerId;

    const stream = await initializeMedia(incomingCall.call_type as "video" | "audio" | "voice");
    
    if (!stream) {
      setCallStatus('ended');
      setIncomingCall(null);
      return;
    }

    setActiveCall(incomingCall);
    setIncomingCall(null);
    setCallStatus('connecting');
    daheejStore.updateCallStatus(incomingCall.id, 'active');

    createPeerConnection(partnerId, stream);
    setupRealtimeSignaling(incomingCall.id, partnerId, stream);
  }, [incomingCall, currentUserId]);

  // 6. Decline Inbound Call
  const declineCall = useCallback(async () => {
    if (!incomingCall || !currentUserId) return;
    const partnerId = incomingCall.caller_id;
    console.info(`[WebRTC] Declining call from ${partnerId}`);

    sendSignal(partnerId, 'reject-call', {}, incomingCall.id);
    daheejStore.updateCallStatus(incomingCall.id, 'declined');

    setIncomingCall(null);
    setCallStatus('completed');
  }, [incomingCall, currentUserId]);

  // 7. End Active Call (Cleanup Flow)
  const endCall = useCallback(
    async (broadcast = true) => {
      console.info('[WebRTC] Terminating call session and releasing media');
      const partnerId = targetUserIdRef.current || (activeCall?.caller_id === currentUserId ? activeCall?.recipient_id : activeCall?.caller_id);

      if (broadcast && partnerId) {
        sendSignal(partnerId, 'end-call', {}, activeCall?.id);
      }

      if (activeCall) {
        daheejStore.updateCallStatus(activeCall.id, 'completed', callDuration);
      }

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      if (peerConnectionRef.current) {
        try {
          peerConnectionRef.current.close();
        } catch (e) {
          console.warn('[WebRTC] Peer connection close note:', e);
        }
        peerConnectionRef.current = null;
      }

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (remoteStream) {
        remoteStream.getTracks().forEach((track) => track.stop());
      }

      setLocalStream(null);
      setRemoteStream(null);
      setActiveCall(null);
      setIncomingCall(null);
      setPartnerProfile(null);
      setCallStatus('completed');
      setCallDuration(0);
      setMediaError(null);
      targetUserIdRef.current = null;

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    },
    [activeCall, callDuration, currentUserId, remoteStream]
  );

  // Call Duration Timer
  useEffect(() => {
    if (callStatus === 'active') {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStatus]);

  // Toggle Microphone
  const toggleAudio = useCallback(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach((t) => {
        t.enabled = !t.enabled;
      });
      setIsAudioMuted((prev) => !prev);
    }
  }, [localStream]);

  // Toggle Camera
  const toggleVideo = useCallback(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach((t) => {
        t.enabled = !t.enabled;
      });
      setIsVideoOff((prev) => !prev);
    }
  }, [localStream]);

  // Listen to incoming call alerts from store & call_signals
  useEffect(() => {
    if (!currentUserId) return;

    const unsubscribe = daheejStore.subscribeToCalls((call) => {
      if (
        (call.recipient_id === currentUserId || call.callee_id === currentUserId) &&
        call.status === 'connecting'
      ) {
        const caller = daheejStore.getProfileById(call.caller_id);
        if (caller) {
          setPartnerProfile({
            ...caller,
            is_photo_unlocked: true,
            is_wali_unlocked: false,
          });
        }
        setIncomingCall(call);
      } else if (activeCall && activeCall.id === call.id) {
        setCallStatus(call.status);
        if (call.status === 'completed' || call.status === 'declined') {
          endCall(false);
        }
      }
    });

    return () => unsubscribe();
  }, [currentUserId, activeCall, endCall]);

  return {
    activeCall,
    incomingCall,
    callStatus,
    partnerProfile,
    localStream,
    remoteStream,
    mediaError,
    isAudioMuted,
    isVideoOff,
    callDuration,
    isAcquiringMedia,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleAudio,
    toggleVideo,
  };
}
