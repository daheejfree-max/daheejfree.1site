// ==============================================================================
// DAHEEJFREE - REACTIVE SUPABASE DATA STORE & SECURE VIEWS (V4 MASTER)
// Implements strict V4 Schema, Realtime Broadcast, Messaging & Signaling
// ==============================================================================

import {
  Profile,
  Subscription,
  Call,
  ConsentRequest,
  Connection,
  ConnectionStatus,
  ConnectionPairStatus,
  ProfileSecureView,
  SubscriptionTier,
  CallStatus,
  ConsentStatus,
  KYCStatus,
  ChatMessage,
  BillingCycle,
} from '../../types';

const STORAGE_KEY_PROFILES = 'daheejfree_v4_profiles';
const STORAGE_KEY_SUBSCRIPTIONS = 'daheejfree_v4_subscriptions';
const STORAGE_KEY_CALLS = 'daheejfree_v4_calls';
const STORAGE_KEY_CONSENT = 'daheejfree_v4_consent_requests';
const STORAGE_KEY_MESSAGES = 'daheejfree_v4_messages';
const STORAGE_KEY_CONNECTIONS = 'daheejfree_v4_connections';
const STORAGE_KEY_CURRENT_USER_ID = 'daheejfree_v4_current_user_id';

export const SEED_PROFILES: Profile[] = [];
export const SEED_SUBSCRIPTIONS: Subscription[] = [];

type RealtimeListener = (event: { table: string; eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: any; old: any }) => void;
type MessageListener = (msg: ChatMessage) => void;
type CallListener = (call: Call) => void;

