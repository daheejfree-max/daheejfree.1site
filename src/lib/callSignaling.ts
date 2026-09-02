// ==============================================================================
// CALL SIGNALING & REALTIME WEBRTC SIGNAL SUBSCRIPTION (TASK 5)
// Dedicated signaling via public.call_signals table & Rich Chat Call Events
// ==============================================================================

import { supabase } from './supabase/client';
import { daheejStore } from './supabase/store';
import { CallSignal, ChatMessage } from '../types';

export interface CallInviteData {
  id?: string;
  type: 'CALL_INVITE' | 'CALL_CONNECTED' | 'CALL_ENDED' | 'CALL_DECLINED' | 'CALL_MISSED';
  callType: 'video' | 'voice';
  room_id: string;
  caller_name: string;
  caller_avatar?: string | null;
  caller_id?: string;
  duration?: number;
  timestamp: string;
}

/**
 * Checks if a string or message payload is an internal WebRTC SDP/ICE token.
 * Used by chat components to filter raw SDP/ICE data from leaking as text,
 * while allowing CALL_INVITE, CALL_CONNECTED, CALL_ENDED, CALL_DECLINED, etc. to render as rich cards.
 */
export function isCallSignalingContent(content: string | undefined | null): boolean {
  if (!content || typeof content !== 'string') return false;
  const trimmed = content.trim();

  // If it's a recognized call event message meant to be rendered as a card, DO NOT filter it out
  if (
    trimmed === 'CALL_INVITE' ||
    trimmed.startsWith('CALL_INVITE') ||
    trimmed === 'CALL_CONNECTED' ||
    trimmed.startsWith('CALL_CONNECTED') ||
    trimmed === 'CALL_ACCEPTED' ||
    trimmed.startsWith('CALL_ACCEPTED') ||
    trimmed === 'CALL_DECLINED' ||
    trimmed.startsWith('CALL_DECLINED') ||
    trimmed === 'CALL_MISSED' ||
    trimmed.startsWith('CALL_MISSED') ||
    trimmed === 'CALL_ENDED' ||
    trimmed.startsWith('CALL_ENDED') ||
    parseCallInvite(trimmed) !== null
  ) {
    return false;
  }

  // Pure WebRTC SDP / ICE exchange payloads that must never be shown as text
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (
        parsed.type === 'offer' ||
        parsed.type === 'answer' ||
        parsed.type === 'ice-candidate' ||
        parsed.type === 'candidate' ||
        parsed.type === 'peer-ready' ||
        parsed.sdp ||
        parsed.candidate
      ) {
        return true;
      }
    } catch {
      // not json
    }
  }

  const upper = trimmed.toUpperCase();
  if (
    upper.includes('"OFFER"') ||
    upper.includes('"ANSWER"') ||
    upper.includes('ICE-CANDIDATE') ||
    upper.includes('"CANDIDATE"')
  ) {
    return true;
  }

  return false;
}

/**
 * Generate a unique Room ID for 1-on-1 calls
 */
export function generateCallRoomId(userId1: string, userId2: string): string {
  const sortedIds = [userId1, userId2].filter(Boolean).sort().join('_');
  return `room_${sortedIds}_${Date.now()}`;
}

/**
 * Parse any signaling payload or call invite message into CallInviteData
 */
