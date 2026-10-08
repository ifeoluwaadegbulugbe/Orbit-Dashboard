/**
 * Generates the hero illustrations for Orbit's lifecycle emails
 * (public/email/hero-*.png). Email clients like Gmail don't render SVG,
 * so the art is drawn as SVG here and rasterised to PNG with sharp.
 *
 * No text is baked into the images - headlines stay live text in the
 * email, so screen readers and image-blocking mail apps still get them.
 *
 *   node scripts/generate-email-art.mjs
 */

import sharp from "sharp";
import { mkdirSync } from "node:fs";

const W = 1200, H = 640;

// Orbit palette, night-sky edition
const C = {
  bg: "#110C18",
  grid: "#2A2036",
  pink: "#E8557A",
  pinkHot: "#FF7AA2",
  pinkDeep: "#C41570",
  lav: "#8E86FF",
  lavSoft: "#B9B4FF",
  cream: "#F7F1EC",
  card: "#1E1729",
  cardEdge: "#3A2D4A",
};

const sparkle = (x, y, r, fill, o = 1) =>
  `<path transform="translate(${x} ${y})" opacity="${o}" fill="${fill}" d="M0 ${-r} L${r * 0.22} ${-r * 0.22} L${r} 0 L${r * 0.22} ${r * 0.22} L0 ${r} L${-r * 0.22} ${r * 0.22} L${-r} 0 L${-r * 0.22} ${-r * 0.22} Z"/>`;

/** Icons drawn inside the floating "app card" (card is 260x260 at origin). */
const ICONS = {
  // rocket lifting off
  welcome: `
    <g transform="translate(130 130) rotate(35)">
      <path d="M0 -92 C40 -60 44 0 30 50 L-30 50 C-44 0 -40 -60 0 -92 Z" fill="${C.cream}"/>
      <circle cx="0" cy="-20" r="18" fill="${C.lav}" stroke="${C.bg}" stroke-width="6"/>
      <path d="M-30 20 L-58 62 L-30 52 Z M30 20 L58 62 L30 52 Z" fill="${C.pink}"/>
      <path d="M-18 54 Q0 120 18 54 Z" fill="${C.pinkHot}"/>
      <path d="M-9 56 Q0 96 9 56 Z" fill="${C.cream}"/>
    </g>`,
  // price tag
  first_service: `
    <g transform="translate(130 130) rotate(-20)">
      <path d="M-70 -50 L40 -50 L80 0 L40 50 L-70 50 Q-80 50 -80 40 L-80 -40 Q-80 -50 -70 -50 Z" fill="${C.cream}"/>
      <circle cx="38" cy="0" r="12" fill="${C.card}"/>
      <rect x="-60" y="-22" width="70" height="12" rx="6" fill="${C.pink}"/>
      <rect x="-60" y="4" width="46" height="12" rx="6" fill="${C.lav}"/>
    </g>`,
  // calendar with a check
  booking_link: `
    <g transform="translate(130 130)">
      <rect x="-80" y="-72" width="160" height="150" rx="22" fill="${C.cream}"/>
      <rect x="-80" y="-72" width="160" height="44" rx="22" fill="${C.pink}"/>
      <rect x="-80" y="-48" width="160" height="20" fill="${C.pink}"/>
      <rect x="-48" y="-92" width="14" height="36" rx="7" fill="${C.lavSoft}"/>
      <rect x="34" y="-92" width="14" height="36" rx="7" fill="${C.lavSoft}"/>
      ${[-50, -14, 22, 58].map((x) => [-6, 26].map((y) => `<circle cx="${x}" cy="${y}" r="7" fill="${C.cardEdge}"/>`).join("")).join("")}
      <circle cx="22" cy="54" r="22" fill="${C.lav}"/>
      <path d="M11 54 L19 62 L34 46" fill="none" stroke="${C.cream}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    </g>`,
  // three clients
  add_clients: `
    <g transform="translate(130 140)">
      ${[[-62, 10, C.lav], [62, 10, C.lavSoft], [0, -6, C.pink]].map(([x, y, f]) => `
        <circle cx="${x}" cy="${y - 34}" r="${x === 0 ? 30 : 24}" fill="${f}"/>
        <path d="M${x - (x === 0 ? 52 : 42)} ${y + 50} Q${x} ${y - 16} ${x + (x === 0 ? 52 : 42)} ${y + 50} Z" fill="${f}"/>`).join("")}
    </g>`,
  // receipt
  first_invoice: `
    <g transform="translate(130 128) rotate(6)">
      <path d="M-62 -84 L62 -84 L62 76 L46 88 L31 76 L16 88 L0 76 L-16 88 L-31 76 L-46 88 L-62 76 Z" fill="${C.cream}"/>
      <rect x="-42" y="-58" width="84" height="12" rx="6" fill="${C.pink}"/>
      ${[-26, -6, 14].map((y, i) => `<rect x="-42" y="${y}" width="${[70, 52, 62][i]}" height="9" rx="4.5" fill="${C.cardEdge}"/>`).join("")}
      <rect x="-42" y="40" width="84" height="16" rx="8" fill="${C.lav}"/>
    </g>`,
  // card + coin
  first_payment: `
    <g transform="translate(118 140) rotate(-12)">
      <rect x="-86" y="-54" width="172" height="108" rx="18" fill="${C.cream}"/>
      <rect x="-86" y="-30" width="172" height="20" fill="${C.cardEdge}"/>
      <rect x="-66" y="6" width="34" height="26" rx="6" fill="${C.lavSoft}"/>
      <rect x="-20" y="14" width="70" height="10" rx="5" fill="${C.pink}"/>
    </g>
    <g transform="translate(196 74)">
      <circle r="38" fill="${C.pinkHot}"/><circle r="28" fill="none" stroke="${C.cream}" stroke-width="5" opacity="0.8"/>
      ${sparkle(0, 0, 14, C.cream)}
    </g>`,
  // progress ring
  finish_setup: `
    <g transform="translate(130 130)">
      <circle r="78" fill="none" stroke="${C.cardEdge}" stroke-width="22"/>
      <circle r="78" fill="none" stroke="${C.pink}" stroke-width="22" stroke-linecap="round"
        stroke-dasharray="${2 * Math.PI * 78 * 0.75} 999" transform="rotate(-90)"/>
      <path d="M-30 2 L-8 24 L32 -20" fill="none" stroke="${C.cream}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
    </g>`,
  // pro crown
  checkout_abandoned: `
    <g transform="translate(130 136)">
      <path d="M-84 40 L-96 -52 L-44 -10 L0 -76 L44 -10 L96 -52 L84 40 Z" fill="${C.pinkHot}"/>
      <rect x="-84" y="40" width="168" height="26" rx="10" fill="${C.cream}"/>
      ${[-96, 0, 96].map((x, i) => `<circle cx="${x}" cy="${[-52, -76, -52][i]}" r="12" fill="${C.lavSoft}"/>`).join("")}
    </g>`,
};

