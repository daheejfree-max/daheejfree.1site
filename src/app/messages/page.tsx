'use client';

// ==============================================================================
// REAL-TIME MATRIMONIAL CHAT INTERFACE (src/app/messages/page.tsx)
// Phase 1: Two-Column Layout & Accepted Matches Sidebar (!inner join)
// Phase 2: Message Fetching & Supabase Realtime Subscription
// ==============================================================================

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Send,
  Search,
  Shield,
  Lock,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  PhoneMissed,
  Video,
  Check,
  CheckCheck,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  MessageSquare,
  Users,
  ChevronLeft,
  Info,
  Clock,
  Heart,
  Crown,
  UserCheck,
  Smile,
  X,
  Bell,
} from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { useAuth } from '../../hooks/useAuth';
import { useWebRTC } from '../../hooks/useWebRTC';
import { daheejStore } from '../../lib/supabase/store';
import { moderateTextContent } from '../../lib/moderation';
import { Profile, ChatMessage } from '../../types';
import { parseCallInvite, parseCallEvent, formatCallMessagePreview, sendCallInvite, declineCallSession, isCallSignalingContent, isCallInviteCurrentlyActive, subscribeToCallSignals, CallInviteData } from '../../lib/callSignaling';
import { getDisplayName } from '../../lib/utils';

export const formatMessagePreview = (content: string | undefined | null): string => {
  return formatCallMessagePreview(content);
};

// Strict Supabase Browser Client initialized with createBrowserClient from @supabase/ssr
const supabaseUrl =
  (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_SUPABASE_URL || process.env?.VITE_SUPABASE_URL : undefined) ||
  (typeof window !== 'undefined' && (import.meta as any as any).env?.VITE_SUPABASE_URL) ||
  '';

const supabaseAnonKey =
  (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env?.VITE_SUPABASE_ANON_KEY : undefined) ||
  (typeof window !== 'undefined' && (import.meta as any as any).env?.VITE_SUPABASE_ANON_KEY) ||
  '';

const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  cookieOptions: {
    sameSite: 'none',
    secure: true,
  },
});

interface MessagesPageProps {
  initialSelectedUserId?: string | null;
  onStartCall?: (partnerId: string, type: 'audio' | 'video') => void;
  onOpenPricing?: () => void;
  onNavigateMatches?: () => void;
}

const ISLAMIC_STARTERS = [
  'Assalamu Alaikum wa Rahmatullahi wa Barakatuh',
  'Barakallahu Feekum. I would be honored to discuss our matrimonial compatibility.',
  'May Allah bless this introduction with Taqwa, Barakah, and pure intentions.',
  'Assalamu Alaikum. Let us involve our family Walis in our conversation as per Sunnah.',
];