export function parseCallInvite(content: string | undefined | null): CallInviteData | null {
  if (!content || typeof content !== 'string') return null;

  try {
    const trimmed = content.trim();

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const parsed = JSON.parse(trimmed);
      if (
        parsed.type === 'CALL_INVITE' ||
        parsed.event === 'CALL_INVITE' ||
        parsed.call_type ||
        parsed.callType ||
        parsed.room_id ||
        parsed.roomId
      ) {
        const rawType = parsed.callType || parsed.call_type || 'video';
        const callType: 'video' | 'voice' = (rawType === 'voice' || rawType === 'audio') ? 'voice' : 'video';
        return {
          id: parsed.id,
          type: 'CALL_INVITE',
          callType,
          room_id: parsed.room_id || parsed.roomId || parsed.roomID || `room_${Date.now()}`,
          caller_name: parsed.caller_name || parsed.callerName || 'Matched Partner',
          caller_avatar: parsed.caller_avatar || parsed.callerAvatar || null,
          caller_id: parsed.caller_id || parsed.callerId,
          duration: parsed.duration || 0,
          timestamp: parsed.timestamp || new Date().toISOString(),
        };
      }
    }

    if (trimmed.startsWith('CALL_INVITE:') || trimmed.startsWith('CALL_INVITE|')) {
      const sub = trimmed.replace(/^CALL_INVITE[:|]\s*/, '').trim();
      try {
        const parsed = JSON.parse(sub);
        const rawType = parsed.callType || parsed.call_type || parsed.type || 'video';
        const callType: 'video' | 'voice' = (rawType === 'voice' || rawType === 'audio') ? 'voice' : 'video';
        return {
          id: parsed.id,
          type: 'CALL_INVITE',
          callType,
          room_id: parsed.room_id || parsed.roomId || parsed.roomID || `room_${Date.now()}`,
          caller_name: parsed.caller_name || parsed.callerName || 'Matched Partner',
          caller_avatar: parsed.caller_avatar || parsed.callerAvatar || null,
          caller_id: parsed.caller_id || parsed.callerId,
          duration: parsed.duration || 0,
          timestamp: parsed.timestamp || new Date().toISOString(),
        };
      } catch {
        return {
          type: 'CALL_INVITE',
          callType: sub.toLowerCase().includes('voice') || sub.toLowerCase().includes('audio') ? 'voice' : 'video',
          room_id: `room_${Date.now()}`,
          caller_name: 'Matched Partner',
          caller_avatar: null,
          timestamp: new Date().toISOString(),
        };
      }
    }

    if (trimmed === 'CALL_INVITE' || trimmed.includes('CALL_INVITE')) {
      return {
        type: 'CALL_INVITE',
        callType: trimmed.toLowerCase().includes('voice') || trimmed.toLowerCase().includes('audio') ? 'voice' : 'video',
        room_id: `room_${Date.now()}`,
        caller_name: 'Matched Partner',
        caller_avatar: null,
        timestamp: new Date().toISOString(),
      };
    }
  } catch (err) {
    // Non-fatal
  }

  return null;
}

/**
 * Parse any generic Call Event (CALL_CONNECTED, CALL_ENDED, CALL_DECLINED, CALL_MISSED)
 */
export function parseCallEvent(content: string | undefined | null): {
  type: 'CALL_INVITE' | 'CALL_CONNECTED' | 'CALL_ENDED' | 'CALL_DECLINED' | 'CALL_MISSED';
  callType: 'video' | 'voice';
  duration?: number;
  room_id?: string;
  timestamp?: string;
} | null {
  if (!content || typeof content !== 'string') return null;
  const trimmed = content.trim();

  // 1. Check for JSON structure
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.type && ['CALL_INVITE', 'CALL_CONNECTED', 'CALL_ENDED', 'CALL_DECLINED', 'CALL_MISSED'].includes(parsed.type)) {
        const rawType = parsed.callType || parsed.call_type || 'video';
        return {
          type: parsed.type,
          callType: (rawType === 'voice' || rawType === 'audio') ? 'voice' : 'video',
          duration: parsed.duration || 0,
          room_id: parsed.room_id || parsed.roomId,
          timestamp: parsed.timestamp || new Date().toISOString(),
        };
      }
    } catch {}
  }

  // 2. Check for prefixed strings e.g. CALL_CONNECTED:{"duration": 120} or CALL_ENDED:{"duration": 45}
  const prefixes: Array<'CALL_CONNECTED' | 'CALL_ENDED' | 'CALL_DECLINED' | 'CALL_MISSED' | 'CALL_INVITE'> = [
    'CALL_CONNECTED',
    'CALL_ENDED',
    'CALL_DECLINED',
    'CALL_MISSED',
    'CALL_INVITE',
  ];

  for (const p of prefixes) {
    if (trimmed === p || trimmed.startsWith(p + ':') || trimmed.startsWith(p + '|')) {
      let duration = 0;
      let room_id = '';
      let callType: 'video' | 'voice' = 'video';

      const jsonPart = trimmed.replace(new RegExp(`^${p}[:|]\\s*`), '').trim();
      if (jsonPart.startsWith('{') && jsonPart.endsWith('}')) {
        try {
          const parsed = JSON.parse(jsonPart);
          duration = parsed.duration || 0;
          room_id = parsed.room_id || parsed.roomId || '';
          if (parsed.callType === 'voice' || parsed.call_type === 'voice' || parsed.call_type === 'audio') {
            callType = 'voice';
          }
        } catch {}
      }
      return { type: p, callType, duration, room_id };
    }
  }

  return null;
}

