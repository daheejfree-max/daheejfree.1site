'use client';

// ==============================================================================
// WEBRTC CALLS HISTORY & P2P SIGNALING CONSOLE
// ==============================================================================

import React from 'react';
import {
  PhoneCall,
  Video,
  Phone,
  Clock,
  CheckCircle,
  XCircle,
  PhoneMissed,
  Sparkles,
  Shield,
  Activity,
} from 'lucide-react';
import { Call, Profile, CallStatus } from '../../types';
import { daheejStore } from '../../lib/supabase/store';

interface CallsHistoryProps {
  currentUserId: string;
  calls: Call[];
  onStartCall: (targetId: string, type: 'voice' | 'video') => void;
}

export const CallsHistory: React.FC<CallsHistoryProps> = ({
  currentUserId,
  calls,
  onStartCall,
}) => {
  const getPartner = (call: Call): { id: string; profile: Profile | null; isIncoming: boolean } => {
    const isIncoming = call.caller_id !== currentUserId;
    const partnerId = isIncoming ? call.caller_id : call.recipient_id;
    return {
      id: partnerId,
      profile: daheejStore.getProfileById(partnerId),
      isIncoming,
    };
  };

  const getStatusBadge = (status: CallStatus) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-600/40 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            Active
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700">
            <CheckCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            Completed
          </span>
        );
      case 'declined':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/40">
            <XCircle className="w-3 h-3 text-red-600 dark:text-red-400" />
            Declined
          </span>
        );
      case 'missed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
            <PhoneMissed className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            Missed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40">
            Connecting...
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 dark:from-emerald-950 dark:via-zinc-900 dark:to-indigo-950 border border-emerald-200 dark:border-emerald-500/30 rounded-3xl p-6 shadow-sm dark:shadow-xl transition-colors">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600/10 dark:bg-emerald-600/30 border border-emerald-300 dark:border-emerald-500/50 flex items-center justify-center text-emerald-700 dark:text-emerald-400 flex-shrink-0 shadow-sm">
              <PhoneCall className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-1">P2P Encrypted WebRTC Communications</h2>
              <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed max-w-xl">
                Realtime peer-to-peer signaling hosted on Supabase WebSockets. No recording, strictly encrypted peer streams, honoring Sunnah privacy.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 rounded-xl text-xs text-emerald-700 dark:text-emerald-400 shadow-sm">
            <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-pulse" />
            <span>STUN/TURN Signaling Online</span>
          </div>
        </div>
      </div>

      {/* Calls Log Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm dark:shadow-lg transition-colors">
        <h3 className="font-bold text-zinc-900 dark:text-white text-base mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          Recent Voice & Video Logs ({calls.length})
        </h3>

        {calls.length === 0 ? (
          <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-950/60 rounded-2xl border border-zinc-200 dark:border-zinc-800/80">
            <PhoneCall className="w-8 h-8 text-zinc-400 dark:text-zinc-600 mx-auto mb-2" />
            <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">No WebRTC calls recorded yet.</p>
            <p className="text-[11px] text-zinc-500 mt-1">
              Select any profile in "Nikah Matches" to initiate a secure Voice or Video call.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-700 dark:text-zinc-300">
              <thead className="bg-zinc-50 dark:bg-zinc-950/80 text-zinc-600 dark:text-zinc-400 uppercase tracking-wider text-[10px] border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="p-3.5">Participant</th>
                  <th className="p-3.5">Call Type</th>
                  <th className="p-3.5">Direction</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Duration</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                {(calls || []).map((call) => {
                  const { id: partnerId, profile: partner, isIncoming } = getPartner(call);
                  const duration = call.duration_seconds || 0;
                  const durationStr = `${Math.floor(duration / 60)}m ${duration % 60}s`;

                  return (
                    <tr key={call.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="p-3.5 font-semibold text-zinc-900 dark:text-white">
                        {partner?.full_name || 'Member Profile'}
                      </td>
                      <td className="p-3.5 capitalize flex items-center gap-1.5">
                        {call.call_type === 'video' ? (
                          <Video className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Phone className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        )}
                        {call.call_type}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            isIncoming
                              ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40'
                              : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                          }`}
                        >
                          {isIncoming ? 'Incoming' : 'Outgoing'}
                        </span>
                      </td>
                      <td className="p-3.5">{getStatusBadge(call.status)}</td>
                      <td className="p-3.5 font-mono text-zinc-500 dark:text-zinc-400">{durationStr}</td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => onStartCall(partnerId, call.call_type === 'video' ? 'video' : 'voice')}
                          className="px-3 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-emerald-600 dark:hover:bg-emerald-600 text-zinc-800 dark:text-white hover:text-white font-medium text-[11px] transition-colors shadow-sm"
                        >
                          Redial
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
