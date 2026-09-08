/**
 * theme.ts — runtime-resolvable theming for globals.
 *
 * Three-layer resolution (lowest → highest priority):
 *   1. DEFAULT_THEME — hardcoded fallback
 *   2. config/SgpConfig.json — partial overlay on disk
 *   3. DB record (globals.theme singleton) — set in-game
 *
 * Header/divider/footer rendering is driven by *fmt format strings evaluated
 * through the mushcode EvalEngine (see renderer.ts). The static colour palette
 * + look/who config still drive +finger, +staff and the inlineUtils() snippet
 * that gets baked into the system-script overrides.
 */

import { DBO } from "@ursamu/ursamu";
import { fromFileUrl } from "@std/path";

const PLUGIN_NAME = "globals";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GlobalsThemeTokens {
  sep:     string;
  title:   string;
  section: string;
  hint:    string;
  smaj:    string;
  smin:    string;
}

export interface GlobalsTheme {
  width:       number;
  borderChar:  string;
  dividerChar: string;
  barFill:     string;
  barEmpty:    string;

  headerfmt:  string;
  dividerfmt: string;
  footerfmt:  string;

  tokens: GlobalsThemeTokens;

  colors: {
    border:    string;
    header:    string;
    label:     string;
    accent:    string;
    idleFresh: string;
    idleAway:  string;
    idleAFK:   string;
    barFilled: string;
    barEmpty:  string;
    reset:     string;
  };

  messages: {
    prefix:    string;
    info:      string;
    success:   string;
    warning:   string;
    error:     string;
    highlight: string;
  };

  ooc: {
    /** Full literal tag string — admin owns the decoration and colors, e.g. "%ch<OOC>%cn". */
    tag:        string;
    sayFormat:  string;
    poseFormat: string;
  };

  look: {
    showShortDesc:   boolean;
    showIdle:        boolean;
    categorizeExits: boolean;
    showExitAliases: boolean;
    /** Case transform applied to exit aliases in the room view and exit cards. */
    aliasCase:       "upper" | "lower" | "preserve";
    exitColumns:     1 | 2 | 3;
    descIndent:      number;
    /** Flag → display string. Order = priority (first match wins). Empty disables the column. */
    roleTags:        Array<{ flag: string; display: string }>;
  };

  who: {
    nameWidth:  number;
    onForWidth: number;
    idleWidth:  number;
  };
}

export type PartialTheme =
  & Partial<Omit<GlobalsTheme, "tokens" | "colors" | "messages" | "ooc" | "look" | "who">>
  & {
    tokens?:   Partial<GlobalsThemeTokens>;
    colors?:   Partial<GlobalsTheme["colors"]>;
    messages?: Partial<GlobalsTheme["messages"]>;
    ooc?:      Partial<GlobalsTheme["ooc"]>;
    look?:     Partial<GlobalsTheme["look"]>;
    who?:      Partial<GlobalsTheme["who"]>;
  };

