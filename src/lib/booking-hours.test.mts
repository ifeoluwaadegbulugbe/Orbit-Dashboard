// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { freeSlots, hoursLabel, displayPrice, validHours, prettyTime } from "./booking-hours.ts";

const weekdays = { days: [1, 2, 3, 4, 5], open: "09:00", close: "12:00" };

test("closed days have no slots (Sunday)", () => {
  assert.deepEqual(freeSlots(weekdays, "2026-10-25", 60, []), []); // 25 Oct 2026 is a Sunday
});

test("open day: 30-minute steps, booking must end by closing", () => {
  assert.deepEqual(freeSlots(weekdays, "2026-10-26", 60, []), ["09:00", "09:30", "10:00", "10:30", "11:00"]);
});

test("existing bookings block overlapping times", () => {
  // busy 10:00-11:00
  assert.deepEqual(freeSlots(weekdays, "2026-10-26", 60, [{ start: 600, end: 660 }]), ["09:00", "11:00"]);
});

test("today: times already passed are hidden", () => {
  assert.deepEqual(freeSlots(weekdays, "2026-10-26", 30, [], 10 * 60), ["10:30", "11:00", "11:30"]);
});

test("labels", () => {
  assert.equal(hoursLabel(weekdays), "Mon–Fri · 9am–12pm");
  assert.equal(hoursLabel({ days: [1, 3, 5], open: "10:00", close: "16:30" }), "Mon, Wed, Fri · 10am–4:30pm");
  assert.equal(hoursLabel({ days: [0, 1, 2, 3, 4, 5, 6], open: "08:00", close: "20:00" }), "Every day · 8am–8pm");
  assert.equal(prettyTime("00:00"), "12am");
});

test("prices: plain numbers get the currency, words stay", () => {
  assert.equal(displayPrice("5000", "₦"), "₦5,000");
  assert.equal(displayPrice("100", "₦"), "₦100");
  assert.equal(displayPrice("Free", "₦"), "Free");
  assert.equal(displayPrice("From ₦5k", "₦"), "From ₦5k");
  assert.equal(displayPrice("", "₦"), "Price on request");
});

test("rejects broken hours", () => {
  assert.equal(validHours({ days: [], open: "09:00", close: "17:00" }), false);
  assert.equal(validHours({ days: [1], open: "18:00", close: "09:00" }), false);
  assert.equal(validHours(weekdays), true);
});
