'use client';

// ==============================================================================
// WEBRTC CALLS DASHBOARD & INTERFACE PAGE
// ==============================================================================

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useWebRTC } from '../../hooks/useWebRTC';
import { CallsHistory } from '../../components/dashboard/CallsHistory';
import { CallScreen } from '../../components/webrtc/CallScreen';
import { daheejStore } from '../../lib/supabase/store';
import {
  PhoneCall,
  Video,
  Phone,
  Shield,
  Sparkles,
  Users,
  Lock,
  Crown,
  Search,
} from 'lucide-react';
import { ProfileSecureView } from '../../types';

export default function WebRTCCallsRoutePage() {
  const { profile: currentProfile, tier, allProfiles } = useAuth();
  const currentUserId = currentProfile?.id || null;
  const [searchQuery, setSearchQuery] = useState('');

  const {
    activeCall,
    incomingCall,
    callStatus,
    partnerProfile,
    localStream,
    remoteStream,
    mediaError,
    isAudioMuted,
    isVideoOff,
    callDuration,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleAudio,
    toggleVideo,
  } = useWebRTC(currentUserId);

  const canCall = tier === 'platinum' || tier === 'diamond';

  const myGender = currentProfile?.gender === 'male' ? 'male' : 'female';
  const targetGender = myGender === 'male' ? 'female' : 'male';

  const candidateMatches = useMemo(() => {
    if (!currentUserId) return [];
    const secureList = daheejStore.getSecureProfiles(currentUserId);

    return secureList.filter((p) => {
      if (p.id === currentUserId || p.kyc_status === 'banned') return false;
      const matchesGender = p.gender === targetGender;
      const matchesSearch =
        !searchQuery.trim() ||
        p.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.profession?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.location?.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesGender && matchesSearch;
    });
  }, [currentUserId, targetGender, searchQuery]);

  const callsList = currentUserId ? daheejStore.getCallsForUser(currentUserId) : [];

  return (
    <div className="py-6 max-w-7xl mx-auto space-y-8">
      {/* Active / Inbound WebRTC Call Screen Overlay */}
      {(activeCall || incomingCall) && (
        <CallScreen
          activeCall={activeCall}
          incomingCall={incomingCall}
          callStatus={callStatus}
          partnerProfile={partnerProfile}
          localStream={localStream}
          remoteStream={remoteStream}
          mediaError={mediaError}
          isAudioMuted={isAudioMuted}
          isVideoOff={isVideoOff}
          callDuration={callDuration}
          onAccept={acceptCall}
          onDecline={declineCall}
          onEndCall={() => endCall(true)}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
        />
      )}

      {/* Hero Header */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-950 to-zinc-900 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold">
            <Shield className="w-3.5 h-3.5" />
            <span>P2P Encrypted Shariah Calling Mesh</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            WebRTC Voice & Video Calls
          </h1>
          <p className="text-xs sm:text-sm text-zinc-300 max-w-2xl leading-relaxed">
            Direct peer-to-peer audio and video communication utilizing STUN servers and Supabase Realtime signaling. Zero server recordings, honoring modesty and Islamic privacy.
          </p>
        </div>

        {!canCall && (
          <div className="bg-zinc-900/90 border border-amber-500/40 rounded-2xl p-4 sm:max-w-xs text-center space-y-2.5 shrink-0 shadow-lg">
            <div className="flex items-center justify-center gap-1.5 text-amber-400 font-bold text-xs">
              <Crown className="w-4 h-4" />
              <span>Platinum & Diamond Feature</span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Upgrade your subscription to initiate direct encrypted audio and video calls.
            </p>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') window.location.href = '/?tab=pricing';
              }}
              className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-colors"
            >
              Upgrade Tier
            </button>
          </div>
        )}
      </div>

      {/* Direct Call Launcher: Candidate List */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm dark:shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Available Verified Candidates</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Select a verified candidate to initiate a secure voice or video call
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter candidates..."
              className="w-full bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100 pl-9 pr-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-800 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(candidateMatches || []).map((candidate) => (
            <div
              key={candidate.id}
              className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl overflow-hidden bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 flex items-center justify-center shrink-0">
                  {candidate.is_photo_unlocked && candidate.avatar_url ? (
                    <img
                      src={candidate.avatar_url}
                      alt={candidate.full_name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Shield className="w-5 h-5 text-emerald-500" />
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                    {candidate.full_name}
                  </h4>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                    {candidate.profession || 'Verified Candidate'} • {candidate.location}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {canCall ? (
                  <>
                    <button
                      onClick={() => startCall(candidate.id, 'audio')}
                      className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40 transition-colors"
                      title="Audio Call"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => startCall(candidate.id, 'video')}
                      className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 transition-colors"
                      title="Video Call"
                    >
                      <Video className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      if (typeof window !== 'undefined') window.location.href = '/?tab=pricing';
                    }}
                    className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 transition-colors"
                    title="Unlock with Platinum"
                  >
                    <Lock className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Call History Console */}
      <CallsHistory
        currentUserId={currentUserId || ''}
        calls={callsList}
        onStartCall={(targetId, type) => startCall(targetId, type as 'audio' | 'video' | 'voice')}
      />
    </div>
  );
}
