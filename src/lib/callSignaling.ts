// ==============================================================================
// CALL SIGNALING & REALTIME WEBRTC SIGNAL SUBSCRIPTION (TASK 5)
// Dedicated signaling via public.call_signals table (Never rendered in chat UI)
// ==============================================================================

import { supabase } from './supabase/client';
import { daheejStore } from './supabase/store';
import { CallSignal, CallType, ChatMessage } from '../types';

export interface CallInviteData {
  id?: string;
  type: 'CALL_INVITE';
  callType: 'video' | 'voice';
  room_id: string;
  caller_name: string;
  caller_avatar?: string | null;
  caller_id?: string;
  timestamp: string;
}

/**
 * Checks if a string or message payload is a WebRTC call signaling token
 * Used by chat components to completely hide/filter signaling data from the chat UI
 */
export function isCallSignalingContent(content: string | undefined | null): boolean {
  if (!content || typeof content !== 'string') return false;
  const trimmed = content.trim();
  const upper = trimmed.toUpperCase();

  if (
    upper.includes('CALL_INVITE') ||
    upper.includes('CALL_ACCEPTED') ||
    upper.includes('CALL_DECLINED') ||
    upper.includes('CALL_MISSED') ||
    upper.includes('CALL_ENDED') ||
    upper.includes('"OFFER"') ||
    upper.includes('"ANSWER"') ||
    upper.includes('ICE-CANDIDATE') ||
    upper.includes('"ICE-CANDIDATE"') ||
    upper.includes('"CANDIDATE"') ||
    upper.includes('"END-CALL"') ||
    upper.includes('"REJECT-CALL"') ||
    upper.startsWith('CALL_INVITE:') ||
    upper.startsWith('CALL_INVITE|')
  ) {
    return true;
  }

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (
        parsed.type === 'CALL_INVITE' ||
        parsed.type === 'CALL_ACCEPTED' ||
        parsed.type === 'CALL_DECLINED' ||
        parsed.type === 'CALL_ENDED' ||
        parsed.type === 'offer' ||
        parsed.type === 'answer' ||
        parsed.type === 'ice-candidate' ||
        parsed.type === 'candidate' ||
        parsed.type === 'end-call' ||
        parsed.type === 'reject-call' ||
        parsed.event === 'signaling' ||
        parsed.event === 'CALL_INVITE' ||
        parsed.sdp ||
        parsed.candidate
      ) {
        return true;
      }
    } catch {
      // not json
    }
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
 * Parse any signaling payload into CallInviteData if present
 */
export function parseCallInvite(content: string | undefined | null): CallInviteData | null {
  if (!content || typeof content !== 'string') return null;

  try {
    const trimmed = content.trim();

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const parsed = JSON.parse(trimmed);
      if (parsed.type === 'CALL_INVITE' || parsed.event === 'CALL_INVITE') {
        const rawType = parsed.callType || parsed.call_type || 'video';
        const callType: 'video' | 'voice' = (rawType === 'voice' || rawType === 'audio') ? 'voice' : 'video';
        return {
          id: parsed.id,
          type: 'CALL_INVITE',
          callType,
          room_id: parsed.room_id || parsed.roomId || parsed.roomID || `room_${Date.now()}`,
          caller_name: parsed.caller_name || parsed.callerName || 'Partner',
          caller_avatar: parsed.caller_avatar || parsed.callerAvatar || null,
          caller_id: parsed.caller_id || parsed.callerId,
          timestamp: parsed.timestamp || new Date().toISOString(),
        };
      }
    }

    if (trimmed.startsWith('CALL_INVITE:')) {
      const jsonSub = trimmed.slice('CALL_INVITE:'.length).trim();
      const parsed = JSON.parse(jsonSub);
      const rawType = parsed.callType || parsed.call_type || parsed.type || 'video';
      const callType: 'video' | 'voice' = (rawType === 'voice' || rawType === 'audio') ? 'voice' : 'video';
      return {
        id: parsed.id,
        type: 'CALL_INVITE',
        callType,
        room_id: parsed.room_id || parsed.roomId || parsed.roomID || `room_${Date.now()}`,
        caller_name: parsed.caller_name || parsed.callerName || 'Partner',
        caller_avatar: parsed.caller_avatar || parsed.callerAvatar || null,
        caller_id: parsed.caller_id || parsed.callerId,
        timestamp: parsed.timestamp || new Date().toISOString(),
      };
    }
  } catch (err) {
    // Non-fatal
  }

  return null;
}

/**
 * Sends a clean Call Signal to the public.call_signals table
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
      });
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
      recipient_id: partnerId,
      content: JSON.stringify(signalPayload),
      read: false,
      is_flagged: false,
      created_at: chatMsg.created_at,
    });
  } catch (msgErr) {
    console.warn('[Call Signaling] Chat message persistence notice:', msgErr);
  }

  return { roomID: generatedRoomId, signalId, message: chatMsg };
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
 * Subscribe to realtime incoming call signals for a user
 */
export function subscribeToCallSignals(
  currentUserId: string,
  onIncomingCall: (invite: CallInviteData) => void
): () => void {
  if (!currentUserId) return () => {};

  // 1. Check for any recent pending call signals (within last 35 seconds)
  const recentThreshold = new Date(Date.now() - 35000).toISOString();
  try {
    supabase
      .from('call_signals')
      .select('*')
      .eq('receiver_id', currentUserId)
      .eq('type', 'offer')
      .gte('created_at', recentThreshold)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const row = data[0];
          const sig = row.payload || {};
          const rawType = sig.call_type || 'video';
          const callType: 'video' | 'voice' = (rawType === 'voice' || rawType === 'audio') ? 'voice' : 'video';
          onIncomingCall({
            id: row.id,
            type: 'CALL_INVITE',
            callType,
            room_id: sig.room_id || `room_${Date.now()}`,
            caller_name: sig.caller_name || 'Matrimonial Candidate',
            caller_avatar: sig.caller_avatar || null,
            caller_id: row.caller_id,
            timestamp: row.created_at,
          });
        }
      });
  } catch (e) {
    // ignore
  }

  // 2. Realtime Postgres Changes Subscription
  const channel = supabase
    .channel(`call_signals_${currentUserId}_${Date.now()}`)
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
        if (row && row.type === 'offer') {
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
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
