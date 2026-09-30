// ==============================================================================
// NEXT.JS API ROUTE: RAZORPAY SERVER-TO-SERVER ORDER CREATION
// File: app/api/payments/create-order/route.ts (Root App Router)
// Endpoint: POST /api/payments/create-order
// ==============================================================================

export const dynamic = 'force-dynamic';
export {
  createOrder,
  POST,
  GET,
  TIER_PRICING_PAISE,
  type CreateOrderRequest,
  type CreateOrderResponse,
} from '../../../../src/app/api/payments/create-order/route';
