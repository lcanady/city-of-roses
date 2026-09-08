# City of Roses (game host)

UrsaMU game server for **City of Roses** — a World of Darkness 20th
Anniversary MU* built on the `@ursamu/wod20th` plugin (vendored).

| Piece | Host |
|-------|------|
| Game API / site / admin | `https://court.ursamu.io` and `https://roses.ursamu.io` |
| WebSocket | `wss://roses.ursamu.io/ws` |
| Telnet | `roses.ursamu.io:4201` |

## Ports (local process)

| Protocol | Port |
|----------|------|
| Telnet | 4201 |
| WebSocket | 4202 |
| HTTP API | 4203 |

## Repo layout

- `deno.json` — JSR pins for engine/official plugins; `@ursamu/wod20th`
  and `@ursamu/globals` map to `vendor/` snapshots (not on JSR).
- `vendor/wod20th` — WoD20th plugin snapshot (from the ursamu monorepo
  `packages/wod20th`).
- `vendor/globals` — `@ursamu/globals` (sgp) snapshot.
- `config/config.json` — **gitignored** live config (from sample).
- `deploy/Caddyfile` — edge proxy (`sudo cp` → `/etc/caddy/`, reload).
- `scripts/` — daemon/supervisor + `safe-update.sh` deploy path.

## Run

```bash
cp config/config.sample.json config/config.json
deno task daemon   # production
# or
deno task start    # foreground + watch
```

## Local vs server

The server (`~/roses` on court.ursamu.io) is a **git checkout of this
repo** (branch `main`). Run the same command locally — the two stay in
lock-step:

```bash
# after editing repo files locally
git add -A && git commit -m "..." && git push origin main
```

then on the server:

```bash
cd ~/roses && bash scripts/safe-update.sh
```

`safe-update.sh` hard-resets to `origin/main`, preserves the gitignored
live state (`config/config.json`, `wiki/`, `data/`), reloads the JSR
cache, and restarts the daemon.

## Resync vendored plugins

`vendor/wod20th` and `vendor/globals` are snapshots. To refresh them
from their source trees, re-vendor and commit:

```bash
# from the ursamu monorepo
tar --exclude tests --exclude tools --exclude showcases \
  -czf vendor-wod20th.tgz -C packages wod20th
# and from the sgp repo (ursamu-sgp-plugin)
tar --exclude tests --exclude tools --exclude showcases -czf vendor-globals.tgz -C . .
```

Extract over `vendor/` (strip package-local `deno.json`/`deno.lock`),
then commit + push + `safe-update.sh` on the server.

## Deploy (infra)

1. Edit `config/config.json` (not overwritten)
2. `sudo cp deploy/Caddyfile /etc/caddy/Caddyfile && sudo systemctl reload caddy`
3. `bash scripts/safe-update.sh` (or `deno task restart`)

wod20th plugin is vendored at `vendor/wod20th`. Theme overlays come
from the vendored `@ursamu/globals` at `vendor/globals`.