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
    return '❌ Missed Call (User unavailable)';
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
      recipient_id: partnerId,
      content: JSON.stringify(signalPayload),
      is_read: false,
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

  // Deduplication: only record connected once per room
  if (typeof window !== 'undefined' && roomID) {
    try {
      const connectedRooms: string[] = JSON.parse(sessionStorage.getItem('connected_call_rooms') || '[]');
      if (connectedRooms.includes(roomID)) {
        return;
      }
      connectedRooms.push(roomID);
      sessionStorage.setItem('connected_call_rooms', JSON.stringify(connectedRooms));
    } catch (e) {}
  }

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
      recipient_id: partnerId,
      content: `CALL_CONNECTED:${JSON.stringify(payload)}`,
      is_read: true,
      created_at: payload.timestamp,
    });
  } catch (e) {
    console.warn('[Call Signaling] recordCallConnected notice:', e);
  }
}

/**
 * Record a Call Declined event in chat
 */
export async function recordCallDeclined({
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

  // If this room has already connected or already ended, do not record as declined
  if (typeof window !== 'undefined' && roomID) {
    try {
      const connectedRooms: string[] = JSON.parse(sessionStorage.getItem('connected_call_rooms') || '[]');
      const endedRooms: string[] = JSON.parse(sessionStorage.getItem('ended_call_rooms') || '[]');
      const declinedRooms: string[] = JSON.parse(sessionStorage.getItem('declined_call_rooms') || '[]');
      if (connectedRooms.includes(roomID) || endedRooms.includes(roomID) || declinedRooms.includes(roomID)) {
        return;
      }
      declinedRooms.push(roomID);
      sessionStorage.setItem('declined_call_rooms', JSON.stringify(declinedRooms));
    } catch (e) {}
  }

  const payload = {
    type: 'CALL_DECLINED',
    room_id: roomID,
    call_type: callType,
    timestamp: new Date().toISOString(),
  };

  const msgId = `dec_${Date.now()}`;
  const chatMsg: ChatMessage = {
    id: msgId,
    sender_id: currentUserId,
    receiver_id: partnerId,
    recipient_id: partnerId,
    content: `CALL_DECLINED:${JSON.stringify(payload)}`,
    read: true,
    created_at: payload.timestamp,
  };

  try {
    if (roomID) {
      daheejStore.updateCallInviteStatus(roomID, `CALL_DECLINED:${JSON.stringify(payload)}`);
      try {
        await supabase
          .from('messages')
          .update({ content: 'CALL_DECLINED' })
          .ilike('content', `%${roomID}%`);
      } catch (e) {}
    }
    daheejStore.addMessage(chatMsg);
    await supabase.from('messages').insert({
      id: msgId,
      sender_id: currentUserId,
      receiver_id: partnerId,
      recipient_id: partnerId,
      content: `CALL_DECLINED:${JSON.stringify(payload)}`,
      is_read: true,
      created_at: payload.timestamp,
    });
  } catch (e) {
    console.warn('[Call Signaling] recordCallDeclined notice:', e);
  }

  if (typeof window !== 'undefined') {
    try {
      const list = JSON.parse(sessionStorage.getItem('declined_call_rooms') || '[]');
      if (roomID && !list.includes(roomID)) {
        list.push(roomID);
        sessionStorage.setItem('declined_call_rooms', JSON.stringify(list));
      }
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('call:cancelled', { detail: { roomId: roomID } }));
    window.dispatchEvent(new CustomEvent('call:declined', { detail: { roomId: roomID } }));
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
    if (roomID) {
      daheejStore.updateCallInviteStatus(roomID, `CALL_ENDED:${JSON.stringify(payload)}`);
      try {
        await supabase
          .from('messages')
          .update({ content: 'CALL_ENDED' })
          .ilike('content', `%${roomID}%`);
      } catch (e) {}
    }
    daheejStore.addMessage(chatMsg);
    await supabase.from('messages').insert({
      id: msgId,
      sender_id: currentUserId,
      receiver_id: partnerId,
      recipient_id: partnerId,
      content: `CALL_ENDED:${JSON.stringify(payload)}`,
      is_read: true,
      created_at: payload.timestamp,
    });
  } catch (e) {
    console.warn('[Call Signaling] recordCallEnded notice:', e);
  }

  if (typeof window !== 'undefined') {
    try {
      const list = JSON.parse(sessionStorage.getItem('ended_call_rooms') || '[]');
      if (roomID && !list.includes(roomID)) {
        list.push(roomID);
        sessionStorage.setItem('ended_call_rooms', JSON.stringify(list));
      }
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('call:cancelled', { detail: { roomId: roomID } }));
    window.dispatchEvent(new CustomEvent('call:ended', { detail: { roomId: roomID } }));
  }
}

/**
 * Record a Missed / Unanswered Call event in chat when not picked up
 */
export async function recordCallMissed({
  currentUserId,
  partnerId,
  roomID,
  callType = 'video',
  reason = 'unanswered',
}: {
  currentUserId: string;
  partnerId: string;
  roomID: string;
  callType?: 'video' | 'voice' | 'audio';
  reason?: string;
}): Promise<void> {
  if (!currentUserId || !partnerId) return;

  const payload = {
    type: 'CALL_MISSED',
    room_id: roomID,
    call_type: callType,
    reason: reason || 'unanswered',
    message: "User isn't available at the moment",
    timestamp: new Date().toISOString(),
  };

  const msgId = `missed_${Date.now()}`;
  const chatMsg: ChatMessage = {
    id: msgId,
    sender_id: currentUserId,
    receiver_id: partnerId,
    recipient_id: partnerId,
    content: `CALL_MISSED:${JSON.stringify(payload)}`,
    read: true,
    created_at: payload.timestamp,
  };

  try {
    if (roomID) {
      daheejStore.updateCallInviteStatus(roomID, `CALL_MISSED:${JSON.stringify(payload)}`);
      try {
        await supabase
          .from('messages')
          .update({ content: 'CALL_MISSED' })
          .ilike('content', `%${roomID}%`);
      } catch (e) {}
    }
    daheejStore.addMessage(chatMsg);
    await supabase.from('messages').insert({
      id: msgId,
      sender_id: currentUserId,
      receiver_id: partnerId,
      recipient_id: partnerId,
      content: `CALL_MISSED:${JSON.stringify(payload)}`,
      is_read: true,
      created_at: payload.timestamp,
    });
  } catch (e) {
    console.warn('[Call Signaling] recordCallMissed notice:', e);
  }

  if (typeof window !== 'undefined') {
    try {
      const list = JSON.parse(sessionStorage.getItem('ended_call_rooms') || '[]');
      if (roomID && !list.includes(roomID)) {
        list.push(roomID);
        sessionStorage.setItem('ended_call_rooms', JSON.stringify(list));
      }
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('call:cancelled', { detail: { roomId: roomID } }));
    window.dispatchEvent(new CustomEvent('call:missed', { detail: { roomId: roomID } }));
  }
}

/**
 * Checks if a specific call invite message is still actively ringing,
 * or if it has expired / concluded / cancelled.
 */
export function isCallInviteCurrentlyActive(
  msg: ChatMessage,
  allMessages: ChatMessage[] = []
): boolean {
  if (!msg || !msg.content) return false;
  
  const trimmed = msg.content.trim();
  if (
    trimmed === 'CALL_DECLINED' ||
    trimmed.startsWith('CALL_DECLINED') ||
    trimmed.includes('CALL_DECLINED') ||
    trimmed === 'CALL_ENDED' ||
    trimmed.startsWith('CALL_ENDED') ||
    trimmed.includes('CALL_ENDED') ||
    trimmed === 'CALL_MISSED' ||
    trimmed.startsWith('CALL_MISSED') ||
    trimmed.includes('CALL_MISSED') ||
    trimmed === 'CALL_CONNECTED' ||
    trimmed.startsWith('CALL_CONNECTED')
  ) {
    return false;
  }

  const invite = parseCallInvite(msg.content);
  if (!invite) return false;

  const targetRoomId = invite.room_id;

  // 1. In-memory and sessionStorage check for ended or declined calls
  if (typeof window !== 'undefined' && targetRoomId) {
    try {
      const endedRooms = JSON.parse(sessionStorage.getItem('ended_call_rooms') || '[]');
      const declinedRooms = JSON.parse(sessionStorage.getItem('declined_call_rooms') || '[]');
      if (endedRooms.includes(targetRoomId) || declinedRooms.includes(targetRoomId)) {
        return false;
      }
    } catch (e) {}
  }

  // 2. Check local store calls list
  try {
    const localCalls = daheejStore.getCalls();
    const match = localCalls.find((c: any) => c.room_id === targetRoomId || c.id === targetRoomId);
    if (match && ['ended', 'completed', 'cancelled', 'declined', 'missed', 'rejected'].includes(match.status)) {
      return false;
    }
  } catch (e) {}

  // 3. Time expiration: A call invite is only actively ringing for at most 30 seconds
  const createdAtTime = new Date(msg.created_at || Date.now()).getTime();
  if (isNaN(createdAtTime) || Date.now() - createdAtTime > 30000) {
    return false;
  }

  // 4. Check if there are subsequent termination events (CALL_ENDED, CALL_DECLINED, CALL_MISSED, CALL_CONNECTED)
  // for this room or later in the chat thread
  for (const other of allMessages) {
    if (other.id === msg.id) continue;
    const otherContent = other.content || '';
    
    // Check if this other message is a termination event
    const isTerm =
      otherContent.includes('CALL_ENDED') ||
      otherContent.includes('CALL_DECLINED') ||
      otherContent.includes('CALL_MISSED') ||
      otherContent.includes('CALL_CONNECTED') ||
      otherContent.includes('call-ended') ||
      otherContent.includes('reject-call');

    if (!isTerm) continue;

    // If it mentions the exact room ID, it definitively terminates this call
    if (targetRoomId && otherContent.includes(targetRoomId)) {
      return false;
    }

    // Or if it occurred after or near this invite
    const otherTime = new Date(other.created_at || 0).getTime();
    if (otherTime >= createdAtTime - 2000) {
      return false;
    }
  }

  // 5. Check if there is ANY newer CALL_INVITE from the caller in the conversation.
  // An older call invite is immediately superseded if a subsequent invite was dispatched.
  const hasNewerInvite = allMessages.some((m) => {
    if (m.id === msg.id) return false;
    const mInvite = parseCallInvite(m.content);
    if (!mInvite) return false;
    const mTime = new Date(m.created_at || 0).getTime();
    return mTime > createdAtTime;
  });

  if (hasNewerInvite) {
    return false;
  }

  return true;
}

/**
 * End a call session in public.call_signals & sync messages / store
 */
export async function endCallSession(
  roomID?: string,
  signalId?: string,
  currentUserId?: string,
  partnerId?: string,
  durationSeconds = 0
): Promise<void> {
  if (!roomID && !signalId) return;

  try {
    if (signalId) {
      await supabase
        .from('call_signals')
        .update({ type: 'call-ended' })
        .eq('id', signalId);
    }
    if (roomID) {
      await supabase
        .from('call_signals')
        .update({ type: 'call-ended' })
        .eq('room_id', roomID);
      daheejStore.updateCallInviteStatus(roomID, `CALL_ENDED:{"room_id":"${roomID}","duration":${durationSeconds}}`);
      try {
        await supabase
          .from('messages')
          .update({ content: 'CALL_ENDED' })
          .ilike('content', `%${roomID}%`);
      } catch (e) {}
    }
  } catch (err) {
    console.warn('[Call Signaling] endCallSession notice:', err);
  }

  if (currentUserId && partnerId && roomID) {
    await recordCallEnded({
      currentUserId,
      partnerId,
      roomID,
      durationSeconds,
    });
  }

  if (typeof window !== 'undefined') {
    try {
      const list = JSON.parse(sessionStorage.getItem('ended_call_rooms') || '[]');
      if (roomID && !list.includes(roomID)) {
        list.push(roomID);
        sessionStorage.setItem('ended_call_rooms', JSON.stringify(list));
      }
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('call:cancelled', { detail: { roomId: roomID, signalId } }));
    window.dispatchEvent(new CustomEvent('call:ended', { detail: { roomId: roomID, signalId } }));
  }
}

/**
 * Explicitly send a call cancellation signal across Supabase and local event buses
 */
export async function sendCallCancellation(roomId?: string, callerId?: string, partnerId?: string): Promise<void> {
  if (roomId) {
    daheejStore.updateCallInviteStatus(roomId, 'CALL_ENDED');
    try {
      await supabase
        .from('call_signals')
        .update({ type: 'cancel-call' })
        .eq('room_id', roomId);
      await supabase
        .from('messages')
        .update({ content: 'CALL_ENDED' })
        .ilike('content', `%${roomId}%`);
    } catch (e) {}
  }
  if (typeof window !== 'undefined') {
    try {
      const list = JSON.parse(sessionStorage.getItem('ended_call_rooms') || '[]');
      if (roomId && !list.includes(roomId)) {
        list.push(roomId);
        sessionStorage.setItem('ended_call_rooms', JSON.stringify(list));
      }
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('call:cancelled', { detail: { roomId } }));
    window.dispatchEvent(new CustomEvent('call:ended', { detail: { roomId } }));
  }
}

/**
 * Mark a call signal as missed or cancelled
 */
export async function markCallAsMissed(
  roomID?: string,
  signalId?: string,
  currentUserId?: string,
  partnerId?: string
): Promise<void> {
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
      daheejStore.updateCallInviteStatus(roomID, `CALL_MISSED:{"room_id":"${roomID}"}`);
      try {
        await supabase
          .from('messages')
          .update({ content: 'CALL_MISSED' })
          .ilike('content', `%${roomID}%`);
      } catch (e) {}
    }
  } catch (err) {
    console.warn('[Call Signaling] markCallAsMissed notice:', err);
  }

  if (currentUserId && partnerId && roomID) {
    await recordCallMissed({
      currentUserId,
      partnerId,
      roomID,
      reason: 'unanswered',
    });
  }

  if (typeof window !== 'undefined') {
    try {
      const list = JSON.parse(sessionStorage.getItem('ended_call_rooms') || '[]');
      if (roomID && !list.includes(roomID)) {
        list.push(roomID);
        sessionStorage.setItem('ended_call_rooms', JSON.stringify(list));
      }
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('call:cancelled', { detail: { roomId: roomID, signalId } }));
    window.dispatchEvent(new CustomEvent('call:missed', { detail: { roomId: roomID, signalId } }));
  }
}

