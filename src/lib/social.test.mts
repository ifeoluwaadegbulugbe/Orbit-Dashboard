import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeHandle, socialChatUrl, primaryContact } from "./social.ts";

test("keeps just the username from whatever was pasted", () => {
  assert.equal(normalizeHandle("@Amaka.Glam", "instagram"), "amaka.glam");
  assert.equal(normalizeHandle("  amaka_glam ", "instagram"), "amaka_glam");
  assert.equal(normalizeHandle("https://www.instagram.com/amaka.glam/?hl=en", "instagram"), "amaka.glam");
  assert.equal(normalizeHandle("instagram.com/amaka.glam", "instagram"), "amaka.glam");
  assert.equal(normalizeHandle("https://ig.me/m/amaka.glam", "instagram"), "amaka.glam");
  assert.equal(normalizeHandle("https://www.tiktok.com/@amaka.glam?lang=en", "tiktok"), "amaka.glam");
  assert.equal(normalizeHandle("@amaka", "tiktok"), "amaka");
});

test("rejects things that can't be a username", () => {
  assert.equal(normalizeHandle("", "instagram"), null);
  assert.equal(normalizeHandle("@", "instagram"), null);
  assert.equal(normalizeHandle("amaka glam", "instagram"), null);
  assert.equal(normalizeHandle("https://evil.com/amaka", "instagram"), null);
  assert.equal(normalizeHandle("https://www.tiktok.com/@amaka", "instagram"), null);
  assert.equal(normalizeHandle("a".repeat(31), "instagram"), null);
  assert.equal(normalizeHandle("javascript:alert(1)", "tiktok"), null);
});

test("links and list labels", () => {
  assert.equal(socialChatUrl("amaka", "instagram"), "https://ig.me/m/amaka");
  assert.equal(socialChatUrl("amaka", "tiktok"), "https://www.tiktok.com/@amaka");
  assert.equal(primaryContact({ phone: "0803", instagram: "amaka" }), "0803");
  assert.equal(primaryContact({ phone: "", instagram: "amaka" }), "@amaka on Instagram");
  assert.equal(primaryContact({ phone: "", tiktok: "amaka" }), "@amaka on TikTok");
});
