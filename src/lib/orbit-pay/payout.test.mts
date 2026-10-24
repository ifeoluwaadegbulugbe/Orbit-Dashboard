// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { expectedPayoutDate, formatPayoutDate, shortBankName } from "./payout.ts";

test("weekday payment arrives the next business day", () => {
  assert.equal(expectedPayoutDate("2026-10-21T10:00:00Z"), "2026-10-22"); // Wed -> Thu
});

test("Saturday night payment arrives Monday (Lagos time)", () => {
  assert.equal(expectedPayoutDate("2026-10-24T20:13:20Z"), "2026-10-26");
});

test("Friday payment arrives Monday; late Friday UTC that's already Saturday in Lagos too", () => {
  assert.equal(expectedPayoutDate("2026-10-23T12:00:00Z"), "2026-10-26");
  assert.equal(expectedPayoutDate("2026-10-23T23:30:00Z"), "2026-10-26"); // 00:30 Sat in Lagos
});

test("public holidays are skipped", () => {
  assert.equal(expectedPayoutDate("2026-09-30T10:00:00Z"), "2026-10-02"); // 1 Oct Independence Day
  assert.equal(expectedPayoutDate("2026-12-24T10:00:00Z"), "2026-12-28"); // Christmas, Boxing Day, weekend
  assert.equal(expectedPayoutDate("2026-04-02T10:00:00Z"), "2026-04-07"); // Good Friday 3 Apr, Easter Monday 6 Apr 2026
});

test("friendly formatting", () => {
  assert.equal(formatPayoutDate("2026-10-26"), "Monday 26 Oct");
  assert.equal(shortBankName("OPay Digital Services Limited (OPay)"), "OPay");
  assert.equal(shortBankName("Guaranty Trust Bank"), "Guaranty Trust Bank");
});
