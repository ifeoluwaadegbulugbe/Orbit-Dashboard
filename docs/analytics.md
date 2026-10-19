# Product analytics

How Orbit measures usage: what is recorded, when, where it goes, and how the
internal dashboard at **/admin/analytics** counts things.

## Architecture

```
browser action succeeds ──► track() ──► POST /api/analytics/track ─┐
                                                                     ├─► user_product_events (Supabase)  ◄── /admin/analytics reads this
server action succeeds (webhooks, crons, API routes) ──► track() ───┘        │
                                                                              └─► PostHog (forwarded after the response)
browser page views + identity ──────────────────────────────────────────────────► PostHog (posthog-js)
```

- **One tracker.** Every product event goes through `track()` in
  `src/lib/analytics/server.ts`. Browser code calls `track()` in
  `src/lib/analytics/browser.ts`, which posts to `/api/analytics/track`. The
  user id always comes from the server session, never from the request body.
- **Recorded once.** Each event can carry a `dedupe_key` of the form
  `<event>:<record id>:<owner id>`. The column is UNIQUE, so retries, double
  clicks, React re-renders, Strict Mode and webhook redeliveries are dropped.
  Only newly recorded events are forwarded to PostHog, so PostHog doesn't
  double-count either.
- **Never in the way.** Tracking runs after the action has succeeded, swallows
  its own errors, and forwards to PostHog with `after()`, once the response
  has been sent. If PostHog or the event log is down, Orbit carries on.
- **Why the dashboard reads Supabase, not the PostHog API.** The event log
  holds the same events PostHog receives, plus history backfilled from
  Orbit's own records (migration 019), which PostHog can't have. It needs no
  privileged PostHog key on the server and works even before PostHog is set
  up. Use PostHog itself for deeper exploration: funnels, paths, cohorts,
  retention and per-user timelines.

## Actors and "meaningful" actions

Each event has an `actor`:

| actor | who | counts as the owner being active? |
| --- | --- | --- |
| `owner` | the signed-in business owner | yes, if the event is meaningful |
| `customer` | their customer on the public booking page | no |
| `system` | Orbit itself (crons, webhooks, auto-invoices) | no |

**DAU / WAU / MAU** are unique owners with at least one *meaningful* owner
event on the day / in the 7 days / in the 30 days ending on the end date,
counted in calendar days in `Africa/Lagos` (override with
`NEXT_PUBLIC_ANALYTICS_TIMEZONE`).

Meaningful is set per event in `src/lib/analytics/catalog.ts`. Flip the
`meaningful` flag there to change the definition; nothing else needs to
change. Logins, page views, client views, searches, Insights views, profile
edits, exports, customer bookings and automatic reminders are **not**
meaningful.

## Events

