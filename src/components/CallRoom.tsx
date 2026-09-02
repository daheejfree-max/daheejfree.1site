'use client';

// ==============================================================================
// CALL ROOM COMPONENT (src/components/CallRoom.tsx)
// Robust WebRTC Audio & Video Calling Engine with Resilient Signaling & Media Fallback
// ==============================================================================

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from '../lib/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { daheejStore } from '../lib/supabase/store';
import { acquireMediaWithFallback } from '../lib/webrtcMediaFallback';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  Shield,
  Clock,
  AlertCircle,
  Camera,
  RefreshCw,
  ArrowLeft,
  Lock,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface CallRoomProps {
  roomID?: string;
  roomId?: string;
  callType?: 'video' | 'voice' | 'audio';
  userName?: string;
  partnerAvatar?: string | null;
  role?: 'caller' | 'receiver';
}

type ConnectionPhase =
  | 'Acquiring Media...'
  | 'Waiting for Partner...'
  | 'Connecting Securely...'
  | 'Connected'
  | 'Disconnected';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ],
  iceCandidatePoolSize: 10,
};

export default function CallRoom({
  roomID,
  roomId: propRoomId,
  callType = 'video',
  userName = 'Matched Partner',
  partnerAvatar = null,
  role: propRole,
}: CallRoomProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Normalized room ID (strictly uniform across all peers)
  const activeRoomId = (roomID || propRoomId || 'default-room').trim();
  const isVideo = callType === 'video';

  // Role determination via URL params or props
  const queryRole = searchParams ? searchParams.get('role') : null;
  const isCaller = propRole === 'caller' || queryRole === 'caller' || (!propRole && queryRole !== 'receiver');

  // Unique local peer identifier to avoid self-echoing
  const localPeerIdRef = useRef<string>(`peer_${Math.random().toString(36).substring(2, 10)}`);
  const myUserIdRef = useRef<string>('');

  // Connection and UI states
  const [phase, setPhase] = useState<ConnectionPhase>('Acquiring Media...');
  const [isAcquiringMedia, setIsAcquiringMedia] = useState<boolean>(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [hasRemoteStream, setHasRemoteStream] = useState<boolean>(false);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [permissionError, setPermissionError] = useState<{
    name: string;
    message: string;
  } | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [isCameraOff, setIsCameraOff] = useState<boolean>(callType === 'voice' || callType === 'audio');
  const [isSpeakerMuted, setIsSpeakerMuted] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(0);
  const [isHangingUp, setIsHangingUp] = useState<boolean>(false);

  // References
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<any>(null);
  const dbChannelRef = useRef<any>(null);
  const iceQueue = useRef<RTCIceCandidateInit[]>([]);

  const isTerminatedRef = useRef<boolean>(false);
  const hasOfferedRef = useRef<boolean>(false);
  const ringingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Dynamic state refs for closures
  const isCallerRef = useRef<boolean>(isCaller);
  isCallerRef.current = isCaller;
  const isVideoRef = useRef<boolean>(isVideo);
  isVideoRef.current = isVideo;
  const activeRoomIdRef = useRef<string>(activeRoomId);
  activeRoomIdRef.current = activeRoomId;

  // Handler references to prevent stale callbacks
  const handleSignalingDataRef = useRef<(payload: any) => Promise<void>>(async () => {});
  const handleHangupRef = useRef<(e?: React.MouseEvent, broadcast?: boolean) => Promise<void>>(async () => {});
  const broadcastSignalRef = useRef<(data: any) => void>(() => {});
  const createAndSendOfferRef = useRef<() => Promise<void>>(async () => {});

  // Initialize Supabase SSR browser client safely
  const supabaseUrl =
    (typeof process !== 'undefined'
      ? process.env?.NEXT_PUBLIC_SUPABASE_URL || process.env?.VITE_SUPABASE_URL
      : undefined) || '';
  const supabaseAnonKey =
    (typeof process !== 'undefined'
      ? process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env?.VITE_SUPABASE_ANON_KEY
      : undefined) || '';

  const [supabase] = useState(() =>
    createBrowserClient(supabaseUrl, supabaseAnonKey, {
      cookieOptions: {
        sameSite: 'none',
        secure: true,
      },
    })
  );

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isConnected = connectionState === 'connected' || phase === 'Connected';

  // Helper to send broadcast payload safely
  const broadcastSignal = useCallback(
    (data: any) => {
      const payloadWithMeta = {
        ...data,
        senderPeerId: localPeerIdRef.current,
        senderUserId: myUserIdRef.current,
        roomId: activeRoomIdRef.current,
        timestamp: Date.now(),
      };

      if (channelRef.current) {
        try {
          channelRef.current.send({
            type: 'broadcast',
            event: 'webrtc-signal',
            payload: payloadWithMeta,
          });
        } catch (err) {
          console.warn('[CallRoom] Broadcast signal warning:', err);
        }
      }
    },
    []
  );
  broadcastSignalRef.current = broadcastSignal;

  // Fault-tolerant hangup and routing routine
  const handleHangup = useCallback(
    async (e?: React.MouseEvent, broadcast = true) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (isTerminatedRef.current) return;
      isTerminatedRef.current = true;
      setIsHangingUp(true);
      setPhase('Disconnected');

      // Clear all active timers
      if (ringingTimeoutRef.current) {
        clearTimeout(ringingTimeoutRef.current);
        ringingTimeoutRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      // Broadcast termination if channel is active
      if (broadcast && channelRef.current) {
        try {
          broadcastSignalRef.current({ type: 'call-ended' });
        } catch (err) {
          console.warn('[CallRoom] Hangup broadcast notice:', err);
        }
      }

      // 1. Stop hardware media streams
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
            track.enabled = false;
          } catch (err) {}
        });
        localStreamRef.current = null;
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }

      // 2. Close Peer Connection
      if (pcRef.current) {
        try {
          pcRef.current.close();
        } catch (err) {}
        pcRef.current = null;
      }

      // 3. Remove Supabase Channels
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch (err) {}
        channelRef.current = null;
      }
      if (dbChannelRef.current) {
        try {
          supabase.removeChannel(dbChannelRef.current);
        } catch (err) {}
        dbChannelRef.current = null;
      }

      // 4. Update call signal status in DB
      try {
        await supabase
          .from('call_signals')
          .update({ type: 'call-ended' })
          .eq('room_id', activeRoomIdRef.current);
      } catch (dbErr) {
        console.warn('[CallRoom] DB signal hangup notice:', dbErr);
      }

      // 5. Clean navigation routing
      if (typeof window !== 'undefined') {
        if (window.opener && !window.opener.closed) {
          window.close();
          return;
        }
        try {
          router.push('/messages');
        } catch {
          window.location.href = '/messages';
        }
      }
    },
    [router, supabase]
  );
  handleHangupRef.current = handleHangup;

  // Resolve current user ID on mount
  useEffect(() => {
    async function resolveUser() {
      const { data } = await supabase.auth.getUser();
      if (data?.user?.id) {
        myUserIdRef.current = data.user.id;
      } else {
        const localUid = daheejStore.getCurrentUserId();
        if (localUid) {
          myUserIdRef.current = localUid;
        }
      }
    }
    resolveUser();
  }, [supabase]);

  // Method to generate and broadcast SDP offer
  const createAndSendOffer = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || isTerminatedRef.current) return;
    if (pc.signalingState !== 'stable') return;

    try {
      setPhase('Connecting Securely...');
      hasOfferedRef.current = true;

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: isVideoRef.current,
      });

      await pc.setLocalDescription(offer);

      broadcastSignalRef.current({
        type: 'offer',
        sdp: offer,
        payload: { sdp: offer },
      });

      // Also persist to DB as fallback for cross-network reliability
      const myId = myUserIdRef.current;
      const targetRoom = activeRoomIdRef.current;
      if (myId && targetRoom) {
        try {
          await supabase.from('call_signals').upsert({
            room_id: targetRoom,
            caller_id: myId,
            receiver_id: 'peer',
            type: 'offer',
            payload: { sdp: offer },
          });
        } catch (e) {}
      }
    } catch (offerErr: any) {
      console.error('[CallRoom] Create offer error:', offerErr);
    }
  }, [supabase]);
  createAndSendOfferRef.current = createAndSendOffer;

  // Supabase Realtime Shared Broadcast Channel (Uniform room channel for both peers)
  useEffect(() => {
    let isMounted = true;
    const currentRoomId = activeRoomId;
    const channelName = `call_webrtc_${currentRoomId}`;

    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { ack: true },
      },
    });
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'webrtc-signal' }, (payload: any) => {
        const data = payload?.payload || payload;
        if (isMounted && data) {
          // Ignore own echo
          if (data.senderPeerId === localPeerIdRef.current) return;
          if (data.senderUserId && data.senderUserId === myUserIdRef.current && myUserIdRef.current !== '') return;
          handleSignalingDataRef.current(data);
        }
      })
      .on('broadcast', { event: 'webrtc' }, (payload: any) => {
        const data = payload?.payload || payload;
        if (isMounted && data) {
          if (data.senderPeerId === localPeerIdRef.current) return;
          if (data.senderUserId && data.senderUserId === myUserIdRef.current && myUserIdRef.current !== '') return;
          handleSignalingDataRef.current(data);
        }
      })
      .subscribe((status: string) => {
        if (isMounted && status === 'SUBSCRIBED') {
          // Announce presence immediately
          broadcastSignalRef.current({
            type: isCallerRef.current ? 'caller-joined' : 'peer-ready',
          });

          // Periodic pulse for 15 seconds to ensure discovery
          let attempts = 0;
          pingIntervalRef.current = setInterval(() => {
            attempts += 1;
            if (
              channelRef.current &&
              isMounted &&
              !isTerminatedRef.current &&
              connectionState !== 'connected' &&
              attempts < 8
            ) {
              if (isCallerRef.current && !hasOfferedRef.current && pcRef.current?.signalingState === 'stable') {
                createAndSendOfferRef.current();
              } else if (!isCallerRef.current) {
                broadcastSignalRef.current({ type: 'peer-ready' });
              }
            } else if (pingIntervalRef.current) {
              clearInterval(pingIntervalRef.current);
              pingIntervalRef.current = null;
            }
          }, 2000);
        }
      });

    return () => {
      isMounted = false;
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [activeRoomId, connectionState, supabase]);

  // Database listener for postgres changes on call_signals and initial sync
  useEffect(() => {
    let isMounted = true;
    const currentRoomId = activeRoomId;
    const dbChannelName = `call_db_${currentRoomId}`;

    // Catch up on any existing offer/answer signals in this room
    async function syncExistingSignals() {
      try {
        const { data: signals } = await supabase
          .from('call_signals')
          .select('*')
          .eq('room_id', currentRoomId)
          .order('created_at', { ascending: true });

        if (isMounted && signals && signals.length > 0) {
          const myId = myUserIdRef.current;
          for (const record of signals) {
            if (record.type === 'offer' && record.caller_id !== myId) {
              handleSignalingDataRef.current({
                type: 'offer',
                sdp: record.payload?.sdp || record.payload,
                payload: record.payload,
                senderUserId: record.caller_id,
              });
            } else if (record.type === 'answer' && record.caller_id !== myId) {
              handleSignalingDataRef.current({
                type: 'answer',
                sdp: record.payload?.sdp || record.payload,
                payload: record.payload,
                senderUserId: record.caller_id,
              });
            }
          }
        }
      } catch (err) {
        console.warn('[CallRoom] Initial DB signals sync warning:', err);
      }
    }

    syncExistingSignals();

    const dbChannel = supabase
      .channel(dbChannelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_signals',
          filter: `room_id=eq.${currentRoomId}`,
        },
        (payload: any) => {
          if (!isMounted) return;
          const record = payload.new;
          if (!record) return;

          // Avoid self reflections
          const myId = myUserIdRef.current;
          if (record.caller_id === myId && record.type === 'offer') return;

          if (
            record.type === 'reject-call' ||
            record.type === 'end-call' ||
            record.type === 'call-ended'
          ) {
            handleHangupRef.current(undefined, false);
          } else if (record.type === 'offer') {
            if (record.caller_id !== myId && record.payload) {
              handleSignalingDataRef.current({
                type: 'offer',
                sdp: record.payload?.sdp || record.payload,
                payload: record.payload,
                senderUserId: record.caller_id,
              });
            }
          } else if (record.type === 'answer' || record.type === 'CALL_ACCEPTED') {
            if (ringingTimeoutRef.current) {
              clearTimeout(ringingTimeoutRef.current);
              ringingTimeoutRef.current = null;
            }
            if (record.payload?.sdp || record.payload) {
              handleSignalingDataRef.current({
                type: 'answer',
                sdp: record.payload?.sdp || record.payload,
                payload: record.payload,
                senderUserId: record.caller_id,
              });
            }
            setPhase((prev) => (prev === 'Waiting for Partner...' ? 'Connecting Securely...' : prev));
          } else if (record.type === 'ice-candidate' || record.type === 'ice') {
            if (record.caller_id !== myId && record.payload) {
              handleSignalingDataRef.current({
                type: 'ice-candidate',
                candidate: record.payload.candidate || record.payload,
                payload: record.payload,
              });
            }
          }
        }
      )
      .subscribe();
    dbChannelRef.current = dbChannel;

    return () => {
      isMounted = false;
      supabase.removeChannel(dbChannel);
    };
  }, [activeRoomId, supabase]);

  // WebRTC Initialization & Media Engine Setup
  useEffect(() => {
    let isMounted = true;
    isTerminatedRef.current = false;
    hasOfferedRef.current = false;
    iceQueue.current = [];

    const callerMode = isCallerRef.current;
    const videoMode = isVideoRef.current;
    const targetRoomId = activeRoomIdRef.current;

    const initMediaAndPeer = async () => {
      setPermissionError(null);
      setGeneralError(null);
      setPhase('Acquiring Media...');
      setIsAcquiringMedia(true);

      let stream: MediaStream | null = null;
      let mediaSuccess = false;

      // 1. Resilient Hardware & Synthetic Media Acquisition (Never hangs)
      try {
        const mediaResult = await acquireMediaWithFallback({
          video: videoMode,
          audio: true,
          userLabel: 'You',
          timeoutMs: 3000,
        });

        stream = mediaResult.stream;
        mediaSuccess = Boolean(stream && stream.getTracks().length > 0);

        if (mediaResult.isAudioOnly || mediaResult.isSynthetic) {
          if (!videoMode) setIsCameraOff(true);
        }

        setLocalStream(stream);
        localStreamRef.current = stream;

        if (localVideoRef.current && stream) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        }
      } catch (mediaErr: any) {
        console.warn('[CallRoom] Media fallback notice:', mediaErr);
        // Fallback synthetic stream
        try {
          const fallbackRes = await acquireMediaWithFallback({
            video: false,
            audio: true,
            userLabel: 'You',
            timeoutMs: 1000,
          });
          stream = fallbackRes.stream;
          mediaSuccess = true;
          setLocalStream(stream);
          localStreamRef.current = stream;
        } catch (e) {
          setGeneralError('Could not initialize audio stream.');
        }
      } finally {
        if (isMounted) {
          setIsAcquiringMedia(false);
          if (mediaSuccess) {
            setPhase(callerMode ? 'Waiting for Partner...' : 'Connecting Securely...');
          } else {
            setPhase('Disconnected');
          }
        }
      }

      if (!stream || !isMounted) return;

      // 2. Initialize RTCPeerConnection
      try {
        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;

        // Attach local tracks
        stream.getTracks().forEach((track) => {
          try {
            pc.addTrack(track, stream!);
          } catch (trackErr) {
            console.error('[CallRoom] Add track error:', trackErr);
          }
        });

        // Remote Track Handler
        pc.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            const remoteStream = event.streams[0];
            remoteStreamRef.current = remoteStream;
            setHasRemoteStream(true);

            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
              remoteVideoRef.current.play().catch(() => {});
            }
            if (remoteAudioRef.current) {
              remoteAudioRef.current.srcObject = remoteStream;
              remoteAudioRef.current.play().catch(() => {});
            }

            setPhase('Connected');
            setConnectionState('connected');

            if (ringingTimeoutRef.current) {
              clearTimeout(ringingTimeoutRef.current);
              ringingTimeoutRef.current = null;
            }
            if (!timerRef.current) {
              timerRef.current = setInterval(() => {
                setDuration((prev) => prev + 1);
              }, 1000);
            }
          }
        };

        // ICE Candidate Dispatcher
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            const cand = event.candidate.toJSON ? event.candidate.toJSON() : event.candidate;
            broadcastSignalRef.current({
              type: 'ice-candidate',
              candidate: cand,
              payload: { candidate: cand },
            });
          }
        };

        // Connection State Monitoring
        pc.onconnectionstatechange = () => {
          if (!isMounted) return;
          const state = pc.connectionState;
          setConnectionState(state);

          if (state === 'connected') {
            setPhase('Connected');
            if (ringingTimeoutRef.current) {
              clearTimeout(ringingTimeoutRef.current);
              ringingTimeoutRef.current = null;
            }
            if (!timerRef.current) {
              timerRef.current = setInterval(() => {
                setDuration((prev) => prev + 1);
              }, 1000);
            }
          } else if (state === 'failed' || state === 'disconnected') {
            // Attempt ICE restart if caller
            if (callerMode && pc.signalingState === 'stable') {
              createAndSendOfferRef.current();
            }
          }
        };

        pc.oniceconnectionstatechange = () => {
          if (!isMounted) return;
          const iceState = pc.iceConnectionState;
          if (iceState === 'connected' || iceState === 'completed') {
            setPhase('Connected');
            setConnectionState('connected');
            if (ringingTimeoutRef.current) {
              clearTimeout(ringingTimeoutRef.current);
              ringingTimeoutRef.current = null;
            }
            if (!timerRef.current) {
              timerRef.current = setInterval(() => {
                setDuration((prev) => prev + 1);
              }, 1000);
            }
          }
        };

        // 60-Second Ringing Timeout for Callers
        if (callerMode) {
          ringingTimeoutRef.current = setTimeout(() => {
            if (isMounted && pcRef.current?.connectionState !== 'connected') {
              handleHangupRef.current(undefined, true);
            }
          }, 60000);
        }

        // 3. Signaling Message Dispatcher
        handleSignalingDataRef.current = async (payload: any) => {
          if (!pcRef.current || isTerminatedRef.current) return;
          const currentPc = pcRef.current;
          const signalType = payload.type || payload.event;

          if (signalType === 'call-ended' || signalType === 'end-call' || signalType === 'reject-call') {
            handleHangupRef.current(undefined, false);
            return;
          }

          // A. Peer readiness signal: retransmit offer or create new offer
          if (signalType === 'peer-ready' || signalType === 'receiver-joined' || signalType === 'caller-joined') {
            if (currentPc.signalingState === 'have-local-offer' && currentPc.localDescription) {
              // Retransmit local offer to newly joined peer
              broadcastSignalRef.current({
                type: 'offer',
                sdp: currentPc.localDescription,
                payload: { sdp: currentPc.localDescription },
              });
            } else if (currentPc.signalingState === 'stable') {
              await createAndSendOfferRef.current();
            }
          }

          // B. Incoming Offer (Handles both receiver role and offer collision glare)
          if (signalType === 'offer') {
            const offerSdp = payload.payload?.sdp || payload.sdp;
            if (!offerSdp) return;

            try {
              if (currentPc.signalingState === 'stable') {
                setPhase('Connecting Securely...');
                await currentPc.setRemoteDescription(new RTCSessionDescription(offerSdp));

                // Drain buffered ICE candidates
                if (iceQueue.current.length > 0) {
                  for (const cand of iceQueue.current) {
                    try {
                      await currentPc.addIceCandidate(new RTCIceCandidate(cand));
                    } catch (iceErr) {}
                  }
                  iceQueue.current = [];
                }

                const answer = await currentPc.createAnswer();
                await currentPc.setLocalDescription(answer);

                broadcastSignalRef.current({
                  type: 'answer',
                  sdp: answer,
                  payload: { sdp: answer },
                });

                // Persist answer to DB
                const myId = myUserIdRef.current;
                if (myId && targetRoomId) {
                  try {
                    await supabase.from('call_signals').upsert({
                      room_id: targetRoomId,
                      caller_id: myId,
                      receiver_id: 'peer',
                      type: 'answer',
                      payload: { sdp: answer },
                    });
                  } catch (e) {}
                }
              } else if (currentPc.signalingState === 'have-local-offer') {
                // Glare collision tie-breaker: polite peer yields
                const remotePeer = payload.senderPeerId || payload.senderUserId || '';
                const isPolite = localPeerIdRef.current < remotePeer;

                if (isPolite) {
                  console.info('[CallRoom] Glare detected, yielding as polite peer...');
                  await currentPc.setRemoteDescription(new RTCSessionDescription(offerSdp));

                  if (iceQueue.current.length > 0) {
                    for (const cand of iceQueue.current) {
                      try {
                        await currentPc.addIceCandidate(new RTCIceCandidate(cand));
                      } catch (iceErr) {}
                    }
                    iceQueue.current = [];
                  }

                  const answer = await currentPc.createAnswer();
                  await currentPc.setLocalDescription(answer);

                  broadcastSignalRef.current({
                    type: 'answer',
                    sdp: answer,
                    payload: { sdp: answer },
                  });
                }
              }
            } catch (err: any) {
              console.error('[CallRoom] Offer processing error:', err);
            }
          }

          // C. Incoming Answer
          if (signalType === 'answer') {
            const answerSdp = payload.payload?.sdp || payload.sdp;
            if (currentPc.signalingState === 'have-local-offer' && answerSdp) {
              try {
                await currentPc.setRemoteDescription(new RTCSessionDescription(answerSdp));
                setPhase('Connected');
                setConnectionState('connected');

                // Drain buffered ICE candidates
                if (iceQueue.current.length > 0) {
                  for (const cand of iceQueue.current) {
                    try {
                      await currentPc.addIceCandidate(new RTCIceCandidate(cand));
                    } catch (iceErr) {}
                  }
                  iceQueue.current = [];
                }
              } catch (err: any) {
                console.error('[CallRoom] Set remote answer error:', err);
              }
            }
          }

          // D. Process incoming ICE Candidate
          if (signalType === 'ice-candidate' || signalType === 'ice' || signalType === 'candidate') {
            const cand = payload.payload?.candidate || payload.candidate;
            if (cand) {
              if (currentPc.remoteDescription && currentPc.remoteDescription.type) {
                try {
                  await currentPc.addIceCandidate(new RTCIceCandidate(cand));
                } catch (err) {}
              } else {
                iceQueue.current.push(cand);
              }
            }
          }
        };

        // Caller can immediately initiate offer if receiver is already present
        if (callerMode) {
          setTimeout(() => {
            if (isMounted && pcRef.current?.signalingState === 'stable') {
              createAndSendOfferRef.current();
            }
          }, 600);
        } else {
          // Receiver broadcasts ready
          broadcastSignalRef.current({ type: 'peer-ready' });
        }
      } catch (peerErr: any) {
        console.error('[CallRoom] RTCPeerConnection error:', peerErr);
        setGeneralError(peerErr.message || 'WebRTC peer connection failure');
      }
    };

    initMediaAndPeer();

    return () => {
      isMounted = false;
      if (ringingTimeoutRef.current) clearTimeout(ringingTimeoutRef.current);
      if (timerRef.current) clearInterval(timerRef.current);

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch (e) {}
        });
        localStreamRef.current = null;
      }
      if (pcRef.current) {
        try {
          pcRef.current.close();
        } catch (e) {}
        pcRef.current = null;
      }
    };
  }, [activeRoomId, supabase]);

  // Video and audio stream element bindings
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStreamRef.current) {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
        remoteVideoRef.current.play().catch(() => {});
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStreamRef.current;
        remoteAudioRef.current.play().catch(() => {});
      }
    }
  }, [hasRemoteStream, isConnected]);

  // Media Controls
  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOff(!videoTrack.enabled);
      }
    }
  };

  const toggleSpeaker = () => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = !remoteAudioRef.current.muted;
      setIsSpeakerMuted(remoteAudioRef.current.muted);
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = !remoteVideoRef.current.muted;
      setIsSpeakerMuted(remoteVideoRef.current.muted);
    }
  };

  // Permission Error Screen
  if (permissionError) {
    return (
      <div className="min-h-[100dvh] w-full bg-zinc-950 flex items-center justify-center p-4 text-white font-sans">
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center space-y-5 shadow-2xl animate-fade-in pointer-events-auto">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
            <Camera className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-white">Media Permissions Required</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {permissionError.message}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-left space-y-2 text-xs text-zinc-300">
            <p className="font-semibold text-emerald-400 flex items-center gap-1.5">
              <Shield className="w-4 h-4" />
              <span>How to allow permissions:</span>
            </p>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-zinc-400 pl-1">
              <li>Click the lock or tune icon beside the URL in your browser bar</li>
              <li>Set <strong>Camera</strong> and <strong>Microphone</strong> permissions to <strong>Allow</strong></li>
              <li>Click the button below to reload and connect</li>
            </ol>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              disabled={isHangingUp}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md pointer-events-auto"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry Permission</span>
            </button>
            <button
              type="button"
              onClick={(e) => handleHangup(e, false)}
              disabled={isHangingUp}
              className="w-full py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none text-zinc-300 text-xs font-medium transition flex items-center justify-center gap-2 cursor-pointer pointer-events-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Chat</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // General Error Screen
  if (generalError) {
    return (
      <div className="min-h-[100dvh] w-full bg-zinc-950 flex items-center justify-center p-4 text-white font-sans">
        <div className="bg-zinc-900 border border-red-500/30 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center space-y-4 shadow-2xl animate-fade-in pointer-events-auto">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-base font-bold text-white">Call Connection Error</h2>
          <p className="text-xs text-zinc-400">{generalError}</p>
          <button
            type="button"
            onClick={(e) => handleHangup(e, false)}
            disabled={isHangingUp}
            className="w-full py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none text-white text-xs font-bold transition cursor-pointer pointer-events-auto"
          >
            Return to Messages
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[100dvh] w-full bg-zinc-950 overflow-hidden font-sans text-white select-none">
      {/* Hidden audio element for remote audio stream delivery */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Top Header Floating Glass Bar */}
      <div className="absolute top-0 left-0 w-full p-4 sm:p-6 flex items-center justify-between z-40 bg-gradient-to-b from-black/90 via-black/50 to-transparent pointer-events-none">
        {/* Partner Info */}
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600 border border-emerald-400/30 overflow-hidden flex items-center justify-center font-bold text-sm shadow-md">
            {partnerAvatar ? (
              <img src={partnerAvatar} alt={userName} className="w-full h-full object-cover" />
            ) : (
              userName.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <h2 className="font-bold text-sm sm:text-base leading-tight flex items-center gap-2">
              <span>{userName}</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                P2P Shariah
              </span>
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={`flex h-2 w-2 rounded-full ${
                  isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'
                }`}
              />
              <span className="text-[11px] text-zinc-300 font-medium">
                {phase}
              </span>
            </div>
          </div>
        </div>

        {/* Call Duration Timer Badge */}
        {isConnected && (
          <div className="pointer-events-auto px-3.5 py-1.5 rounded-full bg-zinc-900/90 border border-emerald-500/40 text-emerald-400 text-xs font-mono font-bold backdrop-blur-md shadow-lg flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span>{formatTime(duration)}</span>
          </div>
        )}
      </div>

      {/* Connection Feedback Overlay (Shown while waiting or connecting) */}
      {!isConnected && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-zinc-950/95 backdrop-blur-md p-6 text-center">
          <div className="relative mb-6">
            <div className="w-24 h-24 rounded-3xl bg-zinc-900 border border-emerald-500/30 overflow-hidden flex items-center justify-center text-3xl font-extrabold text-emerald-400 shadow-2xl">
              {partnerAvatar ? (
                <img src={partnerAvatar} alt={userName} className="w-full h-full object-cover" />
              ) : (
                userName.charAt(0).toUpperCase()
              )}
            </div>
            <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-zinc-950 flex items-center justify-center text-white text-[10px]">
              <Lock className="w-3 h-3" />
            </span>
          </div>

          <h3 className="text-xl font-bold text-white mb-1">{userName}</h3>
          <p className="text-xs text-zinc-400 max-w-xs mb-6 leading-relaxed">
            {isCaller
              ? 'Ringing partner with 100% Halal P2P Shariah encryption. Please wait for them to connect.'
              : 'Connecting encrypted audio & video stream with partner.'}
          </p>

          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium shadow-sm">
            <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            <span>{phase}</span>
          </div>
        </div>
      )}

      {/* Stream Video / Voice Viewports */}
      {isVideo ? (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={`w-full h-full object-cover bg-zinc-950 transition-opacity duration-300 ${
            isConnected ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 text-center p-6 space-y-4">
          <div className="w-28 h-28 rounded-full bg-emerald-950/50 border-2 border-emerald-500/40 overflow-hidden flex items-center justify-center shadow-2xl">
            {partnerAvatar ? (
              <img src={partnerAvatar} alt={userName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl font-extrabold text-emerald-300">
                {userName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">{userName}</h3>
            <p className="text-xs text-emerald-400 font-mono">
              {isConnected
                ? `Audio Stream Active • ${formatTime(duration)}`
                : 'Connecting Encrypted Audio Stream...'}
            </p>
          </div>
        </div>
      )}

      {/* Local Video Stream (PiP in Video Mode) */}
      {isVideo && (
        <div className="absolute top-20 sm:top-24 right-4 z-40 shadow-2xl rounded-2xl overflow-hidden border border-zinc-700/80 bg-zinc-900 w-28 sm:w-36 h-36 sm:h-48 transition-all">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${isCameraOff ? 'opacity-0' : 'opacity-100'}`}
          />
          {isCameraOff && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400 bg-zinc-900 p-2 text-center">
              <VideoOff className="w-6 h-6 mb-1 text-zinc-500" />
              <span className="text-[10px] font-semibold">Camera Off</span>
            </div>
          )}
          <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[9px] font-semibold text-zinc-300 backdrop-blur-xs">
            You
          </div>
        </div>
      )}

      {/* Floating Control Dock */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 sm:gap-6 z-[9999] px-6 py-3.5 bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-full shadow-2xl pb-safe pointer-events-auto">
        {/* Toggle Microphone */}
        <button
          type="button"
          onClick={toggleMic}
          disabled={isHangingUp}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none pointer-events-auto ${
            isMicMuted
              ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30'
              : 'bg-zinc-800 border border-zinc-700 text-white hover:bg-zinc-700'
          }`}
          title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Toggle Camera (in video calls) */}
        {isVideo && (
          <button
            type="button"
            onClick={toggleCamera}
            disabled={isHangingUp}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none pointer-events-auto ${
              isCameraOff
                ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30'
                : 'bg-zinc-800 border border-zinc-700 text-white hover:bg-zinc-700'
            }`}
            title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            {isCameraOff ? <VideoOff className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
          </button>
        )}

        {/* Toggle Speaker */}
        <button
          type="button"
          onClick={toggleSpeaker}
          disabled={isHangingUp}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none pointer-events-auto ${
            isSpeakerMuted
              ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30'
              : 'bg-zinc-800 border border-zinc-700 text-white hover:bg-zinc-700'
          }`}
          title={isSpeakerMuted ? 'Unmute Speaker' : 'Mute Speaker'}
        >
          {isSpeakerMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>

        {/* End Call Button */}
        <button
          id="btn-call-hangup"
          type="button"
          onClick={(e) => handleHangup(e, true)}
          disabled={isHangingUp}
          className="w-14 h-14 bg-red-600 hover:bg-red-500 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none rounded-full flex items-center justify-center shadow-[0_0_25px_rgba(220,38,38,0.5)] transition-all text-white cursor-pointer pointer-events-auto"
          title="End Call Session"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
