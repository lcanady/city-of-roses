/**
 * @module @ursamu/globals
 * @description Modern globals package for UrsaMU — successor to the
 * 2000-era Sandbox Globals Project, rebuilt around UrsaMU's native command
 * and attribute systems.
 *
 * Installs themed replacements for the engine's `look`, `who`, `where`,
 * `mail`, `page`, `score`, `examine`, and `inventory` system scripts, and
 * registers native commands: `+finger`, `+staff`, `+glance`, `+duty`,
 * `+i`/`+inv`, `+gname`, `ooc`, `+ooctag`, `@emit`, `@exittype`, `+motd`,
 * `+summon`/`+rsummon`/`+join`/`+rjoin`, `+uptime`.
 *
 * ## Quick start
 *
 * Add to your game's plugin manifest, then start the engine. On first
 * boot the plugin backs up your existing `system/scripts/*.ts` to
 * `*.original.ts` and copies its replacements into place. On `remove()`
 * the originals are restored.
 *
 * ## Theming
 *
 * Operators retune via the engine's `config/config.json` under
 * `plugins["globals"].theme`. Plugin defaults live in `src/theme.ts`.
 */

// Plugin bootstrap
export { plugin } from "./src/index.ts";
export { default } from "./src/index.ts";

// Theme + layout — for plugins that want to render in the same style
export type { GlobalsTheme, GlobalsThemeTokens, PartialTheme } from "./src/theme.ts";
export {
  DEFAULT_THEME,
  defaultTheme,
  customTheme,
  currentTheme,
  configTheme,
  loadTheme,
  setTheme,
  resetTheme,
} from "./src/theme.ts";
export { renderHeader, renderDivider, renderFooter } from "./src/renderer.ts";
export type { SheetField } from "./src/layout.ts";
export {
  visibleLength,
  padLeft,
  padRight,
  padCenter,
  header,
  footer,
  divider,
  wrap,
  columns,
  nColumns,
  bar,
  sheet,
  table,
} from "./src/layout.ts";

// Helper that other plugins can use to render names with the same
// staff first-letter colouring as the rest of globals.
export { coloredName } from "./src/namecolor.ts";
