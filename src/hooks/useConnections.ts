// ==============================================================================
// MUTUAL CONNECTIONS & MATCHING HOOK (PHASE 3)
// Handles match requests, acceptance, and feature gating with Supabase Realtime
// ==============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { Connection, ConnectionPairStatus, ConnectionStatus } from '../types';
import { daheejStore } from '../lib/supabase/store';
import { supabase } from '../lib/supabase/client';

export function useConnections(currentUserId: string | null) {
  const [connections, setConnections] = useState<Connection[]>(() =>
    currentUserId ? daheejStore.getConnectionsForUser(currentUserId) : []
  );
  const isFetchingRef = useRef<boolean>(false);

  const refreshConnections = useCallback(() => {
    if (!currentUserId) {
      setConnections([]);
      return;
    }
    setConnections(daheejStore.getConnectionsForUser(currentUserId));
  }, [currentUserId]);

  // Initial load from Supabase & local store
  useEffect(() => {
    if (!currentUserId) return;
    let isMounted = true;

    refreshConnections();

    // 1. Fetch from Supabase
    const fetchRemote = async () => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      try {
        const { data, error } = await supabase
          .from('connections')
          .select('*')
          .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);

        if (!error && data && isMounted) {
          data.forEach((conn: Connection) => {
            daheejStore.setConnectionFromRemote(conn, false);
          });
          refreshConnections();
        }
      } catch (err) {
        console.warn('Supabase connections fetch note:', err);
      } finally {
        isFetchingRef.current = false;
      }
    };

    fetchRemote();

    // 2. Subscribe to local store updates
    const unsubscribeStore = daheejStore.subscribe((event) => {
      if (!isMounted) return;
      if (event.table === 'connections') {
        refreshConnections();
      }
    });

    // 3. Subscribe to Supabase Realtime channel (unique per hook instance)
    const channelId = `connections_realtime_${currentUserId}_${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'connections',
        },
        (payload) => {
          if (!isMounted || !payload.new) return;
          const newConn = payload.new as Connection;
          if (newConn.sender_id === currentUserId || newConn.receiver_id === currentUserId) {
            daheejStore.setConnectionFromRemote(newConn, false);
            refreshConnections();
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      unsubscribeStore();
      supabase.removeChannel(channel);
    };
  }, [currentUserId, refreshConnections]);

  const getConnectionPairStatus = useCallback(
    (targetUserId: string): ConnectionPairStatus => {
      if (!currentUserId || !targetUserId || currentUserId === targetUserId) return 'none';
      return daheejStore.getConnectionPairStatus(currentUserId, targetUserId);
    },
    [currentUserId, connections]
  );

  const isMatched = useCallback(
    (targetUserId: string): boolean => {
      if (!currentUserId || !targetUserId) return false;
      return daheejStore.hasAcceptedConnection(currentUserId, targetUserId);
    },
    [currentUserId, connections]
  );

  const sendMatchRequest = useCallback(
    async (targetUserId: string): Promise<Connection | null> => {
      if (!currentUserId || currentUserId === targetUserId) return null;

      // Local optimistic update
      const newConn = daheejStore.sendConnectionRequest(currentUserId, targetUserId);
      refreshConnections();

      // Supabase remote sync
      try {
        await supabase.from('connections').upsert({
          id: newConn.id.startsWith('conn_') ? undefined : newConn.id,
          sender_id: currentUserId,
          receiver_id: targetUserId,
          status: 'pending',
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Supabase send connection sync note:', err);
      }

      return newConn;
    },
    [currentUserId, refreshConnections]
  );

  const respondToMatch = useCallback(
    async (targetUserId: string, status: 'accepted' | 'rejected'): Promise<Connection | null> => {
      if (!currentUserId || !targetUserId) return null;

      // Local store update
      const updated = daheejStore.respondToConnectionByUsers(currentUserId, targetUserId, status);
      refreshConnections();

      // Supabase remote sync
      try {
        await supabase
          .from('connections')
          .update({ status, updated_at: new Date().toISOString() })
          .or(
            `and(sender_id.eq.${currentUserId},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${currentUserId})`
          );
      } catch (err) {
        console.warn('Supabase respond connection sync note:', err);
      }

      return updated;
    },
    [currentUserId, refreshConnections]
  );

  const acceptedPartnerIds = useCallback((): string[] => {
    if (!currentUserId) return [];
    return daheejStore.getAcceptedConnectionPartnerIds(currentUserId);
  }, [currentUserId, connections]);

  return {
    connections,
    getConnectionPairStatus,
    isMatched,
    sendMatchRequest,
    respondToMatch,
    acceptedPartnerIds,
    refreshConnections,
  };
}
