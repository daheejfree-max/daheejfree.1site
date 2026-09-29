// ==============================================================================
// PAYMENT API ALIAS: /api/payment
// File: src/app/api/payment/route.ts
// Proxies to canonical Razorpay order creation endpoint
// ==============================================================================

export const dynamic = 'force-dynamic';
export { POST, GET, TIER_PRICING_PAISE } from '../razorpay/create-order/route';
