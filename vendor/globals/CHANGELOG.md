# Changelog

All notable changes to rhost-vision are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

_Nothing yet._

---

## [1.2.1] — 2026-08-04

### Changed

- System scripts (`who`, `where`, `score`, `examine`, `inventory`) now use
  the themed `renderHeader` / `renderDivider` / `renderFooter` pipeline
  (same as `look` and native `+finger` / `+staff` / `+motd`).
- `+i` / `+inv` uses full `header` + `footer` framing instead of dividers
  only.
- Script install rewrites the renderer import to an absolute plugin URL
  so copies under `system/scripts/` still resolve theme chrome.
- Theme load no longer depends on missing `getConfig` export; reads
  `config/config.json` `plugins.globals.theme` instead.

---

## [1.2.0] — 2026-05-09

### Changed (modernisation — matches current UrsaMU plugin standards)

- Restructured into the canonical plugin layout: `src/` for native command
  modules, `scripts/` for system-script overrides, `mod.ts` for the JSR
  module surface, root `index.ts` as a thin re-export.
- Native command imports moved from internal relative paths
  (`../../services/...`, `../../@types/...`) to the JSR package
  `@ursamu/ursamu`. Plugin can now be installed and developed as a
  standalone repo without symlinking into the engine source tree.
- `addCmd()` registrations now fire at module load via `src/commands.ts`
  (Phase 1) instead of inside `init()`. `init()` is now reserved for
  filesystem work (script copy / backup).
- `@emit` is now a real `addCmd` registration (it was previously dead code
  shaped like a system script).

### Added

- `deno.json` with `test`, `lint`, and `check` tasks; JSR imports pinned to
  `@ursamu/ursamu@^2.2`.
- `mod.ts` exporting the plugin, theme, layout helpers, and `coloredName()`
  for downstream plugins.
- `LICENSE` (MIT), `.gitignore`, `CLAUDE.md` (plugin authoring guide
  matching the help-plugin reference), and `README.md`.
- Help files for previously undocumented commands: `ooc`, `+ooccolor`,
  `+ooccolor2`, `+namecolor`, `@emit`, `@mail`.
- `tests/layout.test.ts` covering the pure layout utilities.

### Compatibility

- Bumped engine requirement to `>=2.2.0` (JSR `@ursamu/ursamu@^2.2`).

---

## [1.1.0] — 2026-03-21

### Added

- **`score.ts`** — New system script override. Displays a formatted scorecard
  for the calling player: DBRef, alias, money, flags, short-desc, doing.
  Supports a customisable stat block via `&SCORE-EXTRA me=<text>`.
- **`examine.ts`** — New system script override. Full object examination —
  flags, owner, lock, location, home, channels, and all non-system attributes.
  Respects the VISUAL flag for non-owner access.
- **`inventory.ts`** — New system script override. Lists everything the player
  is carrying with inline short descriptions, in Rhost-style bordered output.
- **`+staff`** (`staff.ts`) — New native command. Lists all online,
  non-dark staff members (admin / wizard / superuser) with On For, Idle, and
  Doing columns. Registered via `registerStaffCommands()`.
- **`layout.ts`** — Shared layout-utility library for native commands.
  Exports: `visibleLength`, `padLeft`, `padRight`, `padCenter`, `header`,
  `footer`, `divider`, `wrap`, `columns`, `nColumns`, `bar`, `sheet`, `table`.
  Pure functions — no SDK dependency.
- **`theme.ts`** — Centralised theme configuration (`RhostTheme` interface,
  `defaultTheme`, `customTheme`). Edit this file to change colours, widths,
  and layout options; changes apply to all native commands at startup.
- **`CONTRIBUTING.md`** — Contributor guide (setup, code style, commit
  conventions, PR process, bug reports, feature requests).
- **`CHANGELOG.md`** — This file.

### Changed

- `index.ts` — Updated to `v1.1.0`. Adds `score.ts`, `examine.ts`, and
  `inventory.ts` to the list of script overrides. Imports and calls
  `registerStaffCommands()`. Adds `Deno.mkdir` call to ensure `system/scripts/`
  exists before installation. The `remove()` function now also deletes the
  `.original.ts` backup after restoring, keeping the scripts directory clean.
- `ursamu.plugin.json` — Version bumped to `1.1.0`. Description expanded.
  Added `contributors` and `ursamu` (minimum engine version `>=1.8.0`) fields.

---

## [1.0.0] — initial release

### Added

- `look.ts` — Rhost-style room display: bordered header/footer, categorised
  exits (Locations vs Directions), player idle times, short descriptions.
- `who.ts` — WHO list with On For, Idle, and Doing columns; sorted by login
  time; `name_color` support.
- `where.ts` — `+where` command grouping online players by area/zone.
- `mail.ts` — Full MUSH-style mail system: draft, reply, forward, CC/BCC,
  starred messages, status flags `[URFS----]`.
- `page.ts` — Page command with pose syntax and alias display.
- `finger.ts` / `+finger` — Player profile command with settable fields,
  hidden fields, dot-leader formatting, and `name_color` integration.
- `ooc.ts` / `ooc` — Out-of-character talk with customisable colour tags
  (`+ooccolor`, `+ooccolor2`).
- `namecolor.ts` / `+namecolor` — Staff command to colour the first letter of
  a character name; supports ANSI codes and hex `#RRGGBB`.
- `emit.ts` / `@emit` — Staff-only room broadcast command.

[Unreleased]: https://github.com/chogan1981/ursamu-rhost-vision/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/chogan1981/ursamu-rhost-vision/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/chogan1981/ursamu-rhost-vision/releases/tag/v1.0.0
