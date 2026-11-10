// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { policyLines, hasPolicies, cleanPolicies, cleanDeposit, depositForService, depositForBooking, EMPTY_POLICIES } from "./booking-policies.ts";

test("no policies set: nothing to show or agree to", () => {
  assert.deepEqual(policyLines(EMPTY_POLICIES), []);
  assert.equal(hasPolicies(undefined), false);
});

test("each option becomes a plain sentence", () => {
  const lines = policyLines({ cancellationHours: 24, latenessMinutes: 15, refunds: "refund_if_in_time", depositDeadlineHours: 12, extra: "  No kids please.  " });
  assert.equal(lines.length, 5);
  assert.match(lines[0], /at least 24 hours before/);
  assert.match(lines[1], /Cancel at least 24 hours before and your deposit is refunded/);
  assert.match(lines[2], /more than 15 minutes late/);
  assert.match(lines[3], /within 12 hours of confirmation/);
  assert.equal(lines[4], "No kids please.");
  assert.deepEqual(policyLines({ refunds: "deposit_non_refundable" }), ["Deposits are non-refundable."]);
});

test("cleaning keeps only the offered options", () => {
  const c = cleanPolicies({ cancellationHours: 999, latenessMinutes: 15, refunds: "whatever" as never, extra: "x".repeat(900) });
  assert.equal(c.cancellationHours, 0);
  assert.equal(c.latenessMinutes, 15);
  assert.equal(c.refunds, "");
  assert.equal(c.extra.length, 500);
});

test("deposits: fixed, percent, capped at the price, never invented", () => {
  assert.equal(cleanDeposit({ kind: "percent", value: 150 }), null);
  assert.equal(cleanDeposit({ kind: "fixed", value: 0 }), null);
  assert.equal(depositForService({ name: "Braids", price: "₦25,000", deposit: { kind: "fixed", value: 10000 } }), 10000);
  assert.equal(depositForService({ name: "Braids", price: "₦25,000", deposit: { kind: "percent", value: 30 } }), 7500);
  assert.equal(depositForService({ name: "Lash", price: "₦8,000", deposit: { kind: "fixed", value: 10000 } }), 8000);
  assert.equal(depositForService({ name: "Consult", price: "Ask me", deposit: { kind: "percent", value: 50 } }), 0);
  assert.equal(depositForService({ name: "Consult", price: "Ask me", deposit: { kind: "fixed", value: 5000 } }), 5000);
  assert.equal(depositForService({ name: "Plain", price: "₦5,000" }), 0);
});

test("a booking's deposit adds up its services", () => {
  const services = [
    { name: "Knotless braids", price: "₦25,000", deposit: { kind: "percent" as const, value: 40 } },
    { name: "Wash", price: "₦3,000" },
    { name: "Lash fill", price: "12000", deposit: { kind: "fixed" as const, value: 5000 } },
  ];
  assert.equal(depositForBooking(services, "Knotless braids + Wash + Lash fill"), 15000);
  assert.equal(depositForBooking(services, "Wash"), 0);
  assert.equal(depositForBooking(services, "Something freehand"), 0);
});
