// ==============================================================================
// DAHEEJFREE MATRIMONIAL PLATFORM - STRICT MASTER V5 TYPES
// ==============================================================================

export type Gender = 'male' | 'female';
export type KYCStatus = 'unverified' | 'pending' | 'verified' | 'banned';
export type SubscriptionTier = 'free' | 'gold' | 'diamond' | 'platinum';
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'past_due';
export type BillingCycle = 'monthly' | 'yearly';
export type CallType = 'voice' | 'video' | 'audio';
export type CallStatus = 'connecting' | 'active' | 'connected' | 'completed' | 'declined' | 'missed' | 'ringing' | 'pending' | 'ended';
export type ConsentStatus = 'none' | 'pending' | 'accepted' | 'approved' | 'rejected' | 'revoked';
export type ConnectionStatus = 'pending' | 'accepted' | 'rejected';
export type ConnectionPairStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'rejected';
export type PhotoPrivacyMode = 'blur_all' | 'liked_only' | 'public';
export type IslamicSect = 'Sunni' | 'Shia' | 'Just Muslim' | 'Other';
export type PreferredSect = 'Sunni' | 'Shia' | 'Just Muslim' | 'Any';

// TABLE: public.connections (Mutual Matching & Feature Gate)
export interface Connection {
  id: string; // UUID PK
  sender_id: string; // UUID references profiles
  receiver_id: string; // UUID references profiles
  status: ConnectionStatus;
  created_at?: string;
  updated_at?: string;
}

// TABLE: public.profiles
export interface Profile {
  id: string; // UUID references auth.users(id)
  full_name: string;
  nickname?: string;
  phone_number?: string;
  gender?: Gender;
  avatar_url: string | null;
  wali_name?: string | null;
  wali_relation?: string | null;
  wali_phone?: string | null;
  wali_contact_number?: string | null;
  wali_email: string | null;
  wali_verified?: boolean;
  has_wali?: boolean;
  kyc_status: KYCStatus;
  kyc_verified?: boolean;
  is_verified?: boolean;
  is_active?: boolean;
  is_online?: boolean;
  last_seen?: string;
  subscription_tier: SubscriptionTier;
  membership_tier?: SubscriptionTier;
  candidate_role?: string;
  role?: string;
  // Extended matrimonial fields
  bio?: string;
  age?: number;
  profession?: string;
  location?: string;
  education?: string;
  sect?: IslamicSect;
  preferred_sect?: PreferredSect;
  religious_sect?: string;
  religious_practice?: string;
  prayer_frequency?: string;
  quran_recitation?: string;
  marital_status?: string;
  has_children?: boolean;
  height_cm?: number;
  anti_dowry_pledge?: boolean;
  anti_dowry_pledged?: boolean;
  dowry_pledge_signed?: boolean;
  islamic_oath_signed?: boolean;
  islamic_oath_date?: string;
  covenant_signed?: boolean;
  covenant_signed_at?: string;
  is_onboarded?: boolean;
  city?: string;
  kyc_document_type?: string;
  kyc_document_url?: string;
  kyc_session_id?: string | null;
  didit_session_url?: string | null;
  subscription_id?: string | null;
  subscription_status?: string | null;
  photo_privacy?: boolean;
  is_photo_private?: boolean;
  photo_blur_hash?: string;
  photo_privacy_mode?: PhotoPrivacyMode;
  selfie_verified?: boolean;
  selfie_url?: string | null;
  selfie_verification_url?: string | null;
  legal_consent_accepted_at?: string | null;
  terms_accepted?: boolean;
  icebreakers?: string[];
  last_known_ip?: string | null;
  created_at?: string;
  updated_at?: string;
}

// TABLE: public.subscriptions (Dodo Payments)
export interface Subscription {
  id: string;
  profile_id: string; // UUID references public.profiles
  tier: SubscriptionTier;
  billing_cycle: BillingCycle;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  dodo_customer_id?: string;
  dodo_subscription_id?: string;
  dodo_payment_id?: string;
  razorpay_customer_id?: string;
  razorpay_subscription_id?: string;
  razorpay_order_id?: string;
  created_at?: string;
  updated_at?: string;
}

