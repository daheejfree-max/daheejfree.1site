// ==============================================================================
// CREATE-ORDER API ALIAS: /api/create-order
// File: src/app/api/create-order/route.ts
// Proxies to canonical Razorpay order creation endpoint
// ==============================================================================

export const dynamic = 'force-dynamic';
export { POST, GET, TIER_PRICING_PAISE } from '../razorpay/create-order/route';
