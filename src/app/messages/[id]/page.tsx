'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import {
  Send,
  Shield,
  Phone,
  Video,
  ChevronLeft,
  AlertTriangle,
  Clock,
  CheckCheck,
  Check,
  PhoneIncoming,
  PhoneOff,
  PhoneMissed,
  Sparkles,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { Profile, ChatMessage } from '../../../types';
import { daheejStore } from '../../../lib/supabase/store';
import { moderateTextContent } from '../../../lib/moderation';
import { parseCallInvite, declineCallSession } from '../../../lib/callSignaling';
import { getDisplayName } from '../../../lib/utils';

const supabaseUrl =
  (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_SUPABASE_URL || process.env?.VITE_SUPABASE_URL : undefined) ||
  '';

const supabaseAnonKey =
  (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env?.VITE_SUPABASE_ANON_KEY : undefined) ||
  '';

export default function DirectChatRoomPage({ params }: { params?: { id?: string } }) {
  const [partnerId, setPartnerId] = useState<string>(() => {
    if (params?.id) return params.id;
    if (typeof window !== 'undefined') {
      const parts = window.location.pathname.split('/');
      const last = parts[parts.length - 1];
      if (last && last !== 'messages') return last;
    }
    return '';
  });

  const [supabase] = useState(() =>
    createBrowserClient(supabaseUrl, supabaseAnonKey, {
      cookieOptions: {
        sameSite: 'none',
        secure: true,
      },
    })
  );

  const { profile: currentProfile, tier, allProfiles } = useAuth();
  const currentUserId = currentProfile?.id || '';

  const [partnerProfile, setPartnerProfile] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputContent, setInputContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [moderationWarning, setModerationWarning] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom using isolated container-level scrollTop
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Load partner profile
  useEffect(() => {
    if (!partnerId) return;
    const found = allProfiles.find((p) => p.id === partnerId);
    if (found) {
      setPartnerProfile(found);
    } else {
      // Fallback: fetch from Supabase
      supabase
        .from('profiles')
        .select('*')
        .eq('id', partnerId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setPartnerProfile(data as Profile);
        });
    }
  }, [partnerId, allProfiles, supabase]);

  // Load messages and subscribe to Supabase Realtime
  useEffect(() => {
    if (!currentUserId || !partnerId) return;

    // Load initial local store messages
    const localMsgs = daheejStore.getMessages(currentUserId, partnerId);
    setMessages(localMsgs);

    async function loadRemoteMessages() {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .or(
            `and(sender_id.eq.${currentUserId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${currentUserId})`
          )
          .order('created_at', { ascending: true });

        if (!error && data && data.length > 0) {
          setMessages(data as ChatMessage[]);
        }
      } catch (e) {
        console.warn('[DirectChatRoom] Remote fetch notice:', e);
      } finally {
        setIsLoading(false);
      }
    }

    loadRemoteMessages();

    // Supabase Realtime Subscription (unique per mount)
    const channelId = `chat_${currentUserId}_${partnerId}_${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          const isRelevant =
            (newMsg.sender_id === currentUserId && newMsg.receiver_id === partnerId) ||
            (newMsg.sender_id === partnerId && newMsg.receiver_id === currentUserId);

          if (isRelevant) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, partnerId, supabase]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputContent.trim();
    if (!text || !currentUserId || !partnerId || isSending) return;

    // Moderation
    const modResult = moderateTextContent(text);
    if (!modResult.isClean) {
      setModerationWarning(
        modResult.rejectionReason || 'Message blocked: Dowry solicitation and inappropriate content are strictly prohibited.'
      );
      return;
    }
    setModerationWarning(null);

    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      sender_id: currentUserId,
      receiver_id: partnerId,
      content: text,
      read: false,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputContent('');
    setIsSending(true);

    try {
      // Local sync
      daheejStore.sendMessage(currentUserId, partnerId, text);

      // Remote Supabase insert
      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: currentUserId,
          receiver_id: partnerId,
          content: text,
          read: false,
        })
        .select()
        .single();

      if (!error && data) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? (data as ChatMessage) : m))
        );
      }
    } catch (err) {
      console.warn('[DirectChatRoom] Send error:', err);
    } finally {
      setIsSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleInitiateCall = (type: 'voice' | 'video') => {
    const roomId = `room_${[currentUserId, partnerId].sort().join('_')}`;
    const callUrl = `/call/${roomId}?callType=${type}&role=caller&partnerId=${partnerId}`;
    if (typeof window !== 'undefined') {
      window.open(callUrl, '_blank');
    }
  };

  const displayName = partnerProfile ? getDisplayName(partnerProfile) : 'Match Candidate';

  return (
    /* 2. STRICT 3-PART VERTICAL FLEX LAYOUT (No rogue page viewport scroll) */
    <div className="flex flex-col flex-1 h-full max-h-[100dvh] overflow-hidden relative bg-background bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      
      {/* 1. Chat Header (Fixed Height) */}
      <div className="flex-none h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md px-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.history.back();
              }
            }}
            className="min-w-[40px] min-h-[40px] p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition flex items-center justify-center cursor-pointer"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="w-10 h-10 rounded-xl overflow-hidden bg-emerald-700 text-white flex items-center justify-center font-bold text-sm shrink-0">
            {partnerProfile?.avatar_url ? (
              <img
                src={partnerProfile.avatar_url}
                alt={displayName}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              displayName.charAt(0).toUpperCase()
            )}
          </div>

          <div className="min-w-0">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white truncate flex items-center gap-1.5">
              <span>{displayName}</span>
              {partnerProfile?.kyc_status === 'verified' && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                  Verified
                </span>
              )}
            </h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
              {partnerProfile?.profession || 'Matrimonial Match'} • 100% Dowry-Free
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => handleInitiateCall('voice')}
            className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition flex items-center justify-center cursor-pointer"
            title="Start Voice Call"
          >
            <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </button>
          <button
            onClick={() => handleInitiateCall('video')}
            className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center justify-center cursor-pointer shadow-sm"
            title="Start Video Call"
          >
            <Video className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Moderation Warning Toast */}
      {moderationWarning && (
        <div className="flex-none mx-4 mt-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2 shadow-sm animate-in fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span className="flex-1 font-medium">{moderationWarning}</span>
          <button
            onClick={() => setModerationWarning(null)}
            className="text-xs font-bold text-rose-600 hover:underline px-1 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Message List (Scrollable, takes remaining space, locked inside flex-1) */}
      <div 
        ref={chatContainerRef} 
        className="flex-1 overflow-y-auto p-4 space-y-3 overscroll-contain min-h-0"
      >
        {/* Shariah Anti-Dowry Banner */}
        <div className="p-2.5 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-2 shadow-xs">
          <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>
            <strong>Shariah Anti-Dowry Protection:</strong> Discussions demanding Daheej/dowry or inappropriate content are filtered in realtime.
          </span>
        </div>

        {isLoading && messages.length === 0 ? (
          <div className="h-48 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center space-y-2 text-zinc-400 dark:text-zinc-500">
            <Sparkles className="w-8 h-8 text-emerald-500/60" />
            <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Start your conversation with {displayName}
            </p>
            <p className="text-[11px] max-w-xs">
              Begin with an Islamic greeting. Communicate with modesty, honesty, and mutual respect.
            </p>
          </div>
        ) : (
          (messages || []).map((m) => {
            const isMe = m.sender_id === currentUserId;
            const isCallDeclined = m.content?.includes('CALL_DECLINED');
            const isCallMissed = !isCallDeclined && m.content?.includes('CALL_MISSED');
            const isCallEnded = !isCallDeclined && !isCallMissed && m.content?.includes('CALL_ENDED');
            const callInvite = (!isCallDeclined && !isCallEnded && !isCallMissed) ? parseCallInvite(m.content) : null;

            if (isCallDeclined || isCallMissed || isCallEnded) {
              return (
                <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} my-2 w-full`}>
                  <div className="p-3 rounded-2xl border bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 max-w-[85%] sm:max-w-md flex items-center gap-2.5 shadow-xs">
                    <PhoneOff className="w-4 h-4 text-zinc-400" />
                    <span>{isCallDeclined ? 'Call Declined' : isCallMissed ? 'Missed Call' : 'Call Ended'}</span>
                    <span className="text-[10px] opacity-60 ml-auto">
                      {new Date(m.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            }

            if (callInvite) {
              return (
                <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} my-2 w-full`}>
                  <div className="p-3.5 rounded-2xl border bg-emerald-900/30 border-emerald-500/40 text-emerald-200 max-w-[90%] sm:max-w-md space-y-2 shadow-sm">
                    <div className="flex items-center gap-2">
                      {callInvite.callType === 'video' ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                      <span className="font-bold text-xs">P2P {callInvite.callType === 'video' ? 'Video' : 'Voice'} Call</span>
                    </div>
                    <button
                      onClick={() => {
                        const callUrl = `/call/${callInvite.room_id}?callType=${callInvite.callType}&role=${isMe ? 'caller' : 'receiver'}`;
                        window.open(callUrl, '_blank');
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <PhoneIncoming className="w-3.5 h-3.5" />
                      <span>{isMe ? 'Rejoin Call' : 'Accept Call'}</span>
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[85%] sm:max-w-[75%] px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs ${
                    isMe
                      ? 'bg-emerald-600 text-white rounded-br-xs'
                      : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700/70 rounded-bl-xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  <div className={`flex items-center justify-end gap-1 text-[9px] mt-1 ${isMe ? 'text-emerald-100' : 'text-zinc-400'}`}>
                    <Clock className="w-2.5 h-2.5" />
                    <span>
                      {new Date(m.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isMe && (
                      <CheckCheck className={`w-3 h-3 ${m.read ? 'text-teal-200' : 'text-emerald-300'}`} />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 3. Chat Input (Fixed at bottom with no rogue padding) */}
      <div className="flex-none p-3 sm:p-4 bg-background bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 pb-safe z-10">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputContent}
            onChange={(e) => setInputContent(e.target.value)}
            placeholder={`Message ${displayName}...`}
            className="flex-1 min-h-[44px] bg-zinc-100 dark:bg-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-white px-4 py-2.5 rounded-2xl border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
          />
          <button
            type="submit"
            disabled={!inputContent.trim() || isSending}
            className="min-w-[44px] min-h-[44px] p-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center cursor-pointer shrink-0 shadow-md"
            aria-label="Send message"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>

    </div>
  );
}
