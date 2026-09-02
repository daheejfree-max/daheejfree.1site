import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase/client';
import { daheejStore } from '../../lib/supabase/store';
import { Phone, PhoneOff, Video, Shield } from 'lucide-react';

export interface IncomingCallData {
  id: string;
  room_id: string;
  caller_id: string;
  caller_name: string;
  caller_avatar?: string | null;
  call_type: 'audio' | 'video' | 'voice';
}

export const IncomingCallListener: React.FC<{
  currentUserId?: string;
  onAcceptCall: (roomId: string, callData?: IncomingCallData) => void;
}> = ({ currentUserId, onAcceptCall }) => {
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Stop ringtone audio safely
  const stopAudio = () => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch (e) {}
    }
  };

  useEffect(() => {
    if (!currentUserId) return;
    let isMounted = true;

    // 1. Initial check for any recent pending call signals (within last 35s)
    const checkInitialPendingSignals = async () => {
      try {
        const recentThreshold = new Date(Date.now() - 35000).toISOString();
        const { data, error } = await supabase
          .from('call_signals')
          .select('*')
          .eq('receiver_id', currentUserId)
          .eq('type', 'offer')
          .gte('created_at', recentThreshold)
          .order('created_at', { ascending: false })
          .limit(1);

        if (!error && data && data.length > 0 && isMounted) {
          const record = data[0];
          const payload = record.payload || {};
          const localCaller = record.caller_id ? daheejStore.getProfileById(record.caller_id) : null;
          setIncomingCall({
            id: record.id,
            room_id: record.room_id || payload.room_id || `room_${record.caller_id}_${currentUserId}`,
            caller_id: record.caller_id,
            caller_name: payload.caller_name || localCaller?.full_name || 'Matrimonial Match',
            caller_avatar: payload.caller_avatar || localCaller?.avatar_url || null,
            call_type: payload.call_type || 'video',
          });
        }
      } catch (err) {
        console.warn('[IncomingCallListener] Initial signal check note:', err);
      }
    };
    checkInitialPendingSignals();

    // 2. Realtime Postgres Changes Subscription on public.call_signals table
    const channel = supabase
      .channel(`call_incoming_${currentUserId}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_signals',
          filter: 'receiver_id=eq.' + currentUserId,
        },
        (payload) => {
          console.log("Incoming signal received:", payload);
          const record = payload.new as any;
          if (record && record.type === 'offer') {
            const sigPayload = record.payload || {};
            const localCaller = record.caller_id ? daheejStore.getProfileById(record.caller_id) : null;
            const callObj: IncomingCallData = {
              id: record.id,
              room_id: record.room_id || sigPayload.room_id || `room_${record.caller_id}_${currentUserId}`,
              caller_id: record.caller_id,
              caller_name: sigPayload.caller_name || localCaller?.full_name || 'Matrimonial Match',
              caller_avatar: sigPayload.caller_avatar || localCaller?.avatar_url || null,
              call_type: sigPayload.call_type || 'video',
            };
            setIncomingCall(callObj);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_signals',
          filter: 'receiver_id=eq.' + currentUserId,
        },
        (payload) => {
          const record = payload.new as any;
          if (record && (record.type === 'reject-call' || record.type === 'end-call' || record.type === 'call-ended')) {
            setIncomingCall(null);
            stopAudio();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'call_signals',
          filter: 'receiver_id=eq.' + currentUserId,
        },
        () => {
          setIncomingCall(null);
          stopAudio();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      stopAudio();
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  if (!incomingCall) return null;

  const handleReject = async () => {
    stopAudio();
    const callData = incomingCall;
    setIncomingCall(null);

    try {
      if (callData.id) {
        await supabase
          .from('call_signals')
          .update({ type: 'reject-call' })
          .eq('id', callData.id);
      }
      if (callData.room_id) {
        await supabase
          .from('call_signals')
          .update({ type: 'reject-call' })
          .eq('room_id', callData.room_id);
      }
    } catch (e) {
      console.warn('[IncomingCallListener] Reject signal update error:', e);
    }
  };

  const handleAccept = async () => {
    stopAudio();
    const callData = incomingCall;
    setIncomingCall(null);

    // Sync answer state in DB to inform caller & clear 60s timeout immediately
    try {
      if (callData.id) {
        await supabase
          .from('call_signals')
          .update({ type: 'answer' })
          .eq('id', callData.id);
      }
      if (callData.room_id) {
        await supabase
          .from('call_signals')
          .update({ type: 'answer' })
          .eq('room_id', callData.room_id);
      }
    } catch (e) {
      console.warn('[IncomingCallListener] Accept signal update error:', e);
    }

    onAcceptCall(callData.room_id, callData);
  };

  return (
    <div 
      id="incoming-call-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
    >
      <div 
        id="incoming-call-card"
        className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 text-center text-white shadow-2xl space-y-6"
      >
        <div className="relative mx-auto w-24 h-24 rounded-full overflow-hidden border-4 border-emerald-500 shadow-xl">
          {incomingCall.caller_avatar ? (
            <img
              src={incomingCall.caller_avatar}
              alt={incomingCall.caller_name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-emerald-700 flex items-center justify-center text-2xl font-bold">
              {incomingCall.caller_name.charAt(0)}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-lg font-bold truncate">{incomingCall.caller_name}</h3>
          <p className="text-xs text-zinc-400 mt-1 flex items-center justify-center gap-1.5">
            {incomingCall.call_type === 'video' ? (
              <Video className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
            )}
            Incoming Halal {incomingCall.call_type === 'video' ? 'Video' : 'Voice'} Call...
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/40 text-[10px] text-emerald-300 font-medium">
            <Shield className="w-3 h-3 text-emerald-400" />
            <span>End-to-End P2P Halal Encrypted</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-6 pt-2">
          <button
            type="button"
            id="btn-decline-incoming-call"
            onClick={handleReject}
            className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 flex items-center justify-center text-white transition-all shadow-lg active:scale-95 cursor-pointer"
            title="Decline"
            aria-label="Decline Call"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
          <button
            type="button"
            id="btn-accept-incoming-call"
            onClick={handleAccept}
            className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center text-white transition-all shadow-lg animate-bounce active:scale-95 cursor-pointer"
            title="Accept"
            aria-label="Accept Call"
          >
            <Phone className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