class DaheejFreeStore {
  private listeners: Set<RealtimeListener> = new Set();
  private messageListeners: Set<MessageListener> = new Set();
  private callListeners: Set<CallListener> = new Set();

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem(STORAGE_KEY_PROFILES)) {
      localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEY_SUBSCRIPTIONS)) {
      localStorage.setItem(STORAGE_KEY_SUBSCRIPTIONS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEY_CONSENT)) {
      localStorage.setItem(STORAGE_KEY_CONSENT, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEY_CALLS)) {
      localStorage.setItem(STORAGE_KEY_CALLS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEY_MESSAGES)) {
      localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEY_CONNECTIONS)) {
      localStorage.setItem(STORAGE_KEY_CONNECTIONS, JSON.stringify([]));
    }
  }

  public subscribe(listener: RealtimeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public subscribeToMessages(listener: MessageListener): () => void {
    this.messageListeners.add(listener);
    return () => {
      this.messageListeners.delete(listener);
    };
  }

  public subscribeToCalls(listener: CallListener): () => void {
    this.callListeners.add(listener);
    return () => {
      this.callListeners.delete(listener);
    };
  }

  private broadcast(table: string, eventType: 'INSERT' | 'UPDATE' | 'DELETE', newItem: any, oldItem?: any) {
    this.listeners.forEach((listener) => {
      try {
        listener({ table, eventType, new: newItem, old: oldItem || null });
      } catch (err) {
        console.error('Listener error:', err);
      }
    });

    if (table === 'messages' && (eventType === 'INSERT' || eventType === 'UPDATE')) {
      this.messageListeners.forEach((l) => l(newItem));
    }
    if (table === 'calls' && (eventType === 'INSERT' || eventType === 'UPDATE')) {
      this.callListeners.forEach((l) => l(newItem));
    }
  }

  // --- Profiles ---
  public getProfiles(): Profile[] {
    if (typeof window === 'undefined') return SEED_PROFILES;
    const raw = localStorage.getItem(STORAGE_KEY_PROFILES);
    return raw ? JSON.parse(raw) : SEED_PROFILES;
  }

  public getProfileById(id: string): Profile | null {
    const profiles = this.getProfiles();
    return profiles.find((p) => p.id === id) || null;
  }

  public createProfile(profile: Profile): Profile {
    const profiles = this.getProfiles();
    profiles.unshift(profile);
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(profiles));
    this.broadcast('profiles', 'INSERT', profile);
    return profile;
  }

  public updateProfile(profileId: string, updates: Partial<Profile>): Profile | null {
    const profiles = this.getProfiles();
    const index = profiles.findIndex((p) => p.id === profileId);
    if (index === -1) return null;
    const old = profiles[index];
    const updated = { ...old, ...updates, updated_at: new Date().toISOString() };
    profiles[index] = updated;
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(profiles));
    this.broadcast('profiles', 'UPDATE', updated, old);
    return updated;
  }

  public updateKYCStatus(profileId: string, status: KYCStatus): Profile | null {
    return this.updateProfile(profileId, { kyc_status: status });
  }

  public setProfileFromRemote(profile: Profile): void {
    if (!profile || !profile.id || typeof window === 'undefined') return;
    const profiles = this.getProfiles();
    const idx = profiles.findIndex((p) => p.id === profile.id);
    if (idx !== -1) {
      profiles[idx] = { ...profiles[idx], ...profile };
    } else {
      profiles.push(profile);
    }
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(profiles));
  }

  public deleteProfile(profileId: string): boolean {
    if (typeof window === 'undefined' || !profileId) return false;

    // 1. Remove profile
    const profiles = this.getProfiles().filter((p) => p.id !== profileId);
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(profiles));

    // 2. Remove subscriptions
    const subs = this.getSubscriptions().filter((s) => s.profile_id !== profileId);
    localStorage.setItem(STORAGE_KEY_SUBSCRIPTIONS, JSON.stringify(subs));

    // 3. Remove connections
    const connections = this.getConnections().filter(
      (c) => c.sender_id !== profileId && c.receiver_id !== profileId
    );
    localStorage.setItem(STORAGE_KEY_CONNECTIONS, JSON.stringify(connections));

    // 4. Remove consent requests
    const consents = this.getConsentRequests().filter(
      (c) => c.requester_id !== profileId && c.target_id !== profileId && c.target_user_id !== profileId
    );
    localStorage.setItem(STORAGE_KEY_CONSENT, JSON.stringify(consents));

    // 5. Remove messages
    const rawMsgs = localStorage.getItem(STORAGE_KEY_MESSAGES);
    const messages: ChatMessage[] = rawMsgs ? JSON.parse(rawMsgs) : [];
    const filteredMessages = messages.filter((m) => {
      const rec = m.receiver_id || m.recipient_id;
      return m.sender_id !== profileId && rec !== profileId;
    });
    localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(filteredMessages));

    // 6. Remove calls
    const rawCalls = localStorage.getItem(STORAGE_KEY_CALLS);
    const calls: Call[] = rawCalls ? JSON.parse(rawCalls) : [];
    const filteredCalls = calls.filter(
      (c) => c.caller_id !== profileId && c.recipient_id !== profileId && c.callee_id !== profileId
    );
    localStorage.setItem(STORAGE_KEY_CALLS, JSON.stringify(filteredCalls));

    // 7. Clear current user if it's the deleted user
    if (this.getCurrentUserId() === profileId) {
      localStorage.removeItem(STORAGE_KEY_CURRENT_USER_ID);
    }

    this.broadcast('profiles', 'DELETE', { id: profileId });
    return true;
  }

  // --- Subscriptions ---
  public getSubscriptions(): Subscription[] {
    if (typeof window === 'undefined') return SEED_SUBSCRIPTIONS;
    const raw = localStorage.getItem(STORAGE_KEY_SUBSCRIPTIONS);
    return raw ? JSON.parse(raw) : SEED_SUBSCRIPTIONS;
  }

  public getActiveSubscription(profileId: string): Subscription | null {
    const subs = this.getSubscriptions();
    return subs.find((s) => s.profile_id === profileId && s.status === 'active') || null;
  }

  public getSubscriptionTier(profileId: string): SubscriptionTier {
    const sub = this.getActiveSubscription(profileId);
    return sub ? sub.tier : 'free';
  }

  public updateSubscriptionTier(
    profileId: string,
    tier: SubscriptionTier,
    billingCycle: BillingCycle = 'monthly',
    paymentId?: string
  ): Subscription {
    const subs = this.getSubscriptions();
    const index = subs.findIndex((s) => s.profile_id === profileId);

    const now = new Date();
    const endDate = new Date();
    endDate.setDate(now.getDate() + (billingCycle === 'yearly' ? 365 : 30));

    let updated: Subscription;

    if (index !== -1) {
      const old = subs[index];
      updated = {
        ...old,
        tier,
        billing_cycle: billingCycle,
        status: 'active',
        current_period_start: now.toISOString(),
        current_period_end: endDate.toISOString(),
        razorpay_order_id: paymentId,
        updated_at: now.toISOString(),
      };
      subs[index] = updated;
      this.broadcast('subscriptions', 'UPDATE', updated, old);
    } else {
      updated = {
        id: `sub_${Date.now()}`,
        profile_id: profileId,
        tier,
        billing_cycle: billingCycle,
        status: 'active',
        current_period_start: now.toISOString(),
        current_period_end: endDate.toISOString(),
        razorpay_order_id: paymentId,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      };
      subs.push(updated);
      this.broadcast('subscriptions', 'INSERT', updated);
    }

    localStorage.setItem(STORAGE_KEY_SUBSCRIPTIONS, JSON.stringify(subs));
    return updated;
  }

  // --- Photo Consent ---
  public getConsentRequests(): ConsentRequest[] {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY_CONSENT);
    return raw ? JSON.parse(raw) : [];
  }

  public hasAcceptedPhotoConsent(viewerId: string, targetProfileId: string): boolean {
    if (!viewerId || !targetProfileId) return false;
    if (viewerId === targetProfileId) return true;
    
    // Check if target profile has public photos
    const targetProfile = this.getProfileById(targetProfileId);
    if (targetProfile && (targetProfile.photo_privacy === false || targetProfile.photo_privacy_mode === 'public')) {
      return true;
    }

    const reqs = this.getConsentRequests();
    return reqs.some(
      (r) =>
        (r.status === 'accepted' || r.status === 'approved') &&
        ((r.requester_id === viewerId && (r.target_user_id === targetProfileId || r.target_id === targetProfileId)) ||
          (r.requester_id === targetProfileId && (r.target_user_id === viewerId || r.target_id === viewerId)) ||
          ((r as any).requestor_id === viewerId && (r.target_id === targetProfileId || r.target_user_id === targetProfileId)) ||
          ((r as any).requestor_id === targetProfileId && (r.target_id === viewerId || r.target_user_id === viewerId)))
    );
  }

  public getConsentStatusBetween(viewerId: string, targetProfileId: string): ConsentStatus | 'none' {
    if (!viewerId || !targetProfileId) return 'none';
    if (viewerId === targetProfileId) return 'accepted';
    
    const targetProfile = this.getProfileById(targetProfileId);
    if (targetProfile && (targetProfile.photo_privacy === false || targetProfile.photo_privacy_mode === 'public')) {
      return 'accepted';
    }

    const reqs = this.getConsentRequests();
    const req = reqs.find(
      (r) =>
        ((r.requester_id === viewerId || (r as any).requestor_id === viewerId) && (r.target_user_id === targetProfileId || r.target_id === targetProfileId)) ||
        ((r.requester_id === targetProfileId || (r as any).requestor_id === targetProfileId) && (r.target_user_id === viewerId || r.target_id === viewerId))
    );
    if (!req) return 'none';
    if (req.status === 'approved') return 'accepted';
    return req.status as ConsentStatus;
  }

  public upsertConsentRequest(data: Partial<ConsentRequest> & { id?: string; requester_id?: string; requestor_id?: string; target_id?: string; target_user_id?: string; status?: string }): ConsentRequest {
    const reqs = this.getConsentRequests();
    const reqId = data.requester_id || (data as any).requestor_id || '';
    const tgtId = data.target_user_id || data.target_id || '';
    const normStatus: 'pending' | 'accepted' | 'approved' | 'rejected' | 'revoked' =
      (data.status === 'approved' || data.status === 'accepted')
        ? 'accepted'
        : (data.status === 'rejected' ? 'rejected' : (data.status === 'revoked' ? 'revoked' : 'pending'));

    const index = reqs.findIndex(
      (r) =>
        (data.id && r.id === data.id) ||
        (reqId && tgtId && (
          (r.requester_id === reqId && (r.target_user_id === tgtId || r.target_id === tgtId)) ||
          (r.requester_id === tgtId && (r.target_user_id === reqId || r.target_id === reqId)) ||
          ((r as any).requestor_id === reqId && (r.target_id === tgtId || r.target_user_id === tgtId)) ||
          ((r as any).requestor_id === tgtId && (r.target_id === reqId || r.target_user_id === reqId))
        ))
    );

    const existing = index !== -1 ? reqs[index] : null;
    const resolved: ConsentRequest = {
      id: data.id || existing?.id || 'req_' + Math.random().toString(36).substring(2, 9),
      requester_id: reqId || existing?.requester_id || '',
      target_user_id: tgtId || existing?.target_user_id || '',
      target_id: tgtId || existing?.target_id || '',
      status: normStatus,
      created_at: data.created_at || existing?.created_at || new Date().toISOString(),
      updated_at: data.updated_at || new Date().toISOString(),
      target: data.target || existing?.target || null,
      requester: data.requester || existing?.requester || null,
    };

    if (index !== -1) {
      reqs[index] = resolved;
    } else {
      reqs.push(resolved);
    }

    localStorage.setItem(STORAGE_KEY_CONSENT, JSON.stringify(reqs));
    this.broadcast('consent_requests', index !== -1 ? 'UPDATE' : 'INSERT', resolved, existing || undefined);
    return resolved;
  }

  public sendConsentRequest(requesterId: string, targetId: string): ConsentRequest {
    return this.upsertConsentRequest({
      requester_id: requesterId,
      target_user_id: targetId,
      target_id: targetId,
      status: 'pending',
    });
  }

  public updateConsentStatus(requestId: string, status: ConsentStatus, requesterId?: string, targetId?: string): ConsentRequest | null {
    const reqs = this.getConsentRequests();
    let index = reqs.findIndex((r) => r.id === requestId);
    
    if (index === -1 && requesterId && targetId) {
      index = reqs.findIndex(
        (r) =>
          ((r.requester_id === requesterId || (r as any).requestor_id === requesterId) && (r.target_user_id === targetId || r.target_id === targetId)) ||
          ((r.requester_id === targetId || (r as any).requestor_id === targetId) && (r.target_user_id === requesterId || r.target_id === requesterId))
      );
    }

    const normStatus = status === 'none' ? 'pending' : (status === 'approved' ? 'accepted' : status);

    if (index === -1) {
      if (requesterId && targetId) {
        return this.upsertConsentRequest({
          id: requestId,
          requester_id: requesterId,
          target_user_id: targetId,
          target_id: targetId,
          status: normStatus,
        });
      }
      return null;
    }

    const old = reqs[index];
    const updated: ConsentRequest = {
      ...old,
      status: normStatus,
      updated_at: new Date().toISOString()
    };
    reqs[index] = updated;
    localStorage.setItem(STORAGE_KEY_CONSENT, JSON.stringify(reqs));
    this.broadcast('consent_requests', 'UPDATE', updated, old);
    return updated;
  }

  public hasActiveDiamondSubscription(viewerId: string): boolean {
    const sub = this.getActiveSubscription(viewerId);
    if (!sub) return false;
    return sub.tier === 'diamond' && sub.status === 'active';
  }

  public getSecureProfiles(viewerId: string): ProfileSecureView[] {
    const profiles = this.getProfiles();
    const viewerHasDiamond = this.hasActiveDiamondSubscription(viewerId);

    return profiles.map((p) => {
      const isSelf = p.id === viewerId;
      const photoConsentAccepted = isSelf || this.hasAcceptedPhotoConsent(viewerId, p.id);
      const canViewWali = isSelf || viewerHasDiamond;

      return {
        ...p,
        is_photo_unlocked: photoConsentAccepted,
        is_wali_unlocked: canViewWali,
        photo_access_granted: photoConsentAccepted,
        wali_access_granted: canViewWali,
        avatar_url: photoConsentAccepted ? p.avatar_url : null,
        wali_email: canViewWali ? p.wali_email : null,
        wali_phone: canViewWali ? p.wali_phone : null,
      };
    });
  }

  // --- Realtime Messaging ---
  public getMessages(userOne: string, userTwo: string): ChatMessage[] {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY_MESSAGES);
    const list: ChatMessage[] = raw ? JSON.parse(raw) : [];

    return list.filter((m) => {
      const mReceiver = m.receiver_id || m.recipient_id;
      return (
        (m.sender_id === userOne && mReceiver === userTwo) ||
        (m.sender_id === userTwo && mReceiver === userOne)
      );
    });
  }

  public getAllMessagesForUser(userId: string): ChatMessage[] {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY_MESSAGES);
    const list: ChatMessage[] = raw ? JSON.parse(raw) : [];

    return list.filter((m) => {
      const mReceiver = m.receiver_id || m.recipient_id;
      return m.sender_id === userId || mReceiver === userId;
    });
  }

  public getUnreadCountForUser(userId: string): number {
    if (typeof window === 'undefined') return 0;
    const raw = localStorage.getItem(STORAGE_KEY_MESSAGES);
    const list: ChatMessage[] = raw ? JSON.parse(raw) : [];

    return list.filter((m) => {
      const mReceiver = m.receiver_id || m.recipient_id;
      return mReceiver === userId && m.read === false;
    }).length;
  }

  public getUnreadCountBetween(userId: string, senderId: string): number {
    if (typeof window === 'undefined') return 0;
    const raw = localStorage.getItem(STORAGE_KEY_MESSAGES);
    const list: ChatMessage[] = raw ? JSON.parse(raw) : [];

    return list.filter((m) => {
      const mReceiver = m.receiver_id || m.recipient_id;
      return mReceiver === userId && m.sender_id === senderId && m.read === false;
    }).length;
  }

  public markMessagesAsRead(viewerId: string, partnerId: string): void {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem(STORAGE_KEY_MESSAGES);
    if (!raw) return;
    const list: ChatMessage[] = JSON.parse(raw);
    let changed = false;

    const updatedList = list.map((m) => {
      const mReceiver = m.receiver_id || m.recipient_id;
      if (mReceiver === viewerId && m.sender_id === partnerId && !m.read) {
        changed = true;
        return { ...m, read: true };
      }
      return m;
    });

    if (changed) {
      localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(updatedList));
      this.broadcast('messages', 'UPDATE', { viewerId, partnerId, read: true });
    }
  }

  public getMessageCountForUser(userId: string): number {
    if (typeof window === 'undefined') return 0;
    const raw = localStorage.getItem(STORAGE_KEY_MESSAGES);
    const list: ChatMessage[] = raw ? JSON.parse(raw) : [];
    const today = new Date().toISOString().split('T')[0];
    return list.filter((m) => m.sender_id === userId && m.created_at.startsWith(today)).length;
  }

  public sendMessage(senderId: string, recipientId: string, content: string): ChatMessage {
    const raw = localStorage.getItem(STORAGE_KEY_MESSAGES);
    const list: ChatMessage[] = raw ? JSON.parse(raw) : [];

    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sender_id: senderId,
      recipient_id: recipientId,
      receiver_id: recipientId,
      content,
      read: false,
      created_at: new Date().toISOString(),
    };

    list.push(newMsg);
    localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(list));
    this.broadcast('messages', 'INSERT', newMsg);
    return newMsg;
  }

  public addMessage(msg: ChatMessage): void {
    if (typeof window === 'undefined' || !msg) return;
    const raw = localStorage.getItem(STORAGE_KEY_MESSAGES);
    const list: ChatMessage[] = raw ? JSON.parse(raw) : [];
    if (!list.some((m) => m.id === msg.id)) {
      list.push(msg);
      localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(list));
      this.broadcast('messages', 'INSERT', msg);
    }
  }

  public updateCallInviteStatus(roomID: string, newContent: string = 'CALL_ENDED'): void {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem(STORAGE_KEY_MESSAGES);
    if (!raw) return;
    const list: ChatMessage[] = JSON.parse(raw);
    let changed = false;

    const updatedList = list.map((m) => {
      if (
        m.content === 'CALL_INVITE' ||
        (m.content && m.content.includes(roomID)) ||
        (m.content && m.content.includes('CALL_INVITE'))
      ) {
        changed = true;
        const updated = { ...m, content: newContent };
        this.broadcast('messages', 'UPDATE', updated, m);
        return updated;
      }
      return m;
    });

    if (changed) {
      localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(updatedList));
    }
  }


  // --- WebRTC Calls ---
  public getCalls(): Call[] {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY_CALLS);
    return raw ? JSON.parse(raw) : [];
  }

  public getCallHistory(userId?: string): Call[] {
    if (userId) {
      return this.getCallsForUser(userId);
    }
    return this.getCalls();
  }

  public getCallsForUser(userId: string): Call[] {
    const calls = this.getCalls();
    return calls.filter((c) => c.caller_id === userId || c.recipient_id === userId || c.callee_id === userId);
  }

  public createCall(callData: Call | { caller_id: string; recipient_id: string; call_type: 'voice' | 'video' | 'audio' }): Call {
    const calls = this.getCalls();
    const newCall: Call = {
      id: 'id' in callData ? callData.id : 'call_' + Math.random().toString(36).substring(2, 9),
      caller_id: callData.caller_id,
      recipient_id: callData.recipient_id,
      callee_id: callData.recipient_id,
      call_type: callData.call_type,
      status: 'status' in callData ? callData.status : 'connecting',
      started_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      duration_seconds: 0,
    };
    calls.push(newCall);
    localStorage.setItem(STORAGE_KEY_CALLS, JSON.stringify(calls));
    this.broadcast('calls', 'INSERT', newCall);
    return newCall;
  }

  public updateCallStatus(callId: string, status: CallStatus, durationSeconds?: number): Call | null {
    const calls = this.getCalls();
    const index = calls.findIndex((c) => c.id === callId);
    if (index === -1) return null;
    const old = calls[index];
    const updated = {
      ...old,
      status,
      duration_seconds: durationSeconds !== undefined ? durationSeconds : old.duration_seconds,
      updated_at: new Date().toISOString(),
    };
    calls[index] = updated;
    localStorage.setItem(STORAGE_KEY_CALLS, JSON.stringify(calls));
    this.broadcast('calls', 'UPDATE', updated, old);
    return updated;
  }

  // --- Mutual Connections & Feature Gating ---
  public getConnections(): Connection[] {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY_CONNECTIONS);
    return raw ? JSON.parse(raw) : [];
  }

  public getConnectionsForUser(userId: string): Connection[] {
    const connections = this.getConnections();
    return connections.filter((c) => c.sender_id === userId || c.receiver_id === userId);
  }

  public getConnectionBetween(userOne: string, userTwo: string): Connection | null {
    if (!userOne || !userTwo) return null;
    const connections = this.getConnections();
    return (
      connections.find(
        (c) =>
          (c.sender_id === userOne && c.receiver_id === userTwo) ||
          (c.sender_id === userTwo && c.receiver_id === userOne)
      ) || null
    );
  }

  public getConnectionPairStatus(currentUserId: string, targetUserId: string): ConnectionPairStatus {
    if (!currentUserId || !targetUserId || currentUserId === targetUserId) return 'none';
    const conn = this.getConnectionBetween(currentUserId, targetUserId);
    if (!conn) return 'none';

    if (conn.status === 'accepted') return 'accepted';
    if (conn.status === 'rejected') return 'rejected';

    if (conn.status === 'pending') {
      return conn.sender_id === currentUserId ? 'pending_sent' : 'pending_received';
    }

    return 'none';
  }

  public hasAcceptedConnection(userOne: string, userTwo: string): boolean {
    if (!userOne || !userTwo) return false;
    if (userOne === userTwo) return true;
    const conn = this.getConnectionBetween(userOne, userTwo);
    return !!conn && conn.status === 'accepted';
  }

  public getAcceptedConnectionPartnerIds(userId: string): string[] {
    if (!userId) return [];
    const connections = this.getConnections();
    const partnerIds: string[] = [];
    connections.forEach((c) => {
      if (c.status === 'accepted') {
        if (c.sender_id === userId) partnerIds.push(c.receiver_id);
        else if (c.receiver_id === userId) partnerIds.push(c.sender_id);
      }
    });
    return Array.from(new Set(partnerIds));
  }

  public getPendingIncomingRequests(userId: string): Connection[] {
    if (!userId) return [];
    const connections = this.getConnections();
    return connections.filter((c) => c.receiver_id === userId && c.status === 'pending');
  }

  public getUnreadMessageCount(userId: string): number {
    return this.getUnreadCountForUser(userId);
  }

  public respondToConnectionByUsers(
    userOne: string,
    userTwo: string,
    status: 'accepted' | 'rejected'
  ): Connection | null {
    const conn = this.getConnectionBetween(userOne, userTwo);
    if (!conn) return null;
    return this.respondToConnection(conn.id, status);
  }

  public sendConnectionRequest(senderId: string, receiverId: string): Connection {
    const connections = this.getConnections();
    const existing = this.getConnectionBetween(senderId, receiverId);

    if (existing) {
      existing.sender_id = senderId;
      existing.receiver_id = receiverId;
      existing.status = 'pending';
      existing.updated_at = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY_CONNECTIONS, JSON.stringify(connections));
      this.broadcast('connections', 'UPDATE', existing);
      return existing;
    }

    const newConnection: Connection = {
      id: `conn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sender_id: senderId,
      receiver_id: receiverId,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    connections.push(newConnection);
    localStorage.setItem(STORAGE_KEY_CONNECTIONS, JSON.stringify(connections));
    this.broadcast('connections', 'INSERT', newConnection);
    return newConnection;
  }

  public respondToConnection(connectionId: string, status: 'accepted' | 'rejected'): Connection | null {
    const connections = this.getConnections();
    const index = connections.findIndex((c) => c.id === connectionId);
    if (index === -1) return null;

    const old = connections[index];
    const updated = {
      ...old,
      status,
      updated_at: new Date().toISOString(),
    };

    connections[index] = updated;
    localStorage.setItem(STORAGE_KEY_CONNECTIONS, JSON.stringify(connections));
    this.broadcast('connections', 'UPDATE', updated, old);
    return updated;
  }

  public setConnectionFromRemote(connection: Connection, shouldBroadcast = false): void {
    if (!connection || !connection.id || typeof window === 'undefined') return;
    const connections = this.getConnections();
    const index = connections.findIndex((c) => c.id === connection.id);
    let hasChanged = false;
    if (index !== -1) {
      if (connections[index].status !== connection.status || connections[index].updated_at !== connection.updated_at) {
        connections[index] = { ...connections[index], ...connection };
        hasChanged = true;
      }
    } else {
      connections.push(connection);
      hasChanged = true;
    }
    if (hasChanged) {
      localStorage.setItem(STORAGE_KEY_CONNECTIONS, JSON.stringify(connections));
      if (shouldBroadcast) {
        this.broadcast('connections', 'UPDATE', connection);
      }
    }
  }

  public resetToDefaultSeed(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY_PROFILES);
    localStorage.removeItem(STORAGE_KEY_SUBSCRIPTIONS);
    localStorage.removeItem(STORAGE_KEY_CONSENT);
    localStorage.removeItem(STORAGE_KEY_CALLS);
    localStorage.removeItem(STORAGE_KEY_MESSAGES);
    localStorage.removeItem(STORAGE_KEY_CONNECTIONS);
    localStorage.removeItem(STORAGE_KEY_CURRENT_USER_ID);
    window.location.reload();
  }

  public getCurrentUserId(): string {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(STORAGE_KEY_CURRENT_USER_ID) || '';
  }

  public setCurrentUserId(id: string): void {
    if (typeof window === 'undefined') return;
    if (id) {
      localStorage.setItem(STORAGE_KEY_CURRENT_USER_ID, id);
    } else {
      localStorage.removeItem(STORAGE_KEY_CURRENT_USER_ID);
    }
    this.broadcast('profiles', 'UPDATE', { id, action: 'user_switch' });
  }
}

export const daheejStore = new DaheejFreeStore();
