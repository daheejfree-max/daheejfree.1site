// ==============================================================================
// 2-WAY PHOTO CONSENT HOOK (STRICT EXCLUSIVE PHOTO PRIVACY - TASK 6)
// Backed by public.photo_permissions table and Supabase Realtime
// Ensures avatars are blurred/hidden by default and exposed ONLY upon approved consent.
// ==============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { PhotoPermission, ConsentStatus } from '../types';
import { daheejStore } from '../lib/supabase/store';
import { supabase } from '../lib/supabase/client';

export function usePhotoConsent(currentUserId: string | null) {
  const [consentRequests, setConsentRequests] = useState<PhotoPermission[]>(() =>
    daheejStore.getConsentRequests()
  );
  const isFetchingRef = useRef<boolean>(false);

  const refreshRequests = useCallback(() => {
    setConsentRequests(daheejStore.getConsentRequests());
  }, []);

  // Fetch from Supabase photo_permissions table and sync locally
  useEffect(() => {
    if (!currentUserId) return;
    let isMounted = true;

    async function fetchRemotePhotoPermissions() {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      try {
        // 1. Fetch Inbound and Outbound permissions with two-step bulletproof query
        let permData: any[] | null = null;

        const { data: directData, error: directErr } = await supabase
          .from('photo_permissions')
          .select('id, status, created_at, updated_at, requestor_id, target_id')
          .or(`target_id.eq.${currentUserId},requestor_id.eq.${currentUserId}`);

        if (!directErr && directData) {
          permData = directData;
        } else {
          // Fallback flat select with target_user_id / requester_id
          const { data: flatData } = await supabase
            .from('photo_permissions')
            .select('*')
            .or(`target_id.eq.${currentUserId},requestor_id.eq.${currentUserId},target_user_id.eq.${currentUserId},requester_id.eq.${currentUserId}`);
          if (flatData) {
            permData = flatData;
          }
        }

        let rawRows: any[] = [];

        if (permData && permData.length > 0) {
          rawRows = permData.map((r: any) => {
            const reqId = r.requestor_id || r.requester_id;
            const tgtId = r.target_id || r.target_user_id;
            const profileJoined = r.profiles || r.requester;
            return {
              id: r.id,
              requester_id: reqId,
              requestor_id: reqId,
              target_user_id: tgtId,
              target_id: tgtId,
              status: r.status,
              created_at: r.created_at,
              updated_at: r.updated_at,
              requester: profileJoined || null,
              target: r.target || null,
            };
          });
        }

        if (rawRows.length > 0 && isMounted) {
          const missingProfileIds = new Set<string>();

          rawRows.forEach((row: any) => {
            const reqId = row.requester_id || row.requestor_id;
            const tgtId = row.target_user_id || row.target_id;

            if (row.target && tgtId) {
              daheejStore.setProfileFromRemote({ id: tgtId, ...row.target } as any);
            } else if (tgtId) {
              missingProfileIds.add(tgtId);
            }

            if (row.requester && reqId) {
              daheejStore.setProfileFromRemote({ id: reqId, ...row.requester } as any);
            } else if (reqId) {
              missingProfileIds.add(reqId);
            }

            const mappedPerm: PhotoPermission = {
              id: row.id || `perm_${reqId}_${tgtId}`,
              requester_id: reqId,
              target_user_id: tgtId,
              target_id: tgtId,
              status: row.status === 'accepted' ? 'approved' : (row.status || 'pending'),
              created_at: row.created_at || new Date().toISOString(),
              updated_at: row.updated_at || new Date().toISOString(),
              target: row.target || null,
              requester: row.requester || null,
            };

            daheejStore.updateConsentStatus(
              mappedPerm.id,
              mappedPerm.status === 'approved' ? 'accepted' : mappedPerm.status
            );
          });

          // Fetch missing profiles if join did not return full profile objects
          if (missingProfileIds.size > 0) {
            const { data: fetchedProfiles } = await supabase
              .from('profiles')
              .select('id, full_name, location, profession, avatar_url, age, gender, city, kyc_status, wali_name, bio, education')
              .in('id', Array.from(missingProfileIds));

            if (fetchedProfiles && fetchedProfiles.length > 0) {
              fetchedProfiles.forEach((p: any) => {
                if (p && p.id) {
                  daheejStore.setProfileFromRemote(p);
                }
              });
            }
          }

          if (isMounted) {
            refreshRequests();
          }
        }
      } catch (err) {
        console.warn('[usePhotoConsent] Supabase fetch notice:', err);
      } finally {
        isFetchingRef.current = false;
      }
    }

    fetchRemotePhotoPermissions();

    // Supabase Realtime listener on photo_permissions
    const channelId = `photo_permissions_realtime_${currentUserId}_${Date.now()}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'photo_permissions',
        },
        (payload) => {
          if (!isMounted) return;
          // Optimistically handle inserts and updates
          const newRecord = payload.new as any;
          if (newRecord) {
            const reqId = newRecord.requestor_id || newRecord.requester_id;
            const tgtId = newRecord.target_id || newRecord.target_user_id;
            if (tgtId === currentUserId || reqId === currentUserId) {
              fetchRemotePhotoPermissions();
            }
          } else {
            fetchRemotePhotoPermissions();
          }
        }
      )
      .subscribe();

    const unsubStore = daheejStore.subscribe((event) => {
      if (event.table === 'consent_requests') {
        refreshRequests();
      }
    });

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
      unsubStore();
    };
  }, [currentUserId, refreshRequests]);

  const hasPhotoAccess = useCallback(
    (targetProfileId: string): boolean => {
      if (!currentUserId) return false;
      if (currentUserId === targetProfileId) return true;
      return daheejStore.hasAcceptedPhotoConsent(currentUserId, targetProfileId);
    },
    [currentUserId, consentRequests]
  );

  const getConsentStatus = useCallback(
    (targetProfileId: string): ConsentStatus | 'none' => {
      if (!currentUserId) return 'none';
      if (currentUserId === targetProfileId) return 'accepted';
      return daheejStore.getConsentStatusBetween(currentUserId, targetProfileId);
    },
    [currentUserId, consentRequests]
  );

  const sendRequest = async (targetProfileId: string): Promise<PhotoPermission | null> => {
    if (!currentUserId || currentUserId === targetProfileId) return null;
    const req = daheejStore.sendConsentRequest(currentUserId, targetProfileId);
    refreshRequests();

    // Sync to Supabase photo_permissions table
    try {
      await supabase.from('photo_permissions').upsert(
        {
          requestor_id: currentUserId,
          target_id: targetProfileId,
          status: 'pending',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'requestor_id,target_id' }
      );
    } catch (e) {
      // Fallback via backend API
      try {
        await fetch('/api/photo-permissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requesterId: currentUserId,
            targetUserId: targetProfileId,
            status: 'pending',
          }),
        });
      } catch (apiErr) {
        console.warn('[usePhotoConsent] Backend API fallback notice:', apiErr);
      }
    }

    return req as any as any;
  };

  const acceptRequest = async (requestId: string, requesterId?: string) => {
    const updated = daheejStore.updateConsentStatus(requestId, 'accepted');
    refreshRequests();

    // Sync to Supabase photo_permissions
    try {
      await supabase
        .from('photo_permissions')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', requestId);

      if (requesterId && currentUserId) {
        await supabase
          .from('photo_permissions')
          .update({ status: 'approved', updated_at: new Date().toISOString() })
          .or(`and(requestor_id.eq.${requesterId},target_id.eq.${currentUserId}),and(requester_id.eq.${requesterId},target_user_id.eq.${currentUserId})`);
      }
    } catch (e) {
      console.warn('[usePhotoConsent] Supabase update photo_permissions fallback:', e);
    }

    return updated;
  };

  const rejectRequest = async (requestId: string, requesterId?: string) => {
    const updated = daheejStore.updateConsentStatus(requestId, 'rejected');
    refreshRequests();

    // Sync to Supabase photo_permissions
    try {
      await supabase
        .from('photo_permissions')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', requestId);

      if (requesterId && currentUserId) {
        await supabase
          .from('photo_permissions')
          .update({ status: 'rejected', updated_at: new Date().toISOString() })
          .or(`and(requestor_id.eq.${requesterId},target_id.eq.${currentUserId}),and(requester_id.eq.${requesterId},target_user_id.eq.${currentUserId})`);
      }
    } catch (e) {
      console.warn('[usePhotoConsent] Supabase reject photo_permissions fallback:', e);
    }

    return updated;
  };

  const revokeConsent = async (targetProfileId: string) => {
    if (!currentUserId || !targetProfileId) return;
    const reqs = daheejStore.getConsentRequests();
    const match = reqs.find(
      (r) =>
        (r.requester_id === currentUserId && (r.target_user_id === targetProfileId || r.target_id === targetProfileId)) ||
        (r.requester_id === targetProfileId && (r.target_user_id === currentUserId || r.target_id === currentUserId))
    );

    if (match) {
      daheejStore.updateConsentStatus(match.id, 'rejected');
    }
    refreshRequests();

    try {
      await supabase
        .from('photo_permissions')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .or(`and(requestor_id.eq.${currentUserId},target_id.eq.${targetProfileId}),and(requestor_id.eq.${targetProfileId},target_id.eq.${currentUserId})`);
    } catch (e) {
      console.warn('[usePhotoConsent] Revoke notice:', e);
    }
  };

  const grantInstantConsent = async (targetProfileId: string) => {
    if (!currentUserId || !targetProfileId) return;
    const req = daheejStore.sendConsentRequest(currentUserId, targetProfileId);
    daheejStore.updateConsentStatus(req.id, 'accepted');
    refreshRequests();

    try {
      await supabase.from('photo_permissions').upsert(
        {
          requestor_id: currentUserId,
          target_id: targetProfileId,
          status: 'approved',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'requestor_id,target_id' }
      );
    } catch (e) {
      console.warn('[usePhotoConsent] Instant grant notice:', e);
    }
  };

  // Inbound requests targeted to current user
  const inboundRequests = consentRequests.filter(
    (r) => currentUserId && ((r as any as any).target_id === currentUserId || r.target_user_id === currentUserId)
  );

  // Outbound requests sent by current user
  const outboundRequests = consentRequests.filter(
    (r) => currentUserId && (r.requester_id === currentUserId || (r as any).requestor_id === currentUserId)
  );

  return {
    consentRequests,
    inboundRequests,
    outboundRequests,
    hasPhotoAccess,
    getConsentStatus,
    sendRequest,
    acceptRequest,
    rejectRequest,
    revokeConsent,
    grantInstantConsent,
  };
}
