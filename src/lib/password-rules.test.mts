// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { failedRules, passwordProblem } from "./password-rules.ts";

test("a strong password passes", () => {
  assert.equal(passwordProblem("Glam#Nails2026"), null);
});

test("each rule is enforced", () => {
  assert.deepEqual(failedRules("Ab1!"), ["length"]);
  assert.ok(failedRules("lowercase1!x").includes("upper"));
  assert.ok(failedRules("UPPERCASE1!X").includes("lower"));
  assert.ok(failedRules("NoNumbers!!x").includes("number"));
  assert.ok(failedRules("NoSymbol123x").includes("symbol"));
});

test("common or personal passwords are refused even with every rule ticked", () => {
  assert.ok(failedRules("Password1!").includes("guessable"));
  assert.ok(failedRules("Amaka#2026x", "amaka@gmail.com").includes("guessable"));
});

test("friendly message lists what's missing", () => {
  assert.match(passwordProblem("short") ?? "", /at least 8 characters/);
});
