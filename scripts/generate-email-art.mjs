/**
 * Orbit email doodles - the "whimsy system" assets (public/email/*.png).
 *
 * Small hand-drawn marks used sparingly around real-text UI cards: a spark,
 * a pink scribble underline, curly arrows, a cursor, and an orbit line with
 * a travelling pink dot. Gmail doesn't render SVG, so they're drawn as SVG
 * here and rasterised to transparent PNGs at 2x for crisp retina display.
 * No text is ever baked in.
 *
 *   node scripts/generate-email-art.mjs
 */

import sharp from "sharp";
import { mkdirSync, rmSync, readdirSync } from "node:fs";

const INK = "#171719";
const PINK = "#E8557A";
const ROSE = "#C94D6D";

/** Each doodle: [name, width, height (at 1x), svg body]. Rendered at 2x. */
const DOODLES = [
  ["spark", 24, 24,
    `<path d="M12 1.5 C13 8 16 11 22.5 12 C16 13 13 16 12 22.5 C11 16 8 13 1.5 12 C8 11 11 8 12 1.5 Z" fill="${PINK}"/>`],
  ["spark-ink", 24, 24,
    `<path d="M12 1.5 C13 8 16 11 22.5 12 C16 13 13 16 12 22.5 C11 16 8 13 1.5 12 C8 11 11 8 12 1.5 Z" fill="${INK}"/>`],
  // loose, slightly uneven marker underline
  ["underline", 220, 16,
    `<path d="M4 10 C40 5 80 4 120 6 C150 7.5 180 9 216 6" fill="none" stroke="${PINK}" stroke-width="5" stroke-linecap="round" opacity="0.9"/>
     <path d="M30 13 C70 10.5 120 10 190 11.5" fill="none" stroke="${PINK}" stroke-width="2.5" stroke-linecap="round" opacity="0.55"/>`],
  // curly arrow pointing down-left (annotation -> card below)
  ["arrow-down-left", 64, 56,
    `<path d="M58 6 C40 4 30 14 34 24 C38 34 52 30 46 22 C40 14 22 22 14 46" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
     <path d="M7 36 L13 48 L25 43" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`],
  // gentle arrow pointing right (before -> after)
  ["arrow-right", 64, 32,
    `<path d="M4 20 C20 8 38 8 56 16" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>
     <path d="M46 8 L57 16 L47 25" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`],
  // classic pointer cursor
  ["cursor", 22, 26,
    `<path d="M3 2 L3 21 L8 16.5 L11.5 24 L15 22.5 L11.6 15 L18.5 15 Z" fill="${INK}" stroke="#FFFFFF" stroke-width="1.6" stroke-linejoin="round"/>`],
  // orbit line: thin arc with a small pink "planet-less" dot travelling on it
  ["orbit-line", 600, 48,
    `<path d="M8 40 C150 2 450 2 592 40" fill="none" stroke="${INK}" stroke-opacity="0.18" stroke-width="1.4" stroke-dasharray="1 6" stroke-linecap="round"/>
     <circle cx="404" cy="13.5" r="5" fill="${PINK}"/><circle cx="404" cy="13.5" r="9" fill="none" stroke="${PINK}" stroke-opacity="0.3" stroke-width="1.4"/>`],
  // small orbit ring + dot for corners of cards / stickers
  ["orbit-dot", 56, 40,
    `<ellipse cx="28" cy="20" rx="25" ry="12" fill="none" stroke="${ROSE}" stroke-opacity="0.45" stroke-width="1.4" transform="rotate(-14 28 20)"/>
     <circle cx="49" cy="12" r="3.6" fill="${PINK}"/>`],
];

mkdirSync("public/email", { recursive: true });
// Remove art from earlier directions (e.g. the old hero-*.png planets).
for (const f of readdirSync("public/email")) {
  if (!DOODLES.some(([n]) => f === `${n}.png`)) rmSync(`public/email/${f}`);
}
for (const [name, w, h, body] of DOODLES) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 2}" height="${h * 2}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
  await sharp(Buffer.from(svg), { density: 192 }).resize(w * 2, h * 2).png({ compressionLevel: 9 }).toFile(`public/email/${name}.png`);
  console.log(`public/email/${name}.png  (${w}x${h} @2x)`);
}
