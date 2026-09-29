// ==============================================================================
// RAZORPAY CHECKOUT ALIAS: /api/checkout/razorpay
// File: src/app/api/checkout/razorpay/route.ts
// Proxies to canonical Razorpay order creation endpoint
// ==============================================================================

export const dynamic = 'force-dynamic';
export { POST, GET, TIER_PRICING_PAISE } from '../../razorpay/create-order/route';
