'use client';

// ==============================================================================
// GLOBAL NOTIFICATION & INCOMING CALL ENGINE (GlobalNotificationListener.tsx)
// Continuous Real-Time Supabase Message & Call Alerts across All Routes
// ==============================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Phone, PhoneOff, Video, MessageSquare, X, Shield, Volume2, User } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import { daheejStore } from '../../lib/supabase/store';
import { ChatMessage, Profile } from '../../types';

export interface IncomingCallData {
  room_id: string;
  callType: 'video' | 'voice' | 'audio';
  caller_name: string;
  caller_avatar?: string;
  sender_id: string;
  timestamp: number;
}

export interface FloatingMessageToast {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string;
  content: string;
  timestamp: number;
}

interface GlobalNotificationListenerProps {
  currentUserId?: string | null;
  onNavigateToChat?: (partnerId: string) => void;
  onNavigateToCall?: (roomId: string, callType: string) => void;
}

export const GlobalNotificationListener: React.FC<GlobalNotificationListenerProps> = ({
  currentUserId: propUserId,
  onNavigateToChat,
  onNavigateToCall,
}) => {
  const [activeUserId, setActiveUserId] = useState<string>(() => propUserId || daheejStore.getCurrentUserId() || '');
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [messageToast, setMessageToast] = useState<FloatingMessageToast | null>(null);
  const ringtoneAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync active user ID
  useEffect(() => {
    if (propUserId) {
      setActiveUserId(propUserId);
    } else {
      const fetchSession = async () => {
        const { data } = await supabase.auth.getUser();
        if (data?.user?.id) {
          setActiveUserId(data.user.id);
        } else {
          setActiveUserId(daheejStore.getCurrentUserId() || '');
        }
      };
      fetchSession();

      const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        setActiveUserId(session?.user?.id || daheejStore.getCurrentUserId() || '');
      });

      return () => {
        authListener?.subscription?.unsubscribe();
      };
    }
  }, [propUserId]);

  // Play continuous ringing sound (Audio element + Web Audio Synth Fallback)
  const startRingtone = useCallback(() => {
    try {
      if (!ringtoneAudioRef.current) {
        const audio = new Audio('https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg');
        audio.loop = true;
        audio.volume = 0.7;
        ringtoneAudioRef.current = audio;
      }
      ringtoneAudioRef.current.currentTime = 0;
      ringtoneAudioRef.current.play().catch((e) => {
        console.info('[GlobalNotification] Audio file autoplay restricted, activating synth beeps:', e);
        // Synthesizer beep fallback using Web Audio API
        try {
          const AudioContextClass = window.AudioContext || (window as any as any).webkitAudioContext;
          if (AudioContextClass) {
            const ctx = new AudioContextClass();
            audioContextRef.current = ctx;

            const playBeep = () => {
              if (ctx.state === 'suspended') {
                ctx.resume();
              }
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(440, ctx.currentTime);
              osc.frequency.setValueAtTime(480, ctx.currentTime + 0.2);
              gain.gain.setValueAtTime(0.15, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start();
              osc.stop(ctx.currentTime + 0.8);
            };

            playBeep();
            oscillatorIntervalRef.current = setInterval(playBeep, 2000);
          }
        } catch (synthErr) {
          console.warn('[GlobalNotification] Synth beep error:', synthErr);
        }
      });
    } catch (err) {
      console.error('[GlobalNotification] Ringtone error:', err);
    }
  }, []);

  // Stop ringtone completely
  const stopRingtone = useCallback(() => {
    if (ringtoneAudioRef.current) {
      try {
        ringtoneAudioRef.current.pause();
        ringtoneAudioRef.current.currentTime = 0;
      } catch (e) {
        // Ignore
      }
    }
    if (oscillatorIntervalRef.current) {
      clearInterval(oscillatorIntervalRef.current);
      oscillatorIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {
        // Ignore
      }
      audioContextRef.current = null;
    }
  }, []);

  // Play brief message chime
  const playMessageChime = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || (window as any as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch {
      // Ignore
    }
  }, []);

  // Helper to parse CALL_INVITE messages
  const parseCallInvite = (content: string) => {
    if (!content) return null;
    if (content === 'CALL_INVITE') {
      return { room_id: `room_${Date.now()}`, callType: 'video' as const, caller_name: 'Matched Partner' };
    }
    if (content.startsWith('CALL_INVITE:')) {
      try {
        return JSON.parse(content.replace('CALL_INVITE:', ''));
      } catch {
        return { room_id: `room_${Date.now()}`, callType: 'video' as const, caller_name: 'Matched Partner' };
      }
    }
    return null;
  };

  // Main real-time subscription for logged-in user
  useEffect(() => {
    if (!activeUserId) return;

    let isMounted = true;
    const channelName = `global_alerts_user_${activeUserId}_${Math.random().toString(36).slice(2, 9)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload: any) => {
          const newMsg = payload?.new as ChatMessage;
          if (!newMsg || !isMounted) return;

          const receiver = newMsg.receiver_id || (newMsg as any as any).recipient_id;
          const sender = newMsg.sender_id;

          // Message must be addressed to the current logged-in user and NOT sent by self
          if (receiver !== activeUserId || sender === activeUserId) return;

          // If it is a call cancellation/ended message, dismiss any pending notification
          if (
            newMsg.content?.includes('CALL_ENDED') ||
            newMsg.content?.includes('CALL_DECLINED') ||
            newMsg.content?.includes('CALL_MISSED')
          ) {
            stopRingtone();
            setIncomingCall(null);
            return;
          }

          const invite = parseCallInvite(newMsg.content);

          if (invite) {
            // Note: Dedicated full-screen modal & ringtone is handled by GlobalCallPopup
            // Only trigger if not already in a call room and not expired
            if (
              typeof window !== 'undefined' &&
              !window.location.pathname.includes('/call') &&
              !window.location.href.includes('/call/')
            ) {
              const callerName = invite.caller_name || 'Matched Partner';
              // Native Browser Notification for Incoming Call
              if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                new Notification(`Incoming ${invite.callType === 'video' ? 'Video' : 'Voice'} Call from ${callerName}`, {
                  body: 'Click to answer 1-on-1 Shariah verified call',
                  icon: '/favicon.ico',
                  requireInteraction: true,
                });
              }
            }
          } else if (!newMsg.content?.includes('CALL_')) {
            // INCOMING TEXT MESSAGE
            let senderName = 'Matched Partner';
            let senderAvatar = '';
            const cachedProfile = daheejStore.getProfileById(sender);
            if (cachedProfile) {
              senderName = cachedProfile.full_name || senderName;
              senderAvatar = cachedProfile.avatar_url || '';
            }

            playMessageChime();

            // Floating Toast
            if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
            setMessageToast({
              id: newMsg.id || `toast_${Date.now()}`,
              sender_id: sender,
              sender_name: senderName,
              sender_avatar: senderAvatar,
              content: newMsg.content || 'Sent you a new message',
              timestamp: Date.now(),
            });

            toastTimeoutRef.current = setTimeout(() => {
              setMessageToast(null);
            }, 5000);

            // Native Browser Notification if tab is hidden
            if (
              typeof window !== 'undefined' &&
              document.hidden &&
              'Notification' in window &&
              Notification.permission === 'granted'
            ) {
              new Notification(`New message from ${senderName}`, {
                body: newMsg.content || 'Sent you a new message',
                icon: '/favicon.ico',
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      stopRingtone();
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, [activeUserId, startRingtone, stopRingtone, playMessageChime]);

  // Handle Accept Call
  const handleAcceptCall = () => {
    if (!incomingCall) return;
    stopRingtone();
    const { room_id, callType } = incomingCall;
    setIncomingCall(null);

    if (onNavigateToCall) {
      onNavigateToCall(room_id, callType);
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('app:navigate', {
          detail: { tab: 'call', path: `/call/${room_id}?callType=${callType}&role=receiver` },
        })
      );
      window.location.href = `/call/${room_id}?callType=${callType}&role=receiver`;
    }
  };

  // Handle Decline Call
  const handleDeclineCall = async () => {
    if (!incomingCall) return;
    stopRingtone();
    const partnerId = incomingCall.sender_id;
    setIncomingCall(null);

    // Send declination notice
    try {
      await supabase.from('messages').insert({
        sender_id: activeUserId,
        receiver_id: partnerId,
        recipient_id: partnerId,
        content: 'CALL_DECLINED',
        created_at: new Date().toISOString(),
      });
    } catch {
      // Ignore
    }
  };

  // Handle Toast Click
  const handleToastClick = () => {
    if (!messageToast) return;
    const partnerId = messageToast.sender_id;
    setMessageToast(null);

    if (onNavigateToChat) {
      onNavigateToChat(partnerId);
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('app:navigate', {
          detail: { tab: 'messages', partnerId },
        })
      );
    }
  };

  return (
    <>
      {/* 1. FULL-SCREEN INCOMING CALL MODAL OVERLAY (z-[9999]) */}
      {incomingCall && (
        <div className="fixed inset-0 z-[9999] bg-zinc-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl space-y-6 text-white relative overflow-hidden">
            {/* Top decorative pulse wave */}
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl animate-pulse" />
            <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl animate-pulse" />

            {/* Shariah Anti-Dowry Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 text-[11px] font-semibold">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Encrypted Dowry-Free Nikah Call</span>
            </div>

            {/* Caller Avatar with Radial Ring Animation */}
            <div className="relative mx-auto w-24 h-24">
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
              <div className="relative w-24 h-24 rounded-full border-3 border-emerald-500 overflow-hidden bg-zinc-800 flex items-center justify-center shadow-lg">
                {incomingCall.caller_avatar ? (
                  <img
                    src={incomingCall.caller_avatar}
                    alt={incomingCall.caller_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-10 h-10 text-zinc-400" />
                )}
              </div>
            </div>

            {/* Caller Name & Call Type */}
            <div className="space-y-1">
              <h3 className="text-xl font-extrabold text-white tracking-tight">{incomingCall.caller_name}</h3>
              <p className="text-xs text-emerald-400 flex items-center justify-center gap-1.5 font-medium">
                {incomingCall.callType === 'video' ? (
                  <>
                    <Video className="w-4 h-4 animate-bounce" /> Incoming Video Call...
                  </>
                ) : (
                  <>
                    <Phone className="w-4 h-4 animate-bounce" /> Incoming Voice Call...
                  </>
                )}
              </p>
              <p className="text-[11px] text-zinc-400">Ringing via DaheejFree Realtime signaling</p>
            </div>

            {/* Action Buttons: Accept & Decline */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              {/* Decline Button */}
              <button
                id="btn-global-decline-call"
                onClick={handleDeclineCall}
                className="py-3 px-4 rounded-2xl bg-rose-600/90 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-rose-950/50"
              >
                <PhoneOff className="w-4 h-4" />
                <span>Decline</span>
              </button>

              {/* Accept Button */}
              <button
                id="btn-global-accept-call"
                onClick={handleAcceptCall}
                className="py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/50 hover:scale-102"
              >
                {incomingCall.callType === 'video' ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                <span>Accept</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. FLOATING TOP-RIGHT INCOMING MESSAGE TOAST */}
      {messageToast && (
        <div className="fixed top-20 right-4 z-50 max-w-sm w-full bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl shadow-xl p-3.5 flex items-start gap-3 animate-in slide-in-from-top-4 duration-200 text-zinc-900 dark:text-zinc-100">
          <div className="relative w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-700 overflow-hidden flex-shrink-0 flex items-center justify-center text-emerald-800 dark:text-emerald-300 font-bold text-sm">
            {messageToast.sender_avatar ? (
              <img
                src={messageToast.sender_avatar}
                alt={messageToast.sender_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{messageToast.sender_name.charAt(0)}</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <h4 className="text-xs font-bold text-zinc-900 dark:text-white truncate">{messageToast.sender_name}</h4>
              <button
                onClick={() => setMessageToast(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-300 line-clamp-1 mt-0.5">{messageToast.content}</p>

            <div className="mt-2 flex items-center gap-2">
              <button
                id="btn-toast-reply"
                onClick={handleToastClick}
                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition cursor-pointer flex items-center gap-1"
              >
                <MessageSquare className="w-3 h-3" />
                Reply in Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GlobalNotificationListener;
