/**
 * Orbit email design tokens.
 *
 * Balance: ~65% warm neutrals, ~25% supporting tones, ~10% Orbit Pink.
 * Pink is the personality layer (CTA, highlight, sticker, a dot on a line),
 * never the background of a whole email.
 */

export const COLOR = {
  // neutrals (~65%)
  canvas: "#F8F4EF",     // Soft Cream - outer background
  paper: "#FFFDF9",      // Warm White - cards, main sheet
  mist: "#EDEBE8",       // Mist Grey - hairlines, card borders
  mistDeep: "#E2DED8",   // card "lift" edge
  ink: "#171719",        // Deep Ink - headlines, primary text
  softBlack: "#222225",  // body copy
  body: "#45433F",       // secondary copy (7.9:1 on paper)
  meta: "#6E6B66",       // metadata, captions (5.1:1 on paper)
  // supporting (~25%)
  pinkSoft: "#FCE7ED",   // Soft Pink - chips, highlights
  pinkPale: "#FFF3F6",   // Pale Pink - tinted panels
  rose: "#C94D6D",       // Muted Rose - annotations, eyebrow text (4.6:1 on paper)
  successBg: "#E6F4EC",
  success: "#1D7A45",
  amberBg: "#FDF2DC",
  amber: "#8A5A00",
  // accent (~10%)
  pink: "#E8557A",       // Orbit Pink
} as const;

/** System stacks only: Gmail and Outlook ignore web fonts. */
export const FONT = {
  sans: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif",
  /** Editorial accent - used for one phrase per headline and handwritten-style notes. */
  serif: "Georgia,'Times New Roman',Times,serif",
} as const;

/** Type scale (px): [size, lineHeight, weight, letterSpacing]. */
export const TYPE = {
  statementXL: [44, 46, 800, -1.6],
  statement: [34, 38, 800, -1.1],
  statementMobile: [32, 36, 800, -1],
  title: [20, 26, 700, -0.3],
  body: [16, 26, 400, 0],
  small: [14, 21, 400, 0],
  meta: [12, 16, 600, 0.2],
  eyebrow: [11, 14, 700, 1.4],
  amount: [30, 34, 800, -0.8],
} as const;

export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48, huge: 64 } as const;
export const RADIUS = { chip: 999, button: 12, card: 16, frame: 24 } as const;

/** Email column width. */
export const WIDTH = 640;
