'use client';

// ==============================================================================
// GLOBAL INCOMING CALL POPUP COMPONENT (src/components/GlobalCallPopup.tsx)
// Full-Screen Interruption Overlay listening strictly to public.call_signals table
// ==============================================================================

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from '../lib/navigation';
import { Phone, PhoneOff, Video, Shield, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase/client';
import { daheejStore } from '../lib/supabase/store';
import {
  subscribeToCallSignals,
  declineCallSession,
  CallInviteData,
} from '../lib/callSignaling';

export const GlobalCallPopup: React.FC = () => {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallInviteData | null>(null);
  const [callerProfile, setCallerProfile] = useState<{ name: string; avatar?: string } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const synthIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Stop audio ringing completely
  const stopRingtone = useCallback(() => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch (e) {}
    }
    if (synthIntervalRef.current) {
      clearInterval(synthIntervalRef.current);
      synthIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }
  }, []);

  // Play loud looping ringtone with Web Audio fallback
  const startRingtone = useCallback(() => {
    try {
      if (!audioRef.current) {
        const audio = new Audio('https://actions.google.com/sounds/v1/alarms/phone_ringing.ogg');
        audio.loop = true;
        audio.volume = 0.85;
        audioRef.current = audio;
      }
      audioRef.current.currentTime = 0;
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Synthesizer chime fallback
          try {
            const AudioContextClass = window.AudioContext || (window as any as any).webkitAudioContext;
            if (AudioContextClass) {
              const ctx = new AudioContextClass();
              audioContextRef.current = ctx;
              const playRingBeep = () => {
                if (ctx.state === 'suspended') ctx.resume();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(440, ctx.currentTime);
                osc.frequency.setValueAtTime(480, ctx.currentTime + 0.2);
                gain.gain.setValueAtTime(0.2, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 1.2);
              };
              playRingBeep();
              synthIntervalRef.current = setInterval(playRingBeep, 2500);
            }
          } catch (synthErr) {
            console.warn('[GlobalCallPopup] Web Audio synth notice:', synthErr);
          }
        });
      }
    } catch (err) {
      console.error('[GlobalCallPopup] Ringtone error:', err);
    }
  }, []);

  // 1. Fetch current logged-in user on mount & listen to auth state changes
  useEffect(() => {
    let isMounted = true;

    async function fetchUser() {
      const { data } = await supabase.auth.getUser();
      if (data?.user?.id && isMounted) {
        setCurrentUser({ id: data.user.id });
      } else {
        const localUid = daheejStore.getCurrentUserId();
        if (localUid && isMounted) {
          setCurrentUser({ id: localUid });
        }
      }
    }

    fetchUser();

    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        if (session?.user?.id) {
          setCurrentUser({ id: session.user.id });
        } else {
          const localUid = daheejStore.getCurrentUserId();
          setCurrentUser(localUid ? { id: localUid } : null);
        }
      }
    });

    return () => {
      isMounted = false;
      authSub?.subscription?.unsubscribe();
      stopRingtone();
    };
  }, [stopRingtone]);

  // 2. Realtime Listener on public.call_signals table
  useEffect(() => {
    if (!currentUser?.id) return;
    const currentUserId = currentUser.id;
    let isMounted = true;

    const handleCallDismiss = (roomID?: string, signalId?: string) => {
      if (!isMounted) return;
      stopRingtone();
      setIncomingCall((prev) => {
        if (!prev) return null;
        if (!roomID && !signalId) return null;
        if (signalId && prev.id === signalId) return null;
        if (roomID && prev.room_id === roomID) return null;
        return null;
      });
      setCallerProfile(null);
    };

    const unsubscribe = subscribeToCallSignals(
      currentUserId,
      async (invite) => {
        if (!isMounted) return;

        // Do not trigger popup if user is already inside an active call room
        if (typeof window !== 'undefined' && (window.location.pathname.includes('/call') || window.location.href.includes('/call/'))) {
          return;
        }

        // Validate timestamp: Ignore stale invites (> 45s old)
        if (invite.timestamp) {
          const invTime = new Date(invite.timestamp).getTime();
          if (!isNaN(invTime) && Date.now() - invTime > 45000) {
            return;
          }
        }

        console.info('[GlobalCallPopup] Received active incoming call signal:', invite);

        // Fetch caller details
        let name = invite.caller_name;
        let avatar = invite.caller_avatar || '';

        if (invite.caller_id) {
          const localProfile = daheejStore.getProfileById(invite.caller_id);
          if (localProfile) {
            name = localProfile.full_name || name;
            avatar = localProfile.avatar_url || avatar;
          } else {
            try {
              const { data: dbProf } = await supabase
                .from('profiles')
                .select('full_name, avatar_url')
                .eq('id', invite.caller_id)
                .maybeSingle();
              if (dbProf) {
                name = dbProf.full_name || name;
                avatar = dbProf.avatar_url || avatar;
              }
            } catch (e) {}
          }
        }

        setCallerProfile({ name, avatar });
        setIncomingCall(invite);
        startRingtone();
      },
      (roomID, signalId) => {
        handleCallDismiss(roomID, signalId);
      }
    );

    // Also listen directly for call_signals to dismiss immediately if ended/declined/missed
    const updateChannel = supabase
      .channel(`call_signals_updates_${currentUserId}_${Math.random().toString(36).slice(2, 6)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_signals',
          filter: `receiver_id=eq.${currentUserId}`,
        },
        (payload: any) => {
          if (!isMounted) return;
          const row = (payload?.new || payload?.old) as any;
          const type = row?.type;
          if (type === 'reject-call' || type === 'end-call' || type === 'call-ended' || type === 'cancel-call') {
            handleCallDismiss(row?.room_id, row?.id);
          }
        }
      )
      .subscribe();

    // Window custom events for instant cross-component call dismissal
    const onWindowCallDismiss = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      handleCallDismiss(detail?.roomId, detail?.signalId);
    };

    window.addEventListener('call:cancelled', onWindowCallDismiss);
    window.addEventListener('call:ended', onWindowCallDismiss);
    window.addEventListener('call:declined', onWindowCallDismiss);
    window.addEventListener('call:missed', onWindowCallDismiss);

    // Also listen to local store messages for call events
    const unsubStore = daheejStore.subscribeToMessages((msg) => {
      if (
        msg.content === 'CALL_ENDED' ||
        msg.content === 'CALL_DECLINED' ||
        msg.content === 'CALL_MISSED' ||
        msg.content?.includes('CALL_ENDED') ||
        msg.content?.includes('CALL_DECLINED') ||
        msg.content?.includes('CALL_MISSED')
      ) {
        handleCallDismiss();
      }
    });

    return () => {
      isMounted = false;
      stopRingtone();
      unsubscribe();
      unsubStore();
      window.removeEventListener('call:cancelled', onWindowCallDismiss);
      window.removeEventListener('call:ended', onWindowCallDismiss);
      window.removeEventListener('call:declined', onWindowCallDismiss);
      window.removeEventListener('call:missed', onWindowCallDismiss);
      supabase.removeChannel(updateChannel);
    };
  }, [currentUser, startRingtone, stopRingtone]);

  // 3. Auto-dismiss & decline incoming call if unanswered within 35 seconds
  useEffect(() => {
    if (incomingCall) {
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = setTimeout(async () => {
        console.info('[GlobalCallPopup] Incoming call timed out (unanswered after 35s)');
        stopRingtone();
        const signalId = incomingCall.id;
        const targetRoomId = incomingCall.room_id;
        setIncomingCall(null);
        setCallerProfile(null);
        await declineCallSession(signalId, targetRoomId);
      }, 35000);
    } else {
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
    }

    return () => {
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
    };
  }, [incomingCall, stopRingtone]);

  // Handle Accept Action
  const handleAccept = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!incomingCall) return;

    stopRingtone();

    const targetRoomId = incomingCall.room_id || `room_${Date.now()}`;
    const callType = incomingCall.callType || 'video';
    const signalId = incomingCall.id;

    setIncomingCall(null);
    setCallerProfile(null);

    // Update signal in database
    if (signalId) {
      try {
        await supabase
          .from('call_signals')
          .update({ type: 'answer' })
          .eq('id', signalId);
      } catch (err) {
        console.warn('[GlobalCallPopup] Accept signal update notice:', err);
      }
    }

    // Launch Call UI
    const partnerParam = incomingCall.caller_id ? `&partnerId=${incomingCall.caller_id}` : '';
    const callUrl = `/call/${targetRoomId}?callType=${callType}&role=receiver${partnerParam}`;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('app:navigate', {
          detail: { tab: 'call', path: callUrl },
        })
      );
    }

    try {
      router.push(callUrl);
    } catch {
      if (typeof window !== 'undefined') {
        window.location.href = callUrl;
      }
    }
  };

  // Handle Decline Action
  const handleDecline = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!incomingCall) return;

    stopRingtone();

    const signalId = incomingCall.id;
    const targetRoomId = incomingCall.room_id;

    setIncomingCall(null);
    setCallerProfile(null);

    await declineCallSession(signalId, targetRoomId);
  };

  if (!incomingCall) return null;

  const displayName = callerProfile?.name || incomingCall.caller_name || 'Matrimonial Candidate';
  const displayAvatar = callerProfile?.avatar || incomingCall.caller_avatar;
  const isVideo = incomingCall.callType === 'video';

  return (
    <div
      id="global-incoming-call-modal"
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/95 backdrop-blur-xl pointer-events-auto p-4 sm:p-6 text-white select-none animate-in fade-in zoom-in-95 duration-200"
    >
      {/* Background glowing rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <div className="w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-3xl animate-pulse" />
        <div className="w-[300px] h-[300px] rounded-full bg-emerald-500/15 blur-2xl animate-ping" />
      </div>

      <div className="relative w-full max-w-sm bg-neutral-900/95 border border-neutral-800 rounded-3xl p-6 sm:p-8 text-center shadow-2xl space-y-6 pointer-events-auto">
        {/* Shariah Privacy Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 text-xs font-semibold shadow-sm">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span>Encrypted Shariah Call</span>
        </div>

        {/* Pulsing Avatar */}
        <div className="relative mx-auto w-28 h-28">
          <div className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping" />
          <div className="relative w-28 h-28 rounded-full border-4 border-emerald-500 overflow-hidden bg-neutral-800 flex items-center justify-center shadow-2xl">
            {displayAvatar ? (
              <img
                src={displayAvatar}
                alt={displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-4xl font-extrabold text-neutral-300">
                {displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <span className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-emerald-500 border-2 border-neutral-900 flex items-center justify-center text-white text-xs shadow-md">
            <Lock className="w-3.5 h-3.5" />
          </span>
        </div>

        {/* Pulsing Caller Name & Call Type */}
        <div className="space-y-1.5">
          <h2 className="text-2xl font-black text-white tracking-tight animate-pulse">
            {displayName}
          </h2>
          <p className="text-sm font-semibold text-emerald-400 flex items-center justify-center gap-2">
            {isVideo ? (
              <>
                <Video className="w-4 h-4 animate-bounce" />
                <span>Incoming 1-on-1 Video Call...</span>
              </>
            ) : (
              <>
                <Phone className="w-4 h-4 animate-bounce" />
                <span>Incoming 1-on-1 Voice Call...</span>
              </>
            )}
          </p>
          <p className="text-[11px] text-neutral-400">
            Real-time peer-to-peer cryptographic connection
          </p>
        </div>

        {/* Action Buttons: Decline (Red) & Accept (Green) */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-2">
          {/* Red Decline Button */}
          <button
            id="btn-global-decline"
            type="button"
            onClick={handleDecline}
            className="w-full py-4 rounded-xl font-bold text-white bg-red-600 hover:bg-red-500 hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)] flex items-center justify-center gap-2 cursor-pointer pointer-events-auto"
          >
            <PhoneOff className="w-5 h-5" />
            <span>Decline</span>
          </button>

          {/* Green Accept Button */}
          <button
            id="btn-global-accept"
            type="button"
            onClick={handleAccept}
            className="w-full py-4 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-500 hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(5,150,105,0.3)] flex items-center justify-center gap-2 cursor-pointer pointer-events-auto"
          >
            {isVideo ? <Video className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
            <span>Accept</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default GlobalCallPopup;
