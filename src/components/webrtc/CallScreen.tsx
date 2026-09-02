'use client';

// ==============================================================================
// PRODUCTION WEBRTC VOICE & VIDEO CALL COMPONENT
// Fully P2P Mesh with Supabase Realtime Signaling, STUN & MediaStream Controls
// ==============================================================================

import React, { useRef, useEffect, useState } from 'react';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Shield,
  Clock,
  AlertCircle,
  Volume2,
  Maximize2,
  Minimize2,
  Radio,
  Sparkles,
  Users,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';
import { CallRecord, CallStatus, ProfileSecureView } from '../../types';

interface CallScreenProps {
  activeCall: CallRecord | null;
  incomingCall: CallRecord | null;
  callStatus: CallStatus;
  partnerProfile: ProfileSecureView | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  mediaError?: string | null;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  callDuration: number;
  onAccept: () => void;
  onDecline: () => void;
  onEndCall: () => void;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onRetryMedia?: () => void;
}

export const CallScreen: React.FC<CallScreenProps> = ({
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
  onAccept,
  onDecline,
  onEndCall,
  onToggleAudio,
  onToggleVideo,
  onRetryMedia,
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const localAudioRef = useRef<HTMLAudioElement>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Bind local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Bind remote stream to video & dedicated audio element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch((err) => {
        console.warn('[WebRTC CallScreen] Autoplay remote audio policy handling:', err);
      });
    }
  }, [remoteStream]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isVideoCall = activeCall?.call_type === 'video' || incomingCall?.call_type === 'video';

  // 1. Inbound Ringing Dialog
  if (incomingCall && !activeCall) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
        <div className="bg-zinc-900 border border-emerald-500/50 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center space-y-6 shadow-2xl relative overflow-hidden">
          {/* Animated Islamic Ring Halo */}
          <div className="absolute -top-16 -left-16 w-36 h-36 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-16 -right-16 w-36 h-36 rounded-full bg-teal-500/10 blur-2xl pointer-events-none" />

          {/* Caller Avatar */}
          <div className="relative mx-auto w-24 h-24 rounded-full overflow-hidden border-2 border-emerald-500 shadow-xl shadow-emerald-950/80">
            {partnerProfile?.avatar_url ? (
              <img
                src={partnerProfile.avatar_url}
                alt={partnerProfile.full_name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                <Shield className="w-8 h-8 text-emerald-400" />
              </div>
            )}
            <div className="absolute inset-0 border-2 border-emerald-400 rounded-full animate-ping opacity-30 pointer-events-none" />
          </div>

          <div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-400 bg-emerald-950 px-3 py-1 rounded-full border border-emerald-500/30">
              Incoming {incomingCall.call_type === 'video' ? 'Video' : 'Voice'} Call
            </span>
            <h3 className="text-xl font-bold text-white mt-3">
              {partnerProfile?.full_name || 'Matrimonial Candidate'}
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              End-to-End Encrypted Shariah WebRTC Session
            </p>
          </div>

          {/* Action Buttons: Decline & Accept */}
          <div className="flex items-center justify-center gap-8 pt-2">
            <div className="text-center space-y-1.5">
              <button
                onClick={onDecline}
                className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 active:scale-95 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105"
                title="Decline Call"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
              <span className="text-[11px] text-zinc-400 font-medium">Decline</span>
            </div>

            <div className="text-center space-y-1.5">
              <button
                onClick={onAccept}
                className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105 animate-bounce"
                title="Accept Call"
              >
                <Phone className="w-6 h-6" />
              </button>
              <span className="text-[11px] text-emerald-400 font-bold">Accept</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If no active call, return null
  if (!activeCall) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/95 backdrop-blur-xl animate-in fade-in duration-200"
    >
      {/* Hidden dedicated audio element for crystal clear remote sound */}
      <audio ref={remoteAudioRef} autoPlay playsInline />
      <audio ref={localAudioRef} muted autoPlay playsInline />

      <div className="relative w-full max-w-5xl h-[88vh] bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between">
        {/* ========================================================================= */}
        {/* TOP FLOATING OVERLAY: IDENTITY & CONNECTION METRICS */}
        {/* ========================================================================= */}
        <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
          {/* Identity & Status Badge */}
          <div className="flex items-center gap-3 bg-zinc-900/80 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-zinc-800 pointer-events-auto shadow-lg">
            <div className="relative w-8 h-8 rounded-full overflow-hidden bg-zinc-800 border border-emerald-400/40 flex items-center justify-center">
              {partnerProfile?.avatar_url ? (
                <img
                  src={partnerProfile.avatar_url}
                  alt={partnerProfile.full_name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Shield className="w-4 h-4 text-emerald-400" />
              )}
            </div>

            <div>
              <p className="text-xs font-bold text-white leading-none flex items-center gap-1.5">
                {partnerProfile?.full_name || 'Matrimonial Candidate'}
                {partnerProfile?.kyc_status === 'verified' && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500" title="KYC Verified" />
                )}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    callStatus === 'active'
                      ? 'bg-emerald-500 animate-pulse'
                      : 'bg-amber-500 animate-ping'
                  }`}
                />
                <span className="text-[10px] text-zinc-300 capitalize font-medium">
                  {callStatus === 'active'
                    ? 'Connected • P2P Encrypted'
                    : callStatus === 'connecting'
                    ? 'Connecting signaling mesh...'
                    : callStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Call Timer & Fullscreen toggle */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <div className="flex items-center gap-1.5 bg-zinc-900/80 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-zinc-800 text-xs font-mono text-emerald-400 shadow-lg">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>{formatDuration(callDuration)}</span>
            </div>

            <button
              onClick={toggleFullscreen}
              className="p-2.5 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 backdrop-blur-md transition-colors shadow-lg"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* VIDEO DISPLAY STAGE */}
        {/* ========================================================================= */}
        <div className="relative flex-1 w-full bg-zinc-950 flex items-center justify-center overflow-hidden">
          {isVideoCall ? (
            <>
              {/* REMOTE VIDEO STREAM (Full Screen Stage) */}
              <div className="relative w-full h-full flex items-center justify-center bg-zinc-900">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />

                {/* If remote stream is not yet transmitting, render candidate placeholder */}
                {!remoteStream && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-zinc-900 to-zinc-950 text-center p-6 space-y-4">
                    <div className="relative w-28 h-28 rounded-full overflow-hidden border-2 border-emerald-500/40 shadow-2xl shadow-emerald-950">
                      {partnerProfile?.avatar_url ? (
                        <img
                          src={partnerProfile.avatar_url}
                          alt={partnerProfile.full_name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                          <Shield className="w-10 h-10 text-emerald-400" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-base font-bold text-white">
                        {partnerProfile?.full_name || 'Matrimonial Candidate'}
                      </h4>
                      <p className="text-xs text-zinc-400 flex items-center justify-center gap-2">
                        <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                        <span>Negotiating secure P2P WebRTC connection...</span>
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* LOCAL SELF-VIEW (Picture-in-Picture Floating Window) */}
              <div className="absolute bottom-24 right-4 sm:bottom-28 sm:right-6 w-32 h-44 sm:w-44 sm:h-56 bg-zinc-900 border-2 border-zinc-700/80 rounded-2xl overflow-hidden shadow-2xl z-20 transition-all hover:scale-105">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover scale-x-[-1] ${
                    isVideoOff ? 'hidden' : 'block'
                  }`}
                />

                {/* Local camera off placeholder */}
                {isVideoOff && (
                  <div className="w-full h-full bg-zinc-900 flex flex-col items-center justify-center text-zinc-400 p-2 text-center">
                    <VideoOff className="w-6 h-6 text-zinc-500 mb-1" />
                    <span className="text-[10px] font-semibold">Camera Off</span>
                  </div>
                )}

                <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-md rounded-md text-[9px] font-bold text-white">
                  You {isAudioMuted && '• Muted'}
                </div>
              </div>
            </>
          ) : (
            /* AUDIO ONLY CALL STAGE */
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-zinc-900 to-zinc-950 text-center p-6 space-y-6">
              <div className="relative w-36 h-36 rounded-full overflow-hidden border-4 border-emerald-500/40 shadow-2xl shadow-emerald-950/80">
                {partnerProfile?.avatar_url ? (
                  <img
                    src={partnerProfile.avatar_url}
                    alt={partnerProfile.full_name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                    <Shield className="w-14 h-14 text-emerald-400" />
                  </div>
                )}
                {callStatus === 'active' && (
                  <div className="absolute inset-0 border-2 border-emerald-400 rounded-full animate-ping opacity-30 pointer-events-none" />
                )}
              </div>

              <div className="space-y-1">
                <h4 className="text-xl font-bold text-white">
                  {partnerProfile?.full_name || 'Matrimonial Candidate'}
                </h4>
                <p className="text-xs text-zinc-400">
                  {callStatus === 'active'
                    ? 'Encrypted High-Definition Voice Session Active'
                    : 'Connecting Voice Session...'}
                </p>
              </div>

              {/* Audio Pulse Bars Indicator */}
              {callStatus === 'active' && (
                <div className="flex items-center justify-center gap-1.5 h-6">
                  <span className="w-1 h-3 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1 h-5 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1 h-6 bg-emerald-500 rounded-full animate-bounce" />
                  <span className="w-1 h-4 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.2s]" />
                  <span className="w-1 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.4s]" />
                </div>
              )}
            </div>
          )}

          {/* Media Permission / Hardware Error Toast */}
          {mediaError && (
            <div className="absolute top-20 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-30 p-3.5 bg-red-950/90 border border-red-500/50 rounded-2xl text-red-200 text-xs flex items-center gap-3 backdrop-blur-md shadow-2xl">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-white">Device Access Notice</p>
                <p className="text-[11px] text-red-300 mt-0.5">{mediaError}</p>
              </div>
              {onRetryMedia && (
                <button
                  onClick={onRetryMedia}
                  className="p-1.5 bg-red-800 hover:bg-red-700 rounded-xl text-white transition-colors"
                  title="Retry media devices"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* BOTTOM CALL CONTROLS BAR: MUTE, CAMERA, END CALL */}
        {/* ========================================================================= */}
        <div className="p-4 sm:p-6 bg-zinc-900/90 border-t border-zinc-800 flex items-center justify-center gap-4 sm:gap-6 z-20 backdrop-blur-md">
          {/* MUTE AUDIO BUTTON */}
          <button
            onClick={onToggleAudio}
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg active:scale-95 ${
              isAudioMuted
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white'
            }`}
            title={isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {isAudioMuted ? (
              <MicOff className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            ) : (
              <Mic className="w-5 h-5 sm:w-6 sm:h-6" />
            )}
          </button>

          {/* TOGGLE VIDEO CAMERA BUTTON (If video call) */}
          {isVideoCall && (
            <button
              onClick={onToggleVideo}
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg active:scale-95 ${
                isVideoOff
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white'
              }`}
              title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
            >
              {isVideoOff ? (
                <VideoOff className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              ) : (
                <Video className="w-5 h-5 sm:w-6 sm:h-6" />
              )}
            </button>
          )}

          {/* END CALL BUTTON */}
          <button
            onClick={onEndCall}
            className="w-14 h-12 sm:w-20 sm:h-14 rounded-2xl bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg transition-all active:scale-95 hover:scale-105"
            title="End Call Session"
          >
            <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
