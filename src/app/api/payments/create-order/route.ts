// ==============================================================================
// NEXT.JS API ROUTE: RAZORPAY SERVER-TO-SERVER ORDER CREATION
// File: src/app/api/payments/create-order/route.ts
// Endpoint: POST /api/payments/create-order
// ==============================================================================

import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';

export const dynamic = 'force-dynamic';

export const TIER_PRICING_PAISE: Record<string, { monthly: number; yearly: number; name: string }> = {
  free: { monthly: 0, yearly: 0, name: 'Free Sunnah Plan' },
  gold: { monthly: 49900, yearly: 479000, name: 'Gold Matrimonial' },
  platinum: { monthly: 99900, yearly: 959000, name: 'Platinum Matrimonial' },
  diamond: { monthly: 99900, yearly: 959000, name: 'Diamond Wali Access' },
};

export interface CreateOrderRequest {
  tier?: string;
  amount?: number;
  interval?: 'monthly' | 'yearly' | string;
  billingCycle?: 'monthly' | 'yearly' | string;
  profileId?: string;
  userId?: string;
  user_id?: string;
  currency?: string;
}

export interface CreateOrderResponse {
  success?: boolean;
  order_id?: string;
  id?: string;
  amount?: number;
  currency?: string;
  key_id?: string;
  tier?: string;
  interval?: string;
  error?: string;
}

export async function POST(req: Request) {
  try {
    // 1. Audit the environment variables
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return NextResponse.json(
        { error: "Missing Razorpay API keys in environment variables" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { tier = 'gold', amount = 499, interval = 'monthly' } = body || {};

    // 2. Free Tier bypass
    if (tier === 'free' || Number(amount) === 0) {
      return NextResponse.json({
        success: true,
        isFree: true,
        tier: 'free',
        order_id: `free_${Date.now()}`,
        id: `free_${Date.now()}`,
        amount: 0,
        currency: 'INR',
      });
    }

    // 3. Initialize Razorpay instance
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    // 4. Verify payload sent to razorpay.orders.create
    // amount: Must be an integer in paise. Use Math.round(Number(amount) * 100).
    const numAmount = Number(amount || 0);
    const amountInPaise = numAmount >= 10000 ? Math.round(numAmount) : Math.round(Number(amount) * 100);

    const orderOptions = {
      amount: amountInPaise,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: {
        tier,
        interval,
      },
    };

    const order = await razorpay.orders.create(orderOptions);

    return NextResponse.json({
      success: true,
      order_id: order.id,
      id: order.id,
      amount: Number(order.amount),
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
      tier,
      interval,
    });
  } catch (error: any) {
    console.error("Order creation failed:", error);
    const errorMsg =
      error?.error?.description ||
      error?.message ||
      error?.description ||
      "Order creation failed on server";
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}

export async function GET() {
  const hasKeys = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  return NextResponse.json({
    status: hasKeys ? 'ok' : 'missing_keys',
    configured: hasKeys,
    keyPrefix: process.env.RAZORPAY_KEY_ID ? process.env.RAZORPAY_KEY_ID.slice(0, 8) : null,
  });
}
