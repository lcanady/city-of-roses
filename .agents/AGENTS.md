# City of Roses — game host

This repository contains the game-specific files for the City of Roses
UrsaMU server (WoD20th on `@ursamu/wod20th`, vendored).

## Development constraints

- **Line length**: max 78 columns on all code and text edits.
- **Type checking**: `deno check src/main.ts` (root `deno.json` pins).
- The server (`~/roses` on court.ursamu.io) deploys from `main` via
  `scripts/safe-update.sh` — push, then run it there.

## Commands

```bash
deno task daemon    # production daemon (main loop + telnet)
deno task start     # foreground runner (watch mode)
deno task status    # supervisor + port status
deno task stop      # stop everything
deno task restart   # soft-restart main (telnet stays up)
deno task update    # git reset origin/main + cache + soft reboot
```

## Reference

- Config: `config/config.json` (from sample, gitignored)
- Caddy: `deploy/Caddyfile` → `/etc/caddy/Caddyfile`
- Vendored plugins: `vendor/wod20th`, `vendor/globals`
- Do not commit live `data/`, `wiki/`, or secrets.