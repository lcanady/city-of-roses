/**
 * +motd — themed game-wide Message of the Day.
 *
 * Two scopes: `general` (visible to all) and `wizard` (staff only).
 * Both scopes are ordered lists; the display shows each entry numbered.
 *
 * Commands:
 *   +motd                            View the panel.
 *   +motd/set <scope>=<text>         Append an entry. (admin+)
 *   +motd/del <scope>=<n>            Remove entry #n in <scope>. (admin+)
 *   +motd/list                       Same as bare +motd, but explicit.
 *   +motd/reset <scope>              Wipe all entries in <scope>. (admin+)
 *
 * Storage: DBO `globals.motd` with rows
 *   { id, scope: "general"|"wizard", order: number, text: string,
 *     setter: string, ts: number }
 */

import { addCmd, DBO, send } from "@ursamu/ursamu";
import type { IUrsamuSDK } from "@ursamu/ursamu";
import { error, info, success, usage } from "./messages.ts";
import { divider, header, footer, wrap } from "./layout.ts";
import { currentTheme } from "./theme.ts";

export interface IMotdEntry {
  id:     string;
  scope:  "general" | "wizard";
  order:  number;
  text:   string;
  setter: string;
  ts:     number;
}

export const motdDb = new DBO<IMotdEntry>("globals.motd");

function isAdmin(u: IUrsamuSDK): boolean {
  const f = u.me.flags as unknown;
  if (!(f instanceof Set)) return false;
  return f.has("admin") || f.has("wizard") || f.has("superuser");
}

async function entriesByScope(scope: "general" | "wizard"): Promise<IMotdEntry[]> {
  const all = await motdDb.find({ scope });
  return [...all].sort((a, b) => a.order - b.order);
}

async function nextOrder(scope: "general" | "wizard"): Promise<number> {
  const list = await entriesByScope(scope);
  return list.length === 0 ? 1 : list[list.length - 1].order + 1;
}

async function renderMotd(u: IUrsamuSDK): Promise<void> {
  const t = currentTheme();
  const lines: string[] = [];
  lines.push(await header("Message of the Day", t));

  const general = await entriesByScope("general");
  if (general.length === 0) {
    lines.push("  No general MOTD set.");
  } else {
    for (const e of general) {
      const body = wrap(`${e.order}. ${e.text}`, t.width - 4, "  ");
      for (const l of body) lines.push(l);
    }
  }

  if (isAdmin(u)) {
    const wizard = await entriesByScope("wizard");
    lines.push(await divider("Staff Notes", t));
    if (wizard.length === 0) {
      lines.push("  No staff MOTD set.");
    } else {
      for (const e of wizard) {
        const body = wrap(`${e.order}. ${e.text}`, t.width - 4, "  ");
        for (const l of body) lines.push(l);
      }
    }
  }
  lines.push(await footer(t));
  u.send(lines.join("\n"));
}

function parseScope(s: string): "general" | "wizard" | null {
  const v = s.toLowerCase().trim();
  return v === "general" || v === "wizard" ? v : null;
}

export async function execMotd(u: IUrsamuSDK): Promise<void> {
  const sid = u.socketId || "";
  const sw  = (u.cmd.args[0] ?? "").toLowerCase().trim();
  const arg = (u.cmd.args[1] ?? "").trim();

  if (!sw || sw === "list") return renderMotd(u);

  if (!isAdmin(u)) { send([sid], error("Only staff may modify MOTD.")); return; }

  if (sw === "set") {
    const eq = arg.indexOf("=");
    if (eq === -1) { send([sid], usage("+motd/set <general|wizard>=<text>")); return; }
    const scope = parseScope(arg.slice(0, eq));
    const text  = u.util.stripSubs(arg.slice(eq + 1)).trim();
    if (!scope)  { send([sid], error("Scope must be 'general' or 'wizard'.")); return; }
    if (!text)   { send([sid], usage("+motd/set <general|wizard>=<text>")); return; }
    await motdDb.create({
      id: crypto.randomUUID(),
      scope, order: await nextOrder(scope), text,
      setter: u.me.id, ts: Date.now(),
    });
    send([sid], success(`Added entry to ${scope} MOTD.`));
    return;
  }

  if (sw === "del") {
    const eq = arg.indexOf("=");
    if (eq === -1) { send([sid], usage("+motd/del <general|wizard>=<n>")); return; }
    const scope = parseScope(arg.slice(0, eq));
    const n     = parseInt(arg.slice(eq + 1).trim(), 10);
    if (!scope || isNaN(n) || n < 1) {
      send([sid], usage("+motd/del <general|wizard>=<n>"));
      return;
    }
    const list = await entriesByScope(scope);
    const hit  = list.find((e) => e.order === n);
    if (!hit) { send([sid], error(`No entry #${n} in ${scope} MOTD.`)); return; }
    await motdDb.delete({ id: hit.id });
    send([sid], success(`Removed entry #${n} from ${scope} MOTD.`));
    return;
  }

  if (sw === "reset") {
    const scope = parseScope(arg);
    if (!scope) { send([sid], usage("+motd/reset <general|wizard>")); return; }
    const list = await entriesByScope(scope);
    for (const e of list) await motdDb.delete({ id: e.id });
    send([sid], success(`Wiped ${list.length} entr${list.length === 1 ? "y" : "ies"} from ${scope} MOTD.`));
    return;
  }

  send([sid], info("Switches: /set /del /list /reset"));
}

export function registerMotdCommand(): void {
  addCmd({
    name: "+motd",
    pattern: /^\+motd(?:\/(\S+))?(?:\s+(.*))?$/i,
    lock: "connected",
    category: "Info",
    help: `+motd[/<switch>] [<args>]  — Game-wide Message of the Day.

The general scope is visible to all; the wizard scope is staff-only.
Both are ordered lists — set appends, del removes by number, reset wipes
the whole scope.

Switches:
  /set <scope>=<text>     Append an entry to <scope> (admin+).
  /del <scope>=<n>        Remove entry #n in <scope> (admin+).
  /list                   Same as bare +motd.
  /reset <scope>          Wipe all entries in <scope> (admin+).

Examples:
  +motd                              View the panel.
  +motd/set general=Server reboot Sunday at 02:00 UTC.
  +motd/set wizard=Watch new player Alice (#42) for cheating.
  +motd/del general=2
  +motd/reset wizard`,
    exec: execMotd,
  });
}
