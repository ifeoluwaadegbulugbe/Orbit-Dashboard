/**
 * Product analytics: the single list of events Orbit records, and the
 * definitions built on them (what counts as "active", activation, the
 * funnel). Change a definition here and the admin dashboard follows - no
 * tracking code needs to move. See docs/analytics.md.
 *
 * Shared by browser and server code, so nothing in here may import
 * server-only modules.
 */

export type Actor = "owner" | "customer" | "system";

export type Feature =
  | "account" | "clients" | "services" | "booking_link" | "bookings"
  | "invoices" | "payments" | "reminders" | "ai" | "insights" | "export";

interface EventDef {
  feature: Feature;
  /** Counts toward DAU/WAU/MAU when done by the owner. */
  meaningful: boolean;
  /** May be sent from the browser via /api/analytics/track. Everything else is server-only (trusted). */
  fromBrowser: boolean;
  label: string;
}

export const EVENTS = {
  // ── Account & onboarding
  signup_completed:     { feature: "account", meaningful: false, fromBrowser: false, label: "Signed up" },
  login_completed:      { feature: "account", meaningful: false, fromBrowser: true,  label: "Logged in" },
  onboarding_started:   { feature: "account", meaningful: false, fromBrowser: true,  label: "Started onboarding" },
  onboarding_step_completed: { feature: "account", meaningful: false, fromBrowser: true, label: "Onboarding step done" },
  onboarding_completed: { feature: "account", meaningful: false, fromBrowser: true,  label: "Finished onboarding" },
  profile_updated:      { feature: "account", meaningful: false, fromBrowser: true,  label: "Updated profile" },
  // ── Clients
  client_created:       { feature: "clients", meaningful: true,  fromBrowser: true,  label: "Added a client" },
  client_updated:       { feature: "clients", meaningful: true,  fromBrowser: true,  label: "Edited a client" },
  client_deleted:       { feature: "clients", meaningful: true,  fromBrowser: true,  label: "Deleted a client" },
  client_viewed:        { feature: "clients", meaningful: false, fromBrowser: true,  label: "Viewed a client" },
  client_search_used:   { feature: "clients", meaningful: false, fromBrowser: true,  label: "Searched clients" },
  // ── Services & booking link
  service_created:      { feature: "services", meaningful: true, fromBrowser: true,  label: "Added a service" },
  service_updated:      { feature: "services", meaningful: true, fromBrowser: true,  label: "Edited services" },
  booking_link_created: { feature: "booking_link", meaningful: true, fromBrowser: true, label: "Published booking link" },
  booking_link_updated: { feature: "booking_link", meaningful: true, fromBrowser: true, label: "Edited booking page" },
  booking_link_shared:  { feature: "booking_link", meaningful: true, fromBrowser: true, label: "Shared booking link" },
  // ── Bookings
  booking_created:      { feature: "bookings", meaningful: true, fromBrowser: true,  label: "Booking created" },
  booking_confirmed:    { feature: "bookings", meaningful: true, fromBrowser: false, label: "Confirmed a booking" },
  booking_cancelled:    { feature: "bookings", meaningful: true, fromBrowser: true,  label: "Cancelled a booking" },
  booking_completed:    { feature: "bookings", meaningful: true, fromBrowser: true,  label: "Completed a booking" },
  // ── Invoices & payments
  invoice_created:      { feature: "invoices", meaningful: true, fromBrowser: true,  label: "Created an invoice" },
  invoice_sent:         { feature: "invoices", meaningful: true, fromBrowser: true,  label: "Sent an invoice" },
  invoice_marked_paid:  { feature: "invoices", meaningful: true, fromBrowser: true,  label: "Marked an invoice paid" },
  payment_link_created: { feature: "payments", meaningful: true, fromBrowser: false, label: "Created a payment link" },
  payment_received:     { feature: "payments", meaningful: false, fromBrowser: false, label: "Got paid online" },
  payment_failed:       { feature: "payments", meaningful: false, fromBrowser: false, label: "Payment failed" },
  // ── Reminders
  reminder_created:     { feature: "reminders", meaningful: true, fromBrowser: true,  label: "Created a reminder" },
  reminder_completed:   { feature: "reminders", meaningful: true, fromBrowser: true,  label: "Ticked off a reminder" },
  reminder_sent:        { feature: "reminders", meaningful: false, fromBrowser: false, label: "Automatic reminder sent" },
  // ── App
  app_installed:        { feature: "account", meaningful: false, fromBrowser: true, label: "Installed the app" },
  // ── AI, Insights, export
  ai_assistant_used:    { feature: "ai", meaningful: true, fromBrowser: false, label: "Used Orbit AI" },
  analytics_viewed:     { feature: "insights", meaningful: false, fromBrowser: true, label: "Viewed Insights" },
  data_exported:        { feature: "export", meaningful: false, fromBrowser: false, label: "Exported data" },
  // ── Billing (already recorded for lifecycle emails)
  checkout_started:     { feature: "account", meaningful: false, fromBrowser: false, label: "Started Pro checkout" },
  subscription_started: { feature: "account", meaningful: false, fromBrowser: false, label: "Started Pro" },
  upgrade_page_viewed:  { feature: "account", meaningful: false, fromBrowser: false, label: "Viewed upgrade" },
} as const satisfies Record<string, EventDef>;

