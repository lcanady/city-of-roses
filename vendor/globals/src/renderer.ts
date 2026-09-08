/**
 * renderer.ts — evaluates header/divider/footer fmt strings via mushcode.
 *
 * Format-string args:  %0 = label/title, %1 = count, %2 = width
 * Pre-loaded registers from theme.tokens: %qsep, %qtitle, %qsection,
 *                                         %qhint, %qsmaj, %qsmin
 */

import { EvalEngine, makeContext, registerStdlib } from "@ursamu/mushcode";
import { currentTheme } from "./theme.ts";

const engine = new EvalEngine({
  getAttr:       () => Promise.resolve(null),
  resolveTarget: () => Promise.resolve(null),
  getName:       () => Promise.resolve(""),
  hasFlag:       () => Promise.resolve(false),
});
registerStdlib(engine);

function visLen(str: string): number {
  return str
    // deno-lint-ignore no-control-regex
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/%c[xXrRgGbBcCmMyYwWhHuUiIfFnN]/gi, "")
    .replace(/%c\{[^}]*\}/g, "")
    .replace(/%[rnthiub]/gi, "")
    .length;
}

engine.registerFunction("ansicenter", {
  minArgs: 2,
  maxArgs: 3,
  exec(args: unknown[]) {
    const str  = String(args[0] ?? "");
    const w    = parseInt(String(args[1] ?? "78"), 10);
    const fill = String(args[2] ?? " ").charAt(0) || " ";
    const vis  = visLen(str);
    const pad  = Math.max(0, w - vis);
    const left = Math.floor(pad / 2);
    return fill.repeat(left) + str + fill.repeat(pad - left);
  },
});

// ansipad(str, width, fill) -- right-pad `str` with `fill` to `width` visible
// characters. Use this in headerfmt/dividerfmt to build left-anchored rules:
//   "%qsep[repeat(%qsmaj,5)]%cn %qtitle%0%cn %qsep[ansipad(%qtitle%0,sub(%2,7),%qsmaj)]%cn"
//   →  "%cr=====%cn %ch%cyTitle%cn %cr===...==%cn"
engine.registerFunction("ansipad", {
  minArgs: 2,
  maxArgs: 3,
  exec(args: unknown[]) {
    const str  = String(args[0] ?? "");
    const w    = parseInt(String(args[1] ?? "78"), 10);
    const fill = String(args[2] ?? " ").charAt(0) || " ";
    const vis  = visLen(str);
    const pad  = Math.max(0, w - vis);
    return fill.repeat(pad);
  },
});

async function evalFmt(
  fmt: string,
  arg0: string,
  arg1: string,
  arg2: string,
): Promise<string> {
  const t = currentTheme();
  const registers = new Map<string, string>([
    ["sep",     t.tokens.sep],
    ["title",   t.tokens.title],
    ["section", t.tokens.section],
    ["hint",    t.tokens.hint],
    ["smaj",    t.tokens.smaj],
    ["smin",    t.tokens.smin],
  ]);

  const ctx = makeContext({
    enactor:  "#0",
    executor: "#0",
    args:     [arg0, arg1, arg2],
    registers,
  });

  return await engine.evalString(fmt, ctx);
}

export async function renderHeader(title: string, width?: number): Promise<string> {
  const t = currentTheme();
  return await evalFmt(t.headerfmt, title ?? "", "", String(width ?? t.width));
}

export async function renderDivider(label: string | null, width?: number): Promise<string> {
  const t = currentTheme();
  const fmt = label ? t.dividerfmt : t.footerfmt.replace("%qsmaj", "%qsmin");
  return await evalFmt(fmt, label ?? "", "", String(width ?? t.width));
}

export async function renderFooter(width?: number): Promise<string> {
  const t = currentTheme();
  return await evalFmt(t.footerfmt, "", "", String(width ?? t.width));
}
