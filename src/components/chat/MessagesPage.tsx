'use client';

// ==============================================================================
// DAHEEJFREE PRODUCTION REAL-TIME MESSAGING ENGINE & SPLIT-PANE UI
// Fully Integrated with Supabase Realtime Channels, Moderation & Shariah Guardrails
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
  AlertTriangle,
  MessageSquare,
  Users,
  ChevronLeft,
  Info,
  Clock,
  Heart,
  Crown,
  Smile,
  Circle,
  Eye,
  X,
  Bell,
  ArrowDown,
} from 'lucide-react';
import { Profile, ProfileSecureView, SubscriptionTier, ChatMessage } from '../../types';
import { daheejStore } from '../../lib/supabase/store';
import { createBrowserClient } from '@supabase/ssr';
import { moderateTextContent } from '../../lib/moderation';
import { parseCallInvite, parseCallEvent, formatCallMessagePreview, sendCallInvite, declineCallSession, isCallSignalingContent, isCallInviteCurrentlyActive, subscribeToCallSignals } from '../../lib/callSignaling';

export const MessagePreviewRenderer: React.FC<{ content: string | undefined | null; isMe: boolean }> = ({ content, isMe }) => {
  if (!content) return <span className="italic text-emerald-600 dark:text-emerald-400">Start a Shariah conversation...</span>;
  
  const trimmed = content.trim();
  const prefix = isMe ? 'You: ' : '';

  if (trimmed === 'CALL_CONNECTED' || trimmed.startsWith('CALL_CONNECTED') || trimmed.includes('"CALL_CONNECTED"')) {
    return <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400"><PhoneIncoming className="w-3.5 h-3.5" /> {prefix}Call Connected</span>;
  }
  if (trimmed === 'CALL_ENDED' || trimmed.startsWith('CALL_ENDED') || trimmed.includes('"CALL_ENDED"')) {
    return <span className="flex items-center gap-1 font-medium"><Phone className="w-3.5 h-3.5" /> {prefix}Call Ended</span>;
  }
  if (trimmed === 'CALL_DECLINED' || trimmed.startsWith('CALL_DECLINED') || trimmed.includes('"CALL_DECLINED"')) {
    return <span className="flex items-center gap-1 font-medium text-rose-600 dark:text-rose-400"><PhoneOff className="w-3.5 h-3.5" /> {prefix}Call Declined</span>;
  }
  if (trimmed === 'CALL_MISSED' || trimmed.startsWith('CALL_MISSED') || trimmed.includes('"CALL_MISSED"')) {
    return <span className="flex items-center gap-1 font-medium text-rose-600 dark:text-rose-400"><PhoneMissed className="w-3.5 h-3.5" /> {prefix}Missed Call</span>;
  }
  if (trimmed === 'CALL_INVITE' || trimmed.startsWith('CALL_INVITE') || trimmed.includes('"CALL_INVITE"') || trimmed.includes('CALL_INVITE')) {
    return <span className="flex items-center gap-1 font-medium"><PhoneCall className="w-3.5 h-3.5 animate-pulse text-emerald-500" /> {prefix}Call Invite</span>;
  }

  return <span>{prefix}{content}</span>;
};

const supabaseUrl =
  (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_SUPABASE_URL || process.env?.VITE_SUPABASE_URL : undefined) ||
  (typeof window !== 'undefined' && (import.meta as any as any).env?.VITE_SUPABASE_URL) ||
  '';

const supabaseAnonKey =
  (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env?.VITE_SUPABASE_ANON_KEY : undefined) ||
  (typeof window !== 'undefined' && (import.meta as any as any).env?.VITE_SUPABASE_ANON_KEY) ||
  '';

interface MessagesPageProps {
  currentProfile: Profile | null;
  viewerTier: SubscriptionTier;
  allProfiles: Profile[];
  initialSelectedUserId?: string | null;
  onStartCall: (targetUserId: string, callType: 'audio' | 'video') => void;
  onOpenPricing: () => void;
  onViewProfile?: (profile: ProfileSecureView) => void;
  onNavigateMatches?: () => void;
  onMobileChatStateChange?: (isActive: boolean) => void;
}

const ISLAMIC_STARTERS = [
  'Assalamu Alaikum wa Rahmatullahi wa Barakatuh',
  'Barakallahu Feekum. I viewed your profile with pure matrimonial intentions.',
  'May Allah guide our discussions with Barakah and Taqwa.',
  'Assalamu Alaikum, I would be honored to discuss our matrimonial compatibility under Shariah guidelines.',
];

