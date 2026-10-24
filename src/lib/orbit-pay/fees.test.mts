// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { orbitFeeKobo, quote, orbitNetKobo, paystackFeeKobo, type Plan, type FeeBearer, type CardRegion } from "./fees.ts";

const N = (naira: number) => naira * 100; // naira -> kobo

test("Free fee: min(2.5% + ₦100, ₦3,500), rounded up to the naira", () => {
  const cases: [number, number][] = [[2_000, 150], [5_000, 225], [20_000, 600], [80_000, 2_100], [300_000, 3_500]];
  for (const [p, fee] of cases) assert.equal(orbitFeeKobo(N(p), "free"), N(fee), `P=₦${p}`);
});

test("Pro fee: min(2.0% + ₦100, ₦2,500), rounded up to the naira", () => {
  const cases: [number, number][] = [[2_000, 140], [5_000, 200], [20_000, 500], [80_000, 1_700], [300_000, 2_500]];
  for (const [p, fee] of cases) assert.equal(orbitFeeKobo(N(p), "pro"), N(fee), `P=₦${p}`);
});

test("fees round UP to the next whole naira", () => {
  assert.equal(orbitFeeKobo(N(2_450), "free"), N(162)); // 2.5% of 2,450 = 61.25 -> 161.25 -> 162
  assert.equal(orbitFeeKobo(N(2_450) + 50, "pro") % 100, 0);
});

test("who pays the fee: merchant absorbs vs client pays", () => {
  const absorb = quote(N(20_000), "free", "merchant");
  assert.deepEqual([absorb.chargeKobo, absorb.merchantKobo], [N(20_000), N(19_400)]);
  const client = quote(N(20_000), "free", "client");
  assert.deepEqual([client.chargeKobo, client.merchantKobo], [N(20_600), N(20_000)]);
});

test("Paystack fee model: ₦100 waived at or below ₦2,500, capped at ₦2,000", () => {
  assert.equal(paystackFeeKobo(N(2_500)), N(37.5));
  assert.equal(paystackFeeKobo(N(2_501)), Math.ceil(N(2_501) * 0.015 + N(100)));
  assert.equal(paystackFeeKobo(N(1_000_000)), N(2_000));
});

test("Orbit never loses money: every P from ₦100 to ₦5,000,000, both plans, both fee settings (local cards)", () => {
  const worst: Record<string, { p: number; net: number }> = {};
  for (const plan of ["free", "pro"] as Plan[]) {
    for (const bearer of ["merchant", "client"] as FeeBearer[]) {
      for (let p = 100; p <= 5_000_000; p += p < 10_000 ? 1 : p < 200_000 ? 7 : 101) {
        const net = orbitNetKobo(quote(N(p), plan, bearer));
        const k = `${plan}/${bearer}`;
        if (!worst[k] || net < worst[k].net) worst[k] = { p, net };
        assert.ok(net >= 0, `${k} P=₦${p}: Orbit net ${net / 100}`);
      }
    }
  }
  // Exact boundaries the step sizes might skip.
  for (const plan of ["free", "pro"] as Plan[]) for (const bearer of ["merchant", "client"] as FeeBearer[])
    for (const p of [2_400, 2_437, 2_438, 2_450, 2_500, 2_501, 120_000, 126_667, 136_000, 5_000_000])
      assert.ok(orbitNetKobo(quote(N(p), plan, bearer)) >= 0, `${plan}/${bearer} P=₦${p}`);
});

test("international cards: higher fee, and Orbit still never loses money", () => {
  assert.ok(orbitFeeKobo(N(20_000), "free", "international") > orbitFeeKobo(N(20_000), "free", "local"));
  for (const plan of ["free", "pro"] as Plan[])
    for (const bearer of ["merchant", "client"] as FeeBearer[])
      for (let p = 100; p <= 5_000_000; p += p < 10_000 ? 3 : 997) {
        const region: CardRegion = "international";
        assert.ok(orbitNetKobo(quote(N(p), plan, bearer, region)) >= 0, `${plan}/${bearer} intl P=₦${p}`);
      }
});

test("rejects bad amounts", () => {
  assert.throws(() => orbitFeeKobo(0, "free"));
  assert.throws(() => orbitFeeKobo(150.5, "free"));
});
