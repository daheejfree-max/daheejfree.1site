'use client';

// ==============================================================================
// CALL ROOM ROUTE (src/app/call/[roomID]/page.tsx)
// Dynamic 1-on-1 Video & Voice Calling Page with WebRTC & Realtime Signaling
// ==============================================================================

import React, { useEffect, useState } from 'react';
import CallRoom from '../../../components/CallRoom';
import { supabase } from '../../../lib/supabase/client';
import { daheejStore } from '../../../lib/supabase/store';
import { PhoneOff } from 'lucide-react';

interface CallPageProps {
  params?: Promise<{ roomID: string }> | { roomID: string };
  roomID?: string;
  type?: 'video' | 'voice' | 'audio';
  role?: 'caller' | 'receiver';
}

export default function CallPage({ params, roomID: propRoomID, type: propType, role: propRole }: CallPageProps) {
  const [roomID, setRoomID] = useState<string>(propRoomID || '');
  const [callType, setCallType] = useState<'video' | 'voice' | 'audio'>(propType || 'video');
  const [role, setRole] = useState<'caller' | 'receiver'>(propRole || 'caller');
  const [partnerName, setPartnerName] = useState<string>('Matrimonial Candidate');
  const [partnerAvatar, setPartnerAvatar] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function initCallSession() {
      try {
        setIsLoading(true);

        // 1. Resolve roomID, callType, and role
        let resolvedRoom = propRoomID || '';
        let resolvedType: 'video' | 'voice' | 'audio' = propType || 'video';
        let resolvedRole: 'caller' | 'receiver' = propRole || 'caller';
        let explicitPartnerName = '';
        let explicitPartnerId = '';

        if (typeof window !== 'undefined') {
          const searchParams = new URLSearchParams(window.location.search);
          const rawType = searchParams.get('callType') || searchParams.get('type');
          if (rawType === 'voice' || rawType === 'audio') {
            resolvedType = 'voice';
          } else if (rawType === 'video') {
            resolvedType = 'video';
          }

          const rawRole = searchParams.get('role');
          if (rawRole === 'receiver') {
            resolvedRole = 'receiver';
          } else if (rawRole === 'caller') {
            resolvedRole = 'caller';
          }

          explicitPartnerName =
            searchParams.get('partnerName') ||
            searchParams.get('receiverName') ||
            searchParams.get('callerName') ||
            '';
          explicitPartnerId =
            searchParams.get('partnerId') ||
            searchParams.get('receiverId') ||
            searchParams.get('callerId') ||
            searchParams.get('targetId') ||
            '';
        }

        if (!resolvedRoom && params) {
          const resolvedParams = await Promise.resolve(params);
          if (resolvedParams?.roomID) {
            resolvedRoom = resolvedParams.roomID;
          }
        }

        if (!resolvedRoom && typeof window !== 'undefined') {
          const pathSegments = window.location.pathname.split('/').filter(Boolean);
          const callIdx = pathSegments.indexOf('call');
          if (callIdx !== -1 && pathSegments[callIdx + 1]) {
            resolvedRoom = pathSegments[callIdx + 1];
          }
          if (!resolvedRoom) {
            const searchParams = new URLSearchParams(window.location.search);
            resolvedRoom = searchParams.get('roomID') || searchParams.get('roomId') || searchParams.get('room') || '';
          }
        }

        // 2. Resolve Authenticated User ID
        const { data: sessionData } = await supabase.auth.getSession();
        let currentAuthUser = sessionData?.session?.user;

        if (!currentAuthUser) {
          const { data: userData } = await supabase.auth.getUser();
          currentAuthUser = userData?.user || null;
        }

        const myUserId = currentAuthUser?.id || daheejStore.getCurrentUserId() || '';
        const myProfile = myUserId ? daheejStore.getProfileById(myUserId) : null;
        const myName = myProfile?.full_name || currentAuthUser?.user_metadata?.full_name || '';

        // 3. Resolve Partner's ID & Name (STRICTLY NOT own name or own ID!)
        let resolvedPartnerId = explicitPartnerId;
        if (!resolvedPartnerId && resolvedRoom && resolvedRoom.startsWith('room_')) {
          const rawSegments = resolvedRoom.replace('room_', '').split('_');
          // filter out timestamps
          const userSegments = rawSegments.filter(s => s && s.length > 3 && isNaN(Number(s)));
          if (userSegments.length >= 2) {
            resolvedPartnerId = (userSegments[0] === myUserId || (myUserId && userSegments[0].includes(myUserId)))
              ? userSegments[1]
              : userSegments[0];
          } else if (rawSegments.length >= 2) {
            resolvedPartnerId = (rawSegments[0] === myUserId) ? rawSegments[1] : rawSegments[0];
          }
        }

        let resolvedPartnerName = explicitPartnerName;
        let resolvedPartnerAvatar: string | null = null;

        // If explicit name matches own name, discard it
        if (resolvedPartnerName && myName && resolvedPartnerName.trim().toLowerCase() === myName.trim().toLowerCase()) {
          resolvedPartnerName = '';
        }

        if (resolvedPartnerId && resolvedPartnerId !== myUserId) {
          const localPartner = daheejStore.getProfileById(resolvedPartnerId);
          if (localPartner?.full_name && localPartner.full_name !== myName) {
            resolvedPartnerName = resolvedPartnerName || localPartner.full_name;
            resolvedPartnerAvatar = localPartner.avatar_url || null;
          } else {
            try {
              const { data: partnerRow } = await supabase
                .from('profiles')
                .select('full_name, avatar_url')
                .eq('id', resolvedPartnerId)
                .maybeSingle();

              if (partnerRow?.full_name && partnerRow.full_name !== myName) {
                resolvedPartnerName = resolvedPartnerName || partnerRow.full_name;
                resolvedPartnerAvatar = partnerRow.avatar_url || null;
              }
            } catch (dbErr) {
              console.warn('[CallPage] Partner profile query fallback notice:', dbErr);
            }
          }
        }

        // Check active call record in store if still unnamed
        if (!resolvedPartnerName || resolvedPartnerName === myName) {
          const allCalls = daheejStore.getCallHistory();
          const matchCall = allCalls.find(c => c.id === resolvedRoom || resolvedRoom.includes(c.id));
          if (matchCall) {
            const partnerId = matchCall.caller_id === myUserId ? matchCall.recipient_id : matchCall.caller_id;
            if (partnerId && partnerId !== myUserId) {
              const p = daheejStore.getProfileById(partnerId);
              if (p?.full_name) {
                resolvedPartnerName = p.full_name;
                resolvedPartnerAvatar = p.avatar_url || null;
              }
            }
          }
        }

        if (!resolvedPartnerName || resolvedPartnerName === myName) {
          resolvedPartnerName = resolvedRole === 'caller' ? 'Matched Spouse' : 'Matrimonial Suitor';
        }

        if (isMounted) {
          setRoomID(resolvedRoom);
          setCallType(resolvedType);
          setRole(resolvedRole);
          setPartnerName(resolvedPartnerName);
          setPartnerAvatar(resolvedPartnerAvatar);
        }
      } catch (err: any) {
        console.error('[CallPage] Initialization error:', err);
        if (isMounted) {
          setErrorMsg('Unable to initialize call connection.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initCallSession();

    return () => {
      isMounted = false;
    };
  }, [params, propRoomID, propType, propRole]);

  if (isLoading) {
    return (
      <div className="w-screen h-[100dvh] bg-zinc-950 flex flex-col items-center justify-center text-white space-y-4 px-4">
        <div className="w-12 h-12 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <h2 className="text-base font-semibold">Connecting to Secure Call Room...</h2>
        <p className="text-xs text-zinc-400">Verifying Shariah privacy and WebRTC encryption</p>
      </div>
    );
  }

  if (errorMsg || !roomID) {
    return (
      <div className="w-screen h-[100dvh] bg-zinc-950 flex flex-col items-center justify-center p-4 text-center pb-safe">
        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl max-w-md w-full space-y-5 shadow-2xl text-white">
          <div className="w-14 h-14 rounded-2xl bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 flex items-center justify-center mx-auto shadow-inner">
            <PhoneOff className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold">Secure Nikah Call Room</h2>
            <p className="text-xs text-zinc-400">
              {errorMsg || 'Connect with matched spouse candidates via end-to-end encrypted WebRTC.'}
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              onClick={() => {
                const newRoom = `room_nikah_${Math.random().toString(36).substring(2, 8)}`;
                const newUrl = `/call/${newRoom}?callType=video&role=caller`;
                setRoomID(newRoom);
                setRole('caller');
                if (typeof window !== 'undefined') {
                  window.history.pushState({ tab: 'call' }, '', newUrl);
                }
              }}
              className="w-full min-h-[44px] py-3 px-4 rounded-2xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 active:scale-[0.98]"
            >
              Start Instant Call Room
            </button>

            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  if (window.opener && !window.opener.closed) {
                    window.close();
                  } else {
                    window.history.pushState({ tab: 'messages' }, '', '/messages');
                    window.dispatchEvent(new CustomEvent('app:navigate', { detail: { path: '/messages', tab: 'messages' } }));
                  }
                }
              }}
              className="w-full min-h-[44px] py-3 px-4 rounded-2xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-800 text-zinc-300 transition-colors cursor-pointer flex items-center justify-center border border-zinc-700"
            >
              Return to Messages
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <CallRoom
      roomID={roomID}
      roomId={roomID}
      callType={callType === 'audio' ? 'voice' : callType}
      userName={partnerName}
      partnerAvatar={partnerAvatar}
      role={role}
    />
  );
}