export const MessagesPage: React.FC<MessagesPageProps> = ({
  currentProfile,
  viewerTier,
  allProfiles,
  initialSelectedUserId,
  onStartCall,
  onOpenPricing,
  onViewProfile,
  onNavigateMatches,
  onMobileChatStateChange,
}) => {
  // STABLE SUPABASE CLIENT: Initialized safely using useState to prevent recreate on render and keep WebSocket alive
  const [supabase] = useState(() =>
    createBrowserClient(supabaseUrl, supabaseAnonKey, {
      cookieOptions: {
        sameSite: 'none',
        secure: true,
      },
    })
  );

  const currentUserId = currentProfile?.id || '';
  const myGender = currentProfile?.gender === 'male' ? 'male' : 'female';
  const targetGender = myGender === 'male' ? 'female' : 'male';

  const [selectedUserId, setSelectedUserId] = useState<string | null>(initialSelectedUserId || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [moderationWarning, setModerationWarning] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<ChatMessage[]>([]);
  const [allUserMessages, setAllUserMessages] = useState<ChatMessage[]>([]);
  const [isMobileListOpen, setIsMobileListOpen] = useState(!initialSelectedUserId);
  const [isSending, setIsSending] = useState(false);
  const [isInitiatingCall, setIsInitiatingCall] = useState(false);
  const [showStarters, setShowStarters] = useState(false);
  
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const typingChannelRef = useRef<any>(null);
  const partnerTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const myTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reactively select conversation when initialSelectedUserId changes
  useEffect(() => {
    if (initialSelectedUserId) {
      setSelectedUserId(initialSelectedUserId);
      setIsMobileListOpen(false);
    }
  }, [initialSelectedUserId]);

  // Sync mobile chat state with parent
  useEffect(() => {
    onMobileChatStateChange?.(!isMobileListOpen && Boolean(selectedUserId));
  }, [isMobileListOpen, selectedUserId, onMobileChatStateChange]);

  const [isAntiDowryBannerDismissed, setIsAntiDowryBannerDismissed] = useState(false);

  // Deduplicate and consolidate call event messages so each call session renders at most one status pill
  const processedMessages = useMemo(() => {
    if (!activeMessages || activeMessages.length === 0) return [];

    // 1. Identify all rooms and their authoritative status & duration
    const roomStatusMap = new Map<string, {
      finalType: 'CALL_ENDED' | 'CALL_CONNECTED' | 'CALL_DECLINED' | 'CALL_MISSED';
      duration: number;
      callType: 'video' | 'voice';
      authoritativeMsgId: string;
      hasInvite: boolean;
    }>();

    const msgRoomMap = new Map<string, string>();

    for (const msg of activeMessages) {
      const invite = parseCallInvite(msg.content);
      const evt = parseCallEvent(msg.content);
      const roomId = invite?.room_id || evt?.room_id;

      if (roomId) {
        msgRoomMap.set(msg.id, roomId);
        const existing = roomStatusMap.get(roomId);
        const hasInvite = Boolean(invite) || Boolean(existing?.hasInvite);

        if (evt && evt.type !== 'CALL_INVITE') {
          // Priority rank: CALL_ENDED (4) > CALL_CONNECTED (3) > CALL_DECLINED (2) > CALL_MISSED (1)
          const rank = (t: string) =>
            t === 'CALL_ENDED' ? 4 : t === 'CALL_CONNECTED' ? 3 : t === 'CALL_DECLINED' ? 2 : 1;
          const currentRank = existing ? rank(existing.finalType) : 0;
          const newRank = rank(evt.type);

          if (!existing || newRank >= currentRank) {
            roomStatusMap.set(roomId, {
              finalType: evt.type,
              duration: evt.duration || existing?.duration || 0,
              callType: evt.callType || existing?.callType || invite?.callType || 'video',
              authoritativeMsgId: msg.id,
              hasInvite,
            });
          }
        } else if (!existing) {
          roomStatusMap.set(roomId, {
            finalType: 'CALL_MISSED',
            duration: 0,
            callType: invite?.callType || 'video',
            authoritativeMsgId: msg.id,
            hasInvite: true,
          });
        }
      }
    }

    // 2. Filter messages:
    // - For rooms with an authoritative call event message, suppress duplicate signaling messages and suppress inactive CALL_INVITE pills
    // - For messages without a roomId, suppress consecutive duplicate call status messages
    const result: ChatMessage[] = [];
    let lastPillType = '';

    for (const msg of activeMessages) {
      const roomId = msgRoomMap.get(msg.id);
      const invite = parseCallInvite(msg.content);
      const evt = parseCallEvent(msg.content);

      if (roomId) {
        const roomInfo = roomStatusMap.get(roomId);
        if (roomInfo) {
          // If this is an invite message:
          if (invite) {
            const isStillActive = isCallInviteCurrentlyActive(msg, activeMessages);
            if (isStillActive) {
              result.push(msg);
              lastPillType = '';
              continue;
            }
            // Inactive invite: if there is an authoritative event message for this room, do not render inactive invite as a duplicate pill
            if (roomInfo.authoritativeMsgId !== msg.id) {
              continue;
            }
          }

          // If this is a call event message (CALL_CONNECTED, CALL_DECLINED, etc.):
          if (evt && evt.type !== 'CALL_INVITE') {
            // Only render the authoritative event for this room
            if (roomInfo.authoritativeMsgId !== msg.id) {
              continue;
            }
          }
        }
      } else if (evt && evt.type !== 'CALL_INVITE') {
        if (evt.type === lastPillType) {
          continue;
        }
        lastPillType = evt.type;
      } else {
        lastPillType = '';
      }

      result.push(msg);
    }

    return result;
  }, [activeMessages]);

  // Incoming Call Popup State
  const [incomingCallPopup, setIncomingCallPopup] = useState<{
    room_id: string;
    callType: 'video' | 'voice';
    caller_name: string;
    sender_id: string;
    timestamp: number;
  } | null>(null);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Smart Chat Scroll State: isolates chat scrolling and preserves user scroll position
  const isUserScrolledUpRef = useRef<boolean>(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState<boolean>(false);
  const prevMsgCountRef = useRef<number>(0);
  const prevPartnerIdRef = useRef<string | null>(null);

  const scrollToBottom = useCallback((smooth = false) => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
      isUserScrolledUpRef.current = false;
      setShowScrollToBottom(false);
    }
  }, []);

  const handleChatScroll = useCallback(() => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    const isUp = distanceFromBottom > 100;
    isUserScrolledUpRef.current = isUp;
    setShowScrollToBottom(isUp);
  }, []);

  const stopRingtone = useCallback(() => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch (e) {}
      audioRef.current = null;
    }
  }, []);

  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });

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
      if (detail?.roomId) {
        setActiveMessages((prev) =>
          prev.map((m) =>
            m.content?.includes(detail.roomId)
              ? { ...m, content: 'CALL_ENDED' }
              : m
          )
        );
      }
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

  // 1. Get filtered available mutual accepted matches for the current user
  const [connectionsVersion, setConnectionsVersion] = useState(0);
  const [remoteAcceptedProfiles, setRemoteAcceptedProfiles] = useState<ProfileSecureView[]>([]);

  useEffect(() => {
    let isMounted = true;

    let isFetchingMatches = false;

    // Fetch all accepted connections from Supabase with !inner join to eliminate ghost profiles
    async function loadAcceptedMatches() {
      if (!currentUserId || isFetchingMatches) return;
      isFetchingMatches = true;

      try {
        const { data, error } = await supabase
          .from('connections')
          .select(`
            id,
            sender_id,
            receiver_id,
            status,
            sender:profiles!connections_sender_id_fkey!inner(*),
            receiver:profiles!connections_receiver_id_fkey!inner(*)
          `)
          .eq('status', 'accepted')
          .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);

        if (!error && data && isMounted) {
          const loadedProfiles: ProfileSecureView[] = [];
          data.forEach((conn: any) => {
            const partner = conn.sender_id === currentUserId ? conn.receiver : conn.sender;
            daheejStore.setConnectionFromRemote(conn, false);

            if (partner && partner.id) {
              daheejStore.setProfileFromRemote(partner);
              const isUnlocked = !partner.photo_privacy || daheejStore.hasAcceptedPhotoConsent(currentUserId, partner.id);
              loadedProfiles.push({
                ...partner,
                is_photo_unlocked: isUnlocked,
                photo_access_granted: isUnlocked,
                is_wali_unlocked: viewerTier === 'diamond',
              });
            }
          });
          setRemoteAcceptedProfiles(loadedProfiles);
        }
      } catch (err) {
        console.warn('[MessagesPage] Remote accepted connections fetch note:', err);
      } finally {
        isFetchingMatches = false;
      }
    }

    loadAcceptedMatches();

    const unsub = daheejStore.subscribe((event) => {
      if (!isMounted) return;
      if (event.table === 'connections' && event.eventType !== 'UPDATE') {
        setConnectionsVersion((v) => v + 1);
      }
    });

    const channelId = `messages_sidebar_connections_${currentUserId}_${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'connections',
        },
        (payload) => {
          if (!isMounted || !payload.new) return;
          const conn = payload.new as any as any;
          if (conn.sender_id === currentUserId || conn.receiver_id === currentUserId) {
            daheejStore.setConnectionFromRemote(conn, false);
            loadAcceptedMatches();
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      unsub();
      supabase.removeChannel(channel);
    };
  }, [currentUserId, viewerTier]);

  // Memoize conversation partner IDs to prevent recalculating secureProfiles on every read/message update
  const messagePartnerIdsKey = useMemo(() => {
    const set = new Set<string>();
    allUserMessages.forEach((m) => {
      const mReceiver = m.receiver_id || (m as any).recipient_id;
      const partnerId = m.sender_id === currentUserId ? mReceiver : m.sender_id;
      if (partnerId && partnerId !== currentUserId) {
        set.add(partnerId);
      }
    });
    return Array.from(set).sort().join(',');
  }, [allUserMessages, currentUserId]);

  const secureProfiles = useMemo(() => {
    if (!currentUserId) return [];
    const acceptedIds = new Set(daheejStore.getAcceptedConnectionPartnerIds(currentUserId));
    const secureList = daheejStore.getSecureProfiles(currentUserId);
    const allKnownProfiles = daheejStore.getProfiles();

    // Merge remote accepted profiles with secureList and exclude ghost/deleted profiles
    const map = new Map<string, ProfileSecureView>();
    
    // Add remote accepted
    remoteAcceptedProfiles.forEach((p) => {
      if (p.id && p.id !== currentUserId && p.kyc_status !== 'banned') {
        map.set(p.id, p);
      }
    });

    // Add local store profiles
    secureList.forEach((p) => {
      if (p.id === currentUserId || p.kyc_status === 'banned') return;
      if (acceptedIds.has(p.id) || p.id === initialSelectedUserId || p.id === selectedUserId) {
        map.set(p.id, p);
      }
    });

    // Also include anyone who has exchanged messages with currentUserId
    const partnerIdsWithMessages = messagePartnerIdsKey ? messagePartnerIdsKey.split(',') : [];
    partnerIdsWithMessages.forEach((pid) => {
      if (pid && !map.has(pid)) {
        const found = allProfiles.find((p) => p.id === pid) || allKnownProfiles.find((p) => p.id === pid);
        if (found && found.kyc_status !== 'banned') {
          const isUnlocked = !found.photo_privacy || daheejStore.hasAcceptedPhotoConsent(currentUserId, found.id);
          map.set(found.id, {
            ...found,
            is_photo_unlocked: isUnlocked,
            photo_access_granted: isUnlocked,
            is_wali_unlocked: viewerTier === 'diamond',
          });
        }
      }
    });

    // Ensure initialSelectedUserId and selectedUserId exist in list
    const ensureIds = [initialSelectedUserId, selectedUserId].filter(Boolean) as string[];
    ensureIds.forEach((targetId) => {
      if (!map.has(targetId)) {
        const found = allProfiles.find((p) => p.id === targetId) || allKnownProfiles.find((p) => p.id === targetId);
        if (found && found.kyc_status !== 'banned') {
          const isUnlocked = !found.photo_privacy || daheejStore.hasAcceptedPhotoConsent(currentUserId, found.id);
          map.set(found.id, {
            ...found,
            is_photo_unlocked: isUnlocked,
            photo_access_granted: isUnlocked,
            is_wali_unlocked: viewerTier === 'diamond',
          });
        }
      }
    });

    // Fallback if list is empty: show available verified profiles to start chatting
    if (map.size === 0 && allProfiles.length > 0) {
      allProfiles
        .filter((p) => p.id !== currentUserId && p.kyc_status !== 'banned')
        .slice(0, 10)
        .forEach((p) => {
          const isUnlocked = !p.photo_privacy || daheejStore.hasAcceptedPhotoConsent(currentUserId, p.id);
          map.set(p.id, {
            ...p,
            is_photo_unlocked: isUnlocked,
            photo_access_granted: isUnlocked,
            is_wali_unlocked: viewerTier === 'diamond',
          });
        });
    }

    return Array.from(map.values());
  }, [currentUserId, targetGender, allProfiles, connectionsVersion, initialSelectedUserId, selectedUserId, remoteAcceptedProfiles, messagePartnerIdsKey, viewerTier]);

  // If initialSelectedUserId is provided and exists, select it
  useEffect(() => {
    if (initialSelectedUserId && secureProfiles.some((p) => p.id === initialSelectedUserId)) {
      setSelectedUserId(initialSelectedUserId);
      setIsMobileListOpen(false);
    } else if (!selectedUserId && secureProfiles.length > 0) {
      // On desktop (screen >= 768px), default to first profile so the right pane isn't blank.
      // On mobile (screen < 768px), do NOT auto-select so the conversation list stays open!
      const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
      if (isDesktop) {
        setSelectedUserId(secureProfiles[0].id);
      }
    }
  }, [initialSelectedUserId, secureProfiles]);

  // The active chat partner
  const selectedPartner = useMemo(() => {
    return secureProfiles.find((p) => p.id === selectedUserId) || null;
  }, [secureProfiles, selectedUserId]);

  const selectedPartnerRef = useRef<ProfileSecureView | null>(selectedPartner);
  useEffect(() => {
    selectedPartnerRef.current = selectedPartner;
  }, [selectedPartner]);

  const activeMessagesRef = useRef<ChatMessage[]>(activeMessages);
  useEffect(() => {
    activeMessagesRef.current = activeMessages;
  }, [activeMessages]);

  // Load all messages for conversation list previews
  const refreshAllMessages = useCallback(() => {
    if (!currentUserId) return;
    const allMsgs = daheejStore.getAllMessagesForUser(currentUserId);
    setAllUserMessages(allMsgs);
  }, [currentUserId]);

  useEffect(() => {
    refreshAllMessages();
  }, [refreshAllMessages]);

  // 2. Fetch messages for active conversation and mark as read
  // Strictly relies on [currentUserId, selectedUserId] to prevent infinite re-render loops
  useEffect(() => {
    if (!currentUserId || !selectedUserId) {
      setActiveMessages([]);
      return;
    }

    stopRingtone();
    setIncomingCallPopup(null);

    // Initial conversation switch: pre-populate from local store
    const localMsgs = daheejStore.getMessages(currentUserId, selectedUserId);
    setActiveMessages(localMsgs);
    daheejStore.markMessagesAsRead(currentUserId, selectedUserId);

    let isMounted = true;

    const fetchActiveConversation = async () => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .or(
            `and(sender_id.eq.${currentUserId},receiver_id.eq.${selectedUserId}),and(sender_id.eq.${selectedUserId},receiver_id.eq.${currentUserId})`
          )
          .order('created_at', { ascending: true });

        if (!isMounted) return;

        if (error) {
          // Fallback for schemas using recipient_id
          const { data: fbData } = await supabase
            .from('messages')
            .select('*')
            .or(
              `and(sender_id.eq.${currentUserId},recipient_id.eq.${selectedUserId}),and(sender_id.eq.${selectedUserId},recipient_id.eq.${currentUserId})`
            )
            .order('created_at', { ascending: true });

          if (!isMounted) return;

          if (fbData && fbData.length > 0) {
            daheejStore.syncConversationMessages(currentUserId, selectedUserId, fbData as ChatMessage[]);
            const unified = daheejStore.getMessages(currentUserId, selectedUserId);
            setActiveMessages(unified);
          }
        } else if (data) {
          daheejStore.syncConversationMessages(currentUserId, selectedUserId, data as ChatMessage[]);
          const unified = daheejStore.getMessages(currentUserId, selectedUserId);
          setActiveMessages(unified);

          // Remote mark as read in Supabase
          try {
            await supabase
              .from('messages')
              .update({ is_read: true })
              .eq('sender_id', selectedUserId)
              .or(`receiver_id.eq.${currentUserId},recipient_id.eq.${currentUserId}`)
              .eq('is_read', false);

            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('daheej:messages_read'));
            }
          } catch (updateErr) {
            // Ignore if RLS or column difference
          }

          // Check for active incoming call in loaded unified messages
          const activeInviteMsg = unified.find(
            (m) => m.sender_id === selectedUserId && isCallInviteCurrentlyActive(m, unified)
          );
          if (activeInviteMsg) {
            const invite = parseCallInvite(activeInviteMsg.content);
            if (invite) {
              setIncomingCallPopup((prev) => {
                if (prev && prev.room_id === invite.room_id) return prev;
                playRingtone();
                return {
                  room_id: invite.room_id,
                  callType: invite.callType,
                  caller_name: selectedPartnerRef.current?.full_name || 'Matched Partner',
                  sender_id: selectedUserId,
                  timestamp: new Date(activeInviteMsg.created_at || Date.now()).getTime(),
                };
              });
            }
          } else {
            setIncomingCallPopup((prev) => {
              if (prev && prev.sender_id === selectedUserId) {
                stopRingtone();
                return null;
              }
              return prev;
            });
          }
        }
      } catch (err) {
        console.warn('[MessagesPage] Supabase remote sync fallback:', err);
      }
    };

    fetchActiveConversation();

    return () => {
      isMounted = false;
    };
  }, [currentUserId, selectedUserId, playRingtone, stopRingtone]);

  // 3. Supabase Real-Time WebSocket Channel for Live Messages
  // Strictly relies on [currentUserId, selectedUserId] with dedicated cleanup
  useEffect(() => {
    if (!currentUserId) return;

    const channelName = selectedUserId
      ? `chat_room_${currentUserId}_${selectedUserId}_${Math.random().toString(36).slice(2, 9)}`
      : `realtime_user_messages_${currentUserId}_${Math.random().toString(36).slice(2, 9)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const rawMsg = payload.new as any;
          if (!rawMsg) return;

          const newMsg: ChatMessage = {
            ...rawMsg,
            receiver_id: rawMsg.receiver_id || rawMsg.recipient_id,
            recipient_id: rawMsg.recipient_id || rawMsg.receiver_id,
            read: rawMsg.read ?? rawMsg.is_read ?? false,
            is_read: rawMsg.is_read ?? rawMsg.read ?? false,
          };

          const mReceiver = newMsg.receiver_id || newMsg.recipient_id;
          const isForMe = mReceiver === currentUserId || newMsg.sender_id === currentUserId;

          if (!isForMe) return;

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

          // Check if this is an incoming call invite from the partner
          const invite = parseCallInvite(newMsg.content);
          if (invite && newMsg.sender_id === selectedUserId && !isTermEvent && isCallInviteCurrentlyActive(newMsg, activeMessagesRef.current)) {
            setIncomingCallPopup({
              room_id: invite.room_id,
              callType: invite.callType,
              caller_name: invite.caller_name || selectedPartnerRef.current?.full_name || 'Matched Partner',
              sender_id: newMsg.sender_id,
              timestamp: Date.now(),
            });

            // Play audio ringtone
            playRingtone();

            // Native browser push notification with persistent interaction
            if (
              typeof window !== 'undefined' &&
              'Notification' in window &&
              Notification.permission === 'granted'
            ) {
              new Notification(
                `Incoming ${invite.callType === 'video' ? 'Video' : 'Voice'} Call from ${invite.caller_name || selectedPartnerRef.current?.full_name || 'Match'}`,
                {
                  body: 'Click to answer',
                  icon: '/favicon.ico',
                  requireInteraction: true,
                }
              );
            }
          } else if (newMsg.sender_id === selectedUserId && !invite && !isTermEvent) {
            // Native browser push notification when tab/document is in background (document.hidden)
            if (
              typeof window !== 'undefined' &&
              document.hidden &&
              'Notification' in window &&
              Notification.permission === 'granted'
            ) {
              new Notification(`New message from ${selectedPartnerRef.current?.full_name || 'Match'}`, {
                body: newMsg.content || 'Sent you a new message',
                icon: '/favicon.ico',
              });
            }
          }

          // STRICT CHECK: If message is for the currently open conversation, append immediately
          if (
            (newMsg.sender_id === selectedUserId && mReceiver === currentUserId) ||
            (newMsg.sender_id === currentUserId && mReceiver === selectedUserId)
          ) {
            daheejStore.addMessage(newMsg);
            setActiveMessages((prev) => {
              // 1. If exact ID already in state, update in-place
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

            if (mReceiver === currentUserId) {
              daheejStore.markMessagesAsRead(currentUserId, selectedUserId);
              // Send read receipt back to Supabase
              void supabase
                .from('messages')
                .update({ is_read: true })
                .eq('id', newMsg.id)
                .then(() => {
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('daheej:messages_read'));
                  }
                });
            }
          } else {
            daheejStore.addMessage(newMsg);
          }

          setAllUserMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) {
              return prev.map((m) => (m.id === newMsg.id ? { ...m, ...newMsg } : m));
            }
            return [...prev, newMsg];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const rawMsg = payload.new as any;
          if (!rawMsg) return;

          const updatedMsg: ChatMessage = {
            ...rawMsg,
            receiver_id: rawMsg.receiver_id || rawMsg.recipient_id,
            recipient_id: rawMsg.recipient_id || rawMsg.receiver_id,
            read: Boolean(rawMsg.read ?? rawMsg.is_read ?? false),
            is_read: Boolean(rawMsg.is_read ?? rawMsg.read ?? false),
          };

          // If this update signals call end or decline, dismiss call popup
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

          setActiveMessages((prev) =>
            prev.map((m) => (m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m))
          );

          setAllUserMessages((prev) =>
            prev.map((m) => (m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m))
          );
        }
      )
      .subscribe((status) => {
        console.info('Supabase Realtime Status:', status);
      });

    // Local reactive store broadcast subscription (for multi-tab / zero latency events)
    const unsubscribeStore = daheejStore.subscribeToMessages((msg) => {
      const mReceiver = msg.receiver_id || (msg as any as any).recipient_id;

      // Check if this store message is a call termination event
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

      // Check local incoming call invite
      const invite = parseCallInvite(msg.content);
      if (invite && msg.sender_id === selectedUserId && !isTermMsg && isCallInviteCurrentlyActive(msg, activeMessagesRef.current)) {
        setIncomingCallPopup({
          room_id: invite.room_id,
          callType: invite.callType,
          caller_name: invite.caller_name || selectedPartnerRef.current?.full_name || 'Matched Partner',
          sender_id: msg.sender_id,
          timestamp: Date.now(),
        });
        playRingtone();
      }

      if (
        (msg.sender_id === selectedUserId && mReceiver === currentUserId) ||
        (msg.sender_id === currentUserId && mReceiver === selectedUserId)
      ) {
        setActiveMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) {
            return prev.map((m) => (m.id === msg.id ? { ...m, ...msg } : m));
          }
          // Do not duplicate if matching optimistic or confirmed message already exists
          const isDuplicate = prev.some(
            (m) =>
              m.sender_id === msg.sender_id &&
              m.content === msg.content &&
              Math.abs(new Date(m.created_at).getTime() - new Date(msg.created_at).getTime()) < 45000
          );
          if (isDuplicate) return prev;
          return [...prev, msg];
        });
      }

      setAllUserMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) {
          return prev.map((m) => (m.id === msg.id ? { ...m, ...msg } : m));
        }
        return [...prev, msg];
      });
    });

    // 4. Supabase Call Signals subscription for instant call cancellation/hangup detection
    const unsubCallSignals = subscribeToCallSignals(
      currentUserId,
      (inviteData) => {
        if (!selectedUserId || inviteData.caller_id === selectedUserId) {
          setIncomingCallPopup({
            room_id: inviteData.room_id,
            callType: inviteData.callType === 'video' ? 'video' : 'voice',
            caller_name: inviteData.caller_name || selectedPartnerRef.current?.full_name || 'Matched Partner',
            sender_id: inviteData.caller_id || '',
            timestamp: Date.now(),
          });
          playRingtone();
        }
      },
      (cancelledRoomId) => {
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

    // 5. Background polling sync (without wiping or resetting active conversation)
    const pollInterval = setInterval(async () => {
      if (!selectedUserId || !currentUserId) return;
      try {
        const { data } = await supabase
          .from('messages')
          .select('*')
          .or(
            `and(sender_id.eq.${currentUserId},receiver_id.eq.${selectedUserId}),and(sender_id.eq.${selectedUserId},receiver_id.eq.${currentUserId})`
          )
          .order('created_at', { ascending: true });

        if (data && data.length > 0) {
          daheejStore.syncConversationMessages(currentUserId, selectedUserId, data as ChatMessage[]);
          const unified = daheejStore.getMessages(currentUserId, selectedUserId);
          setActiveMessages((prev) => {
            if (prev.length !== unified.length) return unified;
            let isSame = true;
            for (let i = 0; i < prev.length; i++) {
              if (prev[i].id !== unified[i].id || prev[i].content !== unified[i].content || prev[i].read !== unified[i].read) {
                isSame = false;
                break;
              }
            }
            return isSame ? prev : unified;
          });
        }
      } catch {
        // quiet background sync
      }
    }, 5000);

    // 6. Typing Indicator Broadcast Channel
    let typingChannel: any = null;
    if (selectedUserId) {
      const typingRoomId = [currentUserId, selectedUserId].sort().join('_');
      typingChannel = supabase.channel(`typing:${typingRoomId}`);

      typingChannel
        .on('broadcast', { event: 'typing' }, ({ payload }: any) => {
          if (payload.userId === selectedUserId) {
            setIsPartnerTyping(payload.isTyping);
            if (payload.isTyping) {
              if (partnerTypingTimeoutRef.current) clearTimeout(partnerTypingTimeoutRef.current);
              partnerTypingTimeoutRef.current = setTimeout(() => setIsPartnerTyping(false), 3000);
            } else {
              if (partnerTypingTimeoutRef.current) clearTimeout(partnerTypingTimeoutRef.current);
            }
          }
        })
        .subscribe();

      typingChannelRef.current = typingChannel;
    }

    return () => {
      supabase.removeChannel(channel);
      if (typingChannel) supabase.removeChannel(typingChannel);
      unsubscribeStore();
      unsubCallSignals();
      clearInterval(pollInterval);
      stopRingtone();
      if (partnerTypingTimeoutRef.current) clearTimeout(partnerTypingTimeoutRef.current);
      if (myTypingTimeoutRef.current) clearTimeout(myTypingTimeoutRef.current);
      setIsPartnerTyping(false);
    };
  }, [currentUserId, selectedUserId, playRingtone, stopRingtone]);

  // Handle Call Initiation (Sender Side) with Call Signaling & URL param
  const handleInitiateCall = async (callType: 'video' | 'voice') => {
    if (!selectedUserId || !currentUserId || isInitiatingCall) return;

    // KYC Verification Hard Wall
    if (currentProfile?.kyc_status !== 'verified') {
      setModerationWarning('KYC Verification Required: You must verify your identity with Didit before initiating audio or video calls.');
      return;
    }

    try {
      setIsInitiatingCall(true);
      const callerName = currentProfile?.full_name || 'Caller';
      const { roomID, message: sentMsg } = await sendCallInvite({
        currentUserId,
        partnerId: selectedUserId,
        callerName,
        callType,
      });

      setActiveMessages((prev) => {
        if (prev.some((m) => m.id === sentMsg.id)) return prev;
        return [...prev, sentMsg];
      });

      // Navigate to Call Room in-app with role=caller
      const callUrl = `/call/${roomID}?callType=${callType}&role=caller&partnerId=${selectedUserId}`;
      if (typeof window !== 'undefined') {
        window.history.pushState({ tab: 'call' }, '', callUrl);
        // Important: Dispatch event with tab: 'call' to ensure App.tsx switches the tab
        window.dispatchEvent(new CustomEvent('app:navigate', { detail: { path: callUrl, tab: 'call' } }));
      }
    } catch (err) {
      console.error('[MessagesPage] Call initiation error:', err);
    } finally {
      setIsInitiatingCall(false);
    }
  };

  // Smart scroll management: isolated to chat container and never dragging down while reading history
  useEffect(() => {
    if (selectedUserId && selectedUserId !== prevPartnerIdRef.current) {
      prevPartnerIdRef.current = selectedUserId;
      isUserScrolledUpRef.current = false;
      setShowScrollToBottom(false);
      prevMsgCountRef.current = 0;
      const timer = setTimeout(() => {
        scrollToBottom(false);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [selectedUserId, scrollToBottom]);

  useEffect(() => {
    const currentCount = activeMessages.length;
    const isInitialLoad = prevMsgCountRef.current === 0 && currentCount > 0;
    prevMsgCountRef.current = currentCount;

    // If user has intentionally scrolled up to read chat history, DO NOT drag them down
    if (isUserScrolledUpRef.current && !isInitialLoad) {
      return;
    }

    if (chatContainerRef.current) {
      const { scrollHeight, clientHeight } = chatContainerRef.current;
      chatContainerRef.current.scrollTop = scrollHeight - clientHeight;
    }
  }, [activeMessages]);

  // Calculate conversations list with preview metadata
  const conversationsList = useMemo(() => {
    return secureProfiles.map((partner) => {
      const conversationMsgs = allUserMessages.filter((m) => {
        const mReceiver = m.receiver_id || m.recipient_id;
        return (
          (m.sender_id === currentUserId && mReceiver === partner.id) ||
          (m.sender_id === partner.id && mReceiver === currentUserId)
        );
      });

      const sorted = [...conversationMsgs].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const lastMessage = sorted[0] || null;
      const unreadCount = sorted.filter(
        (m) => (m.receiver_id === currentUserId || m.recipient_id === currentUserId) && !(m.read || m.is_read)
      ).length;

      return {
        partner,
        lastMessage,
        unreadCount,
        lastTimestamp: lastMessage ? new Date(lastMessage.created_at).getTime() : 0,
      };
    }).sort((a, b) => b.lastTimestamp - a.lastTimestamp);
  }, [secureProfiles, allUserMessages, currentUserId]);

  // Filtered by search query
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversationsList;
    const q = searchQuery.toLowerCase();
    return conversationsList.filter(
      (c) =>
        c.partner.full_name.toLowerCase().includes(q) ||
        c.partner.profession?.toLowerCase().includes(q) ||
        c.partner.location?.toLowerCase().includes(q)
    );
  }, [conversationsList, searchQuery]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);
    
    if (typingChannelRef.current) {
      typingChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: currentUserId, isTyping: true },
      });
      
      if (myTypingTimeoutRef.current) clearTimeout(myTypingTimeoutRef.current);
      myTypingTimeoutRef.current = setTimeout(() => {
        typingChannelRef.current?.send({
          type: 'broadcast',
          event: 'typing',
          payload: { userId: currentUserId, isTyping: false },
        });
      }, 2000);
    }
  };

  // Send message handler with Shariah anti-dowry & NSFW moderation
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setModerationWarning(null);

    const trimmed = messageInput.trim();
    if (!trimmed || !currentUserId || !selectedUserId || isSending) return;

    // Stop typing indicator instantly
    if (typingChannelRef.current) {
      typingChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: currentUserId, isTyping: false },
      });
      if (myTypingTimeoutRef.current) clearTimeout(myTypingTimeoutRef.current);
    }

    // KYC Verification Hard Wall
    if (currentProfile?.kyc_status !== 'verified') {
      setModerationWarning('KYC Verification Required: You must complete your Didit KYC verification before sending messages.');
      return;
    }

    // Check free plan daily message limit (3 messages/day)
    if (viewerTier === 'free') {
      const sentToday = daheejStore.getMessageCountForUser(currentUserId);
      if (sentToday >= 3) {
        setModerationWarning(
          'Free Sunnah Plan quota reached (3 messages/day). Upgrade to Gold or Diamond for unlimited messaging.'
        );
        return;
      }
    }

    // Run Shariah Anti-Dowry & Content Moderation
    const moderation = moderateTextContent(trimmed);
    if (!moderation.isClean) {
      setModerationWarning(
        moderation.rejectionReason || 'Message violates Shariah Anti-Dowry guidelines.'
      );
      return;
    }

    setIsSending(true);
    setMessageInput('');
    setShowStarters(false);

    // 1. Optimistic Local Insert
    const localMsg = daheejStore.sendMessage(currentUserId, selectedUserId, trimmed);
    setActiveMessages((prev) => {
      if (prev.some((m) => m.id === localMsg.id)) return prev;
      return [...prev, localMsg];
    });
    refreshAllMessages();

    // 2. Supabase Postgres Insert (The Save)
    try {
      let insertedData: ChatMessage | null = null;

      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: currentUserId,
          receiver_id: selectedUserId,
          recipient_id: selectedUserId,
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
            receiver_id: selectedUserId,
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

      if (insertedData) {
        const normalized: ChatMessage = {
          ...insertedData,
          receiver_id: insertedData.receiver_id || (insertedData as any).recipient_id,
          recipient_id: (insertedData as any).recipient_id || insertedData.receiver_id,
          read: (insertedData as any).read ?? (insertedData as any).is_read ?? false,
          is_read: (insertedData as any).is_read ?? (insertedData as any).read ?? false,
        };
        daheejStore.removeMessage(localMsg.id);
        daheejStore.addMessage(normalized);
        setActiveMessages((prev) =>
          prev.map((m) => (m.id === localMsg.id ? normalized : m))
        );
      }
    } catch (err: any) {
      console.warn('[MessagesPage] Supabase remote sync note:', err);
    } finally {
      setIsSending(false);
      isUserScrolledUpRef.current = false;
      setShowScrollToBottom(false);
      setTimeout(() => {
        scrollToBottom(true);
        inputRef.current?.focus();
      }, 50);
    }
  };

  const handleSelectConversation = (partnerId: string) => {
    setSelectedUserId(partnerId);
    setIsMobileListOpen(false);
    setModerationWarning(null);
  };

  // Handle declining an incoming call
  const handleDeclineCall = async (messageId: string, roomId: string) => {
    try {
      stopRingtone();
      setIncomingCallPopup(null);

      // 1. Update optimistic UI state immediately
      setActiveMessages((prev) =>
        prev.map((m) =>
          m.id === messageId || (roomId && m.content?.includes(roomId))
            ? { ...m, content: 'CALL_DECLINED' }
            : m
        )
      );

      // 2. Perform database update, signaling, and local store synchronization
      await declineCallSession(messageId, roomId, currentUserId, selectedUserId);

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

      refreshAllMessages();
    } catch (error) {
      console.error('Failed to decline call:', error);
    }
  };

  const formatMessageTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatSidebarTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const canCall = viewerTier === 'platinum' || viewerTier === 'diamond';

  return (
    <div className="h-[100dvh] w-full overflow-hidden overscroll-none flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-0 sm:p-2 md:p-3 fixed inset-0 z-40 md:relative md:inset-auto md:z-auto md:h-full">
      {/* Top Banner: Islamic Matrimonial Messaging Charter (Desktop only to maximize mobile conversation viewport) */}
      <div className="shrink-0 mb-0 sm:mb-3 bg-gradient-to-r from-emerald-900/90 via-teal-950/90 to-zinc-900 border border-emerald-500/30 rounded-none sm:rounded-2xl p-2.5 sm:p-4 text-white hidden md:flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 shadow-lg">
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

        {viewerTier === 'free' ? (
          <button
            onClick={onOpenPricing}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 active:bg-amber-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
          >
            <Crown className="w-4 h-4 text-amber-400" />
            <span>Upgrade to Gold for Unlimited Chat</span>
          </button>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span className="capitalize font-medium">{viewerTier} Tier Active</span>
          </div>
        )}
      </div>

      {/* Main Split-Pane Layout */}
      <div className="flex-1 flex flex-col md:flex-row bg-white dark:bg-zinc-900 border-0 sm:border border-zinc-200 dark:border-zinc-800 rounded-none sm:rounded-3xl overflow-hidden shadow-xl min-h-0 h-full transition-colors relative">
        {/* ========================================================================= */}
        {/* SIDEBAR: CONVERSATION LIST (Responsive Drawer on Mobile) */}
        {/* ========================================================================= */}
        <div
          className={`w-full md:w-80 lg:w-96 border-r border-zinc-200 dark:border-zinc-800 flex flex-col bg-zinc-50 dark:bg-zinc-950 transition-colors h-full min-h-0 pb-20 md:pb-0 ${
            !isMobileListOpen ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Sidebar Header & Search */}
          <div className="p-3 sm:p-4 border-b border-zinc-200 dark:border-zinc-800 space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Conversations</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                  {conversationsList.length}
                </span>
              </h2>

              {onNavigateMatches && (
                <button
                  onClick={onNavigateMatches}
                  className="min-h-[44px] px-2 text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                >
                  <Users className="w-4 h-4" />
                  <span>Find Matches</span>
                </button>
              )}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search candidates by name, city..."
                className="w-full min-h-[44px] bg-white dark:bg-zinc-900 text-base sm:text-sm text-zinc-900 dark:text-zinc-100 pl-9 pr-3 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-800 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          {/* Conversations Items List */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-200/60 dark:divide-zinc-800/60 overscroll-contain pb-24 md:pb-0">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 dark:text-zinc-400 space-y-3">
                <Users className="w-10 h-10 mx-auto text-zinc-400 dark:text-zinc-600" />
                <p className="text-xs font-medium">No conversations found.</p>
                {onNavigateMatches && (
                  <button
                    onClick={onNavigateMatches}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 active:bg-emerald-700 transition-colors cursor-pointer"
                  >
                    Browse Verified Matches
                  </button>
                )}
              </div>
            ) : (
              (filteredConversations || []).map(({ partner, lastMessage, unreadCount }) => {
                const isSelected = selectedUserId === partner.id;

                return (
                  <button
                    key={partner.id}
                    onClick={() => handleSelectConversation(partner.id)}
                    className={`w-full min-h-[64px] p-3.5 text-left flex items-start gap-3 transition-colors cursor-pointer active:bg-zinc-200 dark:active:bg-zinc-800 ${
                      isSelected
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-l-4 border-emerald-600 dark:border-emerald-400'
                        : 'hover:bg-zinc-100 dark:hover:bg-zinc-900/60'
                    }`}
                  >
                    {/* Avatar with Photo Privacy Blur & Active Status */}
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 rounded-2xl overflow-hidden bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 flex items-center justify-center">
                        {(!partner.photo_privacy || partner.is_photo_unlocked || daheejStore.hasAcceptedPhotoConsent(currentUserId, partner.id)) && partner.avatar_url ? (
                          <img
                            src={partner.avatar_url}
                            alt={partner.full_name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-emerald-800 to-teal-900 flex items-center justify-center text-emerald-200">
                            <Shield className="w-5 h-5" />
                          </div>
                        )}
                      </div>

                      {/* Online Status Indicator */}
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-950" />
                    </div>

                    {/* Text Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <h4 className="text-xs font-bold text-zinc-900 dark:text-white truncate flex items-center gap-1.5">
                          {partner.full_name}
                          {partner.kyc_status === 'verified' && (
                            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" title="KYC Verified" />
                          )}
                        </h4>
                        {lastMessage && (
                          <span className="text-[10px] text-zinc-400 shrink-0 font-medium">
                            {formatSidebarTime(lastMessage.created_at)}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mb-1">
                        {partner.profession || 'Verified Candidate'} • {partner.location}
                      </p>

                      {/* Last Message Preview */}
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={`text-xs truncate ${
                            unreadCount > 0
                              ? 'font-bold text-zinc-900 dark:text-zinc-100'
                              : 'text-zinc-500 dark:text-zinc-400'
                          }`}
                        >
                          <MessagePreviewRenderer content={lastMessage?.content} isMe={lastMessage?.sender_id === currentUserId} />
                        </p>

                        {unreadCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold shrink-0">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CHAT WINDOW: ACTIVE CONVERSATION & REAL-TIME FEED */}
        {/* ========================================================================= */}
        <div
          className={`flex-1 flex flex-col bg-white dark:bg-zinc-900 transition-colors h-full min-h-0 overflow-hidden ${
            isMobileListOpen ? 'hidden md:flex' : 'flex'
          }`}
        >
          {selectedPartner ? (
            <>
              {/* Chat Window Top Bar Header (Min 44x44px Touch Targets) */}
              <div className="px-3 sm:px-4 py-2 sm:py-3 bg-zinc-50/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2 transition-colors z-10 shrink-0">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  {/* Mobile Back Button */}
                  <button
                    onClick={() => {
                      setIsMobileListOpen(true);
                      setSelectedUserId(null);
                    }}
                    className="min-w-[44px] min-h-[44px] p-2 rounded-full md:hidden bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 active:bg-zinc-200 dark:active:bg-zinc-700 flex items-center justify-center cursor-pointer shrink-0"
                    title="Back to conversation list"
                    aria-label="Back to conversation list"
                  >
                    <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>

                  {/* Partner Avatar & Identity - Clickable to view profile */}
                  <div
                    onClick={() => onViewProfile && onViewProfile(selectedPartner)}
                    className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1 cursor-pointer group"
                    title="View candidate profile"
                  >
                    <div className="relative shrink-0">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl overflow-hidden bg-zinc-200 dark:bg-zinc-800 border border-emerald-400/40 flex items-center justify-center shadow-sm group-hover:border-emerald-500 transition-colors">
                        {(!selectedPartner.photo_privacy || selectedPartner.is_photo_unlocked || daheejStore.hasAcceptedPhotoConsent(currentUserId, selectedPartner.id)) && selectedPartner.avatar_url ? (
                          <img
                            src={selectedPartner.avatar_url}
                            alt={selectedPartner.full_name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-emerald-800 to-teal-900 flex items-center justify-center text-emerald-200">
                            <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
                          </div>
                        )}
                      </div>
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-950" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap sm:flex-nowrap">
                        <h3 className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-white truncate max-w-[130px] sm:max-w-[200px] md:max-w-none">
                          {selectedPartner.full_name}
                        </h3>
                        {selectedPartner.kyc_status === 'verified' && (
                          <span
                            title="Identity cryptographically verified via Didit protocol"
                            className="inline-flex items-center gap-0.5 px-1 sm:px-1.5 py-0.2 rounded-full text-[8px] sm:text-[9px] font-bold bg-blue-50 dark:bg-blue-950/80 text-blue-800 dark:text-blue-400 border border-blue-200 dark:border-blue-700/60 shrink-0"
                          >
                            <Check className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400" />
                            <span className="hidden sm:inline">Didit Verified</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] sm:text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1 truncate">
                        <span className="truncate">{selectedPartner.profession || 'Verified Candidate'}</span>
                        <span>•</span>
                        <span className="truncate">{selectedPartner.location}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Top Action Controls: Voice/Video Call (44x44px touch targets) */}
                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                  {canCall ? (
                    <>
                      <button
                        id="messages-page-voice-call-btn"
                        disabled={isInitiatingCall}
                        onClick={() => handleInitiateCall('voice')}
                        className="w-10 h-10 sm:w-auto sm:h-auto sm:min-w-[44px] sm:min-h-[44px] sm:px-3.5 rounded-full sm:rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 active:bg-zinc-300 dark:active:bg-zinc-600 text-zinc-700 dark:text-zinc-200 transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-2 text-xs font-semibold disabled:opacity-50"
                        title="Start 1-on-1 Voice Call (Disables Camera, Opens Zego Audio Room)"
                      >
                        <Phone className="w-4 h-4 sm:w-4 sm:h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="hidden sm:inline-block whitespace-nowrap">Voice</span>
                      </button>
                      <button
                        id="messages-page-video-call-btn"
                        disabled={isInitiatingCall}
                        onClick={() => handleInitiateCall('video')}
                        className="w-10 h-10 sm:w-auto sm:h-auto sm:min-w-[44px] sm:min-h-[44px] sm:px-3.5 rounded-full sm:rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white transition-colors shadow-sm flex items-center justify-center gap-2 text-xs font-bold cursor-pointer disabled:opacity-50"
                        title="Start 1-on-1 Video Call (Enables Camera & Mic, Opens Zego Video Room)"
                      >
                        <Video className="w-4 h-4 shrink-0" />
                        <span className="hidden sm:inline-block whitespace-nowrap">Video Call</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={onOpenPricing}
                      className="min-h-[36px] sm:min-h-[44px] px-2.5 sm:px-3 py-1 rounded-xl bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 text-[11px] font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform"
                      title="Upgrade to Platinum or Diamond to make voice & video calls"
                    >
                      <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span className="hidden sm:inline">Unlock Calls</span>
                    </button>
                  )}

                  {onViewProfile && (
                    <button
                      onClick={() => onViewProfile(selectedPartner)}
                      className="hidden sm:flex min-w-[44px] min-h-[44px] p-2.5 rounded-full sm:rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:bg-zinc-200 transition-colors text-xs font-semibold items-center justify-center gap-1"
                      title="View Candidate Full Profile"
                    >
                      <Eye className="w-4 h-4" />
                      <span className="hidden lg:inline">Profile</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Top Floating Incoming Call Popup / Notification Banner */}
              {incomingCallPopup && (
                <div className="mx-2 sm:mx-4 mt-2 sm:mt-3 p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-emerald-900 to-teal-900 border-2 border-emerald-400 text-white shadow-2xl flex items-center justify-between gap-2.5 sm:gap-3 animate-in fade-in slide-in-from-top-2 shrink-0 z-20">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shrink-0">
                      <span className="absolute -inset-1 rounded-xl bg-emerald-400 opacity-75 animate-ping" />
                      {incomingCallPopup.callType === 'video' ? (
                        <Video className="w-4 h-4 sm:w-5 sm:h-5 relative z-10" />
                      ) : (
                        <PhoneCall className="w-4 h-4 sm:w-5 sm:h-5 relative z-10" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-emerald-400 text-emerald-950 uppercase tracking-wider shrink-0">
                          {incomingCallPopup.callType === 'video' ? 'Video' : 'Voice'} Call
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-emerald-100 mt-0.5 truncate">
                        {incomingCallPopup.caller_name || selectedPartner.full_name} is calling...
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <button
                      id="accept-incoming-call-popup-btn"
                      onClick={() => {
                        stopRingtone();
                        const pId = incomingCallPopup.sender_id || selectedUserId || '';
                        const callUrl = `/call/${incomingCallPopup.room_id}?callType=${incomingCallPopup.callType}&role=receiver&partnerId=${pId}`;
                        setIncomingCallPopup(null);
                        if (typeof window !== 'undefined') {
                          window.history.pushState({ tab: 'call' }, '', callUrl);
                          window.dispatchEvent(new CustomEvent('app:navigate', { detail: { path: callUrl, tab: 'call' } }));
                        }
                      }}
                      className="min-h-[38px] sm:min-h-[44px] px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 active:bg-emerald-500 text-emerald-950 font-bold text-xs flex items-center gap-1 sm:gap-1.5 transition-all shadow-md cursor-pointer active:scale-95"
                    >
                      <PhoneIncoming className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span>Accept</span>
                    </button>
                    <button
                      id="decline-incoming-call-popup-btn"
                      onClick={async () => {
                        const targetRoomId = incomingCallPopup.room_id;
                        stopRingtone();
                        setIncomingCallPopup(null);
                        if (targetRoomId) {
                          const targetMsgId = activeMessages.find((m) => m.content?.includes(targetRoomId))?.id || '';
                          await handleDeclineCall(targetMsgId, targetRoomId);
                        }
                      }}
                      className="w-9 h-9 sm:min-w-[44px] sm:min-h-[44px] p-2 sm:p-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white transition-colors cursor-pointer flex items-center justify-center shrink-0"
                      title="Dismiss & Decline"
                      aria-label="Dismiss and decline call"
                    >
                      <X className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>
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
                      id="enable-notifications-chat-btn"
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

              {/* Shariah Verification Pill Sub-Header (Dismissible to maximize screen space) */}
              {!isAntiDowryBannerDismissed && (
                <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border-b border-emerald-100 dark:border-emerald-900/40 px-3 sm:px-4 py-1.5 text-[10px] md:text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-1.5 truncate">
                    <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="truncate">
                      <strong>Anti-Dowry Protected:</strong> Demanding dowry, cash, or luxury gifts is strictly forbidden.
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {selectedPartner.wali_name && (
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 hidden sm:inline">
                        Guardian: {selectedPartner.wali_name} ({selectedPartner.wali_relation || 'Wali'})
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsAntiDowryBannerDismissed(true)}
                      className="p-0.5 rounded text-emerald-700/60 dark:text-emerald-400/60 hover:text-emerald-900 dark:hover:text-emerald-200 cursor-pointer"
                      title="Dismiss banner"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Message Feed Area (flex-1 with isolated container-level scrolling) */}
              <div 
                id="messages-container"
                ref={chatContainerRef}
                onScroll={handleChatScroll}
                className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4 bg-zinc-100/40 dark:bg-zinc-950/40 min-h-0 relative"
              >
                {activeMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4 sm:p-6 space-y-4 max-w-md mx-auto my-auto">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-3xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-600/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm">
                      <Sparkles className="w-6 h-6 sm:w-7 sm:h-7" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">
                        Begin Matrimonial Discussion with {selectedPartner.full_name}
                      </h4>
                      <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">
                        Introduce yourself honorably. Click any Sunnah greeting below to start:
                      </p>
                    </div>

                    {/* Quick Islamic Icebreakers */}
                    <div className="w-full space-y-2 text-left">
                      {ISLAMIC_STARTERS.map((starter, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setMessageInput(starter);
                            inputRef.current?.focus();
                          }}
                          className="w-full min-h-[44px] p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500 dark:hover:border-emerald-500 active:bg-zinc-100 dark:active:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs transition-all text-left shadow-sm cursor-pointer"
                        >
                          "{starter}"
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  (processedMessages || []).map((msg) => {
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
                    const isStillActive = isCallInviteCurrentlyActive(msg, activeMessages);

                    // 1. Sleek Compact Call Log Pill for completed/ended/declined/missed/expired calls
                    if (isCallDeclined || isCallMissed || isCallEnded || isCallConnected || (callInvite && !isStillActive)) {
                      const isVideo = callInvite?.callType === 'video' || eventData?.callType === 'video' || (!callInvite && !eventData);
                      const durationSec = eventData?.duration || 0;
                      const formattedDuration = durationSec > 0
                        ? `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`
                        : '';

                      return (
                        <div key={msg.id} className="w-full flex justify-center my-2.5 px-2">
                          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-100/90 dark:bg-zinc-800/90 border border-zinc-200/80 dark:border-zinc-700/60 shadow-xs text-xs">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                              isCallMissed || isCallDeclined || (callInvite && !isStillActive && !isCallDeclined && !isCallEnded && !isCallConnected)
                                ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400'
                                : isCallConnected
                                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400'
                                : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
                            }`}>
                              {isCallMissed || (callInvite && !isStillActive && !isCallDeclined && !isCallEnded && !isCallConnected) ? (
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
                                {isCallMissed || (callInvite && !isStillActive && !isCallDeclined && !isCallEnded && !isCallConnected)
                                  ? (isMe ? 'Unanswered Call' : 'Missed Call')
                                  : isCallDeclined
                                  ? 'Call Declined'
                                  : isCallConnected
                                  ? 'Call Connected'
                                  : `${isVideo ? 'Video' : 'Voice'} Call Ended ${formattedDuration ? `(${formattedDuration})` : ''}`}
                              </span>
                              <span className="text-zinc-400 dark:text-zinc-500 text-[10px]">
                                • {formatMessageTime(msg.created_at)}
                              </span>
                            </div>

                            {canCall && (
                              <button
                                type="button"
                                onClick={() => handleInitiateCall(isVideo ? 'video' : 'voice')}
                                className="ml-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white transition-all cursor-pointer shadow-xs shrink-0"
                                title="Call Back"
                              >
                                Call Back
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    }

                    // 2. Touch-Optimized Active Ringing Call Card
                    if (callInvite && isStillActive) {
                      const isVideo = callInvite.callType === 'video';
                      const pId = isMe ? (selectedUserId || '') : (msg.sender_id || selectedUserId || '');
                      const callerCallUrl = `/call/${callInvite.room_id}?callType=${callInvite.callType}&role=caller&partnerId=${pId}`;
                      const receiverCallUrl = `/call/${callInvite.room_id}?callType=${callInvite.callType}&role=receiver&partnerId=${pId}`;

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
                                    : `${callInvite.caller_name || selectedPartner.full_name} is calling you`}
                                </p>
                              </div>
                            </div>

                            {/* Responsive Action Buttons with 44px minimum touch target */}
                            <div className="mt-3 pt-2.5 border-t border-emerald-400/20 flex items-center gap-2">
                              {isMe ? (
                                <div className="w-full flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (typeof window !== 'undefined') {
                                        window.history.pushState({ tab: 'call' }, '', callerCallUrl);
                                        window.dispatchEvent(new CustomEvent('app:navigate', { detail: { path: callerCallUrl, tab: 'call' } }));
                                      }
                                    }}
                                    className="flex-1 min-h-[44px] py-2 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer active:scale-95 bg-emerald-400 hover:bg-emerald-300 active:bg-emerald-500 text-emerald-950"
                                  >
                                    <Video className="w-4 h-4" />
                                    <span>Enter Call Room</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeclineCall(msg.id, callInvite.room_id)}
                                    className="min-h-[44px] px-3.5 py-2 rounded-xl font-bold text-xs bg-rose-500/20 border border-rose-400/40 text-rose-200 hover:bg-rose-600 hover:text-white active:bg-rose-700 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                    title="Cancel Call"
                                  >
                                    <PhoneOff className="w-4 h-4" />
                                    <span>Cancel</span>
                                  </button>
                                </div>
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

                    // Prevent raw JSON / WebRTC signaling data from leaking as plain text chat bubble
                    if (isCallSignalingContent(msg.content)) {
                      return null;
                    }

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in duration-150 my-1`}
                      >
                        <div
                          className={`max-w-[88%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm shadow-xs ${
                            isMe
                              ? 'bg-emerald-600 text-white rounded-br-xs'
                              : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200/80 dark:border-zinc-700/60 rounded-bl-xs'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                        </div>

                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500 px-1">
                          <span>{formatMessageTime(msg.created_at)}</span>
                          {isMe && (
                            <span className="inline-flex items-center">
                              {Boolean(msg.is_read || msg.read) ? (
                                <span title="Read" className="inline-flex items-center gap-0.5 text-sky-500 dark:text-sky-400 font-bold">
                                  <CheckCheck className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
                                </span>
                              ) : (
                                <span title="Sent" className="inline-flex items-center text-zinc-400 dark:text-zinc-500">
                                  <Check className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                {/* Typing Bubble */}
                {isPartnerTyping && (
                  <div className="flex flex-col items-start animate-in fade-in duration-150 my-1">
                    <div className="max-w-[88%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 shadow-xs bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/60 rounded-bl-xs">
                      <div className="flex items-center gap-1.5 h-4">
                        <span className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500 px-1">
                      <span>{selectedPartner?.full_name.split(' ')[0]} is typing...</span>
                    </div>
                  </div>
                )}

                {/* Floating "Scroll to latest" button when user is reading past messages */}
                {showScrollToBottom && (
                  <div className="sticky bottom-2 flex justify-end pr-2 pointer-events-none z-20">
                    <button
                      type="button"
                      onClick={() => scrollToBottom(true)}
                      className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-semibold shadow-lg transition-all cursor-pointer animate-in fade-in slide-in-from-bottom-2"
                      aria-label="Scroll to newest messages"
                    >
                      <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
                      <span>Newest messages</span>
                    </button>
                  </div>
                )}

                {/* Auto-scroll anchor point */}
                <div ref={messagesEndRef} />
              </div>

              {/* Moderation Warning Toast */}
              {moderationWarning && (
                <div className="mx-3 sm:mx-4 mb-2 p-3 rounded-2xl bg-amber-950/90 border border-amber-600/60 text-amber-200 text-xs flex items-center gap-2.5 shadow-lg backdrop-blur-md animate-in slide-in-from-bottom-2 shrink-0">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="flex-1">{moderationWarning}</span>
                </div>
              )}

              {/* Bottom Input Area (Locked strictly to the bottom) */}
              <div className="mt-auto border-t border-zinc-200 dark:border-zinc-800 p-3 bg-white dark:bg-zinc-950 shrink-0 pb-safe z-30 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_16px_rgba(0,0,0,0.35)]">
                {showStarters && (
                  <div className="mb-2 p-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-1.5 shadow-md max-h-36 overflow-y-auto">
                    <p className="text-[10px] font-bold text-zinc-400 px-2 uppercase tracking-wider">
                      Quick Islamic Starters:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {ISLAMIC_STARTERS.map((s, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setMessageInput(s);
                            setShowStarters(false);
                            inputRef.current?.focus();
                          }}
                          className="min-h-[36px] p-2 text-left rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-800 active:bg-zinc-300 text-[11px] text-zinc-800 dark:text-zinc-200 truncate cursor-pointer"
                        >
                          "{s}"
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowStarters(!showStarters)}
                    className="min-w-[44px] min-h-[44px] p-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-emerald-500 active:bg-zinc-200 dark:active:bg-zinc-700 transition-colors flex items-center justify-center cursor-pointer shrink-0"
                    title="Insert Islamic Greeting"
                    aria-label="Insert Islamic Greeting"
                  >
                    <Smile className="w-5 h-5" />
                  </button>

                  <input
                    ref={inputRef}
                    type="text"
                    value={messageInput}
                    onChange={(e) => {
                      handleInputChange(e);
                      if (moderationWarning) setModerationWarning(null);
                    }}
                    placeholder={`Message ${selectedPartner.full_name} respectfully...`}
                    className="flex-1 min-h-[44px] bg-zinc-50 dark:bg-zinc-900 text-base sm:text-sm text-zinc-900 dark:text-zinc-100 px-4 py-2.5 rounded-2xl border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors shadow-inner"
                  />

                  <button
                    type="submit"
                    disabled={!messageInput.trim() || isSending}
                    className="min-w-[44px] min-h-[44px] p-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white transition-all shadow-md active:scale-95 flex items-center justify-center shrink-0 cursor-pointer"
                    title="Send Message"
                    aria-label="Send Message"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500 dark:text-zinc-400 space-y-3">
              <MessageSquare className="w-12 h-12 text-zinc-400 dark:text-zinc-600" />
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                Select a match to start chatting
              </h3>
              <p className="text-xs max-w-sm">
                Choose from verified profiles on the left to begin an honorable, dowry-free conversation.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