export type EventName = keyof typeof EVENTS;

export function isEventName(x: unknown): x is EventName {
  return typeof x === "string" && Object.prototype.hasOwnProperty.call(EVENTS, x);
}

/** An owner action that counts toward DAU/WAU/MAU. Customers and automations never do. */
export function isMeaningful(event: string, actor: string | null | undefined): boolean {
  return isEventName(event) && EVENTS[event].meaningful && (actor ?? "owner") === "owner";
}

// ── Definitions (tune here) ────────────────────────────────────────────────

/** No meaningful action for this many days = "inactive". */
export const INACTIVE_AFTER_DAYS = 14;
/** Signed up within this many days = "new". */
export const NEW_USER_DAYS = 7;
/** Calendar days are counted in this timezone (Orbit is Nigeria-first). */
export const ANALYTICS_TIMEZONE = process.env.NEXT_PUBLIC_ANALYTICS_TIMEZONE || "Africa/Lagos";

/** Feature adoption rows: unique owners who did any of these in the period. */
export const ADOPTION: { label: string; events: EventName[] }[] = [
  { label: "Clients", events: ["client_created", "client_updated"] },
  { label: "Services", events: ["service_created", "service_updated"] },
  { label: "Bookings", events: ["booking_created", "booking_confirmed", "booking_cancelled", "booking_completed"] },
  { label: "Booking link", events: ["booking_link_created", "booking_link_updated", "booking_link_shared"] },
  { label: "Invoices", events: ["invoice_created", "invoice_sent", "invoice_marked_paid", "payment_link_created"] },
  { label: "Reminders", events: ["reminder_created", "reminder_completed"] },
  { label: "Orbit AI", events: ["ai_assistant_used"] },
];

/**
 * Activation funnel. A step is reached when the owner has done ANY of its
 * events (ever), so a booking-first and an invoice-first business both
 * count. Steps are cumulative: reaching step 4 also requires steps 1-3.
 * "signup" is read from the account itself, not an event.
 */
export const FUNNEL: { label: string; events: EventName[] | "signup" }[] = [
  { label: "Signed up", events: "signup" },
  { label: "Finished onboarding", events: ["onboarding_completed"] },
  { label: "Added a first client", events: ["client_created"] },
  { label: "Set up services or booking link", events: ["service_created", "service_updated", "booking_link_created"] },
  { label: "First booking or invoice", events: ["booking_created", "booking_confirmed", "invoice_created", "payment_link_created"] },
];

/** "Activated" = reached the last funnel step. */
export const ACTIVATION_EVENTS = FUNNEL[FUNNEL.length - 1].events as EventName[];