interface ThemeRecord {
  id:      string;
  overlay: PartialTheme;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_THEME: GlobalsTheme = {
  width:       78,
  borderChar:  "=",
  dividerChar: "-",
  barFill:     "#",
  barEmpty:    ".",

  headerfmt:  "%qsep[ansicenter( %qtitle%0%cn%qsep ,%2,%qsmaj)]%cn",
  dividerfmt: "%qsep[ansicenter( %qsection%0%cn%qsep ,%2,%qsmin)]%cn",
  footerfmt:  "%qsep[repeat(%qsmaj,%2)]%cn",

  tokens: {
    sep:     "%ch%cw",
    title:   "%ch%cw",
    section: "%ch%cw",
    hint:    "%cy",
    smaj:    "=",
    smin:    "-",
  },

  colors: {
    border:    "%ch%cw",
    header:    "%ch%cw",
    label:     "%ch%cw",
    accent:    "%cy",
    idleFresh: "%cg",
    idleAway:  "%cn",
    idleAFK:   "%cx",
    barFilled: "%cg",
    barEmpty:  "%cx",
    reset:     "%cn",
  },

  messages: {
    prefix:    "%ch>GAME:%cn",
    info:      "%cn",
    success:   "%cg",
    warning:   "%cy",
    error:     "%cr",
    highlight: "%ch",
  },

  ooc: {
    tag:        "%ch<OOC>%cn",
    sayFormat:  '{tag} {name} says, "{message}"',
    poseFormat: "{tag} {name} {message}",
  },

  look: {
    showShortDesc:   true,
    showIdle:        true,
    categorizeExits: true,
    showExitAliases: true,
    aliasCase:       "preserve",
    exitColumns:     2,
    descIndent:      2,
    roleTags: [
      { flag: "wizard",    display: "(Wizard)" },
      { flag: "superuser", display: "(Root)"   },
      { flag: "admin",     display: "(Admin)"  },
      { flag: "staff",     display: "(Staff)"  },
    ],
  },

  who: {
    nameWidth:  21,
    onForWidth: 8,
    idleWidth:  4,
  },
};

// Back-compat exports for staff.ts, mod.ts, scripts/inlineUtils consumers.
export const defaultTheme: GlobalsTheme = DEFAULT_THEME;
export const customTheme: Partial<GlobalsTheme> | undefined = undefined;

// ─── Merge ────────────────────────────────────────────────────────────────────

function mergeTheme(base: GlobalsTheme, overlay: PartialTheme): GlobalsTheme {
  return {
    width:       overlay.width       ?? base.width,
    borderChar:  overlay.borderChar  ?? base.borderChar,
    dividerChar: overlay.dividerChar ?? base.dividerChar,
    barFill:     overlay.barFill     ?? base.barFill,
    barEmpty:    overlay.barEmpty    ?? base.barEmpty,
    headerfmt:   overlay.headerfmt   ?? base.headerfmt,
    dividerfmt:  overlay.dividerfmt  ?? base.dividerfmt,
    footerfmt:   overlay.footerfmt   ?? base.footerfmt,
    tokens:   { ...base.tokens,   ...overlay.tokens   },
    colors:   { ...base.colors,   ...overlay.colors   },
    messages: { ...base.messages, ...overlay.messages },
    ooc:      { ...base.ooc,      ...overlay.ooc      },
    look:     { ...base.look,     ...overlay.look     },
    who:      { ...base.who,      ...overlay.who      },
  };
}

// ─── Config file ──────────────────────────────────────────────────────────────

const CONFIG_PATH = fromFileUrl(
  new URL("../../config/SgpConfig.json", import.meta.url),
);

async function readJsonConfig(): Promise<PartialTheme> {
  try {
    const raw = await Deno.readTextFile(CONFIG_PATH);
    return JSON.parse(raw) as PartialTheme;
  } catch {
    return {};
  }
}

/**
 * Read the theme overlay from the game's config/config.json
 * (plugins.globals.theme). Empty when not running in a game tree.
 */
function readEngineConfig(): PartialTheme {
  try {
    const raw = Deno.readTextFileSync("config/config.json");
    const game = JSON.parse(raw) as {
      plugins?: Record<string, { theme?: PartialTheme }>;
    };
    const block = game.plugins?.[PLUGIN_NAME] ??
      game.plugins?.["@ursamu/globals"] ??
      game.plugins?.sgp;
    return block?.theme ?? {};
  } catch {
    return {};
  }
}

// ─── Persistence ──────────────────────────────────────────────────────────────

const themeDb  = new DBO<ThemeRecord>("globals.theme");
const THEME_ID = "singleton";

let _theme:        GlobalsTheme = structuredClone(DEFAULT_THEME);
let _configTheme:  GlobalsTheme = structuredClone(DEFAULT_THEME);

export function currentTheme(): GlobalsTheme {
  return _theme;
}

export function configTheme(): GlobalsTheme {
  return _configTheme;
}

export async function loadTheme(): Promise<void> {
  // Layer order (lowest → highest):
  //   1. DEFAULT_THEME
  //   2. config/SgpConfig.json (plugin-local; dev fallback)
  //   3. engine config/config.json plugins["globals"].theme (canonical)
  //   4. DB record (globals.theme singleton; in-game overrides)
  const fileOverlay   = await readJsonConfig();
  const engineOverlay = readEngineConfig();
  _configTheme = mergeTheme(mergeTheme(DEFAULT_THEME, fileOverlay), engineOverlay);

  try {
    const rows = await themeDb.find({ id: THEME_ID });
    _theme = rows.length > 0
      ? mergeTheme(_configTheme, rows[0].overlay)
      : structuredClone(_configTheme);
  } catch {
    _theme = structuredClone(_configTheme);
  }
}

export async function setTheme(overlay: PartialTheme): Promise<void> {
  const rows     = await themeDb.find({ id: THEME_ID });
  const existing = rows.length > 0 ? rows[0].overlay : {};
  const merged: PartialTheme = {
    ...existing,
    ...overlay,
    tokens:   { ...existing.tokens,   ...overlay.tokens   },
    colors:   { ...existing.colors,   ...overlay.colors   },
    messages: { ...existing.messages, ...overlay.messages },
    ooc:      { ...existing.ooc,      ...overlay.ooc      },
    look:     { ...existing.look,     ...overlay.look     },
    who:      { ...existing.who,      ...overlay.who      },
  };

  if (rows.length > 0) {
    await themeDb.update({ id: THEME_ID }, { id: THEME_ID, overlay: merged });
  } else {
    await themeDb.create({ id: THEME_ID, overlay: merged });
  }

  _theme = mergeTheme(_configTheme, merged);
}

export async function resetTheme(): Promise<void> {
  await themeDb.delete({ id: THEME_ID });
  _theme = structuredClone(_configTheme);
}
