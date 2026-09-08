# Contributing to rhost-vision

Thank you for helping make rhost-vision better! This guide walks you through
everything you need to know to get a change merged. If something is confusing
or missing, open an issue — that's a contribution too.

---

## Table of Contents

1. [Getting started](#getting-started)
2. [How the plugin is structured](#how-the-plugin-is-structured)
3. [Making a change](#making-a-change)
4. [Code style](#code-style)
5. [Commit messages](#commit-messages)
6. [Opening a pull request](#opening-a-pull-request)
7. [What happens after you open a PR](#what-happens-after-you-open-a-pr)
8. [Reporting a bug](#reporting-a-bug)
9. [Suggesting a feature](#suggesting-a-feature)

---

## Getting started

You'll need:

- [Deno](https://deno.com) — the TypeScript runtime UrsaMU runs on.
  Install with: `curl -fsSL https://deno.land/install.sh | sh`
- A local copy of [UrsaMU](https://github.com/lcanady/ursamu) so you can
  load the plugin and test it in a running game.
- Git, and a [GitHub](https://github.com) account.

**Fork & clone**

```bash
# 1. Click "Fork" on GitHub, then:
git clone https://github.com/<your-username>/ursamu-rhost-vision
cd ursamu-rhost-vision

# 2. Add the upstream remote so you can pull future changes:
git remote add upstream https://github.com/chogan1981/ursamu-rhost-vision
```

**Set up the plugin in your local UrsaMU**

```bash
# From inside your UrsaMU directory, symlink (or copy) the plugin:
ln -s /path/to/ursamu-rhost-vision src/plugins/rhost-vision

# Start the server:
deno task start
```

Once the server is running, connect with your favourite MU* client and test
your changes live.

---

## How the plugin is structured

```
rhost-vision/
├── index.ts          Plugin entry point — installs script overrides,
│                     registers commands.
│
├── look.ts           System script overrides (copied to system/scripts/)
├── who.ts
├── where.ts
├── mail.ts
├── page.ts
├── score.ts
├── examine.ts
├── inventory.ts
│
├── finger.ts         Native +finger command (registerFingerCommands)
├── staff.ts          Native +staff command  (registerStaffCommands)
├── ooc.ts            OOC talk + colour customisation
├── namecolor.ts      +namecolor command
├── emit.ts           @emit staff broadcast
│
├── layout.ts         Pure string-layout utilities used by native commands
│                     (header, footer, divider, wrap, columns, bar, …)
└── theme.ts          All colours, widths, and layout toggles in one place
```

**System scripts** (look, who, where, etc.) are TypeScript files that get
_copied_ into `system/scripts/` when the plugin loads. They must be
**self-contained** — they can't import from the plugin directory at runtime
because the sandbox runs them from their copied location.

**Native commands** (finger, staff, ooc, namecolor) are registered with
`addCmd()` and run as regular TypeScript. They _can_ import from `layout.ts`
and `theme.ts`.

---

## Making a change

```bash
# 1. Pull the latest upstream changes before you start:
git fetch upstream
git rebase upstream/master

# 2. Create a branch with a short, descriptive name:
git checkout -b fix/who-sorting-order
# or
git checkout -b feat/add-mail-pagination
```

Make your edits, then test them:

- Connect to a running UrsaMU server with the plugin loaded.
- Run the affected commands manually.
- Check that unrelated commands still work.

```bash
# 3. Stage your changes:
git add look.ts who.ts   # be specific — don't `git add .`

# 4. Commit (see Commit messages below):
git commit -m "fix: sort WHO list by login time descending"

# 5. Push to your fork:
git push origin fix/who-sorting-order
```

---

## Code style

- **TypeScript** throughout. Add types where they make the code clearer.
- **Formatting**: 2-space indentation, no trailing whitespace.
- **Self-contained scripts**: system scripts (look.ts, score.ts, etc.) must
  not have runtime `import` statements other than the `@types` import (which
  is stripped at runtime). Inline any helpers you need.
- **Shared utilities**: if you need a formatting helper in a _native_ command,
  add it to `layout.ts` rather than duplicating it.
- **Width**: keep MUSH output at most 78 characters visible. Use `visualLen()`
  to measure width after stripping colour codes.
- **Colour**: use MUSH codes (`%ch`, `%cg`, etc.) not raw ANSI sequences.
  Prefer reading from `theme.ts` so operators can customise the look.
- **No hardcoded strings** for player-facing messages — keep them easy to
  read and adjust.

---

## Commit messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <short description>

[optional body]
```

Common types:

| Type       | When to use                                     |
|------------|-------------------------------------------------|
| `feat`     | New command, option, or user-visible behaviour  |
| `fix`      | Bug fix                                         |
| `refactor` | Code change that doesn't affect behaviour       |
| `docs`     | README, CONTRIBUTING, comments only             |
| `chore`    | Build scripts, deps, repo config                |

Examples:

```
feat: add +staff command for listing online staff
fix: clamp idle time display to four characters
docs: clarify self-contained script rule in CONTRIBUTING
```

Keep the first line under 72 characters.
Use the body for _why_, not _what_ (the diff shows the what).

---

## Opening a pull request

1. Push your branch to your fork.
2. On GitHub, click **"Compare & pull request"**.
3. Fill in the template:
   - **Title** — one line, Conventional Commits style.
   - **What changed** — bullet list of the user-visible changes.
   - **How to test** — exact commands a reviewer can run in-game to verify.
   - **Screenshots** — paste your terminal output. It really helps.
4. If your PR is still in progress, mark it as a **Draft**.
5. Link any related issues with `Closes #<number>`.

**Keep PRs small.** One feature or fix per PR is easier to review and
faster to merge than a sweeping change that touches everything.

---

## What happens after you open a PR

- Automated checks will run (type checking, lint).
- A maintainer will review your changes, usually within a few days.
- You may receive requests for changes — don't be discouraged! Feedback
  is how we make the code better together.
- Once approved, a maintainer will merge using **squash merge** so the
  commit history stays clean.

---

## Reporting a bug

Open a [GitHub issue](https://github.com/chogan1981/ursamu-rhost-vision/issues/new)
and include:

- What you typed in-game.
- What you expected to see.
- What you actually saw (paste the output).
- Your UrsaMU version (`@version` in-game) and OS.

---

## Suggesting a feature

Open an issue with the label **enhancement** and describe:

- What problem this would solve.
- What the in-game experience would look like (example output is gold).
- Whether you'd like to implement it yourself.

We'd love to hear from you!