export default function RealtimeMessagesPage({
  initialSelectedUserId,
  onStartCall,
  onOpenPricing,
  onNavigateMatches,
}: MessagesPageProps) {
  // STABLE SUPABASE CLIENT: Initialized safely using useState to prevent recreate on render and keep WebSocket alive
  const [supabase] = useState(() =>
    createBrowserClient(supabaseUrl, supabaseAnonKey, {
      cookieOptions: {
        sameSite: 'none',
        secure: true,
      },
    })
  );

  const { profile: currentProfile, tier, allProfiles } = useAuth();
  const currentUserId = currentProfile?.id || null;

  // WebRTC hook fallback
  const { startCall } = useWebRTC(currentUserId);

  // PHASE 1 STATE: Sidebar Accepted Matches & Active Chat Profile
  const [acceptedMatches, setAcceptedMatches] = useState<Profile[]>([]);
  const [activeChat, setActiveChat] = useState<Profile | null>(null);
  const [isSidebarLoading, setIsSidebarLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // PHASE 2 STATE: Messages & Input
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isMessagesLoading, setIsMessagesLoading] = useState<boolean>(false);
  const [inputContent, setInputContent] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isInitiatingCall, setIsInitiatingCall] = useState<boolean>(false);
  const [moderationWarning, setModerationWarning] = useState<string | null>(null);
  const [showStarters, setShowStarters] = useState<boolean>(false);
  const [callAlert, setCallAlert] = useState<string | null>(null);

  // INCOMING CALL NOTIFICATION POPUP STATE
  const [incomingCallPopup, setIncomingCallPopup] = useState<{
    room_id: string;
    callType: 'video' | 'voice';
    caller_name: string;
    sender_id: string;
    timestamp: number;
  } | null>(null);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback((smooth?: boolean) => {
    if (chatContainerRef.current) {
      if (smooth) {
        chatContainerRef.current.scrollTo({
          top: chatContainerRef.current.scrollHeight,
          behavior: 'smooth',
        });
      } else {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    }
  }, []);

  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopRingtone = useCallback(() => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch (e) {}
      audioRef.current = null;
    }
  }, []);

  const playRingtone = useCallback(() => {
    try {
      stopRingtone();
      const audio = new Audio('https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg');
      audio.volume = 0.5;
      audioRef.current = audio;
      audio.play().catch((e) => console.info('Audio play blocked by browser interaction rules:', e));
    } catch (err) {
      console.error(err);
    }
  }, [stopRingtone]);

  // Periodic ticker to automatically expire ringing cards and popups smoothly after 35s
  const [, setTicker] = useState<number>(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTicker((prev) => prev + 1);
      setIncomingCallPopup((prev) => {
        if (!prev) return null;
        if (Date.now() - prev.timestamp > 35000) {
          stopRingtone();
          return null;
        }
        return prev;
      });
    }, 1000);
    return () => {
      clearInterval(timer);
      stopRingtone();
    };
  }, [stopRingtone]);

  // Global window call termination listener for cross-tab and cross-component signaling
  useEffect(() => {
    const handleCallDismiss = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      stopRingtone();
      setIncomingCallPopup((prev) => {
        if (!prev) return null;
        if (!detail?.roomId || prev.room_id === detail.roomId) {
          return null;
        }
        return prev;
      });
    };

    window.addEventListener('call:cancelled', handleCallDismiss);
    window.addEventListener('call:ended', handleCallDismiss);
    window.addEventListener('call:declined', handleCallDismiss);
    window.addEventListener('call:missed', handleCallDismiss);

    return () => {
      window.removeEventListener('call:cancelled', handleCallDismiss);
      window.removeEventListener('call:ended', handleCallDismiss);
      window.removeEventListener('call:declined', handleCallDismiss);
      window.removeEventListener('call:missed', handleCallDismiss);
    };
  }, [stopRingtone]);

  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        setNotifPermission(permission);
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Request browser Notification permission on component mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(Notification.permission);
      if (Notification.permission === 'default') {
        Notification.requestPermission().then((perm) => setNotifPermission(perm)).catch(() => {});
      }
    }
  }, []);

  // Check URL query parameters for initial chat selection and call timeout alerts
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const queryChatId = urlParams.get('chat');
      const alertParam = urlParams.get('alert');
      const targetId = queryChatId || initialSelectedUserId;

      if (alertParam === 'unavailable') {
        setCallAlert("User isn't available at the moment. Call disconnected after ringing timeout.");
      }

      if (targetId && acceptedMatches.length > 0) {
        const found = acceptedMatches.find((p) => p.id === targetId);
        if (found) {
          setActiveChat(found);
        }
      }
    }
  }, [acceptedMatches, initialSelectedUserId]);

  // ============================================================================
  // PHASE 1: FETCH SIDEBAR DATA (ACCEPTED MATCHES WITH !inner JOINS)
  // ============================================================================
  useEffect(() => {
    let isMounted = true;

    async function fetchAcceptedMatches() {
      if (!currentUserId) {
        if (isMounted) {
          setAcceptedMatches([]);
          setIsSidebarLoading(false);
        }
        return;
      }

      setIsSidebarLoading(true);

      try {
        // Query connections where status === 'accepted' and current user is sender or receiver
        // Using strict !inner joins on profiles table to eliminate deleted/ghost profiles
        const { data, error } = await supabase
          .from('connections')
          .select(`
            id,
            sender_id,
            receiver_id,
            status,
            created_at,
            sender:profiles!connections_sender_id_fkey!inner(
              id, full_name, avatar_url, profession, location, age, gender, photo_privacy, kyc_status, wali_email
            ),
            receiver:profiles!connections_receiver_id_fkey!inner(
              id, full_name, avatar_url, profession, location, age, gender, photo_privacy, kyc_status, wali_email
            )
          `)
          .eq('status', 'accepted')
          .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);

        if (!error && data && isMounted) {
          const profileMap = new Map<string, Profile>();

          data.forEach((row: any) => {
            const partnerProfile: Profile =
              row.sender_id === currentUserId ? (row.receiver as Profile) : (row.sender as Profile);

            if (partnerProfile && partnerProfile.id && partnerProfile.id !== currentUserId) {
              profileMap.set(partnerProfile.id, partnerProfile);
              daheejStore.setConnectionFromRemote(row);
              daheejStore.setProfileFromRemote(partnerProfile);
            }
          });

          const matchesList = Array.from(profileMap.values());
          setAcceptedMatches(matchesList);

          // Default selection if none is active (Desktop only)
          if (!activeChat && matchesList.length > 0) {
            const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
            if (isDesktop) {
              setActiveChat(matchesList[0]);
            }
          }
        } else {
          // Local fallback from store
          const partnerIds = daheejStore.getAcceptedConnectionPartnerIds(currentUserId);
          const localProfiles: Profile[] = [];

          partnerIds.forEach((pid) => {
            const p = daheejStore.getProfileById(pid) || allProfiles.find((ap) => ap.id === pid);
            if (p && p.id && p.id !== currentUserId) {
              localProfiles.push(p);
            }
          });

          if (isMounted) {
            setAcceptedMatches(localProfiles);
            if (!activeChat && localProfiles.length > 0) {
              const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
              if (isDesktop) {
                setActiveChat(localProfiles[0]);
              }
            }
          }
        }
      } catch (err) {
        console.warn('[MessagesPage] Accepted matches fetch error:', err);
      } finally {
        if (isMounted) {
          setIsSidebarLoading(false);
        }
      }
    }

    fetchAcceptedMatches();

    // Listen to real-time changes on connections table for dynamic sidebar updates
    const connectionsChannelId = `accepted_matches_sidebar_${currentUserId}_${Math.random().toString(36).slice(2, 9)}`;
    const connectionsChannel = supabase
      .channel(connectionsChannelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'connections',
        },
        () => {
          fetchAcceptedMatches();
        }
      )
      .subscribe();

    // Store sync subscription
    const unsubStore = daheejStore.subscribe((e) => {
      if (e.table === 'connections' && isMounted) {
        fetchAcceptedMatches();
      }
    });

    return () => {
      isMounted = false;
      supabase.removeChannel(connectionsChannel);
      unsubStore();
    };
  }, [currentUserId]);

  // ============================================================================
  // PHASE 2: HISTORICAL DATA FETCHING & REAL-TIME SUBSCRIPTION
  // ============================================================================

  // 1. fetchMessages function wrapped in useCallback triggered whenever activeChat.id changes
  const fetchMessages = useCallback(async () => {
    if (!currentUserId || !activeChat?.id) {
      setMessages([]);
      return;
    }

    const partnerId = activeChat.id;
    setIsMessagesLoading(true);

    try {
      // Query database using Supabase browser client
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${currentUserId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${currentUserId})`
        )
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('[MessagesPage] Primary messages fetch error, trying recipient_id fallback:', error.message);
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('messages')
          .select('*')
          .or(
            `and(sender_id.eq.${currentUserId},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${currentUserId})`
          )
          .order('created_at', { ascending: true });

        if (!fallbackError && fallbackData) {
          setMessages(fallbackData as ChatMessage[]);
        } else {
          // Local storage fallback
          const local = daheejStore.getMessages(currentUserId, partnerId);
          setMessages(local);
        }
      } else if (data) {
        // On success, strictly set the messages state to this historical data
        setMessages(data as ChatMessage[]);

        // Mark unread incoming messages as read in Supabase
        await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('sender_id', partnerId)
          .or(`receiver_id.eq.${currentUserId},recipient_id.eq.${currentUserId}`)
          .eq('is_read', false);
      }
    } catch (err) {
      console.error('[MessagesPage] Error fetching messages:', err);
      const local = daheejStore.getMessages(currentUserId, partnerId);
      setMessages(local);
    } finally {
      setIsMessagesLoading(false);
      scrollToBottom(false);
    }
  }, [currentUserId, activeChat?.id, scrollToBottom]);

  // Trigger historical fetch whenever activeChat.id changes
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // 2. STABLE SUPABASE REALTIME SUBSCRIPTION (The Listen)
  useEffect(() => {
    let isMounted = true;
    if (!currentUserId || !activeChat?.id) return;

    const partnerId = activeChat.id;
    const channelId = `chat_room_${currentUserId}_${partnerId}_${Math.random().toString(36).slice(2, 9)}`;

    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload: any) => {
          const newMsg = payload.new as ChatMessage;
          if (!newMsg || !isMounted) return;

          const msgSender = newMsg.sender_id;
          const msgReceiver = newMsg.receiver_id || (newMsg as any as any).recipient_id;

          // STRICT CHECK: Does this message belong to this exact conversation?
          const isBelongingToCurrentChat =
            (msgSender === currentUserId && msgReceiver === partnerId) ||
            (msgSender === partnerId && msgReceiver === currentUserId);

          if (isBelongingToCurrentChat) {
            // Check if this is a call termination event (Call cut, ended, missed, or declined)
            const callEvent = parseCallEvent(newMsg.content);
            const isTermEvent =
              callEvent?.type === 'CALL_ENDED' ||
              callEvent?.type === 'CALL_DECLINED' ||
              callEvent?.type === 'CALL_MISSED' ||
              callEvent?.type === 'CALL_CONNECTED' ||
              newMsg.content?.includes('CALL_ENDED') ||
              newMsg.content?.includes('CALL_DECLINED') ||
              newMsg.content?.includes('CALL_MISSED') ||
              newMsg.content?.includes('CALL_CONNECTED');

            if (isTermEvent) {
              stopRingtone();
              setIncomingCallPopup((prev) => {
                if (!prev) return null;
                if (!callEvent?.room_id || prev.room_id === callEvent.room_id || prev.sender_id === newMsg.sender_id) {
                  return null;
                }
                return prev;
              });
            }

            // Check for Call Signaling
            const invite = parseCallInvite(newMsg.content);
            if (invite && msgSender === partnerId && !isTermEvent) {
              setIncomingCallPopup({
                room_id: invite.room_id,
                callType: invite.callType,
                caller_name: invite.caller_name || activeChat?.full_name || 'Matched Partner',
                sender_id: msgSender,
                timestamp: Date.now(),
              });

              // Play ringtone sound
              playRingtone();

              // Native browser push notification with persistent interaction
              if (
                typeof window !== 'undefined' &&
                'Notification' in window &&
                Notification.permission === 'granted'
              ) {
                new Notification(
                  `Incoming ${invite.callType === 'video' ? 'Video' : 'Voice'} Call from ${invite.caller_name || activeChat?.full_name || 'Match'}`,
                  {
                    body: 'Click to answer',
                    icon: '/favicon.ico',
                    requireInteraction: true,
                  }
                );
              }
            } else if (msgSender === partnerId && !invite && !isTermEvent) {
              // Native browser push notification for new message when tab is in background
              if (
                typeof window !== 'undefined' &&
                document.hidden &&
                'Notification' in window &&
                Notification.permission === 'granted'
              ) {
                new Notification(`New message from ${activeChat?.full_name || 'Match'}`, {
                  body: newMsg.content || 'Sent you a new message',
                  icon: '/favicon.ico',
                });
              }
            }

            setMessages((prev) => {
              // 1. Exact ID match -> update in place
              if (prev.some((m) => m.id === newMsg.id)) {
                return prev.map((m) => (m.id === newMsg.id ? { ...m, ...newMsg } : m));
              }

              // 2. Check if replacing an optimistic local temporary bubble
              const optIndex = prev.findIndex(
                (m) =>
                  m.sender_id === newMsg.sender_id &&
                  m.content === newMsg.content &&
                  (m.id.startsWith('msg_') ||
                    m.id.startsWith('temp_') ||
                    m.id.startsWith('local_') ||
                    Math.abs(new Date(m.created_at).getTime() - new Date(newMsg.created_at).getTime()) < 45000)
              );

              if (optIndex !== -1) {
                const next = [...prev];
                next[optIndex] = newMsg;
                return next;
              }

              return [...prev, newMsg];
            });

            scrollToBottom(true);

            // Mark as read in store and remote
            if (msgReceiver === currentUserId) {
              daheejStore.markMessagesAsRead(currentUserId, partnerId);
              void supabase
                .from('messages')
                .update({ is_read: true })
                .eq('id', newMsg.id);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        (payload: any) => {
          const rawUpdated = payload.new as any;
          if (!rawUpdated || !isMounted) return;

          const updatedMsg: ChatMessage = {
            ...rawUpdated,
            receiver_id: rawUpdated.receiver_id || rawUpdated.recipient_id,
            recipient_id: rawUpdated.recipient_id || rawUpdated.receiver_id,
            read: Boolean(rawUpdated.read ?? rawUpdated.is_read ?? false),
            is_read: Boolean(rawUpdated.is_read ?? rawUpdated.read ?? false),
          };

          if (
            updatedMsg.content === 'CALL_ENDED' ||
            updatedMsg.content === 'CALL_DECLINED' ||
            updatedMsg.content === 'CALL_MISSED' ||
            updatedMsg.content === 'CALL_CONNECTED' ||
            updatedMsg.content?.includes('CALL_ENDED') ||
            updatedMsg.content?.includes('CALL_DECLINED') ||
            updatedMsg.content?.includes('CALL_MISSED')
          ) {
            stopRingtone();
            setIncomingCallPopup(null);
          }

          const msgSender = updatedMsg.sender_id;
          const msgReceiver = updatedMsg.receiver_id;

          if (
            (msgSender === partnerId && msgReceiver === currentUserId) ||
            (msgSender === currentUserId && msgReceiver === partnerId)
          ) {
            setMessages((prev) =>
              prev.map((m) => (m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m))
            );
          }
        }
      )
      .subscribe((status) => {
        console.info('Supabase Realtime Status:', status);
      });

    // Also subscribe to local message broadcast for multi-tab reactivity
    const unsubLocal = daheejStore.subscribeToMessages((msg) => {
      const mReceiver = msg.receiver_id || (msg as any as any).recipient_id;
      if (
        isMounted &&
        ((msg.sender_id === partnerId && mReceiver === currentUserId) ||
          (msg.sender_id === currentUserId && mReceiver === partnerId))
      ) {
        const callEvt = parseCallEvent(msg.content);
        const isTermMsg =
          callEvt?.type === 'CALL_ENDED' ||
          callEvt?.type === 'CALL_DECLINED' ||
          callEvt?.type === 'CALL_MISSED' ||
          callEvt?.type === 'CALL_CONNECTED' ||
          msg.content?.includes('CALL_ENDED') ||
          msg.content?.includes('CALL_DECLINED') ||
          msg.content?.includes('CALL_MISSED');

        if (isTermMsg) {
          stopRingtone();
          setIncomingCallPopup((prev) => {
            if (!prev) return null;
            if (!callEvt?.room_id || prev.room_id === callEvt.room_id || prev.sender_id === msg.sender_id) {
              return null;
            }
            return prev;
          });
        }

        const invite = parseCallInvite(msg.content);
        if (invite && msg.sender_id === partnerId && !isTermMsg) {
          setIncomingCallPopup({
            room_id: invite.room_id,
            callType: invite.callType,
            caller_name: invite.caller_name || activeChat?.full_name || 'Matched Partner',
            sender_id: msg.sender_id,
            timestamp: Date.now(),
          });
          playRingtone();
        }

        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) {
            return prev.map((m) => (m.id === msg.id ? { ...m, ...msg } : m));
          }
          const isDuplicate = prev.some(
            (m) =>
              m.sender_id === msg.sender_id &&
              m.content === msg.content &&
              Math.abs(new Date(m.created_at).getTime() - new Date(msg.created_at).getTime()) < 45000
          );
          if (isDuplicate) return prev;
          return [...prev, msg];
        });
        scrollToBottom(true);
      }
    });

    // Call signals listener for instant cancellation
    const unsubCallSignals = subscribeToCallSignals(
      currentUserId,
      (inviteData) => {
        if (!isMounted) return;
        if (!partnerId || inviteData.caller_id === partnerId) {
          setIncomingCallPopup({
            room_id: inviteData.room_id,
            callType: inviteData.callType === 'video' ? 'video' : 'voice',
            caller_name: inviteData.caller_name || activeChat?.full_name || 'Matched Partner',
            sender_id: inviteData.caller_id || '',
            timestamp: Date.now(),
          });
          playRingtone();
        }
      },
      (cancelledRoomId) => {
        if (!isMounted) return;
        stopRingtone();
        setIncomingCallPopup((prev) => {
          if (!prev) return null;
          if (!cancelledRoomId || prev.room_id === cancelledRoomId) {
            return null;
          }
          return prev;
        });
      }
    );

    // Continuous 2-second heartbeat polling so messages & calls update without reload
    const pollInterval = setInterval(() => {
      if (activeChat?.id) {
        fetchMessages();
      }
    }, 2000);

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
      unsubLocal();
      unsubCallSignals();
      clearInterval(pollInterval);
      stopRingtone();
    };
  }, [currentUserId, activeChat?.id, supabase, scrollToBottom, fetchMessages]);

  // Handle Call Initiation (Sender Side):
  // 1. Inserts CALL_INVITE message into messages table
  // 2. Opens ZegoCloud call room in new tab with ?type=video or ?type=voice
  const handleInitiateCall = async (callType: 'video' | 'voice') => {
    if (!activeChat || !currentUserId || isInitiatingCall) return;

    try {
      setIsInitiatingCall(true);

      const callerName = currentProfile?.full_name || 'Caller';
      const { roomID, message: sentMsg } = await sendCallInvite({
        currentUserId,
        partnerId: activeChat.id,
        callerName,
        callType,
      });

      // Update message list immediately
      setMessages((prev) => {
        if (prev.some((m) => m.id === sentMsg.id)) return prev;
        return [...prev, sentMsg];
      });
      scrollToBottom(true);

      // Open Call Room in new window/tab for sender (Caller)
      if (typeof window !== 'undefined') {
        window.open(`/call/${roomID}?callType=${callType}&role=caller&partnerId=${activeChat.id}`, '_blank');
      }
    } catch (callErr) {
      console.error('[MessagesPage] Error starting call signaling:', callErr);
    } finally {
      setIsInitiatingCall(false);
    }
  };

  // Handle declining an incoming call
  const handleDeclineCall = async (messageId: string, roomId: string) => {
    try {
      stopRingtone();
      setIncomingCallPopup(null);

      // 1. Update optimistic UI state immediately
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId || (roomId && m.content?.includes(roomId))
            ? { ...m, content: 'CALL_DECLINED' }
            : m
        )
      );

      // 2. Perform database update, signaling, and local store synchronization
      await declineCallSession(messageId, roomId, currentUserId, activeChat?.id);

      // 3. Direct Supabase update ensuring database sync
      if (messageId) {
        await supabase
          .from('messages')
          .update({ content: 'CALL_DECLINED' })
          .eq('id', messageId);
      }
      if (roomId) {
        daheejStore.updateCallInviteStatus(roomId, 'CALL_DECLINED');
      }
    } catch (error) {
      console.error('Failed to decline call:', error);
    }
  };

  // Handle sending a new message with Shariah Anti-Dowry moderation & optimistic insert
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setModerationWarning(null);

    const trimmed = inputContent.trim();
    if (!trimmed || !currentUserId || !activeChat?.id || isSending) return;

    // Check free tier limits
    if (tier === 'free') {
      const sentToday = daheejStore.getMessageCountForUser(currentUserId);
      if (sentToday >= 5) {
        setModerationWarning(
          'Free Sunnah Plan quota reached (5 messages/day). Upgrade to Gold or Diamond for unlimited messaging.'
        );
        return;
      }
    }

    // Run Shariah moderation
    const moderation = moderateTextContent(trimmed);
    if (!moderation.isClean) {
      setModerationWarning(
        moderation.rejectionReason || 'Message flagged: Content violates Islamic anti-dowry or modesty policies.'
      );
      return;
    }

    setIsSending(true);
    setInputContent('');
    setShowStarters(false);

    // 1. OPTIMISTIC LOCAL STATE INSERT
    const localMsg = daheejStore.sendMessage(currentUserId, activeChat.id, trimmed);
    setMessages((prev) => {
      if (prev.some((m) => m.id === localMsg.id)) return prev;
      return [...prev, localMsg];
    });
    scrollToBottom(true);

    // 2. ROBUST SUPABASE POSTGRES INSERT (The Save)
    try {
      let insertedData: ChatMessage | null = null;

      // Primary insert with receiver_id
      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: currentUserId,
          receiver_id: activeChat.id,
          recipient_id: activeChat.id,
          content: trimmed,
          is_read: false,
        })
        .select()
        .single();

      if (error) {
        console.warn('[MessagesPage] Primary insert failed, trying secondary fallback:', error.message);
        const { data: fbData, error: fbError } = await supabase
          .from('messages')
          .insert({
            sender_id: currentUserId,
            receiver_id: activeChat.id,
            content: trimmed,
            is_read: false,
          })
          .select()
          .single();

        if (fbError) {
          console.info('[MessagesPage] Supabase insert note (preserving local message):', fbError.message);
        } else if (fbData) {
          insertedData = fbData as ChatMessage;
        }
      } else if (data) {
        insertedData = data as ChatMessage;
      }

      // If database insert returned the record, update optimistic state with confirmed ID
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
      console.warn('[MessagesPage] Remote send message network note:', err);
    } finally {
      setIsSending(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  };

  // Filter accepted matches by search query
  const filteredMatches = useMemo(() => {
    if (!searchQuery.trim()) return acceptedMatches;
    const q = searchQuery.toLowerCase();
    return acceptedMatches.filter(
      (m) =>
        m.full_name?.toLowerCase().includes(q) ||
        m.profession?.toLowerCase().includes(q) ||
        m.location?.toLowerCase().includes(q)
    );
  }, [acceptedMatches, searchQuery]);

  const canMakeCalls = tier === 'platinum' || tier === 'diamond';

  // Instantly snap scroll to bottom on messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages.length, activeChat?.id, scrollToBottom]);

  return (
    <div className="w-full h-full min-h-0 flex-1 overflow-hidden flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-0 sm:p-2 md:p-3">
      {/* Top Banner: Islamic Matrimonial Messaging Charter (Compact on Mobile, hidden when in active mobile chat to give 100% viewport to conversation) */}
      <div className={`shrink-0 mb-0 sm:mb-3 bg-gradient-to-r from-emerald-900/90 via-teal-950/90 to-zinc-900 border border-emerald-500/30 rounded-none sm:rounded-2xl p-2.5 sm:p-4 text-white ${activeChat ? 'hidden sm:flex' : 'flex'} flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 shadow-lg`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-emerald-200 flex items-center gap-2">
              Encrypted Shariah Matrimonial Messaging
              <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
                100% Dowry-Free
              </span>
            </h3>
            <p className="text-[11px] sm:text-xs text-zinc-300">
              Direct, honorable communication under Islamic values. Prohibits dowry extortion, vulgarity & stalking.
            </p>
          </div>
        </div>

        {tier === 'free' ? (
          <button
            onClick={() => {
              if (onOpenPricing) onOpenPricing();
              else if (typeof window !== 'undefined') window.location.href = '/?tab=pricing';
            }}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 active:bg-amber-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
          >
            <Crown className="w-4 h-4 text-amber-400" />
            <span>Upgrade to Gold for Unlimited Chat</span>
          </button>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span className="capitalize font-medium">{tier} Tier Active</span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TWO-COLUMN CHAT LAYOUT */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col md:flex-row bg-white dark:bg-zinc-900 border-0 sm:border border-zinc-200 dark:border-zinc-800 rounded-none sm:rounded-3xl overflow-hidden shadow-xl min-h-0 h-full transition-colors">
        {/* ======================================================================= */}
        {/* COLUMN 1: SIDEBAR (ACCEPTED MATCHES LIST) */}
        {/* Hidden on mobile when activeChat is selected */}
        {/* ======================================================================= */}
        <div
          className={`w-full md:w-80 lg:w-96 border-r border-zinc-200 dark:border-zinc-800 flex flex-col bg-zinc-50 dark:bg-zinc-950 transition-colors h-full min-h-0 ${
            activeChat ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Sidebar Header & Search */}
          <div className="p-3 sm:p-4 border-b border-zinc-200 dark:border-zinc-800 space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Accepted Matches</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                  {acceptedMatches.length}
                </span>
              </h2>

              <button
                onClick={() => {
                  if (onNavigateMatches) onNavigateMatches();
                  else if (typeof window !== 'undefined') window.location.href = '/?tab=matches';
                }}
                className="min-h-[44px] px-2 text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
              >
                <Users className="w-4 h-4" />
                <span>Discover</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search matches by name, location..."
                className="w-full min-h-[44px] bg-white dark:bg-zinc-900 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 pl-9 pr-3 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-800 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          {/* Matches List Items */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-200/60 dark:divide-zinc-800/60 overscroll-contain">
            {isSidebarLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-xl animate-pulse">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
                    <div className="space-y-1 flex-1">
                      <div className="w-24 h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded" />
                      <div className="w-36 h-2.5 bg-zinc-200 dark:bg-zinc-800 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredMatches.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 dark:text-zinc-400 space-y-3">
                <Users className="w-10 h-10 mx-auto text-zinc-400 dark:text-zinc-600" />
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  {searchQuery ? 'No matching candidates.' : 'No mutual matches yet.'}
                </p>
                <p className="text-[11px] text-zinc-500">
                  {searchQuery
                    ? 'Try searching with a different name or keyword.'
                    : 'Send or accept marriage proposals to start halal conversations.'}
                </p>
                <button
                  onClick={() => {
                    if (onNavigateMatches) onNavigateMatches();
                    else if (typeof window !== 'undefined') window.location.href = '/?tab=matches';
                  }}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 active:bg-emerald-700 transition-colors cursor-pointer"
                >
                  Browse Matches
                </button>
              </div>
            ) : (
              (filteredMatches || []).map((match) => {
                const isSelected = activeChat?.id === match.id;

                return (
                  <button
                    key={match.id}
                    id={`sidebar-match-${match.id}`}
                    onClick={() => {
                      setActiveChat(match);
                      setModerationWarning(null);
                    }}
                    className={`w-full min-h-[64px] p-3.5 text-left flex items-start gap-3 transition-colors cursor-pointer active:bg-zinc-200 dark:active:bg-zinc-800 ${
                      isSelected
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-l-4 border-emerald-600 dark:border-emerald-400'
                        : 'hover:bg-zinc-100 dark:hover:bg-zinc-900/60'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 rounded-2xl overflow-hidden bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 flex items-center justify-center">
                        {match.avatar_url ? (
                          <img
                            src={match.avatar_url}
                            alt={match.full_name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-base font-bold text-zinc-700 dark:text-zinc-300">
                            {match.full_name?.charAt(0) || 'M'}
                          </span>
                        )}
                      </div>
                      {match.kyc_status === 'verified' && (
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] shadow-xs">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </span>
                      )}
                    </div>

                    {/* Partner Metadata */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h3 className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                          {getDisplayName(match)}
                        </h3>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
                          Matched
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                        {match.age ? `${match.age} yrs • ` : ''}
                        {match.profession || match.location || 'Nikah Candidate'}
                      </p>
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-300">
                        <UserCheck className="w-3 h-3 text-emerald-600" />
                        <span>Mutual Anti-Dowry Match</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ======================================================================= */}
        {/* COLUMN 2: MAIN CHAT WINDOW */}
        {/* Visible when activeChat is selected (or default on desktop) */}
        {/* ======================================================================= */}
        <div
          className={`flex-1 flex flex-col bg-white dark:bg-zinc-900 transition-colors h-full min-h-0 overflow-hidden ${
            !activeChat ? 'hidden md:flex items-center justify-center' : 'flex'
          }`}
        >
          {activeChat ? (
            <>
              {/* Top Header of Active Chat */}
              <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/90 dark:bg-zinc-950/90 backdrop-blur-md shrink-0 z-10">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  {/* Mobile Back Button (Min 44x44px Touch Target) */}
                  <button
                    onClick={() => setActiveChat(null)}
                    className="md:hidden min-w-[44px] min-h-[44px] p-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 active:bg-zinc-200 dark:active:bg-zinc-700 cursor-pointer flex items-center justify-center shrink-0"
                    aria-label="Back to conversations"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>

                  {/* Partner Avatar & Details */}
                  <div className="relative w-10 h-10 rounded-2xl overflow-hidden bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 shrink-0">
                    <img
                      src={activeChat.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500'}
                      alt={activeChat.full_name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white truncate">
                        {getDisplayName(activeChat)}
                      </h3>
                      {activeChat.kyc_status === 'verified' && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 shrink-0">
                          <Shield className="w-2.5 h-2.5" />
                          KYC
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                      {activeChat.profession || 'Professional'} • {activeChat.location || 'India'}
                    </p>
                  </div>
                </div>

                {/* Calling Action Buttons (ZegoCloud 1-on-1 Voice & Video Calling - Min 44x44px Touch Targets) */}
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <button
                    id="active-chat-audio-call-btn"
                    disabled={isInitiatingCall}
                    onClick={() => handleInitiateCall('voice')}
                    title="Start 1-on-1 Voice Call (Disables Camera, Opens Zego Audio Room)"
                    className="min-w-[44px] min-h-[44px] p-2.5 px-3 rounded-full sm:rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 active:bg-emerald-100 dark:active:bg-emerald-900/80 transition-all flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="hidden sm:inline">Voice</span>
                  </button>

                  <button
                    id="active-chat-video-call-btn"
                    disabled={isInitiatingCall}
                    onClick={() => handleInitiateCall('video')}
                    title="Start 1-on-1 Video Call (Enables Camera & Mic, Opens Zego Video Room)"
                    className="min-w-[44px] min-h-[44px] p-2.5 px-3.5 rounded-full sm:rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 border border-emerald-600 text-white transition-all flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    <Video className="w-4 h-4" />
                    <span className="hidden sm:inline">Video</span>
                  </button>
                </div>
              </div>

              {/* Top Floating Incoming Call Popup / Notification Banner */}
              {incomingCallPopup && (
                <div className="mx-3 sm:mx-4 mt-2 sm:mt-3 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-900 to-teal-900 border-2 border-emerald-400 text-white shadow-2xl flex items-center justify-between gap-3 animate-bounce shrink-0 z-20">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shrink-0">
                      <span className="absolute -inset-1 rounded-xl bg-emerald-400 opacity-75 animate-ping" />
                      {incomingCallPopup.callType === 'video' ? (
                        <Video className="w-5 h-5 relative z-10" />
                      ) : (
                        <PhoneCall className="w-5 h-5 relative z-10" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-emerald-400 text-emerald-950 uppercase tracking-wider">
                          Incoming {incomingCallPopup.callType === 'video' ? 'Video' : 'Voice'} Call
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-emerald-100 mt-0.5 truncate">
                        {incomingCallPopup.caller_name || getDisplayName(activeChat)} is calling you...
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      id="accept-incoming-call-popup-btn"
                      onClick={() => {
                        stopRingtone();
                        setIncomingCallPopup(null);
                        const callUrl = `/call/${incomingCallPopup.room_id}?callType=${incomingCallPopup.callType}&role=receiver`;
                        if (typeof window !== 'undefined') {
                          window.history.pushState({ tab: 'call' }, '', callUrl);
                          window.dispatchEvent(new CustomEvent('app:navigate', { detail: { path: callUrl, tab: 'call' } }));
                        }
                      }}
                      className="min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 active:bg-emerald-500 text-emerald-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer active:scale-95"
                    >
                      <PhoneIncoming className="w-4 h-4" />
                      <span>Accept</span>
                    </button>
                    <button
                      id="decline-incoming-call-popup-btn"
                      onClick={async () => {
                        const targetRoomId = incomingCallPopup.room_id;
                        stopRingtone();
                        setIncomingCallPopup(null);
                        if (targetRoomId) {
                          const targetMsgId = messages.find((m) => m.content?.includes(targetRoomId))?.id || '';
                          await handleDeclineCall(targetMsgId, targetRoomId);
                        }
                      }}
                      className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white transition-colors cursor-pointer flex items-center justify-center"
                      title="Dismiss & Decline"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Call Timeout / Unavailable Notification Banner */}
              {callAlert && (
                <div className="p-3 bg-red-500/10 border-b border-red-500/30 text-red-700 dark:text-red-300 flex items-center justify-between gap-3 text-xs shrink-0 animate-in fade-in slide-in-from-top-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                    <span className="truncate font-medium">{callAlert}</span>
                  </div>
                  <button
                    onClick={() => setCallAlert(null)}
                    className="min-w-[32px] min-h-[32px] p-1 rounded-lg hover:bg-red-500/20 active:bg-red-500/30 text-red-700 dark:text-red-300 cursor-pointer flex items-center justify-center shrink-0"
                    title="Dismiss alert"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Notification Permission Request Banner */}
              {notifPermission === 'default' && (
                <div className="p-2.5 px-3 sm:px-4 bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-900 dark:text-emerald-100 flex items-center justify-between gap-3 text-xs shrink-0 animate-in fade-in">
                  <div className="flex items-center gap-2 min-w-0">
                    <Bell className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="truncate">
                      Enable notifications to receive instant audio & visual alerts for incoming calls
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      id="enable-notifications-btn"
                      onClick={requestNotificationPermission}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold rounded-lg transition text-[11px] cursor-pointer shadow-xs"
                    >
                      Enable
                    </button>
                    <button
                      onClick={() => setNotifPermission('denied')}
                      className="p-1 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition cursor-pointer"
                      title="Dismiss"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Shariah Anti-Dowry Guard Banner */}
              <div className="px-3 sm:px-4 py-1.5 bg-emerald-50/70 dark:bg-emerald-950/40 border-b border-emerald-100 dark:border-emerald-900/40 text-[10px] sm:text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 shrink-0">
                <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">
                  <strong>Halal Discussion:</strong> Keep conversations focused on deen, values, and family compatibility.
                </span>
              </div>

              {/* Messages Body (Flex-1 scrollable with isolated container-level scrolling) */}
              <div 
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-zinc-50/30 dark:bg-zinc-950/20 overscroll-contain min-h-0"
              >
                {isMessagesLoading && messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-4 max-w-md mx-auto p-4 sm:p-6">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                      <Heart className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
                        Start your conversation with {getDisplayName(activeChat)}
                      </h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Begin with an Islamic greeting. Maintain respect, modesty, and clarity regarding matrimonial expectations.
                      </p>
                    </div>

                    {/* Quick Islamic Conversation Starters */}
                    <div className="w-full space-y-2 pt-2">
                      <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                        Suggested Halal Starters
                      </p>
                      {ISLAMIC_STARTERS.slice(0, 2).map((starter, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setInputContent(starter);
                            inputRef.current?.focus();
                          }}
                          className="w-full min-h-[44px] p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-left text-zinc-700 dark:text-zinc-300 hover:border-emerald-500 active:bg-zinc-100 dark:active:bg-zinc-700 transition-colors cursor-pointer"
                        >
                          "{starter}"
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  (messages || []).map((msg) => {
                    const isMe = msg.sender_id === currentUserId;
                    const eventData = parseCallEvent(msg.content);
                    const isCallDeclined =
                      eventData?.type === 'CALL_DECLINED' ||
                      msg.content === 'CALL_DECLINED' ||
                      msg.content?.startsWith('CALL_DECLINED') ||
                      msg.content?.includes('CALL_DECLINED') ||
                      msg.content?.includes('"CALL_DECLINED"');
                    const isCallMissed =
                      !isCallDeclined &&
                      (eventData?.type === 'CALL_MISSED' ||
                        msg.content === 'CALL_MISSED' ||
                        msg.content?.startsWith('CALL_MISSED') ||
                        msg.content?.includes('CALL_MISSED') ||
                        msg.content?.includes('"CALL_MISSED"'));
                    const isCallEnded =
                      !isCallDeclined &&
                      !isCallMissed &&
                      (eventData?.type === 'CALL_ENDED' ||
                        msg.content === 'CALL_ENDED' ||
                        msg.content?.startsWith('CALL_ENDED') ||
                        msg.content?.includes('CALL_ENDED'));
                    const isCallConnected =
                      !isCallDeclined &&
                      !isCallMissed &&
                      !isCallEnded &&
                      (eventData?.type === 'CALL_CONNECTED' ||
                        msg.content === 'CALL_CONNECTED' ||
                        msg.content?.startsWith('CALL_CONNECTED') ||
                        msg.content?.includes('CALL_CONNECTED'));
                    const callInvite = (!isCallDeclined && !isCallEnded && !isCallMissed && !isCallConnected) ? parseCallInvite(msg.content) : null;

                    // Check if invite is currently ringing and unexpired
                    const isStillActive = isCallInviteCurrentlyActive(msg, messages);

                    // 1. Sleek Compact Call Log Pill for completed/ended/declined/missed/expired calls
                    if (isCallDeclined || isCallMissed || isCallEnded || isCallConnected || (callInvite && !isStillActive)) {
                      const isVideo = callInvite?.callType === 'video' || eventData?.type === 'CALL_ENDED';
                      const durationSec = eventData?.duration || 0;
                      const formattedDuration = durationSec > 0
                        ? `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`
                        : '';

                      return (
                        <div key={msg.id} className="w-full flex justify-center my-2.5 px-2">
                          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-100/90 dark:bg-zinc-800/90 border border-zinc-200/80 dark:border-zinc-700/60 shadow-xs text-xs">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                              isCallMissed || isCallDeclined
                                ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400'
                                : isCallConnected
                                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400'
                                : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
                            }`}>
                              {isCallMissed ? (
                                <PhoneMissed className="w-3 h-3" />
                              ) : isCallDeclined ? (
                                <PhoneOff className="w-3 h-3" />
                              ) : isCallConnected ? (
                                <PhoneCall className="w-3 h-3" />
                              ) : isVideo ? (
                                <Video className="w-3 h-3" />
                              ) : (
                                <Phone className="w-3 h-3" />
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 font-medium">
                              <span>
                                {isCallMissed
                                  ? (isMe ? 'Unanswered Call' : 'Missed Call')
                                  : isCallDeclined
                                  ? 'Call Declined'
                                  : isCallConnected
                                  ? 'Call Connected'
                                  : `${isVideo ? 'Video' : 'Voice'} Call Ended ${formattedDuration ? `(${formattedDuration})` : ''}`}
                              </span>
                              <span className="text-zinc-400 dark:text-zinc-500 text-[10px]">
                                • {new Date(msg.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleInitiateCall(isVideo ? 'video' : 'voice')}
                              className="ml-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white transition-all cursor-pointer shadow-xs shrink-0"
                              title="Call Back"
                            >
                              Call Back
                            </button>
                          </div>
                        </div>
                      );
                    }

                    // 2. Touch-Optimized Active Ringing Call Card
                    if (callInvite && isStillActive) {
                      const isVideo = callInvite.callType === 'video';
                      const callerCallUrl = `/call/${callInvite.room_id}?callType=${callInvite.callType}&role=caller`;
                      const receiverCallUrl = `/call/${callInvite.room_id}?callType=${callInvite.callType}&role=receiver`;

                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} my-2.5 w-full`}
                        >
                          <div
                            className={`w-full max-w-[92%] sm:max-w-md p-3.5 sm:p-4 rounded-2xl border transition-all ${
                              isMe
                                ? 'bg-gradient-to-br from-emerald-900 to-teal-950 border-emerald-500/60 text-white shadow-lg'
                                : 'bg-gradient-to-br from-emerald-950/95 to-teal-950/95 border-2 border-emerald-400 text-white shadow-xl ring-2 ring-emerald-500/20 animate-pulse'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="relative w-11 h-11 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shrink-0 shadow-md">
                                <span className="absolute -inset-1 rounded-2xl bg-emerald-400 opacity-60 animate-ping" />
                                {isVideo ? <Video className="w-5 h-5 relative z-10" /> : <Phone className="w-5 h-5 relative z-10" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs sm:text-sm text-white">
                                    {isMe
                                      ? `Outgoing ${isVideo ? 'Video' : 'Voice'} Call`
                                      : `Incoming ${isVideo ? 'Video' : 'Voice'} Call`}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-400 text-emerald-950 uppercase tracking-wider">
                                    Ringing
                                  </span>
                                </div>
                                <p className="text-[11px] text-emerald-100/90 truncate mt-0.5 font-medium">
                                  {isMe
                                    ? 'Waiting for partner to answer...'
                                    : `${callInvite.caller_name || getDisplayName(activeChat)} is calling you`}
                                </p>
                              </div>
                            </div>

                            {/* Responsive Action Buttons with 44px minimum touch target */}
                            <div className="mt-3 pt-2.5 border-t border-emerald-400/20 flex items-center gap-2">
                              {isMe ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (typeof window !== 'undefined') {
                                      window.history.pushState({ tab: 'call' }, '', callerCallUrl);
                                      window.dispatchEvent(new CustomEvent('app:navigate', { detail: { path: callerCallUrl, tab: 'call' } }));
                                    }
                                  }}
                                  className="w-full min-h-[44px] py-2 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer active:scale-95 bg-emerald-400 hover:bg-emerald-300 active:bg-emerald-500 text-emerald-950"
                                >
                                  <Video className="w-4 h-4" />
                                  <span>Enter Call Room</span>
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      stopRingtone();
                                      setIncomingCallPopup(null);
                                      if (typeof window !== 'undefined') {
                                        window.history.pushState({ tab: 'call' }, '', receiverCallUrl);
                                        window.dispatchEvent(new CustomEvent('app:navigate', { detail: { path: receiverCallUrl, tab: 'call' } }));
                                      }
                                    }}
                                    className="bg-emerald-400 hover:bg-emerald-300 active:bg-emerald-500 text-emerald-950 font-bold rounded-xl py-2.5 px-3 flex items-center justify-center gap-1.5 flex-1 min-h-[44px] text-xs sm:text-sm transition-all cursor-pointer shadow-md active:scale-95"
                                  >
                                    <PhoneIncoming className="w-4 h-4" />
                                    <span>Accept & Join</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeclineCall(msg.id, callInvite.room_id)}
                                    className="bg-rose-500/20 border border-rose-400/40 text-rose-200 hover:bg-rose-600 hover:text-white active:bg-rose-700 font-bold rounded-xl py-2.5 px-3 flex items-center justify-center gap-1.5 flex-1 min-h-[44px] text-xs sm:text-sm transition-all cursor-pointer shadow-sm active:scale-95"
                                  >
                                    <PhoneOff className="w-4 h-4" />
                                    <span>Decline</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-[70%] px-4 py-2.5 rounded-2xl text-xs sm:text-sm space-y-1 shadow-xs ${
                            isMe
                              ? 'bg-emerald-600 text-white rounded-br-xs'
                              : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700 rounded-bl-xs'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                          <div
                            className={`flex items-center justify-end gap-1 text-[10px] ${
                              isMe ? 'text-emerald-100' : 'text-zinc-400'
                            }`}
                          >
                            <Clock className="w-2.5 h-2.5" />
                            <span>
                              {new Date(msg.created_at || Date.now()).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            {isMe && (
                              <span className="inline-flex items-center">
                                {Boolean(msg.is_read || msg.read) ? (
                                  <span title="Read" className="inline-flex items-center text-sky-300 dark:text-sky-400 font-bold">
                                    <CheckCheck className="w-3.5 h-3.5 text-sky-300 dark:text-sky-400" />
                                  </span>
                                ) : (
                                  <span title="Sent" className="inline-flex items-center text-emerald-200/80">
                                    <Check className="w-3.5 h-3.5 text-emerald-200/80" />
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Moderation / Error Banner */}
              {moderationWarning && (
                <div className="mx-3 sm:mx-4 mb-2 p-2.5 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-xs flex items-center gap-2 shrink-0">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{moderationWarning}</span>
                </div>
              )}

              {/* Message Input Bar (Pinned securely to bottom with safe area padding) */}
              <div className="shrink-0 sticky bottom-0 z-20 p-2.5 sm:p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 pb-safe space-y-2 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_16px_rgba(0,0,0,0.35)]">
                {/* Starters Accordion Button */}
                <div className="flex items-center justify-between px-1">
                  <button
                    type="button"
                    onClick={() => setShowStarters(!showStarters)}
                    className="min-h-[32px] text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{showStarters ? 'Hide Halal Starters' : 'Show Islamic Starters'}</span>
                  </button>
                  <span className="text-[10px] text-zinc-400 hidden sm:inline">Press Enter to Send</span>
                </div>

                {showStarters && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 max-h-36 overflow-y-auto">
                    {ISLAMIC_STARTERS.map((text, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setInputContent(text);
                          setShowStarters(false);
                          inputRef.current?.focus();
                        }}
                        className="text-left text-[11px] p-2.5 rounded-lg bg-white dark:bg-zinc-800 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer truncate min-h-[36px]"
                      >
                        "{text}"
                      </button>
                    ))}
                  </div>
                )}

                {/* Form Input */}
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputContent}
                    onChange={(e) => setInputContent(e.target.value)}
                    placeholder={`Message ${getDisplayName(activeChat)}...`}
                    className="flex-1 min-h-[44px] bg-zinc-100 dark:bg-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-white px-4 py-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  />

                  <button
                    id="btn-send-chat-message"
                    type="submit"
                    disabled={!inputContent.trim() || isSending}
                    className="min-w-[44px] min-h-[44px] p-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-700/20 transition-all cursor-pointer flex items-center justify-center shrink-0"
                    aria-label="Send message"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            /* Desktop Empty State: No Match Selected */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <MessageSquare className="w-8 h-8" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Select a Mutual Match to Chat
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Select an accepted marriage proposal candidate from the sidebar to start instant real-time messaging.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
