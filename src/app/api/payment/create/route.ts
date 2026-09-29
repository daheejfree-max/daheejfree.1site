// ==============================================================================
// PAYMENT API ALIAS: /api/payment/create
// File: src/app/api/payment/create/route.ts
// Proxies to canonical Razorpay order creation endpoint
// ==============================================================================

export const dynamic = 'force-dynamic';
export { POST, GET, TIER_PRICING_PAISE } from '../../razorpay/create-order/route';