/**
 * Format message preview string for the sidebar conversation list
 */
export function formatCallMessagePreview(content: string | undefined | null): string {
  if (!content) return 'Start a Shariah conversation...';
  const trimmed = content.trim();

  if (trimmed === 'CALL_CONNECTED' || trimmed.startsWith('CALL_CONNECTED') || trimmed.includes('"CALL_CONNECTED"')) {
    return '📞 Call Connected';
  }
  if (trimmed === 'CALL_ENDED' || trimmed.startsWith('CALL_ENDED') || trimmed.includes('"CALL_ENDED"')) {
    return '📞 Call Ended';
  }
  if (trimmed === 'CALL_DECLINED' || trimmed.startsWith('CALL_DECLINED') || trimmed.includes('"CALL_DECLINED"')) {
    return '🚫 Call Declined';
  }
  if (trimmed === 'CALL_MISSED' || trimmed.startsWith('CALL_MISSED') || trimmed.includes('"CALL_MISSED"')) {
    return '❌ Missed Call';
  }
  if (trimmed === 'CALL_INVITE' || trimmed.startsWith('CALL_INVITE') || trimmed.includes('"CALL_INVITE"') || trimmed.includes('CALL_INVITE')) {
    return '📞 Call Invite';
  }
  return content;
}

/**
 * Sends a clean Call Signal to the public.call_signals table and creates the chat invite
 */
export async function sendCallInvite({
  currentUserId,
  partnerId,
  callerName,
  callerAvatar,
  callType,
  roomID,
}: {
  currentUserId: string;
  partnerId: string;
  callerName: string;
  callerAvatar?: string | null;
  callType: 'video' | 'voice' | 'audio';
  roomID?: string;
}): Promise<{ roomID: string; signalId: string; message: ChatMessage }> {
  const normType: 'video' | 'voice' = (callType === 'voice' || callType === 'audio') ? 'voice' : 'video';
  const generatedRoomId = roomID || generateCallRoomId(currentUserId, partnerId);

  const signalPayload = {
    room_id: generatedRoomId,
    call_type: normType,
    caller_name: callerName || 'Matrimonial Candidate',
    caller_avatar: callerAvatar || null,
    caller_id: currentUserId,
    type: 'CALL_INVITE' as const,
  };

  let signalId = `sig_${Date.now()}`;

  // 1. Insert into public.call_signals in Supabase
  try {
    const { data, error } = await supabase
      .from('call_signals')
      .insert({
        caller_id: currentUserId,
        receiver_id: partnerId,
        room_id: generatedRoomId,
        type: 'offer',
        payload: signalPayload,
      })
      .select()
      .single();

    if (error) {
      // Fallback via server API
      await fetch('/api/call-signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callerId: currentUserId,
          receiverId: partnerId,
          signalData: signalPayload,
          status: 'pending',
        }),
      }).catch(() => {});
    } else if (data) {
      signalId = data.id;
    }
  } catch (err) {
    console.warn('[Call Signaling] Insert notice:', err);
  }

  // 2. Broadcast to local store listeners
  daheejStore.createCall({
    id: signalId,
    caller_id: currentUserId,
    recipient_id: partnerId,
    callee_id: partnerId,
    call_type: normType,
    status: 'ringing',
    sdp_offer: signalPayload,
  });

  const chatMsg: ChatMessage = {
    id: signalId,
    sender_id: currentUserId,
    receiver_id: partnerId,
    recipient_id: partnerId,
    content: JSON.stringify(signalPayload),
    read: false,
    created_at: new Date().toISOString(),
  };

  // 3. Persist call invite message into local store and Supabase messages table so it displays in chat
  try {
    daheejStore.addMessage(chatMsg);
    await supabase.from('messages').insert({
      id: signalId,
      sender_id: currentUserId,
      receiver_id: partnerId,
      content: JSON.stringify(signalPayload),
      read: false,
    });
  } catch (msgErr) {
    console.warn('[Call Signaling] Chat message persistence notice:', msgErr);
  }

  return { roomID: generatedRoomId, signalId, message: chatMsg };
}

