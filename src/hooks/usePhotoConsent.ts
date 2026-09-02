// ==============================================================================
// 2-WAY PHOTO CONSENT HOOK (STRICT EXCLUSIVE PHOTO PRIVACY - TASK 6)
// Backed by public.photo_permissions table, Supabase Realtime & Heartbeat Polling
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

  // Fetch from Supabase / Backend API and sync with store
  const fetchRemotePhotoPermissions = useCallback(async () => {
    if (!currentUserId || isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      let rawRows: any[] = [];

      // 1. Try direct Supabase query
      try {
        const { data: directData, error: directErr } = await supabase
          .from('photo_permissions')
          .select('id, status, created_at, updated_at, requestor_id, target_id')
          .or(`target_id.eq.${currentUserId},requestor_id.eq.${currentUserId}`);

        if (!directErr && directData && directData.length > 0) {
          rawRows = directData;
        } else {
          const { data: flatData } = await supabase
            .from('photo_permissions')
            .select('*')
            .or(`target_id.eq.${currentUserId},requestor_id.eq.${currentUserId},target_user_id.eq.${currentUserId},requester_id.eq.${currentUserId}`);
          if (flatData && flatData.length > 0) {
            rawRows = flatData;
          }
        }
      } catch (sbErr) {
        console.warn('[usePhotoConsent] Supabase direct query note:', sbErr);
      }

      // 2. Fallback to backend API if needed
      if (rawRows.length === 0) {
        try {
          const res = await fetch(`/api/photo-permissions?userId=${encodeURIComponent(currentUserId)}`);
          if (res.ok) {
            const json = await res.json();
            if (json.success && Array.isArray(json.permissions) && json.permissions.length > 0) {
              rawRows = json.permissions;
            }
          }
        } catch (apiErr) {
          console.warn('[usePhotoConsent] Backend API fetch note:', apiErr);
        }
      }

      if (rawRows.length > 0) {
        const missingProfileIds = new Set<string>();

        rawRows.forEach((row: any) => {
          const reqId = row.requestor_id || row.requester_id || '';
          const tgtId = row.target_id || row.target_user_id || '';

          if (row.target && tgtId) {
            daheejStore.setProfileFromRemote({ id: tgtId, ...row.target } as any);
          } else if (tgtId && tgtId !== currentUserId) {
            missingProfileIds.add(tgtId);
          }

          if (row.requester && reqId) {
            daheejStore.setProfileFromRemote({ id: reqId, ...row.requester } as any);
          } else if (reqId && reqId !== currentUserId) {
            missingProfileIds.add(reqId);
          }

          const normStatus = row.status === 'approved' ? 'accepted' : (row.status || 'pending');

          daheejStore.upsertConsentRequest({
            id: row.id || `perm_${reqId}_${tgtId}`,
            requester_id: reqId,
            target_user_id: tgtId,
            target_id: tgtId,
            status: normStatus,
            created_at: row.created_at || new Date().toISOString(),
            updated_at: row.updated_at || new Date().toISOString(),
          });
        });

        // Fetch missing profile metadata in background
        if (missingProfileIds.size > 0) {
          try {
            const { data: fetchedProfiles } = await supabase
              .from('profiles')
              .select('id, full_name, location, profession, avatar_url, age, gender, city, kyc_status, wali_name, bio, education, photo_privacy, photo_privacy_mode')
              .in('id', Array.from(missingProfileIds));

            if (fetchedProfiles && fetchedProfiles.length > 0) {
              fetchedProfiles.forEach((p: any) => {
                if (p && p.id) {
                  daheejStore.setProfileFromRemote(p);
                }
              });
            }
          } catch (profErr) {
            console.warn('[usePhotoConsent] Profile metadata fetch note:', profErr);
          }
        }

        refreshRequests();
      }
    } catch (err) {
      console.warn('[usePhotoConsent] Sync error:', err);
    } finally {
      isFetchingRef.current = false;
    }
  }, [currentUserId, refreshRequests]);

  // Initial fetch and Realtime + Heartbeat subscriptions
  useEffect(() => {
    if (!currentUserId) return;
    let isMounted = true;

    fetchRemotePhotoPermissions();

    // 2.5s Heartbeat polling for real-time photo consent updates across clients
    const heartbeatInterval = setInterval(() => {
      if (isMounted) {
        fetchRemotePhotoPermissions();
      }
    }, 2500);

    // Supabase Realtime listener on photo_permissions
    const channelId = `photo_perm_sub_${currentUserId}_${Date.now()}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'photo_permissions',
        },
        () => {
          if (isMounted) {
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
      clearInterval(heartbeatInterval);
      supabase.removeChannel(channel);
      unsubStore();
    };
  }, [currentUserId, fetchRemotePhotoPermissions, refreshRequests]);

  const hasPhotoAccess = useCallback(
    (targetProfileId: string): boolean => {
      if (!currentUserId || !targetProfileId) return false;
      if (currentUserId === targetProfileId) return true;
      return daheejStore.hasAcceptedPhotoConsent(currentUserId, targetProfileId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUserId, consentRequests]
  );

  const getConsentStatus = useCallback(
    (targetProfileId: string): ConsentStatus | 'none' => {
      if (!currentUserId || !targetProfileId) return 'none';
      if (currentUserId === targetProfileId) return 'accepted';
      return daheejStore.getConsentStatusBetween(currentUserId, targetProfileId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUserId, consentRequests]
  );

  const sendRequest = async (targetProfileId: string): Promise<PhotoPermission | null> => {
    if (!currentUserId || currentUserId === targetProfileId) return null;
    
    // 1. Optimistic store update
    const req = daheejStore.sendConsentRequest(currentUserId, targetProfileId);
    refreshRequests();

    // 2. Sync to Supabase photo_permissions table
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
      console.warn('[usePhotoConsent] Supabase upsert note:', e);
    }

    // 3. Fallback via backend API
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

    return req as any;
  };

  const acceptRequest = async (requestId: string, requesterId?: string) => {
    if (!currentUserId) return null;
    
    // 1. Update local store
    const updated = daheejStore.updateConsentStatus(requestId, 'accepted', requesterId, currentUserId);
    refreshRequests();

    // 2. Sync to Supabase
    try {
      if (requestId && !requestId.startsWith('req_')) {
        await supabase
          .from('photo_permissions')
          .update({ status: 'approved', updated_at: new Date().toISOString() })
          .eq('id', requestId);
      }

      if (requesterId) {
        await supabase
          .from('photo_permissions')
          .update({ status: 'approved', updated_at: new Date().toISOString() })
          .or(`and(requestor_id.eq.${requesterId},target_id.eq.${currentUserId}),and(requester_id.eq.${requesterId},target_user_id.eq.${currentUserId})`);
      }
    } catch (e) {
      console.warn('[usePhotoConsent] Supabase update photo_permissions fallback:', e);
    }

    // 3. Backend API sync
    try {
      await fetch('/api/photo-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: requestId,
          requesterId: requesterId,
          targetUserId: currentUserId,
          status: 'approved',
        }),
      });
    } catch (apiErr) {
      console.warn('[usePhotoConsent] API accept sync error:', apiErr);
    }

    return updated;
  };

  const rejectRequest = async (requestId: string, requesterId?: string) => {
    if (!currentUserId) return null;

    // 1. Update local store
    const updated = daheejStore.updateConsentStatus(requestId, 'rejected', requesterId, currentUserId);
    refreshRequests();

    // 2. Sync to Supabase
    try {
      if (requestId && !requestId.startsWith('req_')) {
        await supabase
          .from('photo_permissions')
          .update({ status: 'rejected', updated_at: new Date().toISOString() })
          .eq('id', requestId);
      }

      if (requesterId) {
        await supabase
          .from('photo_permissions')
          .update({ status: 'rejected', updated_at: new Date().toISOString() })
          .or(`and(requestor_id.eq.${requesterId},target_id.eq.${currentUserId}),and(requester_id.eq.${requesterId},target_user_id.eq.${currentUserId})`);
      }
    } catch (e) {
      console.warn('[usePhotoConsent] Supabase reject photo_permissions fallback:', e);
    }

    // 3. Backend API sync
    try {
      await fetch('/api/photo-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: requestId,
          requesterId: requesterId,
          targetUserId: currentUserId,
          status: 'rejected',
        }),
      });
    } catch (apiErr) {
      console.warn('[usePhotoConsent] API reject sync error:', apiErr);
    }

    return updated;
  };

  const revokeConsent = async (targetProfileId: string) => {
    if (!currentUserId || !targetProfileId) return;
    
    // 1. Update local store
    const reqs = daheejStore.getConsentRequests();
    const match = reqs.find(
      (r) =>
        (r.requester_id === currentUserId && (r.target_user_id === targetProfileId || r.target_id === targetProfileId)) ||
        (r.requester_id === targetProfileId && (r.target_user_id === currentUserId || r.target_id === currentUserId)) ||
        ((r as any).requestor_id === currentUserId && (r.target_id === targetProfileId || r.target_user_id === targetProfileId)) ||
        ((r as any).requestor_id === targetProfileId && (r.target_id === currentUserId || r.target_user_id === currentUserId))
    );

    if (match) {
      daheejStore.updateConsentStatus(match.id, 'rejected', currentUserId, targetProfileId);
    } else {
      daheejStore.upsertConsentRequest({
        requester_id: currentUserId,
        target_id: targetProfileId,
        target_user_id: targetProfileId,
        status: 'rejected',
      });
    }
    refreshRequests();

    // 2. Sync to Supabase
    try {
      await supabase
        .from('photo_permissions')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .or(`and(requestor_id.eq.${currentUserId},target_id.eq.${targetProfileId}),and(requestor_id.eq.${targetProfileId},target_id.eq.${currentUserId})`);
    } catch (e) {
      console.warn('[usePhotoConsent] Revoke notice:', e);
    }

    // 3. Sync to API
    try {
      await fetch('/api/photo-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterId: currentUserId,
          targetUserId: targetProfileId,
          status: 'rejected',
        }),
      });
    } catch (apiErr) {
      console.warn('[usePhotoConsent] API revoke sync notice:', apiErr);
    }
  };

  const grantInstantConsent = async (targetProfileId: string) => {
    if (!currentUserId || !targetProfileId) return;

    // 1. Update local store
    const req = daheejStore.sendConsentRequest(currentUserId, targetProfileId);
    daheejStore.updateConsentStatus(req.id, 'accepted', currentUserId, targetProfileId);
    refreshRequests();

    // 2. Sync to Supabase
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

    // 3. Sync to API
    try {
      await fetch('/api/photo-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterId: currentUserId,
          targetUserId: targetProfileId,
          status: 'approved',
        }),
      });
    } catch (apiErr) {
      console.warn('[usePhotoConsent] API instant grant sync notice:', apiErr);
    }
  };

  // Inbound requests targeted to current user (with enriched requester profile)
  const inboundRequests = consentRequests
    .filter(
      (r) =>
        currentUserId &&
        (r.target_id === currentUserId || r.target_user_id === currentUserId || (r as any).targetUserId === currentUserId) &&
        r.requester_id !== currentUserId &&
        (r as any).requestor_id !== currentUserId
    )
    .map((r) => {
      const reqId = r.requester_id || (r as any).requestor_id;
      const cachedProf = reqId ? daheejStore.getProfileById(reqId) : null;
      return {
        ...r,
        requester: r.requester || cachedProf || undefined,
      };
    });

  // Outbound requests sent by current user (with enriched target profile)
  const outboundRequests = consentRequests
    .filter(
      (r) =>
        currentUserId &&
        (r.requester_id === currentUserId || (r as any).requestor_id === currentUserId) &&
        r.target_id !== currentUserId &&
        r.target_user_id !== currentUserId
    )
    .map((r) => {
      const tgtId = r.target_id || r.target_user_id || (r as any).targetUserId;
      const cachedProf = tgtId ? daheejStore.getProfileById(tgtId) : null;
      return {
        ...r,
        target: r.target || cachedProf || undefined,
      };
    });

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
    refreshRequests,
  };
}
