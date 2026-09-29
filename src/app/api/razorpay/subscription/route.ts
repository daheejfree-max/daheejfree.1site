// ==============================================================================
// RAZORPAY SUBSCRIPTION ALIAS: /api/razorpay/subscription
// File: src/app/api/razorpay/subscription/route.ts
// Proxies to canonical Razorpay order creation endpoint
// ==============================================================================

export const dynamic = 'force-dynamic';
export { POST, GET, TIER_PRICING_PAISE } from '../create-order/route';
