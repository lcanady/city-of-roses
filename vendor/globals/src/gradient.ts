/**
 * Color resolution + HSL gradient blending for +gname.
 *
 * Color lookup precedence (first match wins):
 *   1. Short ANSI codes: hr, hg, hy, hb, hm, hc, hw, hx (bright) and r, g, y, b, m, c, w, x (dark)
 *   2. CSS named colors (147)
 *   3. xterm 256-color palette names (~240)
 *   4. #rrggbb hex literal
 *
 * Blending happens in HSL space with shortest-arc hue interpolation so red →
 * green stays vivid rather than passing through brown.
 */

import { CSS_COLORS }   from "./colors-css.ts";
import { XTERM_COLORS } from "./colors-xterm.ts";

export interface RGB { r: number; g: number; b: number }

// Short ANSI codes → RGB. Approximate xterm "bright" / "dark" palette values.
const ANSI_COLORS: Readonly<Record<string, string>> = {
  hr: "#ff5555", hg: "#55ff55", hy: "#ffff55", hb: "#5555ff",
  hm: "#ff55ff", hc: "#55ffff", hw: "#ffffff", hx: "#555555",
  r:  "#aa0000", g:  "#00aa00", y:  "#aaaa00", b:  "#0000aa",
  m:  "#aa00aa", c:  "#00aaaa", w:  "#aaaaaa", x:  "#000000",
};

/** Parse a color reference to RGB. Returns null when unknown. */
export function resolveColor(name: string): RGB | null {
  const key = name.trim().toLowerCase();
  if (!key) return null;

  const hex =
    ANSI_COLORS[key]  ??
    CSS_COLORS[key]   ??
    XTERM_COLORS[key] ??
    (/^#?[0-9a-f]{6}$/.test(key) ? (key.startsWith("#") ? key : "#" + key) : null);

  return hex ? hexToRgb(hex) : null;
}

export function hexToRgb(hex: string): RGB {
  const h = hex.replace(/^#/, "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return "#" + c(r) + c(g) + c(b);
}

// ─── HSL ─────────────────────────────────────────────────────────────────────

interface HSL { h: number; s: number; l: number } // h ∈ [0,360), s,l ∈ [0,1]

function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if      (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0));
  else if (max === gn) h = ((bn - rn) / d + 2);
  else                 h = ((rn - gn) / d + 4);
  return { h: h * 60, s, l };
}

function hslToRgb({ h, s, l }: HSL): RGB {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const hk = ((h % 360) + 360) % 360 / 360;
  const q  = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p  = 2 * l - q;
  const t = (n: number) => {
    let x = n;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return {
    r: Math.round(t(hk + 1 / 3) * 255),
    g: Math.round(t(hk)         * 255),
    b: Math.round(t(hk - 1 / 3) * 255),
  };
}

/** Lerp hue along the shortest arc. */
function lerpHue(a: number, b: number, t: number): number {
  const d = ((b - a + 540) % 360) - 180; // signed shortest delta in [-180, 180]
  return (a + d * t + 360) % 360;
}

function lerpHsl(a: HSL, b: HSL, t: number): HSL {
  return {
    h: lerpHue(a.h, b.h, t),
    s: a.s + (b.s - a.s) * t,
    l: a.l + (b.l - a.l) * t,
  };
}

// ─── Blending ────────────────────────────────────────────────────────────────

/**
 * Distribute `steps` color samples across the supplied `stops` (in HSL),
 * with stops anchored at the endpoints and intermediate stops at evenly
 * spaced positions. Returns one RGB per requested step.
 */
export function blendStops(stops: RGB[], steps: number): RGB[] {
  if (stops.length === 0 || steps <= 0) return [];
  if (stops.length === 1) return Array(steps).fill(stops[0]);

  const hslStops = stops.map(rgbToHsl);
  const out: RGB[] = [];
  const lastStop = stops.length - 1;
  const denom = Math.max(1, steps - 1);

  for (let i = 0; i < steps; i++) {
    const pos = (i / denom) * lastStop;        // position in stop-space
    const lo  = Math.floor(pos);
    const hi  = Math.min(lo + 1, lastStop);
    const t   = pos - lo;
    out.push(hslToRgb(lerpHsl(hslStops[lo], hslStops[hi], t)));
  }
  return out;
}

// ─── Public: gradient name ───────────────────────────────────────────────────

/**
 * Render `name` with a color gradient across its letters, given color stops.
 * Whitespace passes through uncolored. Returns null when any stop is unknown.
 *
 * Output format: `<#rrggbb>L<#rrggbb>e…%cn` — MUSH hex color codes per letter
 * with a single trailing reset.
 */
export function gradientName(name: string, stops: string[]): string | null {
  const rgbs: RGB[] = [];
  for (const s of stops) {
    const c = resolveColor(s);
    if (!c) return null;
    rgbs.push(c);
  }

  // Color only the visible characters; treat whitespace as separators.
  const indices: number[] = [];
  for (let i = 0; i < name.length; i++) if (!/\s/.test(name[i])) indices.push(i);
  if (indices.length === 0) return name;

  const palette = blendStops(rgbs, indices.length);
  const out: string[] = [];
  let p = 0;
  for (let i = 0; i < name.length; i++) {
    const ch = name[i];
    if (/\s/.test(ch)) { out.push(ch); continue; }
    out.push(`<${rgbToHex(palette[p++])}>${ch}`);
  }
  return out.join("") + "%cn";
}
