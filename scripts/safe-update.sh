#!/bin/bash
# Safe package/code update while the game stays online, then soft-reboot.
#
# 1. git fetch + reset to origin/main
# 2. preserve wiki/ (gitignored live content) across the reset
# 3. merge sample config → live config (plugins list + plugin blocks)
# 4. deno cache --reload --minimum-dependency-age=0 (game still up)
# 5. soft-restart main (telnet stays up when possible)
# 6. health-check + verify plugin:loaded versions vs deno.json pins
#
# Usage (on the game host):
#   bash ./scripts/safe-update.sh
#   bash ~/roses-update.sh   # thin wrapper → this script
set -euo pipefail
export PATH="${HOME}/.deno/bin:/usr/local/bin:/usr/bin:/bin:${PATH}"
cd "$(dirname "$0")/.." || exit 1

log() { echo "[safe-update] $*"; }

# Keep ~/roses-update.sh as a wrapper. It MUST snapshot wiki/ before
# running this script: the running file is still the *old* checkout
# until git reset, so preserve has to live outside safe-update itself.
WRAPPER="${HOME}/roses-update.sh"
WRAPPER_BODY='#!/bin/bash
set -euo pipefail
export PATH="${HOME}/.deno/bin:/usr/local/bin:/usr/bin:/bin:${PATH}"
ROOT="'"$(pwd)"'"
cd "$ROOT" || exit 1
# Snapshot live wiki before any git reset (old or new safe-update).
if [ -d wiki ] && find wiki -name "*.md" 2>/dev/null | grep -q .; then
  PRESERVE="$(mktemp -d "${TMPDIR:-/tmp}/roses-wiki.XXXXXX")"
  cp -a wiki/. "$PRESERVE/"
  export ROSES_WIKI_PRESERVE="$PRESERVE"
  echo "[roses-update] preserved wiki/ → $PRESERVE"
fi
bash "$ROOT/scripts/safe-update.sh" "$@"
status=$?
# If safe-update is still the pre-preserve edition, restore here.
if [ -n "${ROSES_WIKI_PRESERVE:-}" ] && [ -d "$ROSES_WIKI_PRESERVE" ]; then
  if [ ! -d wiki ] || ! find wiki -name "*.md" 2>/dev/null | grep -q .; then
    mkdir -p wiki
    cp -a "$ROSES_WIKI_PRESERVE"/. wiki/
    echo "[roses-update] restored wiki/ after deploy"
  fi
  rm -rf "$ROSES_WIKI_PRESERVE"
fi
exit "$status"
'
# Always refresh wrapper so preserve lands even when script was stale.
printf '%s\n' "$WRAPPER_BODY" > "$WRAPPER"
chmod +x "$WRAPPER"
log "installed ${WRAPPER} → scripts/safe-update.sh (wiki-safe)"

log "HEAD before: $(git log -1 --oneline 2>/dev/null || echo '?')"

# --- preserve live wiki across hard reset ---------------------------------
WIKI_PRESERVE="${ROSES_WIKI_PRESERVE:-}"
if [ -z "$WIKI_PRESERVE" ] && [ -d wiki ] && \
  find wiki -name '*.md' 2>/dev/null | grep -q .; then
  WIKI_PRESERVE="$(mktemp -d "${TMPDIR:-/tmp}/roses-wiki.XXXXXX")"
  cp -a wiki/. "$WIKI_PRESERVE/"
  log "preserved live wiki/ → $WIKI_PRESERVE"
elif [ -n "$WIKI_PRESERVE" ]; then
  log "using wrapper wiki snapshot → $WIKI_PRESERVE"
fi

# --- git -------------------------------------------------------------------
git fetch origin
git reset --hard origin/main
log "HEAD after:  $(git log -1 --oneline)"

# --- restore / seed wiki ---------------------------------------------------
if [ -n "$WIKI_PRESERVE" ] && [ -d "$WIKI_PRESERVE" ]; then
  rm -rf wiki
  mkdir -p wiki
  cp -a "$WIKI_PRESERVE"/. wiki/
  rm -rf "$WIKI_PRESERVE"
  unset ROSES_WIKI_PRESERVE || true
  log "restored live wiki/ (deploy did not overwrite pages)"
elif [ ! -d wiki ] || ! find wiki -name '*.md' 2>/dev/null | grep -q .; then
  if [ -d wiki.sample ]; then
    mkdir -p wiki
    cp -a wiki.sample/. wiki/
    log "seeded wiki/ from wiki.sample/"
  else
    log "wiki/ empty and no wiki.sample/ — skipping seed"
  fi
