# Prompting It - Backend Setup Guide

Complete guide to set up the Supabase backend and Stripe payments.

---

## Prerequisites

- [Supabase Account](https://supabase.com) (Free tier works for development)
- [Stripe Account](https://stripe.com) (Test mode for development)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for Edge Functions)

---

## Step 1: Supabase Project Setup

### 1.1 Create Project
1. Go to [app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Name: `promptingit`
4. Choose a strong database password
5. Select your region

### 1.2 Run Database Schema
1. Go to **SQL Editor** in your Supabase dashboard
2. Copy the entire contents of `supabase-schema.sql`
3. Paste and run in the SQL Editor
4. This creates all tables, functions, triggers, and RLS policies

### 1.3 Configure Authentication
1. Go to **Authentication** → **Providers**
2. Enable **Email** (already enabled by default)
3. For **Google OAuth**:
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create OAuth credentials
   - Add redirect URL: `https://<your-project>.supabase.co/auth/v1/callback`
   - Copy Client ID and Secret to Supabase
4. For **GitHub OAuth**:
   - Go to [GitHub Developer Settings](https://github.com/settings/developers)
   - Create new OAuth App
   - Add callback URL: `https://<your-project>.supabase.co/auth/v1/callback`
   - Copy Client ID and Secret to Supabase

### 1.4 Update Frontend Configuration
Edit `supabase-config.js`:
```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
```

Get these from **Settings** → **API** in your Supabase dashboard.

---

## Step 2: Stripe Setup

### 2.1 Create Stripe Account
1. Go to [dashboard.stripe.com](https://dashboard.stripe.com)
2. Enable Test Mode (toggle in top right)
3. Complete account activation

### 2.2 Get API Keys
1. Go to **Developers** → **API Keys**
2. Copy:
   - **Publishable key** (pk_test_xxx)
   - **Secret key** (sk_test_xxx)

### 2.3 Create Products and Prices
1. Go to **Products** → **Add Product**
2. Create "Pro Plan Monthly":
   - Name: `Pro Plan`
   - Pricing: $49/month recurring
   - Copy the Price ID (price_xxx)
3. Create "Pro Plan Annual":
   - Name: `Pro Plan Annual`
   - Pricing: $399/year recurring
   - Copy the Price ID

### 2.4 Update Frontend Configuration
Edit `stripe-config.js`:
```javascript
const STRIPE_PUBLISHABLE_KEY = 'pk_test_YOUR_KEY';

const PRICING = {
  pro: {
    monthly: { priceId: 'price_xxx', ... },
    annual: { priceId: 'price_xxx', ... }
  }
};
```

### 2.5 Enable Stripe Connect (for Creator Payouts)
1. Go to **Connect** → **Settings**
2. Enable Express accounts
3. Configure branding
4. Set up payout schedule

---

## Step 3: Deploy Edge Functions

### 3.1 Install Supabase CLI
```bash
npm install -g supabase
```

### 3.2 Login and Link Project
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_ID
```

### 3.3 Set Environment Variables
```bash
# Set Stripe keys as secrets
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### 3.4 Deploy Functions
```bash
cd supabase/functions

# Deploy all functions
supabase functions deploy create-checkout
supabase functions deploy create-payment
supabase functions deploy create-connect-account
supabase functions deploy verify-checkout
supabase functions deploy stripe-webhook
```

---

## Step 4: Set Up Stripe Webhooks

### 4.1 Create Webhook Endpoint
1. Go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. URL: `https://<your-project>.supabase.co/functions/v1/stripe-webhook`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `account.updated`
   - `payout.paid`
   - `payout.failed`
5. Copy the **Signing secret** (whsec_xxx)
6. Set as environment variable (Step 3.3)

---

## Step 5: Create Owner Account

### 5.1 Sign Up Through UI
1. Go to your site's `/signup.html`
2. Create account with your owner email

### 5.2 Set Owner Role (SQL)
Run in Supabase SQL Editor:
```sql
-- Set user as owner
UPDATE public.profiles 
SET role = 'owner' 
WHERE email = 'your-owner-email@example.com';

-- Give owner unlimited access
UPDATE public.subscriptions 
SET tier = 'enterprise', 
    status = 'active', 
    prompts_limit = -1 
WHERE user_id = (
  SELECT id FROM public.profiles WHERE email = 'your-owner-email@example.com'
);
```

### 5.3 (Optional) Set Owner Credentials in Settings
For automatic owner recognition during signup/login:
```sql
INSERT INTO public.settings (key, value, description) VALUES 
  ('owner_email', 'your-owner-email@example.com', 'Owner account email'),
  ('owner_password', 'your-secure-password', 'Owner account password')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

---

## Step 6: Test the Setup

### 6.1 Test Authentication
1. Sign up with a test email
2. Verify email confirmation works
3. Test login/logout
4. Test password reset

### 6.2 Test Subscription (Stripe Test Mode)
1. Go to `/upgrade.html`
2. Select Pro plan
3. Use Stripe test card: `4242 4242 4242 4242`
4. Any future expiry, any CVC
5. Verify subscription updates in database

### 6.3 Test Marketplace Purchase
1. Create a test prompt in marketplace
2. Use another account to purchase
3. Verify purchase recorded in database

### 6.4 Test Creator Onboarding
1. Go to settings as creator
2. Click "Set up payouts"
3. Complete Stripe Connect onboarding
4. Verify account linked

---

## Environment Variables Summary

### Supabase (supabase-config.js)
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...
```

### Stripe (stripe-config.js)
```
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

### Supabase Secrets (Edge Functions)
```
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

---

## Production Checklist

- [ ] Switch Stripe to Live mode
- [ ] Update all API keys to production keys
- [ ] Create production webhook endpoint
- [ ] Test complete purchase flow
- [ ] Enable Stripe Radar (fraud protection)
- [ ] Set up monitoring/alerting
- [ ] Configure email templates in Supabase
- [ ] Set up custom domain in Supabase

---

## Troubleshooting

### "Supabase not initialized"
- Check that `supabase-config.js` loads before `auth.js`
- Verify Supabase CDN script is included

### "Table not found" errors
- Run `supabase-schema.sql` in SQL Editor
- Check RLS policies are created

### Webhook not receiving events
- Verify webhook URL is correct
- Check function is deployed: `supabase functions list`
- Check logs: `supabase functions logs stripe-webhook`

### OAuth not working
- Verify redirect URLs match exactly
- Check provider is enabled in Supabase dashboard

---

## Support

- Supabase Docs: https://supabase.com/docs
- Stripe Docs: https://stripe.com/docs
- GitHub Issues: [your-repo]/issues

