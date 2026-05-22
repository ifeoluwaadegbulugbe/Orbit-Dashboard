# Orbit Web

Web dashboard for Orbit — shares the same Supabase backend as the mobile app, so users sign in with one account across both.

Tech: Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase · Paystack · Zustand · TanStack Query · React Hook Form · Framer Motion.

---

## Setup

1. **Copy environment file**
   ```bash
   cp .env.local.example .env.local
   ```

2. **Fill in Supabase keys**
   - Go to your Supabase dashboard → Settings → API
   - Copy `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - Copy `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep this private!)

3. **Set up Paystack** (see [Paystack setup](#paystack-setup) below)

4. **Install + run**
   ```bash
   npm install
   npm run dev
   ```
   Opens at <http://localhost:3000>.

---

## Database schema

The web app reuses your mobile app's existing tables: `profiles`, `clients`, `payments`, `bookings`, `reminders`. No new migrations needed for the web build — but you may want to add an `avatar_url` column to `profiles` if you haven't yet:

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;
```

---

## Paystack setup

1. **Sign up** at [paystack.com](https://paystack.com). Free, requires a business email + BVN.

2. **Create a plan**
   - Dashboard → Plans → "Add Plan"
   - Name: `Orbit Pro Monthly`
   - Amount: `9000` (NGN — roughly $17)
   - Interval: `Monthly`
   - Copy the **plan code** (looks like `PLN_xxxxx`) → `NEXT_PUBLIC_PAYSTACK_PLAN_CODE`

3. **Get API keys**
   - Settings → API Keys & Webhooks
   - Copy `Test Secret Key` → `PAYSTACK_SECRET_KEY`
   - Copy `Test Public Key` → `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`

4. **Configure webhook**
   - Same Settings page → Webhooks → Test Webhook URL
   - URL: `https://YOUR_DEPLOYED_DOMAIN/api/paystack/webhook`
   - For local testing, use [ngrok](https://ngrok.com): `ngrok http 3000` then use the public URL
   - Paystack signs webhooks with your secret key automatically — no separate webhook secret to copy

5. **Test the flow**
   - Sign up a new user in the web app
   - Click any Pro feature → paywall modal opens
   - Click "Start 7-day free trial"
   - You'll be redirected to Paystack's hosted checkout
   - Use a [test card](https://paystack.com/docs/payments/test-payments): `4084 0840 8408 4081`, any future expiry, CVV `408`, PIN `0000`, OTP `123456`
   - After success, you'll return to `/profile?paystack=success`
   - Pro features unlock

6. **Going live**
   - In Paystack dashboard, switch from Test → Live mode
   - Replace `sk_test_...` with `sk_live_...` and `pk_test_...` with `pk_live_...`
   - Re-create the plan in live mode (test plans don't carry over) and update the plan code

---

## Project structure

```
src/
├── app/
│   ├── (auth)/            # Login, signup pages
│   ├── (dashboard)/       # Sidebar layout + all logged-in pages
│   │   ├── home/          # Greeting + stats + quick actions
│   │   ├── clients/       # Client list with 10-client limit gate
│   │   ├── payments/      # Invoices, outstanding tracking
│   │   ├── work/          # Projects + invoices + calendar tabs
│   │   ├── analytics/     # Pro-gated charts & insights
│   │   ├── reminders/     # Follow-up reminders
│   │   └── profile/       # Subscription, settings, legal
│   ├── api/paystack/      # Server routes: checkout, verify, webhook, portal
│   ├── layout.tsx         # Root layout (Inter font, providers)
│   ├── page.tsx           # Redirects based on auth state
│   └── globals.css        # Tailwind v4 theme (matches mobile colors)
├── components/
│   ├── ui/                # Button, Card, Avatar, Badge, Input
│   ├── layout/            # Sidebar, TopBar, MobileNav
│   ├── dashboard/         # StatCard, QuickAction
│   ├── paywall/           # PaywallModal, ProGate, LockedFeatureRow
│   └── providers/         # Query + auth providers
├── hooks/                 # useSubscription, useClients, usePayments
├── lib/
│   ├── supabase/          # Browser, server, middleware clients
│   ├── paystack/          # Server-side Paystack API client
│   ├── constants.ts       # FREE_CLIENT_LIMIT, prices, etc.
│   └── utils.ts           # cn, formatCurrency, dates, greetings
├── stores/                # Zustand auth store
├── types/                 # Shared TS types (mirrors mobile)
└── middleware.ts          # Auth-aware route protection
```

---

## Paywall flow

```
┌─────────────────┐
│ Free user clicks│
│  Pro feature    │
└────────┬────────┘
         ↓
┌─────────────────────────┐
│  PaywallModal opens     │  ← components/paywall/PaywallModal.tsx
│  "Start 7-day trial"    │
└────────┬────────────────┘
         ↓ POST
┌─────────────────────────┐
│ /api/paystack/checkout  │  ← initializes Paystack transaction
│   returns auth URL      │
└────────┬────────────────┘
         ↓ redirect
┌─────────────────────────┐
│  Paystack hosted page   │  ← user enters card
│  (or test card details) │
└────────┬────────────────┘
         ↓ callback
┌─────────────────────────┐
│ /api/paystack/verify    │  ← confirms tx + updates profile
│   redirects → /profile  │     subscription_status='trial'
└─────────────────────────┘
         ↓
┌─────────────────────────┐
│ Webhooks keep DB synced │  ← /api/paystack/webhook
│  on renewal/cancel      │
└─────────────────────────┘
```

When the user lands back on `/profile?paystack=success`:
- Auth provider re-fetches the profile → `subscription_status` is now `'trial'` or `'pro'`
- `useSubscription()` flips `isPro` to true
- All `ProGate` components unmask, lock badges disappear, the sidebar shows the Pro Trial pill

---

## Free tier limits

The 10-client free limit is enforced in [`src/lib/constants.ts`](src/lib/constants.ts) and gated in the Clients page (`src/app/(dashboard)/clients/page.tsx`). At 8 clients the user sees a "you're growing" nudge; at 10 the Add button is disabled and the paywall opens.

For real protection (someone could call your DB directly), add a Supabase RLS policy or DB trigger:

```sql
CREATE OR REPLACE FUNCTION enforce_free_client_limit()
RETURNS trigger AS $$
DECLARE
  status text;
  cnt int;
BEGIN
  SELECT subscription_status INTO status FROM profiles WHERE id = NEW.user_id;
  IF status = 'free' THEN
    SELECT count(*) INTO cnt FROM clients WHERE user_id = NEW.user_id;
    IF cnt >= 10 THEN
      RAISE EXCEPTION 'Free plan limit reached. Upgrade to Pro for unlimited clients.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_client_limit
  BEFORE INSERT ON clients
  FOR EACH ROW EXECUTE FUNCTION enforce_free_client_limit();
```

---

## Scripts

```bash
npm run dev      # Local dev server
npm run build    # Production build (catches TS errors)
npm run start    # Serve the production build
```
