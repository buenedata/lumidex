# Stripe Integration Plan

> **Status:** Ready for implementation  
> **Stack:** Stripe Node SDK · Next.js App Router API Routes · Supabase  
> **Tiers:** Free (default) → Pro at €4.99/mo or €39.99/yr

---

## Architecture Overview

```
User clicks "Upgrade"
      │
      ▼
POST /api/stripe/checkout
  - Auth: require logged-in user
  - Create/reuse Stripe Customer (store stripe_customer_id in user_subscriptions)
  - Create Stripe Checkout Session (mode: subscription)
  - Return { url } → client redirects to Stripe hosted page
      │
      ▼ (Stripe hosted checkout)
User enters card details + pays
      │
      ▼
Stripe POST /api/stripe/webhook
  - Verify STRIPE_WEBHOOK_SECRET signature
  - Handle events:
      checkout.session.completed     → set tier='pro', store sub ID + period
      customer.subscription.updated  → update period dates, handle plan changes
      customer.subscription.deleted  → set tier='free', clear billing fields
      invoice.payment_failed         → optional: flag payment issue in UI
      │
      ▼
supabaseAdmin.from('user_subscriptions').upsert(...)
      │
      ▼
Client: useSubscriptionStore.fetchSubscription()
  → tier updates → Pro UI unlocks
```

---

## Environment Variables

Add to `.env.local` (and to your production environment):

```env
# Stripe keys (Dashboard → Developers → API keys)
STRIPE_SECRET_KEY=sk_live_...          # or sk_test_... for development
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...  # or pk_test_...

# Webhook signing secret (Dashboard → Developers → Webhooks → your endpoint → Signing secret)
STRIPE_WEBHOOK_SECRET=whsec_...

# Price IDs (Dashboard → Products → Lumidex Pro → Pricing)
STRIPE_MONTHLY_PRICE_ID=price_...      # €4.99/month recurring
STRIPE_ANNUAL_PRICE_ID=price_...       # €39.99/year recurring
```

> **Dev workflow:** Use `stripe listen --forward-to localhost:3000/api/stripe/webhook` to forward test webhooks locally. Install Stripe CLI from https://stripe.com/docs/stripe-cli

---

## Files to Create / Modify

### 1. `lib/stripe.ts` *(new — server-only)*

Singleton Stripe client. Never import this from Client Components.

```ts
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
  typescript: true,
})
```

---

### 2. `app/api/stripe/checkout/route.ts` *(new)*

**POST** — Creates a Stripe Checkout Session and returns the hosted URL.

**Request body:**
```json
{ "priceId": "price_xxx" }
```

**Logic:**
1. Authenticate the user via cookie session
2. Read existing `stripe_customer_id` from `user_subscriptions` (if any)
3. If no existing customer → create a new Stripe Customer with `metadata.userId = user.id`
4. Create `stripe.checkout.sessions.create()`:
   - `customer`: existing or newly created customer ID
   - `line_items`: `[{ price: priceId, quantity: 1 }]`
   - `mode`: `'subscription'`
   - `success_url`: `${origin}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`
   - `cancel_url`: `${origin}/upgrade`
   - `metadata`: `{ userId: user.id }` *(belt-and-suspenders — also on the customer)*
   - `allow_promotion_codes`: `true` *(for future discount codes)*
   - `billing_address_collection`: `'auto'`
   - `tax_id_collection`: `{ enabled: true }` *(for VAT compliance in EU)*
5. Upsert `stripe_customer_id` immediately into `user_subscriptions` so the portal route can look it up
6. Return `{ url: session.url }`

**Response:**
```json
{ "url": "https://checkout.stripe.com/c/pay/cs_..." }
```

---

### 3. `app/api/stripe/webhook/route.ts` *(new)*

**POST** — Receives and processes Stripe events.

**Critical:** Must use `Request` (not `NextRequest`) and call `stripe.webhooks.constructEvent()` with the raw body. Next.js App Router requires disabling body parsing for webhook routes:

```ts
export const config = { api: { bodyParser: false } }
// In App Router: use request.text() to get the raw body string
```

**Events to handle:**

| Event | Action |
|---|---|
| `checkout.session.completed` | Upsert `user_subscriptions`: `tier='pro'`, store `stripe_customer_id`, `stripe_subscription_id`, `current_period_start`, `current_period_end`, `billing_period` |
| `customer.subscription.updated` | Update `current_period_start`, `current_period_end`; if `status='past_due'` or `status='canceled'` → set `tier='free'` |
| `customer.subscription.deleted` | Set `tier='free'`, clear `stripe_subscription_id`, `current_period_end` |
| `invoice.payment_failed` | Log — optionally set a `payment_failed` flag for UI warning (future) |

**Lookup userId pattern:** Always resolve via `stripe_customer_id` → `user_subscriptions.user_id`:
```ts
const { data } = await supabaseAdmin
  .from('user_subscriptions')
  .select('user_id')
  .eq('stripe_customer_id', stripeCustomerId)
  .single()
```

**Billing period detection:**
```ts
const billingPeriod = subscription.items.data[0].plan.interval === 'year'
  ? 'annual'
  : 'monthly'
```

---

### 4. `app/api/stripe/portal/route.ts` *(new)*

**POST** — Creates a Stripe Customer Portal session for subscription management.

```ts
// Requires stripe dashboard config: https://dashboard.stripe.com/settings/billing/portal
// Enable: cancel subscription, update payment method, view invoices
```

**Logic:**
1. Authenticate user
2. Look up `stripe_customer_id` from `user_subscriptions`
3. If no customer ID → return 400 (user has never paid)
4. `stripe.billingPortal.sessions.create({ customer, return_url: '/dashboard' })`
5. Return `{ url }`