function hero(icon) {
  const dots = [];
  for (let x = 30; x < W; x += 40) for (let y = 30; y < H; y += 40) dots.push(`<circle cx="${x}" cy="${y}" r="1.6"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="planet" cx="35%" cy="30%" r="75%">
      <stop offset="0" stop-color="${C.pinkHot}"/><stop offset="0.55" stop-color="${C.pink}"/><stop offset="1" stop-color="${C.pinkDeep}"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="${C.pink}" stop-opacity="0.35"/><stop offset="1" stop-color="${C.pink}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="cardg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#271D35"/><stop offset="1" stop-color="${C.card}"/>
    </linearGradient>
    <!-- front half of the ring = below its own tilted centre line -->
    <clipPath id="frontHalf"><rect x="-200" y="330" width="1000" height="400" transform="rotate(-16 300 330)"/></clipPath>
  </defs>
  <rect width="${W}" height="${H}" rx="36" fill="${C.bg}"/>
  <g fill="${C.grid}">${dots.join("")}</g>

  <!-- orbit paths -->
  <ellipse cx="600" cy="340" rx="560" ry="150" fill="none" stroke="${C.lav}" stroke-opacity="0.25" stroke-width="2" stroke-dasharray="6 12"/>
  <ellipse cx="600" cy="340" rx="420" ry="250" fill="none" stroke="${C.pink}" stroke-opacity="0.18" stroke-width="2"/>

  <!-- planet with ring (ring back half, planet, ring front half) -->
  <circle cx="300" cy="330" r="230" fill="url(#glow)"/>
  <ellipse cx="300" cy="330" rx="230" ry="52" fill="none" stroke="${C.lavSoft}" stroke-width="14" stroke-opacity="0.55" transform="rotate(-16 300 330)"/>
  <circle cx="300" cy="330" r="148" fill="url(#planet)"/>
  <ellipse cx="258" cy="282" rx="46" ry="28" fill="${C.cream}" opacity="0.18"/>
  <circle cx="352" cy="384" r="16" fill="${C.pinkDeep}" opacity="0.5"/><circle cx="238" cy="378" r="10" fill="${C.pinkDeep}" opacity="0.45"/>
  <g clip-path="url(#frontHalf)">
    <ellipse cx="300" cy="330" rx="230" ry="52" fill="none" stroke="${C.lavSoft}" stroke-width="14" transform="rotate(-16 300 330)"/>
  </g>

  <!-- little moon on the orbit -->
  <circle cx="1080" cy="300" r="26" fill="${C.lav}"/><circle cx="1072" cy="292" r="8" fill="${C.lavSoft}" opacity="0.6"/>

  <!-- floating app card -->
  <g transform="translate(700 150) rotate(5 130 170)">
    <rect x="-10" y="-10" width="300" height="360" rx="40" fill="${C.pink}" opacity="0.12"/>
    <rect x="0" y="0" width="280" height="340" rx="34" fill="url(#cardg)" stroke="${C.cardEdge}" stroke-width="3"/>
    <circle cx="36" cy="34" r="7" fill="${C.pink}"/><circle cx="58" cy="34" r="7" fill="${C.lav}"/><circle cx="80" cy="34" r="7" fill="${C.cardEdge}"/>
    <g transform="translate(10 50)">${ICONS[icon]}</g>
    <rect x="34" y="296" width="130" height="14" rx="7" fill="${C.cardEdge}"/>
    <rect x="176" y="292" width="70" height="22" rx="11" fill="${C.pink}"/>
  </g>

  ${sparkle(560, 120, 26, C.cream)}${sparkle(1110, 520, 18, C.pinkHot)}${sparkle(120, 110, 14, C.lavSoft)}
  ${sparkle(640, 560, 12, C.cream, 0.7)}${sparkle(1040, 110, 10, C.cream, 0.6)}${sparkle(90, 560, 10, C.pink, 0.8)}
</svg>`;
}

mkdirSync("public/email", { recursive: true });
for (const icon of Object.keys(ICONS)) {
  await sharp(Buffer.from(hero(icon)), { density: 144 })
    .resize(W, H)
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toFile(`public/email/hero-${icon}.png`);
  console.log(`public/email/hero-${icon}.png`);
}
