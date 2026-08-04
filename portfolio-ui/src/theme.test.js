/*
 * theme.test.js
 * -------------
 * The readability guarantee is the whole point of the feature, so it is tested
 * directly rather than eyeballed: whatever colour a user picks, the derived
 * background must clear WCAG AA against it.
 */

import {
  buildPalette,
  contrastRatio,
  deriveBackground,
  isValidHex,
  luminance,
  DEFAULT_THEME_COLOR,
  UI_MIN_CONTRAST,
} from "./theme";

const AA = 4.5;

test("luminance ranks black below white", () => {
  expect(luminance("#000000")).toBeCloseTo(0, 5);
  expect(luminance("#ffffff")).toBeCloseTo(1, 5);
});

test("contrast of black on white is the known 21:1", () => {
  expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
});

test("black text gets a light background, not a black one", () => {
  const bg = deriveBackground("#000000");
  expect(luminance(bg)).toBeGreaterThan(0.5);
  expect(contrastRatio("#000000", bg)).toBeGreaterThanOrEqual(AA);
});

test("white text gets a dark background", () => {
  const bg = deriveBackground("#ffffff");
  expect(luminance(bg)).toBeLessThan(0.5);
  expect(contrastRatio("#ffffff", bg)).toBeGreaterThanOrEqual(AA);
});

test("the default green keeps its dark background", () => {
  const p = buildPalette(DEFAULT_THEME_COLOR);
  expect(p.bgIsDark).toBe(true);
  expect(p.contrast).toBeGreaterThanOrEqual(AA);
});

describe("every reasonable colour choice stays readable", () => {
  const colors = [
    "#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff",
    "#ffff00", "#00ffff", "#ff00ff", "#808080", "#7f7f00",
    "#123456", "#ff8800", "#4b0082", "#006400", "#c0c0c0",
    "#2e2e2e", "#e0e0e0", "#556b2f", "#8b0000", "#00008b",
  ];

  test.each(colors)("%s meets WCAG AA against its derived background", (color) => {
    const p = buildPalette(color);
    expect(p.contrast).toBeGreaterThanOrEqual(AA);
    expect(p.meetsAA).toBe(true);
  });
});

test("body text is readable against the background too", () => {
  ["#000000", "#00ff00", "#808080", "#ff8800"].forEach((color) => {
    const p = buildPalette(color);
    expect(contrastRatio(p.body, p.background)).toBeGreaterThanOrEqual(AA);
  });
});

describe("the control colour is a visible third colour", () => {
  const colors = [
    "#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff",
    "#ffff00", "#00ffff", "#ff00ff", "#808080", "#7f7f00",
    "#123456", "#ff8800", "#4b0082", "#006400", "#c0c0c0",
    "#b388ff", "#00e5ff", "#ff3d7f", "#e0e0e0", "#2e2e2e",
  ];

  /* WCAG 1.4.11 requires 3:1 for non-text UI like borders. */
  test.each(colors)("%s gives a control colour visible on its background", (color) => {
    const p = buildPalette(color);
    expect(contrastRatio(p.control, p.background)).toBeGreaterThanOrEqual(
      UI_MIN_CONTRAST
    );
    expect(p.controlVisible).toBe(true);
  });

  test.each(colors)("%s control is distinguishable from the accent", (color) => {
    const p = buildPalette(color);
    /* Either a different hue or a clear lightness step — never the same colour. */
    expect(p.control.toLowerCase()).not.toBe(p.accent.toLowerCase());
  });

  test("a greyscale accent still gets a visible control colour", () => {
    ["#000000", "#ffffff", "#808080"].forEach((color) => {
      const p = buildPalette(color);
      expect(contrastRatio(p.control, p.background)).toBeGreaterThanOrEqual(3);
    });
  });
});

test("invalid input falls back to the default rather than producing garbage", () => {
  expect(isValidHex("nonsense")).toBe(false);
  expect(buildPalette("nonsense").color).toBe(DEFAULT_THEME_COLOR);
  expect(buildPalette(undefined).color).toBe(DEFAULT_THEME_COLOR);
});
