# 🕊️ DaheejFree — Privacy-First, Dowry-Free Islamic Matrimonial Platform

<div align="center">
  <p><strong>A dignified, 100% Shariah-compliant matrimonial ecosystem engineered with anti-dowry covenants, 2-way mutual photo consent, guardian (Wali) facilitation, live Didit biometric KYC verification, and browser-based WebRTC calling.</strong></p>

  [![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
  [![React](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://reactjs.org/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.1-38b2ac.svg)](https://tailwindcss.com/)
  [![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20Auth-3ECF8E.svg)](https://supabase.com/)
  [![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
</div>

---

## 📖 Table of Contents

- [Core Principles & Features](#-core-principles--features)
- [Tech Stack](#-tech-stack)
- [Project Architecture](#-project-architecture)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Database Setup & Supabase Migration](#-database-setup--supabase-migration)
- [API Routes & Integrations](#-api-routes--integrations)
- [Deployment (Vercel / Cloud Run / Node.js)](#-deployment)
- [Contributing & Shariah Guidelines](#-contributing--shariah-guidelines)

---

## ✨ Core Principles & Features

1. **Bila-Daheej (Zero Dowry) Sacred Covenant**:
   - Every candidate and guardian explicitly takes the mandatory **Anti-Dowry Pledge** prior to entering candidate matching.
   - Zero tolerance for dowry demands; community reporting and automated covenant audits.

2. **2-Way Mutual Photo Consent & Privacy Blurring**:
   - All profile photos are blurred by default with privacy filters.
   - Candidate photos are only unblurred when both parties explicitly grant mutual consent.

3. **Didit.me Biometric & Government ID KYC**:
   - Integrated live identity verification using Didit Protocol to eradicate fake profiles and bots.
   - Strict Hard KYC gating for candidate discovery and direct communications.

4. **Guardian (Wali) Access Control**:
   - Direct Guardian contact details (phone, email, relation) are protected under VIP Diamond access to ensure dignified family-to-family engagement.

5. **Browser-Based WebRTC Audio & Video Calling**:
   - End-to-end encrypted voice and video meetings without exposing private phone numbers or personal social accounts.

6. **Global Multi-Currency & Tier Synchronization**:
   - **Free Sunnah** (₹0 / $0): Verified discovery, 3 match requests/day, text chat with accepted matches, KYC biometric verification.
   - **Gold Member** (₹499 / $6 /mo): Unlimited requests, 2-way unblurred photo consent, read receipts, priority search ranking.
   - **Diamond VIP** (₹999 / $12 /mo): Full Wali contact details, WebRTC voice/video calling, VIP badge, family conferencing.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Motion, Lucide Icons, Canvas Confetti.
- **Backend**: Express.js (Node.js ESM/CJS bundled via `esbuild`), Vite Middleware.
- **Database & Auth**: Supabase PostgreSQL, Supabase Auth (Email + Google OAuth PKCE), Row Level Security (RLS), Realtime.
- **Identity & KYC**: Didit Protocol (Government ID OCR + Biometric Liveness Detection).
- **Payment Gateways**: Dodo Payments (Global Multi-Currency) & Razorpay (INR / UPI).
- **AI Matchmaker**: Google Gemini API (Compatibility scoring & bio summaries).

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm** / **pnpm** / **yarn**
- A free [Supabase](https://supabase.com) project
- (Optional) [Didit.me](https://business.didit.me) and [Dodo Payments](https://app.dodopayments.com) accounts for live verification & payments.

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-username/daheejfree.git
cd daheejfree

# 2. Install dependencies
npm install

# 3. Create your local environment file
cp .env.example .env

# 4. Start development server
npm run dev
```

The application dev server runs on `http://localhost:3000`.

---

## 🔐 Environment Variables

Configure your `.env` or Vercel Environment Variables:

```env
# Application Domain
APP_URL=https://your-domain.vercel.app
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
NODE_ENV=production

# Supabase (Database, Auth & Realtime)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...

# Didit Protocol KYC (Live Mode)
DIDIT_API_KEY=live_didit_api_key_xxxxxxxxxxxxxxxxxxxx
DIDIT_CLIENT_ID=your_didit_client_id
DIDIT_CLIENT_SECRET=your_didit_client_secret
DIDIT_WEBHOOK_SECRET=whsec_didit_xxxxxxxxxxxxxxxxxxxxxxxx

# Dodo Payments (Production)
DODO_PAYMENTS_API_KEY=live_dodo_api_xxxxxxxxxxxxxxxxxxxx
DODO_PAYMENTS_WEBHOOK_KEY=whsec_dodo_xxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_DODO_PAYMENTS_ENVIRONMENT=production
DODO_BASE_URL=https://live.dodopayments.com

# Razorpay (INR / UPI Payments)
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret

# Google Gemini AI Matchmaker
GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 🗄️ Database Setup & Supabase Migration

Run this script in your **Supabase Dashboard → SQL Editor**:

```sql
-- 1. Ensure profiles table has required columns and constraints
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(20) DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(20) DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS oath_signed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS wali_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS wali_contact VARCHAR(50),
  ADD COLUMN IF NOT EXISTS wali_relation VARCHAR(50);

-- 2. Enforce subscription tier constraint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_subscription_tier_check') THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_subscription_tier_check;
  END IF;
END $$;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_subscription_tier_check 
CHECK (subscription_tier IN ('free', 'gold', 'diamond', 'platinum'));

-- 3. Create index for fast query lookups
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier ON public.profiles (subscription_tier);
CREATE INDEX IF NOT EXISTS idx_profiles_kyc_status ON public.profiles (kyc_status);
```

---

## 🌐 API Routes & Webhooks

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/health` | `GET` | Healthcheck and timestamp |
| `/api/kyc/create-session` | `POST` | Generates live Didit KYC biometric verification session |
| `/api/kyc/webhook` | `POST` | Handles Didit biometric verification callback updates |
| `/api/kyc/verify-selfie` | `POST` | Biometric face match & liveness check |
| `/api/payments/create-checkout` | `POST` | Creates live Dodo Payments checkout session |
| `/api/webhooks/dodo` | `POST` | Verifies and provisions Dodo subscription upgrades |
| `/api/checkout/razorpay` | `POST` | Creates Razorpay order for INR checkout |
| `/api/webhooks/razorpay` | `POST` | Processes Razorpay payment capture webhooks |
| `/api/gemini/evaluate` | `POST` | AI Shariah profile compatibility assessment |

---

## 🚢 Deployment

### Deploy to Vercel

1. Push your repository to GitHub.
2. Import repository into **Vercel**.
3. In **Project Settings → Environment Variables**, copy and paste the values from `.env.example`.
4. Click **Deploy**.

### Production Build & Run (Container / Node.js)

```bash
# Build frontend and compile backend server bundle
npm run build

# Start production server
npm start
```

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for details.