/**
 * Decline an incoming call signal
 */
export async function declineCallSession(
  signalId?: string,
  roomID?: string,
  currentUserId?: string,
  partnerId?: string
): Promise<void> {
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
      daheejStore.updateCallInviteStatus(roomID, 'CALL_DECLINED');
      try {
        await supabase
          .from('messages')
          .update({ content: 'CALL_DECLINED' })
          .ilike('content', `%${roomID}%`);
      } catch (e) {}
    }
  } catch (err) {
    console.warn('[Call Signaling] declineCallSession notice:', err);
  }

  if (currentUserId && partnerId && roomID) {
    await recordCallDeclined({
      currentUserId,
      partnerId,
      roomID,
    });
  }

  if (typeof window !== 'undefined') {
    try {
      const list = JSON.parse(sessionStorage.getItem('declined_call_rooms') || '[]');
      if (roomID && !list.includes(roomID)) {
        list.push(roomID);
        sessionStorage.setItem('declined_call_rooms', JSON.stringify(list));
      }
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('call:cancelled', { detail: { roomId: roomID, signalId } }));
    window.dispatchEvent(new CustomEvent('call:declined', { detail: { roomId: roomID, signalId } }));
  }
}

/**
 * Subscribe to realtime incoming call signals for a user with instantaneous heartbeat polling
 * and automatic cancellation dismissal
 */
