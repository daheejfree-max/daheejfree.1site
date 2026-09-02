'use client';

// ==============================================================================
// REALTIME CHAT WINDOW WITH NSFW & DOWRY MODERATION INTERCEPTION
// ==============================================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Shield,
  ShieldCheck,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  PhoneMissed,
  Video,
  X,
  AlertTriangle,
  Sparkles,
  Info,
  Mail,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { Profile, ProfileSecureView, SubscriptionTier, ChatMessage, ConsentStatus } from '../../types';
import { daheejStore } from '../../lib/supabase/store';
import { createBrowserClient } from '@supabase/ssr';
import { moderateTextContent } from '../../lib/moderation';
import { parseCallInvite, sendCallInvite, declineCallSession, isCallSignalingContent, isCallInviteCurrentlyActive } from '../../lib/callSignaling';

const supabaseUrl =
  (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_SUPABASE_URL || process.env?.VITE_SUPABASE_URL : undefined) ||
  (typeof window !== 'undefined' && (import.meta as any as any).env?.VITE_SUPABASE_URL) ||
  '';

const supabaseAnonKey =
  (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env?.VITE_SUPABASE_ANON_KEY : undefined) ||
  (typeof window !== 'undefined' && (import.meta as any as any).env?.VITE_SUPABASE_ANON_KEY) ||
  '';

