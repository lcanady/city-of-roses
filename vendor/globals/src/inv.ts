/**
 * +i / +inv <player> — see what another player is carrying.
 *
 * Visible to anyone for targets in the same room; staff (canEdit) bypass
 * the same-room restriction and also see opaque/dark items.
 *
 * Bare `+i` (no target) intentionally NOT handled here — the engine's stock
 * `inventory` system script (overridden by scripts/inventory.ts) covers self.
 */

import { addCmd, send } from "@ursamu/ursamu";
import type { IDBObj, IDBOBJ, IUrsamuSDK } from "@ursamu/ursamu";
import { header, footer, divider } from "./layout.ts";
import { coloredName } from "./namecolor.ts";
import { error, info } from "./messages.ts";
import { currentTheme } from "./theme.ts";

export async function execPlusInv(u: IUrsamuSDK): Promise<void> {
  const sid = u.socketId || "";
  const ref = u.util.stripSubs(u.cmd.args[0] ?? "").trim();
  if (!ref) { send([sid], error("Usage: +i <player>")); return; }

  const target = await u.util.target(u.me, ref, true);
  if (!target) { send([sid], error(`No one found matching '${ref}'.`)); return; }
  if (!target.flags.has("player")) {
    send([sid], error(`${u.util.displayName(target, u.me)} isn't a player.`));
    return;
  }

  const canEdit = await u.canEdit(u.me, target);
  const sameRoom = target.location && u.here && target.location === u.here.id;
  if (!sameRoom && !canEdit) {
    send([sid], error(`${u.util.displayName(target, u.me)} isn't here.`));
    return;
  }

  // Visibility filter: opaque/dark items are staff-only.
  const items = (target.contents ?? []).filter((o: IDBObj) =>
    canEdit ? true : !o.flags.has("dark") && !o.flags.has("opaque"),
  );

  const t = currentTheme();
  const title = `Carried by ${coloredName(target as unknown as IDBOBJ)}`;
  const lines: string[] = [];
  lines.push(await header(title, t));

  if (items.length === 0) {
    lines.push("  Nothing.");
  } else {
    for (const o of items) {
      const name = (o.state?.name as string) || o.name || "(unknown)";
      lines.push(`  ${name}`);
    }
  }
  lines.push(await divider(null, t));
  lines.push(
    `  ${items.length} item${items.length === 1 ? "" : "s"}.`,
  );
  lines.push(await footer(t));
  u.send(lines.join("\n"));
  if (!canEdit && items.length === 0) {
    u.send(info("(Staff-only items, if any, are hidden.)"));
  }
}

export function registerPlusInvCommand(): void {
  addCmd({
    name: "+i",
    pattern: /^\+(?:i|inv)(?:\s+(.*))?$/i,
    lock: "connected",
    category: "Social",
    help: `+i <player>  — See what another player is carrying.

Same-room targets are visible to anyone; staff can inspect any target,
including opaque/dark items. For your own inventory, use the standard
'inventory' command (no plus sign).

  +inv is an alias for +i.

Examples:
  +i Alice         List Alice's visible items.
  +inv Bob         Same thing.`,
    exec: execPlusInv,
  });
}