export function subscribeToCallSignals(
  currentUserId: string,
  onIncomingCall: (invite: CallInviteData) => void,
  onCallCancelled?: (roomID?: string, signalId?: string) => void
): () => void {
  if (!currentUserId) return () => {};

  let isMounted = true;
  let seenSignalIds = new Set<string>();
  let activeRingingSignalId: string | null = null;
  let activeRingingRoomId: string | null = null;

  // 1. Proactive Fetch Check
  const checkPendingSignals = async () => {
    if (!isMounted) return;
    try {
      const recentThreshold = new Date(Date.now() - 45000).toISOString();
      const { data, error } = await supabase
        .from('call_signals')
        .select('*')
        .eq('receiver_id', currentUserId)
        .gte('created_at', recentThreshold)
        .order('created_at', { ascending: false })
        .limit(3);

      if (!error && data && data.length > 0 && isMounted) {
        // Find newest valid offer
        const activeOffer = data.find((row) => row.type === 'offer');
        
        // If there was an active ringing signal that got cancelled/ended
        if (activeRingingSignalId) {
          const matchedRow = data.find((row) => row.id === activeRingingSignalId);
          if (matchedRow && (matchedRow.type === 'reject-call' || matchedRow.type === 'end-call' || matchedRow.type === 'call-ended' || matchedRow.type === 'cancel-call')) {
            const rId = activeRingingRoomId || undefined;
            const sId = activeRingingSignalId;
            activeRingingSignalId = null;
            activeRingingRoomId = null;
            if (onCallCancelled) onCallCancelled(rId, sId);
            return;
          }
        }

        if (activeOffer && !seenSignalIds.has(activeOffer.id)) {
          seenSignalIds.add(activeOffer.id);
          activeRingingSignalId = activeOffer.id;
          activeRingingRoomId = activeOffer.room_id || null;

          const sig = activeOffer.payload || {};
          const rawType = sig.call_type || 'video';
          const callType: 'video' | 'voice' = (rawType === 'voice' || rawType === 'audio') ? 'voice' : 'video';
          onIncomingCall({
            id: activeOffer.id,
            type: 'CALL_INVITE',
            callType,
            room_id: activeOffer.room_id || sig.room_id || `room_${Date.now()}`,
            caller_name: sig.caller_name || 'Matrimonial Candidate',
            caller_avatar: sig.caller_avatar || null,
            caller_id: activeOffer.caller_id,
            timestamp: activeOffer.created_at,
          });
        }
      } else if (activeRingingSignalId && (!data || data.length === 0)) {
        // Signal expired
        const rId = activeRingingRoomId || undefined;
        const sId = activeRingingSignalId;
        activeRingingSignalId = null;
        activeRingingRoomId = null;
        if (onCallCancelled) onCallCancelled(rId, sId);
      }
    } catch (e) {
      // ignore
    }
  };

  // Run immediately on subscribe
  checkPendingSignals();

  // 2. Active 2-second Heartbeat Polling Fallback
  const pollInterval = setInterval(() => {
    checkPendingSignals();
  }, 2000);

  // 3. Supabase Realtime Postgres Changes Subscription (INSERT and UPDATE)
  const channel = supabase
    .channel(`call_signals_live_${currentUserId}_${Math.random().toString(36).slice(2, 7)}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'call_signals',
        filter: `receiver_id=eq.${currentUserId}`,
      },
      (payload) => {
        if (!isMounted) return;
        const row = (payload.new || payload.old) as CallSignal;
        if (!row) return;

        // If cancelled or ended
        const signalType = row.type as string;
        if (
          signalType === 'reject-call' ||
          signalType === 'end-call' ||
          signalType === 'call-ended' ||
          signalType === 'cancel-call'
        ) {
          activeRingingSignalId = null;
          activeRingingRoomId = null;
          if (onCallCancelled) {
            onCallCancelled(row.room_id, row.id);
          }
          return;
        }

        // If new offer
        if (payload.eventType === 'INSERT' && row.type === 'offer') {
          if (!seenSignalIds.has(row.id)) {
            seenSignalIds.add(row.id);
            activeRingingSignalId = row.id;
            activeRingingRoomId = row.room_id || null;

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
    if (recipientId === currentUserId) {
      const callStatus = call.status as string;
      if (
        callStatus === 'ended' ||
        callStatus === 'cancelled' ||
        callStatus === 'rejected' ||
        callStatus === 'completed' ||
        callStatus === 'declined'
      ) {
        activeRingingSignalId = null;
        activeRingingRoomId = null;
        if (onCallCancelled) {
          onCallCancelled(call.id, call.id);
        }
      } else if (call.status === 'ringing') {
        if (!seenSignalIds.has(call.id)) {
          seenSignalIds.add(call.id);
          activeRingingSignalId = call.id;
          activeRingingRoomId = (call.sdp_offer as any)?.room_id || call.id;

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
    }
  });

  return () => {
    isMounted = false;
    clearInterval(pollInterval);
    unsubsStore();
    supabase.removeChannel(channel);
  };
}
