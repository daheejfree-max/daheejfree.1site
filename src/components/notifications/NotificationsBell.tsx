import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase/client';
import { fetchInboundPhotoRequests } from '../../lib/photoRequests';
import { Bell, Check, X, Lock } from 'lucide-react';

interface PhotoRequestItem {
  id: string;
  requestor_id: string;
  created_at: string;
  status?: string;
  profiles?: {
    full_name: string;
    avatar_url: string;
    city?: string;
    profession?: string;
  } | null;
}

export const NotificationsBell: React.FC<{ currentUserId: string }> = ({ currentUserId }) => {
  const [requests, setRequests] = useState<PhotoRequestItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const isFetchingRef = useRef<boolean>(false);

  const loadRequests = useCallback(async () => {
    if (!currentUserId || isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const data = await fetchInboundPhotoRequests(currentUserId);
      setRequests(data as any);
    } catch (e) {
      console.warn('[NotificationsBell] Fetch error:', e);
    } finally {
      isFetchingRef.current = false;
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    loadRequests();

    const channel = supabase
      .channel(`photo_notifications_${currentUserId}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'photo_permissions',
          filter: `target_id=eq.${currentUserId}`,
        },
        () => {
          loadRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, loadRequests]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleUpdateStatus = async (requestId: string, status: 'approved' | 'rejected') => {
    try {
      await supabase
        .from('photo_permissions')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', requestId);

      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (e) {
      console.error('[NotificationsBell] Update error:', e);
    }
  };

  return (
    <div className="relative" ref={bellRef} id="notifications-bell-widget">
      <button
        type="button"
        id="btn-notifications-bell"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full border transition-colors border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
        title="Photo Requests & Notifications"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {requests.length > 0 && (
          <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] font-extrabold bg-rose-600 text-white rounded-full animate-pulse shadow-sm">
            {requests.length}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 sm:hidden animate-in fade-in"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div 
            id="notifications-bell-dropdown"
            className="fixed inset-x-3 top-16 sm:inset-auto sm:absolute sm:right-0 sm:top-full sm:mt-2 sm:w-80 max-w-sm mx-auto sm:mx-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-3 z-50 space-y-2 animate-in fade-in"
          >
          <div className="flex items-center justify-between px-2 py-1 border-b border-zinc-100 dark:border-zinc-800">
            <span className="text-xs font-bold text-zinc-900 dark:text-white">Photo Access Requests</span>
            <span className="text-[10px] text-zinc-500">{requests.length} pending</span>
          </div>

          {requests.length === 0 ? (
            <p className="text-xs text-center text-zinc-500 py-5">No pending photo requests</p>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-2">
              {requests.map((req) => (
                <div
                  key={req.id}
                  id={`photo-req-item-${req.id}`}
                  className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 flex items-center justify-between gap-2 border border-zinc-200/60 dark:border-zinc-800"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                        {req.profiles?.full_name || 'A Match'}
                      </p>
                      <p className="text-[10px] text-zinc-400">Requests photo access</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      id={`btn-approve-${req.id}`}
                      onClick={() => handleUpdateStatus(req.id, 'approved')}
                      className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors cursor-pointer"
                      title="Approve Unblur"
                      aria-label="Approve"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      id={`btn-reject-${req.id}`}
                      onClick={() => handleUpdateStatus(req.id, 'rejected')}
                      className="p-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-rose-600 hover:text-white transition-colors cursor-pointer"
                      title="Reject"
                      aria-label="Reject"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </>
      )}
    </div>
  );
};
