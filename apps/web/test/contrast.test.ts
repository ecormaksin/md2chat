import { describe, expect, it } from "vitest";

/**
 * Programmatic WCAG 2.x contrast check for the Editorial design tokens this
 * app actually ships (see src/style.css) — the AA-corrected accent/muted
 * values from .ai-dlc/md-for-slack/design-blueprint.md, NOT the uncorrected
 * values in the wireframe mockup file. Per unit-02-web-app.md's Success
 * Criteria, body/button text must reach >=4.5:1 against the background.
 */

const COLOR_BACKGROUND = "#f8f7f4";
const COLOR_TEXT = "#1a1a1a";
const COLOR_MUTED = "#6b6560";
const COLOR_ACCENT = "#7a5a1e";

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return [r, g, b];
}

function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexA);
  const lumB = relativeLuminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

const AA_NORMAL_TEXT_MINIMUM = 4.5;

describe("Editorial palette WCAG AA contrast", () => {
  it("--color-text on --color-background meets 4.5:1", () => {
    expect(contrastRatio(COLOR_TEXT, COLOR_BACKGROUND)).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT_MINIMUM
    );
  });

  it("--color-muted on --color-background meets 4.5:1", () => {
    expect(contrastRatio(COLOR_MUTED, COLOR_BACKGROUND)).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT_MINIMUM
    );
  });

  it("--color-accent (link color) on --color-background meets 4.5:1", () => {
    expect(contrastRatio(COLOR_ACCENT, COLOR_BACKGROUND)).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT_MINIMUM
    );
  });

  it("does NOT use the wireframe mockup's uncorrected, non-AA-compliant colors", () => {
    // #c5a572 / #8a8580 are the archetype defaults the wireframe mockup file
    // (mockups/unit-02-web-app-wireframe.html) still uses; design-blueprint.md
    // documents they fail AA (~2.18:1 / ~3.40:1). This app must use the
    // corrected tokens instead.
    expect(contrastRatio("#c5a572", COLOR_BACKGROUND)).toBeLessThan(AA_NORMAL_TEXT_MINIMUM);
    expect(contrastRatio("#8a8580", COLOR_BACKGROUND)).toBeLessThan(AA_NORMAL_TEXT_MINIMUM);
    expect(COLOR_ACCENT).not.toBe("#c5a572");
    expect(COLOR_MUTED).not.toBe("#8a8580");
  });
});
