/**
 * Shared "what should actually happen for this trigger" logic - read by the
 * Automations page, the real send paths (bookings/respond, birthday cron,
 * payment-reminders cron, client-followups cron), and the AI suggest
 * endpoint, so they all agree on the same state instead of drifting.
 */

export type TriggerType =
  | "booking_confirmation" | "birthday" | "payment_reminder" | "client_followup"
  | "appointment_reminder" | "review_request";

export const TRIGGER_TYPES: TriggerType[] = [
  "booking_confirmation",
  "birthday",
  "payment_reminder",
  "client_followup",
  "appointment_reminder",
  "review_request",
];

/**
 * booking_confirmation and birthday already send unconditionally today -
 * defaulting them to enabled just adds an off-switch without changing
 * current behavior. payment_reminder and client_followup are brand new
 * automatic sends to real clients, so they default off until the owner
 * opts in.
 */
export const DEFAULT_ENABLED: Record<TriggerType, boolean> = {
  booking_confirmation: true,
  birthday: true,
  payment_reminder: false,
  client_followup: false,
  // Client reminders already went out unconditionally - default on keeps that.
  appointment_reminder: true,
  // New automatic message to clients - opt-in like the others.
  review_request: false,
};

export interface MessageRuleRow {
  trigger_type: TriggerType;
  enabled: boolean;
  template: string | null;
}

export interface EffectiveRule {
  enabled: boolean;
  template: string | null;
}

export function getEffectiveRule(rows: MessageRuleRow[], triggerType: TriggerType): EffectiveRule {
  const row = rows.find((r) => r.trigger_type === triggerType);
  if (!row) return { enabled: DEFAULT_ENABLED[triggerType], template: null };
  return { enabled: row.enabled, template: row.template };
}

/** Fills {{placeholder}} tokens in a saved template. Unknown tokens are left as-is. */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match,
  );
}
