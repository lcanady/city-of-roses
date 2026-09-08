/**
 * +glance — quick one-line-per-occupant scan of the room.
 *
 * Companion to look: shows display name + idle + short-desc for every
 * connected player in the room without any of the description/exits noise.
 */

import { addCmd } from "@ursamu/ursamu";
import type { IDBObj, IDBOBJ, IUrsamuSDK } from "@ursamu/ursamu";
import { divider }      from "./layout.ts";
import { coloredName }  from "./namecolor.ts";
import { info }         from "./messages.ts";
import { currentTheme } from "./theme.ts";

function fmtIdle(lastCommand: unknown): string {
  if (typeof lastCommand !== "number") return "---";
  const s = Math.floor((Date.now() - lastCommand) / 1000);
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function getShortDesc(obj: IDBObj): string {
  const attrs = (obj.state?.attributes as Array<{ name?: string; value?: string }> | undefined) ?? [];
  return attrs.find((a) =>
    a.name?.toLowerCase() === "short-desc" || a.name?.toLowerCase() === "shortdesc",
  )?.value ?? "";
}

export async function execGlance(u: IUrsamuSDK): Promise<void> {
  const here = u.here;
  if (!here) { u.send(info("You aren't anywhere.")); return; }

  const players = (here.contents ?? []).filter(
    (o: IDBObj) => o.flags.has("player") && o.flags.has("connected"),
  );

  const t = currentTheme();
  const lines: string[] = [];
  lines.push(await divider(`At a glance around ${here.name ?? "here"}`, t));

  if (players.length === 0) {
    lines.push("  No one else is here.");
  } else {
    for (const p of players) {
      const name = coloredName(p as unknown as IDBOBJ);
      const idle = fmtIdle(p.state?.lastCommand);
      const desc = getShortDesc(p);
      lines.push(` ${name.padEnd(28)} ${idle.padStart(4)}  ${desc}`);
    }
  }
  lines.push(await divider(null, t));
  u.send(lines.join("\n"));
}

export function registerGlanceCommand(): void {
  addCmd({
    name: "+glance",
    pattern: /^\+glance$/i,
    lock: "connected",
    category: "Social",
    help: `+glance  — One-line-per-occupant scan of the room.

Compact companion to look: shows each connected player's display name,
idle time, and short-desc, no room description or exits.

Examples:
  +glance          Show everyone here at a glance.`,
    exec: execGlance,
  });
}
