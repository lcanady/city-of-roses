# City of Roses game host

UrsaMU + `@ursamu/wod20th` (vendored at `vendor/wod20th`) and
`@ursamu/globals` (vendored at `vendor/globals`).

- Config: `config/config.json` (from sample)
- Do not commit live `data/`, `wiki/`, or secrets
- Engine + all official plugins resolve from JSR (`deno.json`)
- The server (`~/roses`) deploys from this repo via
  `scripts/safe-update.sh`. Push to `main`, then run it there.

## Deploy loop

Local edit → `git commit && git push origin main` → on the server
`cd ~/roses && bash scripts/safe-update.sh`.