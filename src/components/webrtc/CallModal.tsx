'use client';

// ==============================================================================
// WEBRTC CALL MODAL WITH PICTURE-IN-PICTURE & ENCRYPTED CONTROLS
// ==============================================================================

import React, { useRef, useEffect } from 'react';
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
} from 'lucide-react';
import { CallRecord, CallStatus, ProfileSecureView } from '../../types';

interface CallModalProps {
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
}

export const CallModal: React.FC<CallModalProps> = ({
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
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const localAudioRef = useRef<HTMLAudioElement>(null);

  // Attach local stream to video/audio elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Attach remote stream to video element and ensure remote audio element plays
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch((err) => {
        console.warn('[WebRTC CallModal] Remote audio autoplay error:', err);
      });
    }
  }, [remoteStream]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Inbound Call Notification Overlay
  if (incomingCall && !activeCall) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
        <div className="bg-zinc-900 border border-emerald-500/50 rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center space-y-6 shadow-2xl">
          <div className="relative mx-auto w-24 h-24 rounded-full overflow-hidden border-2 border-emerald-500 shadow-xl shadow-emerald-950/60 animate-pulse">
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
          </div>

          <div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-400 bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
              Incoming {incomingCall.call_type === 'video' ? 'Video' : 'Voice'} Call
            </span>
            <h3 className="text-xl font-bold text-white mt-2">
              {partnerProfile?.full_name || 'Matrimonial Candidate'}
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">End-to-End Encrypted WebRTC Session</p>
          </div>

          <div className="flex items-center justify-center gap-6 pt-2">
            <button
              onClick={onDecline}
              className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110"
              title="Decline"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
            <button
              onClick={onAccept}
              className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110 animate-bounce"
              title="Accept"
            >
              <Phone className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active / Connecting Call Window
  if (!activeCall) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/90 backdrop-blur-lg">
      {/* Hidden dedicated audio elements for remote stream playback */}
      <audio ref={remoteAudioRef} autoPlay playsInline />
      <audio ref={localAudioRef} muted autoPlay playsInline />

      <div className="relative w-full max-w-4xl h-[85vh] bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between">
        {/* Top Floating Overlay */}
        <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-3 bg-zinc-900/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-zinc-800 pointer-events-auto">
            <Shield className="w-4 h-4 text-emerald-400" />
            <div>
              <p className="text-xs font-bold text-white leading-none">
                {partnerProfile?.full_name || 'Candidate'}
              </p>
              <p className="text-[10px] text-zinc-400 capitalize">
                {callStatus === 'connecting' ? 'Connecting P2P Session...' : callStatus}
              </p>
            </div>
          </div>

          {callStatus === 'active' && (
            <div className="flex items-center gap-2 bg-zinc-900/80 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-zinc-800 pointer-events-auto">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-mono font-bold text-emerald-300">
                {formatTime(callDuration)}
              </span>
            </div>
          )}
        </div>

        {/* Media Permission Warning Banner */}
        {mediaError && (
          <div className="absolute top-16 left-4 right-4 z-30 bg-amber-950/90 border border-amber-600/60 rounded-2xl p-3 flex items-center gap-3 text-amber-200 text-xs shadow-lg backdrop-blur-md">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{mediaError}</span>
          </div>
        )}

        {/* Video / Remote Audio Stage */}
        <div className="relative flex-1 bg-zinc-950 flex items-center justify-center overflow-hidden">
          {activeCall.call_type === 'video' ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center space-y-4">
              <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-emerald-500/40 shadow-2xl mx-auto">
                {partnerProfile?.avatar_url ? (
                  <img
                    src={partnerProfile.avatar_url}
                    alt={partnerProfile.full_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                    <Shield className="w-10 h-10 text-emerald-400" />
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{partnerProfile?.full_name}</h3>
                <p className="text-xs text-zinc-400">Encrypted Shariah Voice Call</p>
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-[11px] text-emerald-300">
                  <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                  <span>Audio Channel Active</span>
                </div>
              </div>
            </div>
          )}

          {/* Local Camera (Picture-in-Picture) */}
          {activeCall.call_type === 'video' && (
            <div className="absolute bottom-4 right-4 w-32 sm:w-44 aspect-video bg-zinc-900 border-2 border-zinc-700 rounded-2xl overflow-hidden shadow-2xl z-20">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
              />
              {isVideoOff && (
                <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-[10px] text-zinc-500">
                  Camera Off
                </div>
              )}
            </div>
          )}
        </div>

        {/* Floating Call Bottom Bar Controls Hub */}
        <div className="p-4 sm:p-5 bg-zinc-900/95 border-t border-zinc-800 backdrop-blur-xl flex items-center justify-center gap-4 sm:gap-8 z-20">
          {/* Mute / Unmute Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              id="btn-call-mute-toggle"
              onClick={onToggleAudio}
              aria-label={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
              aria-pressed={isAudioMuted}
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center transition-all duration-200 shadow-md ${
                isAudioMuted
                  ? 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30'
                  : 'bg-zinc-800 text-zinc-100 border border-zinc-700 hover:bg-zinc-750 hover:border-zinc-600'
              } active:scale-95`}
              title={isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            >
              {isAudioMuted ? (
                <MicOff className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" />
              ) : (
                <Mic className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
              )}
            </button>
            <span className="text-[11px] font-medium text-zinc-300 select-none">
              {isAudioMuted ? 'Unmute' : 'Mute'}
            </span>
          </div>

          {/* Camera On / Off Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              id="btn-call-camera-toggle"
              onClick={onToggleVideo}
              aria-label={isVideoOff ? 'Turn camera on' : 'Turn camera off'}
              aria-pressed={isVideoOff}
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center transition-all duration-200 shadow-md ${
                isVideoOff
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50 hover:bg-amber-500/30'
                  : 'bg-zinc-800 text-zinc-100 border border-zinc-700 hover:bg-zinc-750 hover:border-zinc-600'
              } active:scale-95`}
              title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
            >
              {isVideoOff ? (
                <VideoOff className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
              ) : (
                <Video className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
              )}
            </button>
            <span className="text-[11px] font-medium text-zinc-300 select-none">
              {isVideoOff ? 'Start Video' : 'Stop Video'}
            </span>
          </div>

          {/* End Call Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              id="btn-call-end-session"
              onClick={onEndCall}
              aria-label="End call"
              className="w-14 h-12 sm:w-16 sm:h-14 rounded-2xl bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-950/50 transition-all duration-200 hover:scale-105 active:scale-95 border border-red-500"
              title="End Call Session"
            >
              <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <span className="text-[11px] font-semibold text-red-400 select-none">
              End Call
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
