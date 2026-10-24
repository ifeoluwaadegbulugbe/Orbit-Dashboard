// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { priceLabel, billedInNaira, planEnvVar, yearlySaving, NGN_PRICE } from "./pricing.ts";

test("Nigeria: ₦7,500/month or ₦75,000/year, billed natively", () => {
  assert.equal(priceLabel("NG", "monthly"), "₦7,500/month");
  assert.equal(priceLabel("NG", "yearly"), "₦75,000/year");
  assert.equal(billedInNaira("NG"), false);
  assert.equal(yearlySaving("NG"), "₦15,000");
});

test("other African countries see their own currency, one at a time", () => {
  assert.equal(priceLabel("GH", "monthly"), "GH₵75/month");
  assert.equal(priceLabel("KE", "yearly"), "KSh 7,000/year");
  assert.equal(priceLabel("ZA", "monthly"), "R99/month");
  assert.equal(priceLabel("SN", "monthly"), "3,000 CFA/month");
  assert.equal(priceLabel("CM", "monthly"), "3,000 CFA/month");
  assert.equal(priceLabel("MA", "monthly"), "55 MAD/month");
  assert.equal(billedInNaira("GH"), true);
});

test("countries without a set price, and unknown, use naira", () => {
  assert.equal(priceLabel("DZ", "monthly"), "₦7,500/month");
  assert.equal(priceLabel(null, "monthly"), "₦7,500/month");
});

test("every subscription is charged on the naira plans", () => {
  assert.equal(planEnvVar("monthly"), "PAYSTACK_PLAN_NGN_MONTHLY");
  assert.equal(planEnvVar("yearly"), "PAYSTACK_PLAN_NGN_YEARLY");
  assert.equal(NGN_PRICE.yearly, 75_000);
});
