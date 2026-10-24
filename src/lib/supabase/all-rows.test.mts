// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { allRows } from "./all-rows.ts";

const table = Array.from({ length: 2_345 }, (_, i) => ({ id: i }));
// Mimics Supabase: never more than 1,000 rows per request.
const make = () => ({
  range: async (from: number, to: number) => ({ data: table.slice(from, Math.min(to + 1, from + 1000)), error: null }),
});

test("reads every row past Supabase's 1,000-row cap", async () => {
  const { data, error } = await allRows(make);
  assert.equal(error, null);
  assert.equal(data!.length, 2_345);
  assert.equal(data![2_344].id, 2_344);
});

test("stops on an error and reports it", async () => {
  const { error } = await allRows(() => ({ range: async () => ({ data: null, error: { message: "boom" } }) }));
  assert.equal(error?.message, "boom");
});