/**
 * Record a Call Connected event in chat
 */
export async function recordCallConnected({
  currentUserId,
  partnerId,
  roomID,
  callType = 'video',
}: {
  currentUserId: string;
  partnerId: string;
  roomID: string;
  callType?: 'video' | 'voice' | 'audio';
}): Promise<void> {
  if (!currentUserId || !partnerId) return;

  const payload = {
    type: 'CALL_CONNECTED',
    room_id: roomID,
    call_type: callType,
    timestamp: new Date().toISOString(),
  };

  const msgId = `conn_${Date.now()}`;
  const chatMsg: ChatMessage = {
    id: msgId,
    sender_id: currentUserId,
    receiver_id: partnerId,
    recipient_id: partnerId,
    content: `CALL_CONNECTED:${JSON.stringify(payload)}`,
    read: true,
    created_at: payload.timestamp,
  };

  try {
    daheejStore.addMessage(chatMsg);
    await supabase.from('messages').insert({
      id: msgId,
      sender_id: currentUserId,
      receiver_id: partnerId,
      content: `CALL_CONNECTED:${JSON.stringify(payload)}`,
      read: true,
      created_at: payload.timestamp,
    });
  } catch (e) {
    console.warn('[Call Signaling] recordCallConnected notice:', e);
  }
}

/**
 * Record a Call Ended event with duration in chat
 */
export async function recordCallEnded({
  currentUserId,
  partnerId,
  roomID,
  durationSeconds = 0,
  callType = 'video',
}: {
  currentUserId: string;
  partnerId: string;
  roomID: string;
  durationSeconds?: number;
  callType?: 'video' | 'voice' | 'audio';
}): Promise<void> {
  if (!currentUserId || !partnerId) return;

  const payload = {
    type: 'CALL_ENDED',
    room_id: roomID,
    call_type: callType,
    duration: durationSeconds,
    timestamp: new Date().toISOString(),
  };

  const msgId = `end_${Date.now()}`;
  const chatMsg: ChatMessage = {
    id: msgId,
    sender_id: currentUserId,
    receiver_id: partnerId,
    recipient_id: partnerId,
    content: `CALL_ENDED:${JSON.stringify(payload)}`,
    read: true,
    created_at: payload.timestamp,
  };

  try {
    daheejStore.addMessage(chatMsg);
    await supabase.from('messages').insert({
      id: msgId,
      sender_id: currentUserId,
      receiver_id: partnerId,
      content: `CALL_ENDED:${JSON.stringify(payload)}`,
      read: true,
      created_at: payload.timestamp,
    });
  } catch (e) {
    console.warn('[Call Signaling] recordCallEnded notice:', e);
  }
}

/**
 * End a call session in public.call_signals
 */
export async function endCallSession(roomID?: string, signalId?: string): Promise<void> {
  if (!roomID && !signalId) return;

  try {
    if (signalId) {
      await supabase
        .from('call_signals')
        .update({ type: 'end-call' })
        .eq('id', signalId);
    }
    if (roomID) {
      await supabase
        .from('call_signals')
        .update({ type: 'end-call' })
        .eq('room_id', roomID);
    }
  } catch (err) {
    console.warn('[Call Signaling] endCallSession notice:', err);
  }
}

/**
 * Mark a call signal as missed
 */
export async function markCallAsMissed(roomID?: string, signalId?: string): Promise<void> {
  if (!roomID && !signalId) return;

  try {
    if (signalId) {
      await supabase
        .from('call_signals')
        .update({ type: 'reject-call' })
        .eq('id', signalId);
    }
    if (roomID) {
      await supabase
        .from('call_signals')
        .update({ type: 'reject-call' })
        .eq('room_id', roomID);
    }
  } catch (err) {
    console.warn('[Call Signaling] markCallAsMissed notice:', err);
  }
}

/**
 * Decline an incoming call signal
 */
