---
archetype: editorial
archetype_name: "Editorial"
parameters:
  density: 50
  expressiveness: 50
  shape_language: 50
  color_mood: 50
generated: "2026-09-24T03:52:46Z"
---

# Design Blueprint: Editorial

Magazine-inspired layouts with serif headings, generous whitespace, and refined typography. Elegant, content-first design with subtle warm accents.

## CSS Tokens

| Token | Value |
|---|---|
| `--color-primary` | `#1a1a1a` |
| `--color-background` | `#f8f7f4` |
| `--color-accent` | `#7a5a1e` |
| `--color-text` | `#1a1a1a` |
| `--color-muted` | `#6b6560` |
| `--color-border` | `#d4cfc7` |
| `--font-heading` | `Georgia, 'Times New Roman', serif` |
| `--font-body` | `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` |
| `--font-size-base` | `15px` |
| `--line-height` | `1.5` |
| `--border-radius` | `10px` |
| `--border-width` | `2px` |
| `--shadow` | `0 1px 3px rgba(0,0,0,0.06)` |
| `--spacing-unit` | `8px` |
| `--spacing-section` | `48px` |

## Layout Guidelines

Wide margins, generous line lengths (60-75 characters). Use pull quotes and dropcaps to break long content. Two or three column grids for article layouts. Whitespace is a primary design element. Asymmetric balance over rigid symmetry.

## Typography

Serif for headings, sans-serif for body. Headings at moderate sizes with normal weight. Body text at 17px+ for readability. Generous line-height (1.7+). Use italic for emphasis, small-caps for labels. Subtle letter-spacing on uppercase elements.

## Component Guidelines

Buttons: understated, text-based with subtle borders. Cards: minimal borders or none, separated by whitespace. Hover states are subtle color shifts, not dramatic transforms. Forms: clean inputs with thin borders and warm focus rings. Navigation: clean horizontal bar, no background color.

## Expressiveness

Balanced — moderate use of shadows, transitions, and visual hierarchy aids. Decorative elements should reinforce meaning, not distract.

## Color Palette

The color palette is based on the **Editorial** archetype, adjusted for a color mood of **50** (0=cool/desaturated, 100=warm/vibrant).

- **Primary:** `#1a1a1a` — main brand color, used for primary actions and key UI elements
- **Background:** `#f8f7f4` — page and container backgrounds
- **Accent:** `#7a5a1e` — secondary highlights, CTAs, and decorative elements (darkened from the
  archetype's default `#c5a572` — the default value only reaches ~2.18:1 contrast against
  `--color-background` and fails this project's WCAG AA requirement; this value reaches ~5.9:1)
- **Text:** `#1a1a1a` — body text and headings
- **Muted:** `#6b6560` — secondary text, labels, and disabled states (darkened from the archetype's
  default `#8a8580`, which only reaches ~3.40:1 against `--color-background`, below the 4.5:1
  normal-text AA threshold; this value reaches ~5.4:1)
- **Border:** `#d4cfc7` — dividers, input borders, and card outlines (decorative only — never used
  for text, so it is exempt from the text-contrast requirement)

**Contrast rule for any future token use:** any color token used for body-size text (not purely
decorative borders/backgrounds) must be verified against the background it will sit on using the
WCAG 2.x relative-luminance contrast formula, and must reach at least 4.5:1 for normal text or 3:1
for large text (≥18pt / ≥14pt bold), before use in `unit-02-web-app` or `unit-03-chrome-extension`.
