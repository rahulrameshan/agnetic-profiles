/*
 * theme.js
 * --------
 * Derives a full, readable palette from a single chosen text colour.
 *
 * Only the text colour is ever stored. The background is computed here so the
 * pair can never drift into an unreadable combination — pick black text and you
 * get a near-white background, pick green and you get near-black.
 *
 * Contrast is measured with the WCAG 2.1 relative-luminance formula. AA body
 * text needs 4.5:1; we aim for AA_TARGET and treat MIN_CONTRAST as the floor
 * that must be met before we stop pushing the background further away.
 */

export const DEFAULT_THEME_COLOR = "#00ff00";

/*
 * The theme for pages that belong to nobody — landing, login, signup.
 *
 * Those pages have no owner whose colour to borrow, so they get the site's own
 * identity: black on light. Deliberately not the default green, which is a
 * per-user starting point rather than the product's own look.
 */
export const SITE_THEME_COLOR = "#000000";

const AA_TARGET = 7;      // comfortable — AAA for body text
const MIN_CONTRAST = 4.5; // hard floor — WCAG AA

/* ── colour conversion ─────────────────────────────── */

export function hexToRgb(hex) {
  const clean = String(hex).replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean.split("").map((c) => c + c).join("")
      : clean.padEnd(6, "0").slice(0, 6);

  return {
    r: parseInt(full.slice(0, 2), 16) || 0,
    g: parseInt(full.slice(2, 4), 16) || 0,
    b: parseInt(full.slice(4, 6), 16) || 0,
  };
}

const toHex = (n) =>
  Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");

export const rgbToHex = ({ r, g, b }) => `#${toHex(r)}${toHex(g)}${toHex(b)}`;

export function isValidHex(hex) {
  return /^#[0-9a-fA-F]{6}$/.test(String(hex).trim());
}

/* ── HSL, needed to rotate hue for the control colour ── */

export function rgbToHsl({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;

  if (delta === 0) return { h: 0, s: 0, l };

  const s = delta / (1 - Math.abs(2 * l - 1));

  let h;
  if (max === rn) h = ((gn - bn) / delta) % 6;
  else if (max === gn) h = (bn - rn) / delta + 2;
  else h = (rn - gn) / delta + 4;

  h = h * 60;
  if (h < 0) h += 360;

  return { h, s, l };
}

export function hslToHex({ h, s, l }) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let rgb;
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];

  return rgbToHex({
    r: (rgb[0] + m) * 255,
    g: (rgb[1] + m) * 255,
    b: (rgb[2] + m) * 255,
  });
}

/* ── contrast ──────────────────────────────────────── */

/* WCAG relative luminance: sRGB channels are gamma-encoded, so they must be
 * linearised before weighting. */
export function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);

  const channel = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/* ── palette derivation ────────────────────────────── */

/* Blend two colours. amount=0 returns `from`, amount=1 returns `to`. */
export function mix(from, to, amount) {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  return rgbToHex({
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount,
  });
}

/*
 * Pick a background for the given text colour.
 *
 * Both a dark and a light candidate are built by pulling the text colour most
 * of the way toward black or white — that keeps a hint of the chosen hue rather
 * than landing on flat #000/#fff. Whichever contrasts better wins, and if it
 * still falls short it is pushed the rest of the way.
 */
export function deriveBackground(textColor) {
  const darkCandidate = mix(textColor, "#000000", 0.94);
  const lightCandidate = mix(textColor, "#ffffff", 0.94);

  const darkRatio = contrastRatio(textColor, darkCandidate);
  const lightRatio = contrastRatio(textColor, lightCandidate);

  let background = darkRatio >= lightRatio ? darkCandidate : lightCandidate;
  let towards = darkRatio >= lightRatio ? "#000000" : "#ffffff";

  /* Mid-luminance colours (olive, mid-grey) can't reach the target against
   * either extreme. Push as far as the extreme and accept what we get — the
   * checker below reports the real number rather than pretending. */
  let amount = 0.94;
  while (contrastRatio(textColor, background) < AA_TARGET && amount < 1) {
    amount = Math.min(1, amount + 0.02);
    background = mix(textColor, towards, amount);
  }

  return background;
}