interface ChatWindowProps {
  currentProfile: Profile | null;
  targetProfile: ProfileSecureView;
  viewerTier: SubscriptionTier;
  onClose: () => void;
  onStartCall: (targetUserId: string, callType: 'audio' | 'video') => void;
  onOpenPricing: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  currentProfile,
  targetProfile,
  viewerTier,
  onClose,
  onStartCall,
  onOpenPricing,
}) => {
  // STABLE SUPABASE CLIENT: Initialized safely using useState to prevent recreation on render
  const [supabase] = useState(() =>
    createBrowserClient(supabaseUrl, supabaseAnonKey, {
      cookieOptions: {
        sameSite: 'none',
        secure: true,
      },
    })
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputContent, setInputContent] = useState('');
  const [moderationWarning, setModerationWarning] = useState<string | null>(null);
  const [isInitiatingCall, setIsInitiatingCall] = useState(false);
  const [waliNotice, setWaliNotice] = useState<string | null>(null);
  const [isPhotoRevealed, setIsPhotoRevealed] = useState<boolean>(() => {
    return daheejStore.hasAcceptedPhotoConsent(currentProfile?.id || '', targetProfile.id);
  });
  const [incomingCallPopup, setIncomingCallPopup] = useState<{
    room_id: string;
    callType: 'video' | 'voice';
    caller_name: string;
    sender_id: string;
    timestamp: number;
  } | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const currentUserId = currentProfile?.id || '';
  const targetUserId = targetProfile.id;

  const togglePhotoReveal = async () => {
    if (!currentUserId) return;
    if (currentProfile?.kyc_status !== 'verified') {
      setWaliNotice('KYC Verification Required: Please complete your Didit KYC verification to manage photo access.');
      setTimeout(() => setWaliNotice(null), 4000);
      return;
    }
    const nextState = !isPhotoRevealed;
    setIsPhotoRevealed(nextState);

    if (nextState) {
      const req = daheejStore.sendConsentRequest(currentUserId, targetUserId);
      daheejStore.updateConsentStatus(req.id, 'accepted', currentUserId, targetUserId);
      setWaliNotice('Photo permissions granted to match.');

      try {
        await supabase.from('photo_permissions').upsert(
          {
            requestor_id: currentUserId,
            target_id: targetUserId,
            status: 'approved',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'requestor_id,target_id' }
        );
      } catch (e) {
        console.warn('[ChatWindow] Supabase photo consent error:', e);
      }

      try {
        await fetch('/api/photo-permissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requesterId: currentUserId,
            targetUserId,
            status: 'approved',
          }),
        });
      } catch (e) {
        console.warn('[ChatWindow] API photo consent error:', e);
      }
    } else {
      const req = daheejStore.sendConsentRequest(currentUserId, targetUserId);
      daheejStore.updateConsentStatus(req.id, 'rejected', currentUserId, targetUserId);
      setWaliNotice('Photo access revoked.');

      try {
        await supabase
          .from('photo_permissions')
          .update({ status: 'rejected', updated_at: new Date().toISOString() })
          .or(`and(requestor_id.eq.${currentUserId},target_id.eq.${targetUserId}),and(requestor_id.eq.${targetUserId},target_id.eq.${currentUserId})`);
      } catch (e) {
        console.warn('[ChatWindow] Supabase photo consent revoke error:', e);
      }

      try {
        await fetch('/api/photo-permissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requesterId: currentUserId,
            targetUserId,
            status: 'rejected',
          }),
        });
      } catch (e) {
        console.warn('[ChatWindow] API photo consent revoke error:', e);
      }
    }

    setTimeout(() => setWaliNotice(null), 3000);
  };

  const handleSendWaliTranscript = async () => {
    if (!targetProfile.wali_email) {
      setWaliNotice('No Wali email registered for this profile.');
      setTimeout(() => setWaliNotice(null), 3000);
      return;
    }

    try {
      const res = await fetch('/api/wali/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: currentUserId,
          partnerId: targetProfile.id,
          partnerName: targetProfile.nickname || targetProfile.full_name,
          waliEmail: targetProfile.wali_email,
          waliName: targetProfile.wali_name || 'Guardian',
          messages,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setWaliNotice(`Weekly transcript sent to Wali (${targetProfile.wali_email})`);
      }
    } catch (e) {
      setWaliNotice(`Audit log recorded for Wali (${targetProfile.wali_email})`);
    }
    setTimeout(() => setWaliNotice(null), 4000);
  };

  // Load initial conversation and subscribe to Supabase Realtime postgres_changes & local store bridge
  useEffect(() => {
    if (!currentUserId || !targetUserId) return;

    // 1. Initial local load
    const initialMessages = daheejStore.getMessages(currentUserId, targetUserId);
    setMessages(initialMessages);

    // 2. Fetch remote messages from Supabase
    async function loadRemoteMessages() {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .or(
            `and(sender_id.eq.${currentUserId},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${currentUserId})`
          )
          .order('created_at', { ascending: true });

        if (error) {
          // Fallback to recipient_id if receiver_id column not present
          const { data: fbData } = await supabase
            .from('messages')
            .select('*')
            .or(
              `and(sender_id.eq.${currentUserId},recipient_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},recipient_id.eq.${currentUserId})`
            )
            .order('created_at', { ascending: true });

          if (fbData && fbData.length > 0) {
            setMessages(fbData as ChatMessage[]);
          }
        } else if (data) {
          setMessages(data as ChatMessage[]);
        }
      } catch (err) {
        console.warn('[Chat] Supabase messages fetch fallback:', err);
      }
    }
    loadRemoteMessages();

    // 3. Supabase Realtime Postgres Changes Subscription (unique channel ID per mount)
    const channelId = `chat_room_${currentUserId}_${targetUserId}_${Math.random().toString(36).slice(2, 9)}`;
    const supabaseChannel = supabase
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
          if (!newMsg) return;

          const mReceiver = newMsg.receiver_id || (newMsg as any as any).recipient_id;
          // STRICT CHECK: Does this message belong to this exact conversation?
          const isRelevant =
            (newMsg.sender_id === currentUserId && mReceiver === targetUserId) ||
            (newMsg.sender_id === targetUserId && mReceiver === currentUserId);

          if (isRelevant) {
            // Check for incoming call invite
            const invite = parseCallInvite(newMsg.content);
            if (invite && newMsg.sender_id === targetUserId) {
              setIncomingCallPopup({
                room_id: invite.room_id,
                callType: invite.callType,
                caller_name: invite.caller_name || targetProfile.full_name,
                sender_id: newMsg.sender_id,
                timestamp: Date.now(),
              });
            }

            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;

              const isOptimisticMatch = prev.some(
                (m) =>
                  m.sender_id === newMsg.sender_id &&
                  m.content === newMsg.content &&
                  Math.abs(new Date(m.created_at).getTime() - new Date(newMsg.created_at).getTime()) < 10000
              );

              if (isOptimisticMatch) {
                return prev.map((m) =>
                  m.sender_id === newMsg.sender_id &&
                  m.content === newMsg.content &&
                  Math.abs(new Date(m.created_at).getTime() - new Date(newMsg.created_at).getTime()) < 10000
                    ? { ...m, ...newMsg }
                    : m
                );
              }
              return [...prev, newMsg];
            });
          }
        }
      )
      .subscribe((status) => {
        console.info('Supabase Realtime Status:', status);
      });

    // 4. Local reactive store subscription
    const unsubscribeStore = daheejStore.subscribeToMessages((msg) => {
      const mReceiver = msg.receiver_id || (msg as any as any).recipient_id;
      const isParticipant =
        (msg.sender_id === currentUserId && mReceiver === targetUserId) ||
        (msg.sender_id === targetUserId && mReceiver === currentUserId);

      if (isParticipant) {
        const invite = parseCallInvite(msg.content);
        if (invite && msg.sender_id === targetUserId) {
          setIncomingCallPopup({
            room_id: invite.room_id,
            callType: invite.callType,
            caller_name: invite.caller_name || targetProfile.full_name,
            sender_id: msg.sender_id,
            timestamp: Date.now(),
          });
        }

        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    });

    return () => {
      supabase.removeChannel(supabaseChannel);
      unsubscribeStore();
    };
  }, [currentUserId, targetUserId, targetProfile.full_name, supabase]);

  useEffect(() => {
    if (chatContainerRef.current) {
      const { scrollHeight, clientHeight } = chatContainerRef.current;
      chatContainerRef.current.scrollTop = scrollHeight - clientHeight;
    }
  }, [messages]);

  const handleInitiateCall = async (callType: 'video' | 'voice') => {
    if (!targetUserId || !currentUserId || isInitiatingCall) return;

    if (currentProfile?.kyc_status !== 'verified') {
      setModerationWarning('KYC Verification Required: You must verify your identity with Didit before initiating audio or video calls.');
      return;
    }

    try {
      setIsInitiatingCall(true);
      const callerName = currentProfile?.full_name || 'Caller';
      const { roomID, message: sentMsg } = await sendCallInvite({
        currentUserId,
        partnerId: targetUserId,
        callerName,
        callType,
      });

      setMessages((prev) => {
        if (prev.some((m) => m.id === sentMsg.id)) return prev;
        return [...prev, sentMsg];
      });

      if (typeof window !== 'undefined') {
        window.open(`/call/${roomID}?callType=${callType}&role=caller&partnerId=${targetUserId}`, '_blank');
      }
    } catch (err) {
      console.error('[ChatWindow] Call initiation error:', err);
    } finally {
      setIsInitiatingCall(false);
    }
  };

  const handleDeclineCall = async (messageId: string, roomId: string) => {
    try {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, content: 'CALL_DECLINED' } : m))
      );
      if (incomingCallPopup && incomingCallPopup.room_id === roomId) {
        setIncomingCallPopup(null);
      }
      await declineCallSession(messageId, roomId);
    } catch (error) {
      console.error('[ChatWindow] Failed to decline call:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setModerationWarning(null);

    const trimmed = inputContent.trim();
    if (!trimmed || !currentUserId) return;

    // KYC Verification Hard Wall
    if (currentProfile?.kyc_status !== 'verified') {
      setModerationWarning('KYC Verification Required: You must complete your Didit KYC verification before sending messages.');
      return;
    }

    // Check free plan message limits (3 messages/day)
    if (viewerTier === 'free') {
      const sentCount = daheejStore.getMessageCountForUser(currentUserId);
      if (sentCount >= 3) {
        setModerationWarning(
          'Free Sunnah Plan allows 3 messages/day. Upgrade to Gold for unlimited messaging.'
        );
        return;
      }
    }

    // 1. Fast local regex check for known violations
    const moderation = moderateTextContent(trimmed);
    if (!moderation.isClean) {
      setModerationWarning(
        moderation.rejectionReason || 'Message violates Shariah Anti-Dowry guidelines.'
      );
      return;
    }

    // 2. Real-time Gemini AI Shariah Moderation Check (Dowry & Inappropriate Content)
    try {
      const aiModRes = await fetch('/api/ai/moderate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          senderName: currentProfile?.full_name || 'User',
        }),
      });
      const aiModData = await aiModRes.json();
      if (aiModData.flagged) {
        setModerationWarning(
          aiModData.warning_message || aiModData.reason || 'Message violates Shariah Halal Matrimony guidelines.'
        );
        return;
      }
    } catch (aiErr) {
      // Non-blocking fallback
      console.warn('[AI Moderation] Fallback to regex check:', aiErr);
    }

    setInputContent('');

    // Insert clean message into reactive store & local state optimistically
    const localMsg = daheejStore.sendMessage(currentUserId, targetUserId, trimmed);
    setMessages((prev) => {
      if (prev.some((m) => m.id === localMsg.id)) return prev;
      return [...prev, localMsg];
    });

    // Sync to Supabase PostgreSQL table (The Save)
    try {
      let insertedData: ChatMessage | null = null;

      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: currentUserId,
          receiver_id: targetUserId,
          recipient_id: targetUserId,
          content: trimmed,
          is_read: false,
        })
        .select()
        .single();

      if (error) {
        console.warn('[ChatWindow] Primary insert failed, trying secondary fallback:', error.message);
        const { data: fbData, error: fbError } = await supabase
          .from('messages')
          .insert({
            sender_id: currentUserId,
            receiver_id: targetUserId,
            content: trimmed,
            is_read: false,
          })
          .select()
          .single();

        if (fbError) {
          console.info('[ChatWindow] Supabase insert note (preserving local message):', fbError.message);
        } else if (fbData) {
          insertedData = fbData as ChatMessage;
        }
      } else if (data) {
        insertedData = data as ChatMessage;
      }

      if (insertedData) {
        const normalized: ChatMessage = {
          ...insertedData,
          receiver_id: insertedData.receiver_id || (insertedData as any).recipient_id,
          recipient_id: (insertedData as any).recipient_id || insertedData.receiver_id,
          read: (insertedData as any).read ?? (insertedData as any).is_read ?? false,
          is_read: (insertedData as any).is_read ?? (insertedData as any).read ?? false,
        };
        setMessages((prev) =>
          prev.map((m) => (m.id === localMsg.id ? normalized : m))
        );
      }
    } catch (err: any) {
      console.warn('[ChatWindow] Supabase messages sync note:', err);
    }
  };

  const canCall = viewerTier === 'platinum' || viewerTier === 'diamond';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl h-[100dvh] sm:h-[85vh] sm:max-h-[680px] bg-white dark:bg-zinc-950 border-0 sm:border border-zinc-200 dark:border-zinc-800 rounded-none sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col transition-colors">
        {/* Top Header */}
        <div className="p-3 sm:p-4 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between transition-colors shrink-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-10 h-10 rounded-full overflow-hidden bg-white dark:bg-zinc-800 border border-emerald-300 dark:border-emerald-500/40 flex items-center justify-center shadow-sm shrink-0">
              {targetProfile.is_photo_unlocked && targetProfile.avatar_url ? (
                <img
                  src={targetProfile.avatar_url}
                  alt={targetProfile.full_name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              )}
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-white flex items-center gap-2 truncate">
                <span className="truncate">{targetProfile.full_name}</span>
                {targetProfile.kyc_status === 'verified' && (
                  <span
                    title="Identity cryptographically verified via the Didit protocol to ensure authenticity and prevent fake profiles."
                    className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-blue-50 dark:bg-blue-950/80 text-blue-800 dark:text-blue-400 border border-blue-200 dark:border-blue-700/60 shrink-0 cursor-help"
                  >
                    ✓ Didit Verified
                  </span>
                )}
              </h4>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                {targetProfile.profession || 'Verified Candidate'} • {targetProfile.location}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Reveal Photos Toggle */}
            <button
              type="button"
              onClick={togglePhotoReveal}
              className={`min-h-[40px] px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs ${
                isPhotoRevealed
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                  : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700'
              }`}
              title="Toggle Photo Reveal Consent"
            >
              {isPhotoRevealed ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isPhotoRevealed ? 'Photos Revealed' : 'Reveal Photo'}</span>
            </button>

            {/* Wali Supervision Button */}
            {targetProfile.wali_email && (
              <button
                type="button"
                onClick={handleSendWaliTranscript}
                className="min-h-[40px] px-2.5 sm:px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-700/60 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                title="Dispatch Supervised Chat Transcript to Legal Guardian"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span className="hidden md:inline">Wali Overseen</span>
              </button>
            )}

            {canCall ? (
              <>
                <button
                  id="chatwindow-voice-call-btn"
                  disabled={isInitiatingCall}
                  onClick={() => handleInitiateCall('voice')}
                  className="min-w-[44px] min-h-[44px] p-2.5 px-3 rounded-full sm:rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 active:bg-zinc-300 dark:active:bg-zinc-600 text-zinc-700 dark:text-zinc-200 transition-colors shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                  title="Start 1-on-1 Voice Call (Disables Camera, Opens Zego Audio Room)"
                >
                  <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="hidden sm:inline text-xs font-semibold">Voice</span>
                </button>
                <button
                  id="chatwindow-video-call-btn"
                  disabled={isInitiatingCall}
                  onClick={() => handleInitiateCall('video')}
                  className="min-w-[44px] min-h-[44px] p-2.5 px-3.5 rounded-full sm:rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white transition-colors shadow-sm flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer disabled:opacity-50"
                  title="Start 1-on-1 Video Call (Enables Camera & Mic, Opens Zego Video Room)"
                >
                  <Video className="w-4 h-4" />
                  <span className="hidden sm:inline">Video</span>
                </button>
              </>
            ) : (
              <button
                onClick={onOpenPricing}
                className="min-h-[44px] px-3 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 text-[11px] font-bold flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Unlock Calling</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] p-2.5 rounded-full sm:rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white active:bg-zinc-300 transition-colors flex items-center justify-center cursor-pointer"
              aria-label="Close chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Wali Notice or Photo Reveal Feedback Banner */}
        {waliNotice && (
          <div className="mx-3 sm:mx-4 mt-2 p-2.5 rounded-2xl bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 text-xs flex items-center gap-2 animate-fade-in shrink-0 z-20">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="font-semibold">{waliNotice}</span>
          </div>
        )}

        {/* Incoming Call Notification Banner */}
        {incomingCallPopup && (
          <div className="mx-3 sm:mx-4 mt-2 p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-emerald-900 to-teal-900 border-2 border-emerald-400 text-white shadow-2xl flex items-center justify-between gap-3 animate-bounce shrink-0 z-20">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center text-white shrink-0">
                {incomingCallPopup.callType === 'video' ? (
                  <Video className="w-5 h-5" />
                ) : (
                  <PhoneCall className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider bg-emerald-400 text-emerald-950 px-2 py-0.5 rounded-full">
                  Incoming {incomingCallPopup.callType === 'video' ? 'Video' : 'Voice'} Call
                </span>
                <p className="text-xs font-semibold text-emerald-100 mt-0.5 truncate">
                  {incomingCallPopup.caller_name || targetProfile.full_name} is calling you
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  const callUrl = `/call/${incomingCallPopup.room_id}?type=${incomingCallPopup.callType}`;
                  setIncomingCallPopup(null);
                  if (typeof window !== 'undefined') {
                    window.open(callUrl, '_blank');
                  }
                }}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 active:bg-emerald-500 text-emerald-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer active:scale-95"
              >
                <PhoneIncoming className="w-4 h-4" />
                <span>Accept</span>
              </button>
              <button
                onClick={() => setIncomingCallPopup(null)}
                className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white transition-colors flex items-center justify-center"
                aria-label="Dismiss call"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Message Thread Stage (Flex-1 scrollable with isolated container-level scrolling) */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-zinc-50 dark:bg-zinc-950/60 transition-colors overscroll-contain min-h-0"
        >
          {/* Shariah Anti-Dowry Notice Banner */}
          <div className="p-2.5 sm:p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-500/30 rounded-2xl text-[10px] sm:text-[11px] text-emerald-800 dark:text-emerald-200 flex items-center gap-2 shadow-sm">
            <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span>
              <strong>Automated Moderation Active:</strong> Discussions regarding cash dowry (Daheej) or explicit language are intercepted in realtime.
            </span>
          </div>

          {messages.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center text-zinc-400 dark:text-zinc-500 space-y-1 p-4">
              <Sparkles className="w-6 h-6 text-zinc-400 dark:text-zinc-600 mb-1" />
              <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Initiate respectful matrimonial conversation</p>
              <p className="text-[11px]">Send greetings according to Islamic Sunnah.</p>
            </div>
          ) : (
            (messages || []).map((m) => {
              const isMe = m.sender_id === currentUserId;
              const isCallDeclined =
                m.content === 'CALL_DECLINED' ||
                m.content?.startsWith('CALL_DECLINED') ||
                m.content?.includes('CALL_DECLINED') ||
                m.content?.includes('"CALL_DECLINED"');
              const isCallMissed =
                !isCallDeclined &&
                (m.content === 'CALL_MISSED' ||
                  m.content?.startsWith('CALL_MISSED') ||
                  m.content?.includes('CALL_MISSED') ||
                  m.content?.includes('"CALL_MISSED"'));
              const isCallEnded =
                !isCallDeclined &&
                !isCallMissed &&
                (m.content === 'CALL_ENDED' ||
                  m.content?.startsWith('CALL_ENDED') ||
                  m.content?.includes('CALL_ENDED'));
              const callInvite = (!isCallDeclined && !isCallEnded && !isCallMissed) ? parseCallInvite(m.content) : null;

              if (isCallDeclined) {
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} my-2 w-full`}
                  >
                    <div
                      className={`w-full max-w-[90%] sm:max-w-md p-3.5 rounded-2xl border transition-all ${
                        isMe
                          ? 'bg-rose-950/40 border-rose-800/60 text-rose-200 shadow-sm'
                          : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-500 shrink-0">
                          <PhoneOff className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-rose-700 dark:text-rose-300">
                              Call Declined
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-rose-500/20 text-rose-600 dark:text-rose-400">
                              Declined
                            </span>
                          </div>
                          <p className="text-[11px] text-rose-600/90 dark:text-rose-300/90 truncate mt-0.5 font-medium">
                            {isMe ? 'Call invitation was declined' : 'You declined the call'}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2.5 pt-1.5 border-t border-rose-500/20 text-[10px] text-rose-500/70 dark:text-rose-400/70 flex items-center justify-between">
                        <span>Session Cancelled</span>
                        <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                );
              }

              if (isCallMissed) {
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} my-2 w-full`}
                  >
                    <div
                      className={`w-full max-w-[90%] sm:max-w-md p-3.5 rounded-2xl border transition-all ${
                        isMe
                          ? 'bg-red-950/40 border-red-800/60 text-red-200 shadow-sm'
                          : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-500 shrink-0">
                          <PhoneMissed className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-red-700 dark:text-red-300">
                              Missed Call
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-500/20 text-red-600 dark:text-red-400">
                              Unavailable
                            </span>
                          </div>
                          <p className="text-[11px] text-red-600/90 dark:text-red-300/90 truncate mt-0.5 font-medium">
                            User isn't available at the moment.
                          </p>
                        </div>
                      </div>
                      <div className="mt-2.5 pt-1.5 border-t border-red-500/20 text-[10px] text-red-500/70 dark:text-red-400/70 flex items-center justify-between">
                        <span>Ringing Timeout (60s)</span>
                        <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                );
              }

              if (isCallEnded) {
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} my-2 w-full`}
                  >
                    <div
                      className={`w-full max-w-[90%] sm:max-w-md p-3.5 rounded-2xl border transition-all ${
                        isMe
                          ? 'bg-zinc-800/80 border-zinc-700 text-zinc-300 shadow-sm'
                          : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 shrink-0">
                          <PhoneOff className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-zinc-700 dark:text-zinc-300">
                              Call Ended
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-zinc-200 dark:bg-zinc-800 text-zinc-500">
                              Session Finished
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                            {isMe ? 'You ended the call session' : 'Call session ended'}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2.5 pt-1.5 border-t border-zinc-200 dark:border-zinc-800 text-[10px] text-zinc-400 flex items-center justify-between">
                        <span>Room Closed</span>
                        <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                );
              }

              if (callInvite) {
                const isVideo = callInvite.callType === 'video';
                const isStillActive = isCallInviteCurrentlyActive(m, messages);
                const callerCallUrl = `/call/${callInvite.room_id}?callType=${callInvite.callType}&role=caller`;
                const receiverCallUrl = `/call/${callInvite.room_id}?callType=${callInvite.callType}&role=receiver`;

                if (!isStillActive) {
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} my-2 w-full`}
                    >
                      <div
                        className={`w-full max-w-[90%] sm:max-w-md p-3.5 rounded-2xl border transition-all ${
                          isMe
                            ? 'bg-zinc-800/80 border-zinc-700 text-zinc-300 shadow-sm'
                            : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 shadow-sm'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 shrink-0">
                            {isVideo ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-zinc-700 dark:text-zinc-300">
                                {isMe ? `Outgoing ${isVideo ? 'Video' : 'Voice'} Call` : `Incoming ${isVideo ? 'Video' : 'Voice'} Call`}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-zinc-200 dark:bg-zinc-800 text-zinc-500">
                                Call Ended
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                              {isMe ? 'Call invitation completed' : 'Call session completed'}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2.5 pt-1.5 border-t border-zinc-200 dark:border-zinc-800 text-[10px] text-zinc-400 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => handleInitiateCall(isVideo ? 'video' : 'voice')}
                            className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                          >
                            {isVideo ? <Video className="w-3 h-3" /> : <Phone className="w-3 h-3" />}
                            <span>Call Again</span>
                          </button>
                          <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} my-2 w-full`}
                  >
                    <div
                      className={`w-full max-w-[92%] sm:max-w-md p-4 rounded-2xl border transition-all ${
                        isMe
                          ? 'bg-gradient-to-br from-emerald-800 to-teal-950 border-emerald-600 text-white shadow-md'
                          : 'bg-white dark:bg-zinc-900 border-emerald-500/50 text-zinc-900 dark:text-white shadow-lg'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            isMe ? 'bg-emerald-600 text-white' : 'bg-emerald-500 text-white animate-pulse'
                          }`}
                        >
                          {isVideo ? <Video className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs sm:text-sm">
                              {isMe ? `Outgoing ${isVideo ? 'Video' : 'Voice'} Call` : `Incoming ${isVideo ? 'Video' : 'Voice'} Call`}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 animate-pulse">
                              Ringing...
                            </span>
                          </div>
                          <p className="text-[11px] opacity-80 truncate mt-0.5">
                            {isMe ? 'Ringing partner (Expires in 45s)...' : `${callInvite.caller_name || targetProfile.full_name} is calling you`}
                          </p>
                        </div>
                      </div>

                      {/* Responsive Action Buttons */}
                      <div className="mt-3 pt-3 border-t border-emerald-500/20 flex flex-col gap-2">
                        {isMe ? (
                          <button
                            onClick={() => {
                              if (typeof window !== 'undefined') {
                                window.open(callerCallUrl, '_blank');
                              }
                            }}
                            className="w-full min-h-[44px] py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer active:scale-[0.98] bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-emerald-950"
                          >
                            <Video className="w-4 h-4" />
                            <span>Join Call Room</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-2 w-full">
                            <button
                              onClick={() => {
                                if (typeof window !== 'undefined') {
                                  window.open(receiverCallUrl, '_blank');
                                }
                              }}
                              className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-medium rounded-lg py-2.5 px-4 flex items-center justify-center gap-2 flex-1 min-h-[44px] text-xs sm:text-sm transition-colors cursor-pointer shadow-sm"
                            >
                              <PhoneIncoming className="w-4 h-4 animate-bounce" />
                              <span>Accept & Join Call</span>
                            </button>
                            <button
                              onClick={() => handleDeclineCall(m.id, callInvite.room_id)}
                              className="bg-rose-600/20 border border-rose-500/40 text-rose-300 hover:bg-rose-600 hover:text-white active:bg-rose-700 font-medium rounded-lg py-2.5 px-4 flex items-center justify-center gap-2 flex-1 min-h-[44px] text-xs sm:text-sm transition-colors cursor-pointer shadow-sm"
                            >
                              <PhoneOff className="w-4 h-4" />
                              <span>Decline</span>
                            </button>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-[10px] opacity-60 px-1">
                          <span>1-on-1 Halal Audio/Video</span>
                          <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // Suppress raw WebRTC signaling tokens / SDP / ICE from chat bubble rendering
              if (isCallSignalingContent(m.content)) {
                return null;
              }

              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[78%] px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                      isMe
                        ? 'bg-emerald-600 text-white rounded-br-sm shadow-md'
                        : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-bl-sm border border-zinc-200 dark:border-zinc-700 shadow-sm'
                    }`}
                  >
                    {m.content}
                  </div>
                  <span className="text-[9px] text-zinc-400 dark:text-zinc-500 mt-1 px-1">
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Moderation Warning Notification */}
        {moderationWarning && (
          <div className="p-3 bg-red-50 dark:bg-red-950/90 border-t border-red-300 dark:border-red-800 text-red-800 dark:text-red-300 text-xs flex items-center justify-between gap-2 animate-in fade-in shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
              <span>{moderationWarning}</span>
            </div>
            <button
              onClick={() => setModerationWarning(null)}
              className="text-red-700 dark:text-red-400 hover:underline text-xs font-bold min-h-[36px] px-2 flex items-center cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Input Bar (Pinned securely to bottom with safe area padding) */}
        <form onSubmit={handleSendMessage} className="shrink-0 p-2.5 sm:p-3 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-2 transition-colors pb-safe z-10">
          <input
            type="text"
            value={inputContent}
            onChange={(e) => setInputContent(e.target.value)}
            placeholder="Type a message (Mahr, religious practice, family values)..."
            className="flex-1 min-h-[44px] bg-zinc-50 dark:bg-zinc-950 text-xs sm:text-sm text-zinc-900 dark:text-zinc-200 px-4 py-2.5 rounded-2xl border border-zinc-300 dark:border-zinc-800 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={!inputContent.trim()}
            className="min-w-[44px] min-h-[44px] p-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-emerald-700/20 flex items-center justify-center shrink-0 cursor-pointer"
            aria-label="Send message"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};
