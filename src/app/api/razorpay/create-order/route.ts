// ==============================================================================
// RAZORPAY ORDER API ALIAS: /api/razorpay/create-order
// File: src/app/api/razorpay/create-order/route.ts
// Re-exports canonical implementation from src/app/api/payments/create-order/route.ts
// ==============================================================================

export const dynamic = 'force-dynamic';
export { POST, GET, TIER_PRICING_PAISE, type CreateOrderRequest, type CreateOrderResponse } from '../../payments/create-order/route';