export async function declineCallSession(signalId?: string, roomID?: string): Promise<void> {
  try {
    if (signalId) {
      await supabase
        .from('call_signals')
        .update({ type: 'reject-call' })
        .eq('id', signalId);
    }
    if (roomID) {
      await supabase
        .from('call_signals')
        .update({ type: 'reject-call' })
        .eq('room_id', roomID);
    }
  } catch (err) {
    console.warn('[Call Signaling] declineCallSession notice:', err);
  }
}

/**
 * Subscribe to realtime incoming call signals for a user with instantaneous heartbeat polling
 */
export function subscribeToCallSignals(
  currentUserId: string,
  onIncomingCall: (invite: CallInviteData) => void
): () => void {
  if (!currentUserId) return () => {};

  let isMounted = true;
  let seenSignalIds = new Set<string>();

  // 1. Proactive Fetch Check
  const checkPendingSignals = async () => {
    if (!isMounted) return;
    try {
      const recentThreshold = new Date(Date.now() - 45000).toISOString();
      const { data, error } = await supabase
        .from('call_signals')
        .select('*')
        .eq('receiver_id', currentUserId)
        .eq('type', 'offer')
        .gte('created_at', recentThreshold)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0 && isMounted) {
        const row = data[0];
        if (!seenSignalIds.has(row.id)) {
          seenSignalIds.add(row.id);
          const sig = row.payload || {};
          const rawType = sig.call_type || 'video';
          const callType: 'video' | 'voice' = (rawType === 'voice' || rawType === 'audio') ? 'voice' : 'video';
          onIncomingCall({
            id: row.id,
            type: 'CALL_INVITE',
            callType,
            room_id: row.room_id || sig.room_id || `room_${Date.now()}`,
            caller_name: sig.caller_name || 'Matrimonial Candidate',
            caller_avatar: sig.caller_avatar || null,
            caller_id: row.caller_id,
            timestamp: row.created_at,
          });
        }
      }
    } catch (e) {
      // ignore
    }
  };

  // Run immediately on subscribe
  checkPendingSignals();

  // 2. Active 2-second Heartbeat Polling Fallback so users never need to reload to detect calls
  const pollInterval = setInterval(() => {
    checkPendingSignals();
  }, 2000);

  // 3. Supabase Realtime Postgres Changes Subscription
  const channel = supabase
    .channel(`call_signals_live_${currentUserId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'call_signals',
        filter: `receiver_id=eq.${currentUserId}`,
      },
      (payload) => {
        const row = payload.new as CallSignal;
        if (row && row.type === 'offer' && isMounted) {
          if (!seenSignalIds.has(row.id)) {
            seenSignalIds.add(row.id);
            const sig = (row.payload as any) || {};
            const rawType = sig.call_type || 'video';
            const callType: 'video' | 'voice' = (rawType === 'voice' || rawType === 'audio') ? 'voice' : 'video';
            onIncomingCall({
              id: row.id,
              type: 'CALL_INVITE',
              callType,
              room_id: row.room_id || sig.room_id || `room_${Date.now()}`,
              caller_name: sig.caller_name || 'Matrimonial Candidate',
              caller_avatar: sig.caller_avatar || null,
              caller_id: row.caller_id,
              timestamp: row.created_at,
            });
          }
        }
      }
    )
    .subscribe();

  // 4. Also listen to local store calls
  const unsubsStore = daheejStore.subscribeToCalls((call) => {
    if (!isMounted) return;
    const recipientId = call.recipient_id || call.callee_id;
    if (recipientId === currentUserId && call.status === 'ringing') {
      if (!seenSignalIds.has(call.id)) {
        seenSignalIds.add(call.id);
        const rawType = call.call_type || 'video';
        const callType: 'video' | 'voice' = (rawType === 'voice' || rawType === 'audio') ? 'voice' : 'video';
        const sdp = (call.sdp_offer as any) || {};
        onIncomingCall({
          id: call.id,
          type: 'CALL_INVITE',
          callType,
          room_id: sdp.room_id || `room_${Date.now()}`,
          caller_name: sdp.caller_name || 'Matrimonial Candidate',
          caller_avatar: sdp.caller_avatar || null,
          caller_id: call.caller_id,
          timestamp: call.created_at || new Date().toISOString(),
        });
      }
    }
  });

  return () => {
    isMounted = false;
    clearInterval(pollInterval);
    unsubsStore();
    supabase.removeChannel(channel);
  };
}