// TABLE: public.call_signals (Dedicated WebRTC Signaling Table)
export type WebRTCSignalType = 'offer' | 'answer' | 'ice-candidate' | 'end-call' | 'reject-call' | 'CALL_INVITE' | 'CALL_ACCEPTED' | 'CALL_DECLINED' | 'CALL_ENDED';

export interface CallSignal {
  id: string;
  caller_id: string;
  receiver_id: string;
  room_id?: string;
  type?: WebRTCSignalType;
  payload?: unknown;
  signal_data?: {
    room_id?: string;
    call_type?: CallType;
    type?: WebRTCSignalType;
    caller_name?: string;
    caller_avatar?: string | null;
    sdp?: unknown;
    candidate?: unknown;
    [key: string]: unknown;
  };
  status?: 'pending' | 'accepted' | 'declined' | 'missed' | 'ended';
  created_at?: string;
}

// TABLE: public.calls (Legacy WebRTC Signaling Table)
export interface Call {
  id: string;
  caller_id: string; // UUID references profiles
  recipient_id: string; // UUID references profiles
  callee_id: string; // UUID references profiles (populated identically to recipient_id)
  call_type: CallType;
  status: CallStatus;
  started_at?: string;
  duration_seconds?: number;
  sdp_offer?: unknown;
  sdp_answer?: unknown;
  ice_candidates?: any[];
  created_at?: string;
  updated_at?: string;
  ended_at?: string;
}

export type CallRecord = Call;

// TABLE: public.photo_permissions (Strict 2-Way Gated Photo Consent Table)
export interface PhotoPermission {
  id: string; // UUID PK
  requester_id: string; // UUID references profiles
  target_user_id: string; // UUID references profiles
  target_id?: string; // Legacy alias for target_user_id
  status: 'pending' | 'accepted' | 'approved' | 'rejected' | 'revoked';
  created_at: string;
  updated_at: string;
  target?: {
    id?: string;
    full_name?: string;
    location?: string;
    city?: string;
    profession?: string;
    avatar_url?: string | null;
    age?: number;
    gender?: Gender;
    kyc_status?: KYCStatus;
  } | null;
  requester?: {
    id?: string;
    full_name?: string;
    location?: string;
    city?: string;
    profession?: string;
    avatar_url?: string | null;
    age?: number;
    gender?: Gender;
    kyc_status?: KYCStatus;
  } | null;
}

// Legacy alias for photo consent
export type ConsentRequest = PhotoPermission;

// TABLE: public.messages (Realtime Chat)
export interface ChatMessage {
  id: string;
  conversation_id?: string;
  sender_id: string;
  recipient_id?: string;
  receiver_id?: string;
  content: string;
  read?: boolean;
  is_nsfw?: boolean;
  is_dowry_demand?: boolean;
  moderation_flagged?: boolean;
  created_at: string;
}

export type Message = ChatMessage;

// SECURE VIEW: public.profiles_secure_view
export interface ProfileSecureView extends Profile {
  is_photo_unlocked?: boolean;
  is_wali_unlocked?: boolean;
  photo_access_granted?: boolean;
  wali_access_granted?: boolean;
}

export interface PlanDetail {
  id: SubscriptionTier;
  name: string;
  tagline?: string;
  eyebrow?: string;
  priceINR: number;
  priceUSD: number;
  annualPriceINR?: number;
  annualPriceUSD?: number;
  period?: string;
  desc?: string;
  description?: string;
  features: string[];
  recommended?: boolean;
  popular?: boolean;
  badge?: string;
  btnText?: string;
}

export interface SecurityAuditLog {
  id: string;
  user_id?: string | null;
  last_known_ip?: string | null;
  action_type: string;
  metadata?: Record<string, any>;
  recorded_at: string;
}