| Event | Fired when | Where | Actor | Meaningful |
| --- | --- | --- | --- | --- |
| `signup_completed` | account created | `api/auth/signup` | owner | no |
| `login_completed` | password sign-in succeeded | login page | owner | no |
| `onboarding_started` | welcome wizard opened (once per account) | `/welcome` | owner | no |
| `onboarding_step_completed` | a wizard step was finished (`step`) | `/welcome` | owner | no |
| `onboarding_completed` | "Enter Orbit" at the end of the wizard | `/welcome` | owner | no |
| `profile_updated` | a Settings field saved (`fields`, names only) | Settings | owner | no |
| `client_created` | client row inserted | `useCreateClient` / public booking (customer) | owner / customer | yes (owner) |
| `client_updated` | client saved (at most once a minute per client) | `useUpdateClient` | owner | yes |
| `client_deleted` | client deleted | `useDeleteClient` | owner | yes |
| `client_viewed` | client page opened (once per client per session) | client page | owner | no |
| `client_search_used` | typed 2+ characters in client search (once per visit) | Clients | owner | no |
| `service_created` | services saved with a new service name | `useUpdateServices` | owner | yes |
| `service_updated` | services saved, nothing new | `useUpdateServices` | owner | yes |
| `booking_link_created` | first successful save of a booking-link slug | Booking link | owner | yes |
| `booking_link_updated` | later saves | Booking link | owner | yes |
| `booking_link_shared` | link copied / shared / sent to WhatsApp / QR downloaded (`method`) | booking link card, QR card | owner | yes |
| `booking_created` | booking inserted (`actor_type`) | `useCreateBooking` / public booking API | owner / customer | yes (owner) |
| `booking_confirmed` | request confirmed | `api/bookings/[id]/respond` | owner | yes |
| `booking_cancelled` | booking request declined | `api/bookings/[id]/respond` | owner | yes |
| `booking_completed` | booking marked completed. **Orbit has no "mark completed" button yet, so this doesn't fire today**; it's wired into `useUpdateBookingStatus` for when one is added | `useUpdateBookingStatus` | owner | yes |
| `invoice_created` | invoice inserted | `useCreatePayment`; auto-invoice on confirm (system) | owner / system | yes (owner) |
| `invoice_sent` | payment link copied, PDF shared (`confirmed: true`), or WhatsApp opened with the link (`confirmed: false`, Orbit can't see the send) | invoice page | owner | yes |
| `invoice_marked_paid` | invoice set to paid by the owner | `useUpdatePayment` | owner | yes |
| `payment_link_created` | Paystack link generated | `api/payments/[id]/link` | owner | yes |
| `payment_received` | Paystack `charge.success` for an invoice (verified webhook, once per invoice) | Paystack webhook | system | no |
| `payment_failed` | Paystack `invoice.payment_failed` (Pro renewal) | Paystack webhook | system | no |
| `reminder_created` | reminder inserted (`repeats`) | `useCreateReminder` | owner | yes |
| `reminder_completed` | reminder ticked off | `useToggleReminder` | owner | yes |
| `reminder_sent` | automatic appointment / payment reminder email delivered | crons | system | no |
| `ai_assistant_used` | AI reply generated (`operation`: chat or the draft kind) | `api/ai/chat`, `api/ai/suggest` | owner | yes |
| `analytics_viewed` | Insights opened (once per session) | Insights | owner | no |
| `data_exported` | CSV export downloaded (`kind`, `rows`) | `api/export/[kind]` | owner | no |
| `checkout_started`, `subscription_started`, `upgrade_page_viewed` | Pro billing (already used by lifecycle emails) | Paystack routes | owner | no |

`payment_received` never comes from the browser: the browser endpoint
accepts only events marked `fromBrowser` in the catalog.

## What is never collected

Passwords, tokens, names, phone numbers, emails, client records, messages,
AI prompts or replies, invoice amounts tied to people, bank or card details.
Props are short scalars only (ids, counts, kinds); the browser endpoint drops
anything else. In PostHog:

- autocapture is **off** and session replay is **off**;
- anonymous visitors don't create person profiles (`identified_only`);
- signed-link secrets (`?t=`, `token_hash`, `code` ...) are stripped from URLs
  before page views are sent;
- local development doesn't send anything unless `NEXT_PUBLIC_POSTHOG_DEV=true`.

## Identity

On sign-in, the browser calls `posthog.identify(<supabase user id>)` once per
account per page load (re-renders and repeat logins are no-ops), with
`subscription_tier` and `signed_up_at` as person properties. Anonymous page
views from before login merge into that person. On sign-out,
`posthog.reset()` starts a fresh anonymous visitor. Server events use the
same user id as `distinct_id`, so both sides land on one person.

## Dashboard definitions

- **Registered users**: all accounts minus team and test accounts (admins,
  reserved test domains like `@example.com`, and `ANALYTICS_EXCLUDE_EMAILS`).
- **Activation rate**: signups in the range whose account has, at any time, a
  booking (by them or a customer) or an invoice/payment link.
- **Funnel**: signed up → finished onboarding → first client → services or
  booking link → first booking or invoice. Steps are cumulative but not
  ordered, so a booking-first business and an invoice-first business both
  progress. Edit `FUNNEL` in the catalog to change it.
- **Week-1 retention**: of signups in the range at least 14 days old, the share
  with a meaningful action on days 7-13 after signup. Shown once 5+ people
  qualify.
- **New**: signed up within 7 days. **Inactive**: no meaningful action for
  14 days. Change `NEW_USER_DAYS` / `INACTIVE_AFTER_DAYS` in the catalog.

## History (migration 019)

The migration backfills events from existing rows: clients, bookings
(customer requests from the booking page are marked `customer`), invoices,
reminders, verified online payments, services and booking links. Onboarding
completion is inferred from having services or a client. Backfilled rows
carry `props.backfilled = true` and the same dedupe keys as live tracking,
so nothing is counted twice. Before launch, only these actions exist, so
older activity is undercounted for edits, confirmations and AI use.

Known gap: clients a *customer* created through the booking page before
launch can't be told apart from clients the owner added, so they're
backfilled as owner actions.

## Admin access

`src/lib/admin.ts`: the existing owner account in `ADMIN_EMAILS`
(`src/lib/subscription/isPro.ts`) plus any Supabase user id in
`ORBIT_ADMIN_USER_IDS`. Both the page and `/api/admin/analytics` check this on
the server for every request and answer 404 to everyone else. The sidebar
link is cosmetic. Extra admins are added by id, not email, because Orbit's
signup doesn't verify inbox ownership.