/*
 * The third colour: what buttons and inputs are drawn in.
 *
 * Borders tinted toward the background disappear, and borders in the accent
 * colour blend into the accent text beside them. So controls get their own hue
 * — the accent rotated 180° — lightened or darkened until it clears
 * UI_MIN_CONTRAST against the background (WCAG 1.4.11 for non-text elements).
 *
 * A greyscale accent (black, white, grey) has no hue to rotate, so it falls
 * back to a mid neutral that reads clearly on either background.
 */
export const UI_MIN_CONTRAST = 3;   // WCAG 1.4.11 floor for non-text UI
const UI_TARGET_CONTRAST = 4.5;     // what we aim for before giving up

export function deriveControl(textColor, background) {
  const bgIsDark = luminance(background) < 0.5;
  const hsl = rgbToHsl(hexToRgb(textColor));

  let candidate;
  if (hsl.s < 0.15) {
    candidate = bgIsDark ? "#a8b0b8" : "#4a5158";
  } else {
    candidate = hslToHex({
      h: (hsl.h + 180) % 360,
      s: Math.min(0.85, Math.max(0.45, hsl.s)),
      l: bgIsDark ? 0.62 : 0.38,
    });
  }

  /* Walk toward the far extreme until the control reads clearly. */
  const towards = bgIsDark ? "#ffffff" : "#000000";
  let amount = 0;
  while (
    contrastRatio(candidate, background) < UI_TARGET_CONTRAST &&
    amount < 1
  ) {
    amount += 0.04;
    candidate = mix(candidate, towards, 0.04);
  }

  return candidate;
}

/*
 * Build every token the stylesheets consume from one colour.
 *
 * `body` is deliberately a near-neutral rather than the accent: long prose in a
 * saturated colour is tiring to read, so the accent is used for labels, borders
 * and terminal text, and prose gets a high-contrast neutral.
 */
export function buildPalette(textColor) {
  const color = isValidHex(textColor) ? textColor.toLowerCase() : DEFAULT_THEME_COLOR;
  const background = deriveBackground(color);
  const bgIsDark = luminance(background) < 0.5;
  const control = deriveControl(color, background);

  const neutral = bgIsDark ? "#ffffff" : "#000000";

  return {
    color,
    background,
    bgIsDark,
    /* accent family */
    accent: color,
    accentDim: mix(color, background, 0.25),
    accentGlow: mix(background, color, 0.12),
    /* surfaces */
    surface: mix(background, neutral, 0.045),
    border: mix(background, neutral, 0.12),
    /* prose */
    body: mix(neutral, background, 0.06),
    muted: mix(neutral, background, 0.35),
    subtle: mix(neutral, background, 0.6),
    /* Errors stay red for meaning, but a light red on a light background is
     * unreadable, so the shade follows the background. */
    error: bgIsDark ? "#ff6b6b" : "#b00020",
    /* Third colour — borders and labels for buttons and inputs. */
    control: control,
    controlSoft: mix(control, background, 0.75),
    /* reported so the UI can show the real numbers */
    contrast: contrastRatio(color, background),
    meetsAA: contrastRatio(color, background) >= MIN_CONTRAST,
    controlContrast: contrastRatio(control, background),
    controlVisible: contrastRatio(control, background) >= UI_MIN_CONTRAST,
  };
}

/*
 * Write the palette onto a DOM element as CSS custom properties.
 *
 * The names match the tokens already defined in global.css, so every existing
 * stylesheet picks the theme up without being touched.
 */
export function applyTheme(textColor, element) {
  const target = element || document.documentElement;
  const p = buildPalette(textColor);

  const tokens = {
    "--green": p.accent,
    "--green-dim": p.accentDim,
    "--green-glow": p.accentGlow,
    "--black": p.background,
    "--card-bg": p.surface,
    "--card-border": p.border,
    "--white": p.body,
    "--grey-light": p.muted,
    "--grey-mid": p.subtle,
    "--grey-dark": p.border,
    /* semantic aliases for the newer components */
    "--theme-accent": p.accent,
    "--theme-bg": p.background,
    "--theme-surface": p.surface,
    "--theme-border": p.border,
    "--theme-body": p.body,
    "--theme-muted": p.muted,
    "--theme-error": p.error,
    "--theme-control": p.control,
    "--theme-control-soft": p.controlSoft,
  };

  Object.entries(tokens).forEach(([name, value]) =>
    target.style.setProperty(name, value)
  );

  /* body carries the page background, so it has to be set explicitly. */
  if (!element) {
    document.body.style.backgroundColor = p.background;
    document.body.style.color = p.body;
  }

  return p;
}