---

### 5. `app/upgrade/page.tsx` *(new)*

Pricing page at `/upgrade`. Shows the two plans with feature comparison and upgrade CTA.

**Sections:**
```
┌──────────────────────────────────────────────────────────┐
│  Your collection deserves more than a snapshot.          │
│  [Subheading: Track where your cards have been...]       │
└──────────────────────────────────────────────────────────┘
┌─────────────────────────┐  ┌───────────────────────────┐
│  Free                   │  │  💎 Pro          [POPULAR] │
│  €0 forever             │  │  €4.99/mo                  │
│  ─────────────────────  │  │  or €39.99/yr (save 33%)  │
│  ✓ Collection tracking  │  │  ─────────────────────────│
│  ✓ Today's prices       │  │  Everything in Free, plus:│
│  ✓ 7-day price history  │  │  ✓ 14/30/90/365-day charts│
│  ✓ 2 custom lists       │  │  ✓ Portfolio value history │
│  ✓ All 36 achievements  │  │  ✓ Price alerts            │
│  ✓ Friends + trades     │  │  ✓ Graded cards tracking  │
│  [Current plan]         │  │  ✓ Sealed products         │
│                         │  │  ✓ Unlimited custom lists │
└─────────────────────────┘  │  ✓ Collection export       │
                              │  ✓ Advanced analytics      │
                              │  ✓ Pro profile badge       │
                              │  [Monthly] [Annual ⭐]     │
                              │  [Upgrade to Lumidex Pro]  │
                              └───────────────────────────┘
```

**Client behaviour:**
- Toggle between Monthly / Annual billing
- "Upgrade" button calls `POST /api/stripe/checkout` with selected priceId
- On success: redirect to `session.url`
- Show loading state while checkout session creates

**`/upgrade/success` page:** Show "Welcome to Pro!" confirmation, button to go to Dashboard. After load, trigger `useSubscriptionStore.getState().fetchSubscription()` to refresh tier.

---

### 6. `components/upgrade/UpgradeModal.tsx` *(new)*

Inline modal triggered anywhere in the app when a free user hits a Pro gate.

**Props:**
```ts
interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  feature: string  // "Price history charts", "Graded card tracking", etc.
}
```

**Content:** Brief value pitch, the Pro feature being gated, two price options (monthly/annual), CTA that triggers checkout.

**Usage pattern (with useProGate hook):**
```tsx
const [upgradeOpen, setUpgradeOpen] = useState(false)
const { isPro } = useProGate()

if (!isPro) return (
  <>
    <div className="blur-sm pointer-events-none"><GradedCardsSection /></div>
    <UpgradeModal
      isOpen={upgradeOpen}
      onClose={() => setUpgradeOpen(false)}
      feature="Graded card tracking"
    />
    <button onClick={() => setUpgradeOpen(true)}>💎 Upgrade to Pro</button>
  </>
)
```

---

### 7. `components/upgrade/ProBadge.tsx` *(new)*

Small inline badge shown on Pro user profiles.

```tsx
// Usage: <ProBadge /> next to username
// Visual: small pill "💎 Pro" with accent glow, glass surface
```

---

## Stripe Dashboard Configuration Required

Before going live, configure these in the Stripe Dashboard:

1. **Customer Portal** → Settings → Billing → Customer portal:
   - ✅ Allow customers to cancel subscriptions
   - ✅ Allow customers to update payment methods
   - ✅ Show invoice history
   - Return URL: `https://yourdomain.com/dashboard`

2. **Webhook endpoint** → Developers → Webhooks → Add endpoint:
   - URL: `https://yourdomain.com/api/stripe/webhook`
   - Events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`

3. **Tax settings** (EU VAT compliance):
   - Enable automatic tax calculation
   - Register Lumidex for VAT in Norway (Skatteetaten)
   - In checkout: `automatic_tax: { enabled: true }`

---

## Data Flow: Subscription State After Payment

```
Stripe sends webhook
        │
        ▼
/api/stripe/webhook resolves userId
        │
supabaseAdmin.from('user_subscriptions').upsert({
  user_id:                 'uuid...',
  tier:                    'pro',
  billing_period:          'monthly' | 'annual',
  current_period_start:    1713139200,  // Unix → ISO
  current_period_end:      1715817600,
  stripe_customer_id:      'cus_...',
  stripe_subscription_id:  'sub_...',
})
        │
        ▼
On next page load / refetch:
useSubscriptionStore.fetchSubscription()
  → reads user_subscriptions via RLS
  → sets tier = 'pro'
  → useIsPro() returns true
  → Pro UI unlocks
```

---

## Subscription Renewal (Automatic)

Stripe handles renewal automatically. Each successful renewal fires `customer.subscription.updated` with new `current_period_end`. The webhook handler updates the date in `user_subscriptions`. No action needed from the app side.

---

## Cancellation Grace Period

When a user cancels, Stripe by default sets `cancel_at_period_end = true` — the subscription stays active until `current_period_end`. The `customer.subscription.deleted` event fires **after** the period ends, so the user retains Pro access for the remaining paid period with no extra work needed.

---

## Implementation Order

1. Install `stripe` package + add env vars
2. `lib/stripe.ts`
3. `app/api/stripe/webhook/route.ts` *(most critical — test with Stripe CLI first)*
4. `app/api/stripe/checkout/route.ts`
5. `app/api/stripe/portal/route.ts`
6. `app/upgrade/page.tsx` + `/upgrade/success`
7. `components/upgrade/UpgradeModal.tsx`
8. `components/upgrade/ProBadge.tsx`
9. Wire upgrade CTA into Navbar + Profile settings
