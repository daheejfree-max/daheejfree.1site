'use client';

// ==============================================================================
// 2-WAY PHOTO PRIVACY & CONSENT MANAGEMENT VIEW
// ==============================================================================

import React from 'react';
import { Lock, Unlock, Check, X, Eye, Shield, Users, Clock, AlertCircle } from 'lucide-react';
import { ConsentRequest, Profile } from '../../types';
import { daheejStore } from '../../lib/supabase/store';

interface ConsentManagerProps {
  currentUserId: string;
  inboundRequests: ConsentRequest[];
  outboundRequests: ConsentRequest[];
  onAccept: (reqId: string) => void;
  onReject: (reqId: string) => void;
  onViewProfile: (profileId: string) => void;
}

export const ConsentManager: React.FC<ConsentManagerProps> = ({
  currentUserId,
  inboundRequests,
  outboundRequests,
  onAccept,
  onReject,
  onViewProfile,
}) => {
  const getProfile = (id: string): Profile | null => daheejStore.getProfileById(id);

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-50 via-emerald-100/40 to-teal-50 dark:from-emerald-950 dark:via-zinc-900 dark:to-emerald-950 border border-emerald-200 dark:border-emerald-500/30 rounded-3xl p-6 shadow-sm dark:shadow-xl transition-colors">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600/10 dark:bg-emerald-600/30 border border-emerald-300 dark:border-emerald-500/50 flex items-center justify-center text-emerald-700 dark:text-emerald-400 flex-shrink-0 shadow-sm">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-1">2-Way Photo Privacy & Consent Gate</h2>
            <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed max-w-2xl">
              In accordance with Islamic modesty and privacy rules, profile photos remain strictly hidden by default. A photo is ONLY visible when <strong>both parties</strong> mutually exchange and accept a photo consent request.
            </p>
          </div>
        </div>
      </div>

      {/* Inbound Consent Requests */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm dark:shadow-lg transition-colors">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-bold text-zinc-900 dark:text-white text-base">
              Inbound Photo Access Requests ({inboundRequests.length})
            </h3>
          </div>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Other members seeking mutual photo reveal</span>
        </div>

        {inboundRequests.length === 0 ? (
          <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-950/60 rounded-2xl border border-zinc-200 dark:border-zinc-800/80">
            <Shield className="w-8 h-8 text-zinc-400 dark:text-zinc-600 mx-auto mb-2" />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">No incoming photo consent requests at this time.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(inboundRequests || []).map((req) => {
              const requester = getProfile(req.requester_id);
              if (!requester) return null;

              return (
                <div
                  key={req.id}
                  className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/90 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-400 font-bold text-sm shadow-sm">
                      {(req.status === 'accepted' || req.status === 'approved') && requester.avatar_url ? (
                        <img
                          src={requester.avatar_url}
                          alt={requester.full_name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover rounded-xl"
                        />
                      ) : (
                        <Lock className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
                      )}
                    </div>

                    <div>
                      <h4 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                        {requester.full_name}
                        <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
                          ({requester.gender === 'female' ? 'Sister' : 'Brother'}, {requester.location || 'Member'})
                        </span>
                      </h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Profession: {requester.profession || 'Professional'}
                      </p>
                    </div>
                  </div>

                  {/* Actions depending on status */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {req.status === 'pending' ? (
                      <>
                        <button
                          id={`btn-reject-consent-${req.id}`}
                          onClick={() => onReject(req.id)}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-zinc-900 hover:bg-red-50 dark:hover:bg-zinc-800 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 flex items-center gap-1.5 transition-colors shadow-sm"
                        >
                          <X className="w-3.5 h-3.5" />
                          Decline
                        </button>
                        <button
                          id={`btn-accept-consent-${req.id}`}
                          onClick={() => onAccept(req.id)}
                          className="px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-md shadow-emerald-700/20 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Grant 2-Way Consent
                        </button>
                      </>
                    ) : (req.status === 'accepted' || req.status === 'approved') ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/50 shadow-sm">
                        <Unlock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        Photos Unlocked Both Ways
                      </span>
                    ) : (
                      <span className="text-xs text-red-700 dark:text-red-400/80 bg-red-50 dark:bg-red-950/40 px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-900/40">
                        Declined
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Outbound Sent Requests */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm dark:shadow-lg transition-colors">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-bold text-zinc-900 dark:text-white text-base">
              Sent Photo Requests ({outboundRequests.length})
            </h3>
          </div>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Requests you sent to other prospective matches</span>
        </div>

        {outboundRequests.length === 0 ? (
          <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-950/60 rounded-2xl border border-zinc-200 dark:border-zinc-800/80">
            <Eye className="w-8 h-8 text-zinc-400 dark:text-zinc-600 mx-auto mb-2" />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">You haven't requested photo consent from any profile yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(outboundRequests || []).map((req) => {
              const targetId = req.target_user_id || req.target_id || '';
              const target = getProfile(targetId);
              if (!target) return null;

              return (
                <div
                  key={req.id}
                  className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/90 rounded-2xl p-4 flex items-center justify-between gap-4 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-400 shadow-sm">
                      {(req.status === 'accepted' || req.status === 'approved') && target.avatar_url ? (
                        <img
                          src={target.avatar_url}
                          alt={target.full_name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover rounded-xl"
                        />
                      ) : (
                        <Lock className="w-4 h-4 text-zinc-500" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-zinc-900 dark:text-white">{target.full_name}</h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{target.location || 'Verified Match'}</p>
                    </div>
                  </div>

                  <div>
                    {(req.status === 'accepted' || req.status === 'approved') ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/50 shadow-sm">
                        <Unlock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        Accepted & Visible
                      </span>
                    ) : req.status === 'pending' ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/40">
                        <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        Awaiting Response
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800">
                        Declined
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
