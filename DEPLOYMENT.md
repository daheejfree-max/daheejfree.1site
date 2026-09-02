# 🚀 DaheejFree Matrimonial Platform — Production Deployment Guide

This guide provides the complete, step-by-step procedure to deploy the **DaheejFree** Islamic Matrimonial Progressive Web App (PWA) to **Vercel** with **Supabase (PostgreSQL, Realtime, RLS)** and **Razorpay Payments**.

---

## 📋 Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [Step 1: Database Setup on Supabase](#step-1-database-setup-on-supabase)
3. [Step 2: Push Codebase to GitHub](#step-2-push-codebase-to-github)
4. [Step 3: Deploy Project to Vercel](#step-3-deploy-project-to-vercel)
5. [Step 4: Configure Production Environment Variables](#step-4-configure-production-environment-variables)
6. [Step 5: Configure Razorpay Webhook Endpoint](#step-5-configure-razorpay-webhook-endpoint)
7. [Step 6: Production Verification Checklist](#step-6-production-verification-checklist)

---

## 1. Prerequisites
Ensure you have active accounts for:
- [Supabase](https://supabase.com) (Database, Auth, Storage, Realtime)
- [Razorpay Dashboard](https://dashboard.razorpay.com) (Live / Test Merchant Mode)
- [GitHub](https://github.com) (Repository Hosting)
- [Vercel](https://vercel.com) (Serverless Frontend & API Hosting)
- [Cloudflare Turnstile](https://dash.cloudflare.com) (Optional: Anti-Bot Challenge)

---

## Step 1: Database Setup on Supabase

1. Log in to your [Supabase Dashboard](https://supabase.com/dashboard) and click **"New Project"**.
2. Name your project `daheejfree-prod` and select your closest AWS/GCP region.
3. Open the **SQL Editor** from the left navigation panel.
4. Copy the entire contents of [`supabase/migrations/00_complete_master_schema.sql`](./supabase/migrations/00_complete_master_schema.sql) and paste it into the editor.
5. Click **"Run"** to execute the migration:
   - Sets up `profiles` (with sectarian fields `sect`, `preferred_sect`, `religious_sect`, KYC, and Wali fields), `connections`, `consent_requests`, `photo_requests`, `calls`, `messages`, and `subscriptions` tables.
   - Activates strict Row Level Security (RLS) policies and Storage bucket configurations.
   - Enables Supabase Realtime broadcast replication across all relevant tables.

---

## Step 2: Push Codebase to GitHub

In your project root terminal, initialize git (if not already done) and push to your private repository:

```bash
git init
git add .
git commit -m "feat: complete DaheejFree production build"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/daheejfree-matrimonial.git
git push -u origin main
```

---

## Step 3: Deploy Project to Vercel

1. Navigate to the [Vercel Dashboard](https://vercel.com/dashboard) and click **"Add New..."** $\rightarrow$ **"Project"**.
2. Select your `daheejfree-matrimonial` repository and click **"Import"**.
3. Set the **Framework Preset** to **Next.js** (or Vite for SPA build).
4. Leave the root directory as `./`.

---

## Step 4: Configure Production Environment Variables

In the **"Environment Variables"** section on Vercel, add the following key-value pairs:

| Variable Name | Description | Example / Where to Find |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | Supabase Dashboard $\rightarrow$ Settings $\rightarrow$ API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public client-side anon key | Supabase Dashboard $\rightarrow$ Settings $\rightarrow$ API |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret backend service role key | Supabase Dashboard $\rightarrow$ Settings $\rightarrow$ API *(Server-Only)* |
| `DIDIT_API_KEY` | Didit.me KYC Live API Key | Didit Developer Dashboard $\rightarrow$ API Keys |
| `DIDIT_WEBHOOK_SECRET` | Didit Webhook Secret Key | Didit Developer Dashboard $\rightarrow$ Webhooks |
| `DODO_PAYMENTS_API_KEY` | Dodo Payments Live API Key | Dodo Payments Dashboard $\rightarrow$ Developer |
| `DODO_PAYMENTS_WEBHOOK_KEY` | Dodo Webhook Verification Key | Dodo Payments Dashboard $\rightarrow$ Webhooks |
| `NEXT_PUBLIC_DODO_PAYMENTS_ENVIRONMENT` | Environment Mode (`production`) | Set to `production` |
| `DODO_BASE_URL` | Dodo API Base URL | `https://live.dodopayments.com` |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay Merchant Public Key | Razorpay Dashboard $\rightarrow$ Settings $\rightarrow$ API Keys |
| `RAZORPAY_KEY_SECRET` | Razorpay Merchant Secret Key | Razorpay Dashboard $\rightarrow$ Settings $\rightarrow$ API Keys |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay Webhook Secret | Razorpay Dashboard $\rightarrow$ Webhooks |
| `GEMINI_API_KEY` | Google Gemini API Key | Google AI Studio $\rightarrow$ Get API Key |
| `NEXT_PUBLIC_APP_URL` / `APP_URL` | Live Production Domain | `https://daheejfree.vercel.app` |

Click **"Deploy"** to initiate the production build.

---

## Step 5: Configure Razorpay Webhook Endpoint

1. Log in to the [Razorpay Dashboard](https://dashboard.razorpay.com).
2. Go to **Settings** $\rightarrow$ **Webhooks** $\rightarrow$ **"Add New Webhook"**.
3. In **Webhook URL**, enter:
   ```text
   https://YOUR_VERCEL_DOMAIN.vercel.app/api/webhooks/razorpay
   ```
4. In **Secret**, enter the exact string you configured for `RAZORPAY_WEBHOOK_SECRET`.
5. Under **Active Events**, check the following boxes:
   - `order.paid`
   - `payment.captured`
   - `payment.failed`
   - `subscription.activated`
   - `subscription.charged`
6. Click **"Create Webhook"**.

---

## Step 6: Production Verification Checklist

- [ ] **Zero Dowry Anti-Bot Registration**: Test phone OTP verification at `/register`.
- [ ] **2-Way Photo Privacy**: Verify that profile photos remain cryptographically blurred until mutual consent is accepted.
- [ ] **Diamond Tier Wali Access**: Verify that guardian phone and email are strictly hidden on Free/Gold/Platinum tiers and revealed only on Diamond.
- [ ] **Automated Moderation**: Test chat messages containing dowry solicitations (*"jahez"*, *"cash demand"*) and confirm they are intercepted in real-time.
- [ ] **HMAC Webhook**: Trigger a test payment and verify that `public.subscriptions` updates automatically via the webhook endpoint.
- [ ] **PWA Offline Caching**: Open the site on mobile Safari/Chrome and verify that the PWA install prompt is available.
