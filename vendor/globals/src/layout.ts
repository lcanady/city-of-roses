/**
 * @ursamu/globals — Layout Utilities
 *
 * Pure string-manipulation helpers for building 78-char MUSH output.
 * No SDK dependency — copy any function into your own scripts.
 *
 * MUSH color codes understood by these functions:
 *   %ch  bold/bright       %cn  reset
 *   %cw  white             %cr  red       %cg  green    %cy  yellow
 *   %cb  blue              %cm  magenta   %cc  cyan      %cx  dark gray
 *   %cX  (any single char) — all treated as zero-width
 *
 * Raw ANSI escapes (\x1b[…m) are also stripped when measuring width.
 */

import type { GlobalsTheme } from "./theme.ts";
import { renderHeader, renderDivider, renderFooter } from "./renderer.ts";

// ─── Visible Width ────────────────────────────────────────────────────────────

/**
 * Returns the number of *visible* characters in a string — i.e. the display
 * width after stripping MUSH color codes and ANSI escape sequences.
 */
export function visibleLength(s: string): number {
  return s
    // deno-lint-ignore no-control-regex
    .replace(/\x1b\[[0-9;]*m/g, "")     // raw ANSI escapes
    .replace(/<#[0-9a-fA-F]{6}>/g, "")  // inline hex color codes from +gname / moniker
    .replace(/%c[a-zA-Z]/g, "")         // MUSH color codes  (%cX, %ch, %cn, …)
    .replace(/%[rRnt]/g, "")            // MUSH subs that produce no visible char
    .length;
}

// ─── Padding ─────────────────────────────────────────────────────────────────

/** Left-pad: pad `s` on the right so its *visible* width equals `n`. */
export function padLeft(s: string, n: number, char = " "): string {
  const extra = Math.max(0, n - visibleLength(s));
  return s + char.repeat(extra);
}

/** Right-pad: pad `s` on the left so its *visible* width equals `n`. */
export function padRight(s: string, n: number, char = " "): string {
  const extra = Math.max(0, n - visibleLength(s));
  return char.repeat(extra) + s;
}

/** Center: surround `s` with equal padding so its *visible* width equals `n`. */
export function padCenter(s: string, n: number, char = " "): string {
  const extra = Math.max(0, n - visibleLength(s));
  const left  = Math.floor(extra / 2);
  return char.repeat(left) + s + char.repeat(extra - left);
}

// ─── Block Elements ───────────────────────────────────────────────────────────

/**
 * Full-width header line with the title centered between border chars.
 *
 *   header("The Grand Hall", t)
 *   → "============================= The Grand Hall =============================="
 *     (78 chars, bright white borders, bright white title)
 */
export function header(title: string, t?: GlobalsTheme): Promise<string> {
  return renderHeader(title, t?.width);
}

/**
 * Full-width footer — a solid border line.
 *
 *   footer(t)  →  "=========================================…" (78 chars)
 */
export function footer(t?: GlobalsTheme): Promise<string> {
  return renderFooter(t?.width);
}

/**
 * Full-width section divider with an optional centered label.
 *
 *   divider("Players", t)   →  "------------ Players ------------"
 *   divider(null, t)        →  "------------------------------------"
 */
export function divider(label: string | null, t?: GlobalsTheme): Promise<string> {
  return renderDivider(label, t?.width);
}

// ─── Word Wrap ────────────────────────────────────────────────────────────────

/**
 * Word-wrap `text` to `width` visible characters, returning one line per entry.
 * `indent` is prepended to every line (e.g. "  " for a 2-space indent).
 * Color codes in the text are preserved; they don't count toward the width.
 */
export function wrap(text: string, width: number, indent = ""): string[] {
  const indentVis = visibleLength(indent);
  const words     = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current     = indent;
  let currentVis  = indentVis;

  for (const word of words) {
    const wv = visibleLength(word);
    if (currentVis > indentVis && currentVis + 1 + wv > width) {
      lines.push(current);
      current    = indent + word;
      currentVis = indentVis + wv;
    } else {
      if (currentVis > indentVis) { current += " "; currentVis++; }
      current    += word;
      currentVis += wv;
    }
  }
  if (current.trim()) lines.push(current);
  return lines;
}

// ─── Multi-Column Layout ──────────────────────────────────────────────────────

/**
 * Render rows of [left, right] pairs in two columns.
 *
 *   columns([["Market (m)", "North (n)"], ["Inn (i)", "South (s)"]], 38, 78)
 *
 * `leftWidth`  — visible width of the left column.
 * `totalWidth` — total line width (right column fills the remainder).
 * `gap`        — visible spaces between columns (default 2).
 */
export function columns(
  rows: [string, string][],
  leftWidth: number,
  totalWidth: number,
  gap = 2,
): string[] {
  const rightWidth = totalWidth - leftWidth - gap;
  return rows.map(([l, r]) =>
    padLeft(l, leftWidth) + " ".repeat(gap) + padLeft(r, rightWidth)
  );
}

/**
 * Render rows in N equal columns.
 *
 *   nColumns(["Market", "Inn", "North", "South"], 2, 78, 2)
 *   → ["Market                                  Inn",
 *      "North                                   South"]
 */
export function nColumns(items: string[], n: number, totalWidth: number, gap = 2): string[] {
  const colWidth = Math.floor((totalWidth - gap * (n - 1)) / n);
  const lines: string[] = [];
  for (let i = 0; i < items.length; i += n) {
    const row = items.slice(i, i + n);
    lines.push(
      row.map((item, j) => j < row.length - 1 ? padLeft(item, colWidth) : item).join(" ".repeat(gap))
    );
  }
  return lines;
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

/**
 * Render a progress bar.
 *
 *   bar(7, 10, 20, t)  →  "[%cg#######%cn%cx..........%cn]"   (visible: 22 chars)
 *
 * The returned string is `barWidth + 2` visible chars wide (brackets included).
 */
export function bar(
  filled: number,
  total: number,
  barWidth: number,
  t: GlobalsTheme,
): string {
  const ratio   = total > 0 ? Math.min(1, Math.max(0, filled / total)) : 0;
  const nFilled = Math.round(ratio * barWidth);
  const nEmpty  = barWidth - nFilled;
  const { colors: c } = t;
  return (
    "[" +
    c.barFilled + t.barFill.repeat(nFilled)   + c.reset +
    c.barEmpty  + t.barEmpty.repeat(nEmpty)   + c.reset +
    "]"
  );
}

// ─── Character Sheet ──────────────────────────────────────────────────────────

export interface SheetField {
  label: string;
  value: string;
  /** Optional inline progress bar. */
  bar?: { filled: number; total: number; width?: number };
}

/**
 * Render a character sheet — labeled key/value rows, optionally with stat bars.
 *
 *   sheet([
 *     { label: "STR", value: "5 / 10", bar: { filled: 5, total: 10, width: 20 } },
 *     { label: "DEX", value: "7 / 10", bar: { filled: 7, total: 10, width: 20 } },
 *   ], 6, t)
 *   →
 *     "STR    [#####...............] 5 / 10"
 *     "DEX    [#######.............] 7 / 10"
 *
 * `labelWidth` — visible width reserved for the label column.
 */
export function sheet(fields: SheetField[], labelWidth: number, t: GlobalsTheme): string[] {
  const { colors: c } = t;
  return fields.map(({ label, value, bar: b }) => {
    const labelStr = c.label + padLeft(label, labelWidth) + c.reset;
    if (b) {
      const barStr = bar(b.filled, b.total, b.width ?? 20, t);
      return `${labelStr}  ${barStr}  ${value}`;
    }
    return `${labelStr}  ${value}`;
  });
}

// ─── Table ────────────────────────────────────────────────────────────────────

/**
 * Render a bordered table.
 *
 *   table(
 *     ["Name",    "Idle", "Doing"],
 *     [["Jupiter", "2m",   "Playing"], ["Aria", "5m", "Watching"]],
 *     [21, 5],   // widths of first N-1 columns; last column fills remainder
 *     78,
 *     t,
 *   )
 *
 * `colWidths` — visible widths for the first `colWidths.length` columns.
 * The final column fills whatever space remains.
 */
export async function table(
  headers: string[],
  rows: string[][],
  colWidths: number[],
  totalWidth: number,
  t: GlobalsTheme,
): Promise<string[]> {
  const gap        = 2;
  const lastWidth  = totalWidth - colWidths.reduce((a, w) => a + w + gap, 0);
  const allWidths  = [...colWidths, lastWidth];

  const renderRow  = (cells: string[]) =>
    cells.map((c, i) => padLeft(c, allWidths[i] ?? 0)).join(" ".repeat(gap));

  const { colors: c } = t;
  const headerCells = headers.map((h, i) => c.label + padLeft(h, allWidths[i] ?? 0) + c.reset);
  const div = await divider(null, t);

  return [
    div,
    headerCells.join(" ".repeat(gap)),
    div,
    ...rows.map(renderRow),
    div,
  ];
}

// ─── Inline Snippet (for script generation) ───────────────────────────────────

/**
 * Returns the core layout utility functions as a self-contained JavaScript
 * snippet, with the given theme values baked in as constants.
 *
 * This is used by index.ts to inline the utilities into the scripts written
 * to system/scripts/, making those scripts fully standalone.
 */
export function inlineUtils(t: GlobalsTheme): string {
  const { width: W, borderChar: BC, dividerChar: DC, barFill: BF, barEmpty: BE, colors: c } = t;
  return `
// ─── rhost-vision layout constants ───────────────────────────────────────────
const _W=(typeof u!=="undefined"&&u.me?.state?.termWidth)||${W},_BC="${BC}",_DC="${DC}",_BF="${BF}",_BE="${BE}";
const _CB="${c.border}",_CH="${c.header}",_CL="${c.label}",_CA="${c.accent}",_CN="${c.reset}";
const _CG="${c.idleFresh}",_CAW="${c.idleAway}",_CAK="${c.idleAFK}";
const _CBF="${c.barFilled}",_CBE="${c.barEmpty}";
// ─── rhost-vision layout utilities ───────────────────────────────────────────
function _vis(s){return s.replace(/\\x1b\\[[0-9;]*m/g,"").replace(/%c[a-zA-Z]/g,"").replace(/%[rRnt]/g,"").length;}
function _padL(s,n,c=" "){const p=Math.max(0,n-_vis(s));return s+c.repeat(p);}
function _padR(s,n,c=" "){const p=Math.max(0,n-_vis(s));return c.repeat(p)+s;}
function _padC(s,n,c=" "){const p=Math.max(0,n-_vis(s));const l=Math.floor(p/2);return c.repeat(l)+s+c.repeat(p-l);}
function _hdr(title){if(!title)return _CB+_BC.repeat(_W)+_CN;const iv=_vis(title)+2;const fill=_W-iv;const l=Math.floor(fill/2);return _CB+_BC.repeat(l)+_CN+" "+_CH+title+_CN+" "+_CB+_BC.repeat(fill-l)+_CN;}
function _ftr(){return _CB+_BC.repeat(_W)+_CN;}
function _div(label){if(!label)return _CB+_DC.repeat(_W)+_CN;const iv=_vis(label)+2;const fill=_W-iv;const l=Math.floor(fill/2);return _CB+_DC.repeat(l)+_CN+" "+_CL+label+_CN+" "+_CB+_DC.repeat(fill-l)+_CN;}
function _wrap(text,indent=""){const iw=_vis(indent);const words=text.split(/\\s+/).filter(Boolean);const lines=[];let cur=indent,cw=iw;for(const w of words){const wv=_vis(w);if(cw>iw&&cw+1+wv>_W){lines.push(cur);cur=indent+w;cw=iw+wv;}else{if(cw>iw){cur+=" ";cw++;}cur+=w;cw+=wv;}}if(cur.trim())lines.push(cur);return lines;}
function _bar(n,total,bw=20){const r=total>0?Math.min(1,Math.max(0,n/total)):0;const f=Math.round(r*bw);return "["+_CBF+_BF.repeat(f)+_CN+_CBE+_BE.repeat(bw-f)+_CN+"]";}
function _idleColor(secs){if(secs<300)return _CG;if(secs<900)return _CAW;return _CAK;}
function _fmtIdle(lastCmd){if(typeof lastCmd!=="number")return "---";const s=Math.floor((Date.now()-lastCmd)/1000);if(s<60)return s+"s";const m=Math.floor(s/60);if(m<60)return m+"m";const h=Math.floor(m/60);if(h<24)return h+"h";return Math.floor(h/24)+"d";}
function _fmtOnFor(lastLogin){if(typeof lastLogin!=="number")return "??:??";const s=Math.floor((Date.now()-lastLogin)/1000);const d=Math.floor(s/86400);const h=Math.floor((s%86400)/3600);const m=Math.floor((s%3600)/60);const hm=String(h).padStart(2,"0")+":"+String(m).padStart(2,"0");return d>0?String(d).padStart(2)+"d "+hm:"   "+hm;}
// ─────────────────────────────────────────────────────────────────────────────
`.trimStart();
}