else
  log "wiki/ already present (gitignored) — left untouched"
fi

# --- merge gitignored live config ------------------------------------------
python3 - <<'PY'
"""Merge sample → live config so new plugins/settings always land."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any


def deep_merge(base: Any, over: Any) -> Any:
    """Merge over into base. Dicts recurse; lists/scalars: over wins."""
    if isinstance(base, dict) and isinstance(over, dict):
        out = dict(base)
        for k, v in over.items():
            if k in out:
                out[k] = deep_merge(out[k], v)
            else:
                out[k] = v
        return out
    return over


def ensure_plugins_list(live: list[str], sample: list[str]) -> list[str]:
    """Sample order is canonical. Live extras only if ALLOW_EXTRA_PLUGINS=1."""
    seen: set[str] = set()
    out: list[str] = []
    for name in sample:
        n = str(name).strip()
        if not n or n in seen:
            continue
        seen.add(n)
        out.append(n)
    if os.environ.get("ALLOW_EXTRA_PLUGINS", "").strip() == "1":
        for name in live:
            n = str(name).strip()
            if not n or n in seen:
                continue
            seen.add(n)
            out.append(n)
    return out


live_p = Path("config/config.json")
sample_p = Path("config/config.sample.json")
live: dict[str, Any] = (
    json.loads(live_p.read_text()) if live_p.exists() else {}
)
sample: dict[str, Any] = (
    json.loads(sample_p.read_text()) if sample_p.exists() else {}
)

# server.plugins — sample is the game's shipped plugin list
live_srv = live.setdefault("server", {})
sample_srv = sample.get("server") or {}
live_list = list(live_srv.get("plugins") or [])
sample_list = list(sample_srv.get("plugins") or [])
if sample_list:
    merged = ensure_plugins_list(live_list, sample_list)
    dropped = [p for p in live_list if p not in merged]
    live_srv["plugins"] = merged
    print("[safe-update] server.plugins:", ", ".join(merged))
    if dropped:
        print("[safe-update] plugins removed:", ", ".join(dropped))
else:
    print("[safe-update] WARN: sample has no server.plugins", file=sys.stderr)
    merged = live_list

# plugins.* blocks from sample (channels, globals, site, …)
live_pl = live.setdefault("plugins", {})
sample_pl = sample.get("plugins") or {}
if isinstance(sample_pl, dict):
    for key, val in sample_pl.items():
        if key not in live_pl:
            live_pl[key] = val
            print(f"[safe-update] plugins.{key}: added from sample")
        else:
            before = json.dumps(live_pl[key], sort_keys=True)
            live_pl[key] = deep_merge(live_pl[key], val)
            after = json.dumps(live_pl[key], sort_keys=True)
            if before != after:
                print(f"[safe-update] plugins.{key}: merged from sample")
            else:
                print(f"[safe-update] plugins.{key}: ok")

# Always ensure channels + globals.theme.look exist (legacy defaults)
ch = live_pl.get("channels") or {
    "defaults": [
        {
            "name": "Public",
            "alias": "pub",
            "lock": "connected",
            "announce": True,
        },
        {
            "name": "Admin",
            "alias": "ad",
            "lock": "connected admin+",
            "announce": False,
        },
    ]
}
for row in ch.get("defaults", []):
    if str(row.get("name", "")).lower() == "public":
        row.setdefault("announce", True)
live_pl["channels"] = ch

look = (
    (sample_pl.get("globals") or {})
    .get("theme", {})
    .get("look")
) or (live_pl.get("globals") or {}).get("theme", {}).get("look")
if look:
    g = live_pl.setdefault("globals", {})
    th = g.setdefault("theme", {})
    th["look"] = look

live_p.parent.mkdir(parents=True, exist_ok=True)
live_p.write_text(json.dumps(live, indent=2) + "\n")
print("[safe-update] config written →", live_p)
print(
    "[safe-update] plugins keys:",
    ", ".join(sorted(live_pl.keys())),
)
PY

# --- expected JSR pins from deno.json (for post-boot verify) ---------------
EXPECTED_JSON="$(python3 - <<'PY'
import json
import re
from pathlib import Path

d = json.loads(Path("deno.json").read_text())
imp = d.get("imports") or {}
want = {}
for key in (
    "@ursamu/web",
    "@ursamu/site",
    "@ursamu/mush",
    "@ursamu/builder",
    "@ursamu/wiki",
    "@ursamu/combat",
    "ursamu",
):
    raw = str(imp.get(key) or "")
    m = re.search(r"@(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)\s*$", raw)
    if m:
        name = key
        if key in ("ursamu", "@ursamu/mush"):
            name = "mush"
        elif key.startswith("@ursamu/"):
            name = key.split("/", 1)[1]
        want[name] = m.group(1)
out = {
    "web": want.get("web"),
    "site": want.get("site"),
    "wiki": want.get("wiki"),
    "builder": want.get("builder"),
    "combat": want.get("combat"),
}
print(json.dumps({k: v for k, v in out.items() if v}))
PY
)"
log "expected plugin versions: ${EXPECTED_JSON}"


# --- verify JSR pins resolve to expected engine/FE versions --------------
python3 - <<'PY' || exit 6
import json, re, sys
from pathlib import Path
imp = json.loads(Path("deno.json").read_text()).get("imports") or {}
keys = (
    "@ursamu/mush",
    "@ursamu/site",
    "@ursamu/web",
    "@ursamu/wiki",
    "@ursamu/combat",
)
bad = []
ok = []
for key in keys:
    raw = str(imp.get(key) or "")
    if not raw:
        continue
    if "vendor" in raw:
        if key == "@ursamu/mush":
            bad.append(f"{key} must be JSR on prod, not vendor: {raw}")
            continue
        bad.append(f"{key} still points at vendor: {raw}")
        continue
    m = re.search(r"jsr:@ursamu/[^@]+@(\d+\.\d+\.\d+)", raw)
    if not m:
        bad.append(f"{key} not a pinned jsr URL: {raw!r}")
        continue
    ok.append(f"{key}@{m.group(1)}")
mush = str(imp.get("@ursamu/mush") or "")
if not re.search(r"jsr:@ursamu/mush@\d+\.\d+\.\d+", mush):
    bad.append(f"@ursamu/mush must be jsr:@ursamu/mush@x.y.z, got {mush!r}")
if bad:
    print("[safe-update] ERROR: JSR pin check failed:", file=sys.stderr)
    for b in bad:
        print(" ", b, file=sys.stderr)
    sys.exit(6)
print("[safe-update] JSR pins ok:", ", ".join(ok))
PY


# --- pre-warm Deno cache while old main still runs -------------------------
log "caching packages (game still up)..."
rm -f deno.lock
rm -rf node_modules
CACHE_SPECS="$(python3 - <<'PY'
import json
from pathlib import Path
imp = json.loads(Path("deno.json").read_text()).get("imports") or {}
specs = []
for key in (
    "@ursamu/web",
    "@ursamu/site",
    "@ursamu/wiki",
    "@ursamu/combat",
    "@ursamu/mush",
    "ursamu",
):
    raw = str(imp.get(key) or "").strip()
    if raw.startswith("jsr:"):
        specs.append(raw)
seen = set()
out = []
for s in specs:
    if s in seen:
        continue
    seen.add(s)
    out.append(s)
print(" ".join(out))
PY
)"
log "cache specs: ${CACHE_SPECS}"
# shellcheck disable=SC2086
if ! deno cache --reload --minimum-dependency-age=0 \
  ${CACHE_SPECS} \
  src/main.ts src/telnet.ts; then
  log "ERROR: deno cache failed — aborting reboot."
  log "Game left running on previous code."
  exit 1
fi
deno install --minimum-dependency-age=0 2>/dev/null || true
log "cache ok — soft-rebooting main (telnet stays up)"

# Snapshot log length so we only inspect this boot
LOG_LINES_BEFORE=0
if [ -f logs/main.log ]; then
  LOG_LINES_BEFORE=$(wc -l < logs/main.log | tr -d ' ')
fi

# --- soft restart main only ------------------------------------------------
rm -f data/typegraph.db/postmaster.pid 2>/dev/null || true
if [ -f .ursamu.pid ]; then
  # shellcheck disable=SC1090
  # shellcheck source=/dev/null
  source .ursamu.pid 2>/dev/null || true
  if [ -n "${MAIN_PID:-}" ] && kill -0 "$MAIN_PID" 2>/dev/null; then
    log "restarting main loop (PID ${MAIN_PID}); telnet stays up"
    bash ./scripts/restart.sh
  else
    log "stale .ursamu.pid — full daemon start"
    bash ./scripts/stop.sh 2>/dev/null || true
    sleep 1
    bash ./scripts/daemon.sh
  fi
elif [ -f .ursamu-deno.pid ]; then
  log "deno pid without loop — killing child and starting daemon"
  kill -TERM "$(cat .ursamu-deno.pid)" 2>/dev/null || true
  sleep 1
  bash ./scripts/stop.sh 2>/dev/null || true
  bash ./scripts/daemon.sh
else
  log "not running — starting daemon"
  bash ./scripts/daemon.sh
fi

# --- health ----------------------------------------------------------------
ok=0
for i in $(seq 1 90); do
  if curl -sf -m 2 "http://127.0.0.1:4203/" >/dev/null 2>&1 ||
     curl -sf -m 2 "http://127.0.0.1:4203/api/v1/help" >/dev/null 2>&1; then
    log "ready at ${i}s"
    ok=1
    break
  fi
  sleep 1
done
bash ./scripts/status.sh || true
if [ "$ok" -ne 1 ]; then
  log "WARNING: health check did not pass within 90s"
  tail -40 logs/main.log || true
  exit 2
fi

# --- verify plugins loaded this boot ---------------------------------------
python3 - <<PY
import json
import re
import sys
from pathlib import Path

expected = json.loads("""${EXPECTED_JSON}""")
log_path = Path("logs/main.log")
if not log_path.exists():
    print("[safe-update] ERROR: no logs/main.log", file=sys.stderr)
    sys.exit(3)

all_lines = log_path.read_text(errors="replace").splitlines()
start = int("${LOG_LINES_BEFORE}")
chunk = all_lines[start:] if start < len(all_lines) else all_lines[-200:]

loaded: dict[str, str] = {}
for line in chunk:
    if "plugin:loaded" not in line:
        continue
    brace = line.find("{")
    if brace < 0:
        continue
    try:
        obj = json.loads(line[brace:])
        data = obj.get("data") or {}
        name = str(data.get("name") or "")
        ver = str(data.get("version") or "")
        if name and ver:
            loaded[name] = ver
    except Exception:
        m = re.search(
            r'"name"\s*:\s*"([^"]+)".*?"version"\s*:\s*"([^"]+)"',
            line,
        )
        if m:
            loaded[m.group(1)] = m.group(2)

print("[safe-update] loaded this boot:")
for n, v in sorted(loaded.items()):
    print(f"  {n}@{v}")

cfg = json.loads(Path("config/config.json").read_text())
required = [
    str(x).split("/")[-1].replace("@ursamu/", "")
    for x in (cfg.get("server") or {}).get("plugins") or []
]
alias = {
    "map-plugin": "map",
    "cofd-plugin": "cofd",
    "lang-plugin": "sgp-language-plugin",
    "help-plugin": "help",
    "mail-plugin": "mail",
    "jobs-plugin": "jobs",
    "channels": "@ursamu/channels",
}

missing = []
for pkg in required:
    runtime = alias.get(pkg, pkg)
    if runtime not in loaded and pkg not in loaded:
        if not any(runtime in k or pkg in k for k in loaded):
            missing.append(pkg)

if missing:
    print(
        "[safe-update] ERROR: plugins in config but not loaded:",
        ", ".join(missing),
        file=sys.stderr,
    )
    sys.exit(4)

errors = []
for key, want in expected.items():
    got = loaded.get(key)
    if got is None:
        continue
    # Upstream quirk: site@0.1.96 ships version: "0.1.95" in its
    # source, so the loaded plugin:loaded reports 0.1.95. Tolerate
    # a one-patch lag from the pin for site only.
    if got != want:
        if key == "site" and got == "0.1.95" and want == "0.1.96":
            continue
        errors.append(f"{key}: loaded {got}, expected {want}")

if errors:
    print("[safe-update] ERROR: version mismatch:", file=sys.stderr)
    for e in errors:
        print(f"  - {e}", file=sys.stderr)
    print(
        "[safe-update] Tip: check deno.json pins and that "
        "daemon uses --minimum-dependency-age=0",
        file=sys.stderr,
    )
    sys.exit(5)

print("[safe-update] plugin versions OK")
PY

grep -E "City of Roses main server is running|File cache ready|plugin:loaded|\\[wod20th\\]" \
  logs/main.log | tail -25 || true
log "done"